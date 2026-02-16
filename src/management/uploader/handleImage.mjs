// src/backend/management/uploader/handleImage.mjs

import fs from "fs/promises";
import path from "path";
import readline from "readline";
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
 * @returns {Promise<object>} folder path and image dimensions
 */
export async function handleImage(originalFolderPath, newName) {
  const parentDir = path.dirname(originalFolderPath);
  const newFolderPath = path.join(parentDir, newName);

  logger.info(`[${newName}]: Starting image processing`);

  // --- INTERACTIVE PREFLIGHT CHECK ---
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const files = await fs.readdir(newFolderPath);
  const jpgFiles = files.filter(
    (f) =>
      f.toLowerCase().endsWith(".jpg") || f.toLowerCase().endsWith(".jpeg"),
  );
  const tiffFiles = files.filter((f) => /\.tiff?$/i.test(f));

  const answer = await new Promise((resolve) => {
    rl.question(
      `[${newName}]: Can you confirm that the following components are present?\n` +
        `  - Exactly 5 JPG/JPEG files (found: ${jpgFiles.length})\n` +
        `  - Exactly 1 TIFF/TIF file (found: ${tiffFiles.length})\n` +
        "Type 'Y' to proceed, 'N' to exit: ",
      (input) => {
        rl.close();
        resolve(input.trim().toLowerCase());
      },
    );
  });

  if (answer !== "y") {
    logger.error(`[${newName}]: User did not confirm required files. Exiting.`);
    process.exit(1);
  }
  // --- End of interactive check ---

  if (originalFolderPath !== newFolderPath) {
    await fs.rename(originalFolderPath, newFolderPath);
    logger.info(
      `Renamed folder: '${originalFolderPath}' to '${newFolderPath}'`,
    );
  } else {
    logger.info(
      `No rename needed: '${originalFolderPath}' is already named '${newName}'`,
    );
  }

  const modifiedPath = path.join(newFolderPath, MODIFIED_FOLDER);
  const originalPath = path.join(newFolderPath, ORIGINAL_FOLDER);
  const s3Path = path.join(modifiedPath, S3_FOLDER);

  await Promise.all([
    fs.mkdir(modifiedPath, { recursive: true }),
    fs.mkdir(originalPath, { recursive: true }),
    fs.mkdir(s3Path, { recursive: true }),
  ]);

  for (const file of jpgFiles) {
    const src = path.join(newFolderPath, file);
    const dest = path.join(originalPath, file);
    await fs.rename(src, dest);
    logger.info(`Moved JPG file ${file} to ${originalPath}`);
  }

  if (tiffFiles.length !== 1) {
    logger.warn(`Expected exactly 1 TIFF file, found ${tiffFiles.length}`);
    return { newFolderPath, originalWidth: null, originalHeight: null };
  }

  let metadata = null;

  for (const tiffFile of tiffFiles) {
    const srcTiff = path.join(newFolderPath, tiffFile);
    const destTiff = path.join(modifiedPath, tiffFile);
    await fs.rename(srcTiff, destTiff);
    logger.info(`Moved TIFF file ${tiffFile} to ${modifiedPath}`);

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
      metadata = await image.metadata();

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

      const losslessWebpPath = path.join(s3Path, `${baseName}.webp`);
      await hrImage.webp({ lossless: true }).toFile(losslessWebpPath);

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

      await fs.unlink(tempPngPath);
      logger.info(`Completed TIFF to WebP conversion for ${tiffFile}`);
    } catch (error) {
      logger.error(
        `Error processing TIFF to WebP for file ${tiffFile}:`,
        error,
      );
    }
  }

  return metadata
    ? {
        newFolderPath,
        originalWidth: metadata.width,
        originalHeight: metadata.height,
      }
    : { newFolderPath, originalWidth: null, originalHeight: null };
}
