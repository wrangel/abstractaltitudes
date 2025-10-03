// src/backend/management/uploader/handleImage.mjs

import fs from "fs/promises";
import path from "path";
import logger from "../../backend/utils/logger.mjs";
import {
  THUMBNAIL_WIDTH,
  THUMBNAIL_HEIGHT,
  THUMBNAIL_QUALITY,
  THUMBNAIL_FILENAME,
  MODIFIED_FOLDER,
  ORIGINAL_FOLDER,
  S3_FOLDER,
} from "../../backend/constants.mjs";
import sharp from "sharp";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/**
 * Renames a folder to newName.
 * Moves JPG files to the original folder.
 * Moves TIFF files to the modified folder,
 * then converts TIFF to lossless and thumbnail WebP images in modified/S3.
 *
 * @param {string} originalFolderPath
 * @param {string} newName
 * @returns {Promise<string>} The path to the processed folder.
 */
export async function handleImage(originalFolderPath, newName) {
  const parentDir = path.dirname(originalFolderPath);
  const newFolderPath = path.join(parentDir, newName);

  // Rename folder if needed
  if (originalFolderPath !== newFolderPath) {
    await fs.rename(originalFolderPath, newFolderPath);
    logger.info(
      `Renamed folder: '${originalFolderPath}' to '${newFolderPath}'`
    );
  } else {
    logger.info(
      `No rename needed: '${originalFolderPath}' is already named '${newName}'`
    );
  }

  // Define paths for subfolders
  const modifiedPath = path.join(newFolderPath, MODIFIED_FOLDER);
  const originalPath = path.join(newFolderPath, ORIGINAL_FOLDER);
  const s3Path = path.join(modifiedPath, S3_FOLDER);

  // Create all required subfolders unconditionally
  await Promise.all([
    fs.mkdir(modifiedPath, { recursive: true }),
    fs.mkdir(originalPath, { recursive: true }),
    fs.mkdir(s3Path, { recursive: true }),
  ]);

  // Read all files in the new folder root
  const files = await fs.readdir(newFolderPath);

  // Move JPG/JPEG files to original folder if any
  const jpgFiles = files.filter(
    (f) => f.toLowerCase().endsWith(".jpg") || f.toLowerCase().endsWith(".jpeg")
  );
  for (const file of jpgFiles) {
    const src = path.join(newFolderPath, file);
    const dest = path.join(originalPath, file);
    await fs.rename(src, dest);
    logger.info(`Moved JPG file ${file} to ${originalPath}`);
  }

  // Move TIFF files (handle all TIFF files, process each)
  const tiffFiles = files.filter((f) => /\.tiff?$/i.test(f));
  if (tiffFiles.length === 0) {
    logger.warn(`No TIFF files found in ${newFolderPath}`);
  } else {
    for (const tiffFile of tiffFiles) {
      const srcTiff = path.join(newFolderPath, tiffFile);
      const destTiff = path.join(modifiedPath, tiffFile);
      await fs.rename(srcTiff, destTiff);
      logger.info(`Moved TIFF file ${tiffFile} to ${modifiedPath}`);

      // Convert each TIFF to PNG then WebP lossless and thumbnail in modified/S3
      const baseName = path.parse(tiffFile).name;
      const tempPngPath = path.join(s3Path, `${baseName}_temp.png`);
      try {
        await execFileAsync("magick", [
          destTiff,
          "-depth",
          "8",
          "-normalize",
          tempPngPath,
        ]);
        logger.info(`Converted TIFF to PNG: ${tempPngPath}`);

        const image = sharp(tempPngPath);
        const metadata = await image.metadata();

        // Resize if dimensions exceed WebP max size (16383)
        let hrImage = image;
        if (metadata.width > 16383 || metadata.height > 16383) {
          const aspectRatio = metadata.width / metadata.height;
          let newWidth = Math.min(metadata.width, 16383);
          let newHeight = Math.round(newWidth / aspectRatio);
          if (newHeight > 16383) {
            newHeight = 16383;
            newWidth = Math.round(newHeight * aspectRatio);
          }
          hrImage = image.resize(newWidth, newHeight, { fit: "inside" });
        }

        // Write lossless WebP file
        const losslessWebpPath = path.join(s3Path, `${baseName}.webp`);
        await hrImage.webp({ lossless: true }).toFile(losslessWebpPath);

        // Write thumbnail WebP file
        const thumbnailWebpPath = path.join(s3Path, THUMBNAIL_FILENAME);

        const tnImage = image
          .webp({ lossless: false, quality: THUMBNAIL_QUALITY })
          .resize({
            width: THUMBNAIL_WIDTH,
            height: THUMBNAIL_HEIGHT,
            fit: "inside",
            position: sharp.strategy.attention,
          });
        await tnImage.toFile(thumbnailWebpPath);

        // Clean up temp PNG
        await fs.unlink(tempPngPath);

        logger.info(`Completed TIFF to WebP conversion for ${tiffFile}`);
      } catch (error) {
        logger.error(
          `Error processing TIFF to WebP for file ${tiffFile}:`,
          error
        );
      }
    }
  }

  return {
    newFolderPath,
    originalWidth: metadata.width,
    originalHeight: metadata.height,
  };
}
