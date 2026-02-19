// src/backend/management/uploader/handleWideAngle.mjs

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
 * Processes wide-angle media folder containing exactly 10 JPEG files:
 * - 1x DJI_*.JPG (main image, equivalent to TIFF in handleImage)
 * - 9x PANO_*.JPG (reference images)
 *
 * Workflow (IDENTICAL to handleImage, DJI JPG replaces TIFF):
 * 1. Interactive user confirmation of file structure
 * 2. Rename folder to metadata name if needed
 * 3. Create original/, modified/, modified/S3/ directories
 * 4. Move 9x PANO JPGs → original/
 * 5. Move 1x DJI JPG → modified/
 * 6. DJI JPG → PNG (magick) → lossless wa_*.webp + thumbnail.webp (S3/)
 *
 * @param {string} originalFolderPath - Path to folder BEFORE renaming
 * @param {string} newName - New folder name from collectMetadata
 * @returns {Promise<{
 *   newFolderPath: string,
 *   originalWidth: number|null,
 *   originalHeight: number|null
 * }>} Folder path and original image dimensions
 */
export async function handleWideAngle(originalFolderPath, newName) {
  const parentDir = path.dirname(originalFolderPath);
  const newFolderPath = path.join(parentDir, newName);

  logger.info(`[${newName}]: Starting wide-angle processing`);

  // ========================================================================
  // INTERACTIVE PREFLIGHT CHECK - CONFIRM FILE STRUCTURE
  // ========================================================================
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const files = await fs.readdir(newFolderPath);
  const jpgFiles = files.filter(
    (f) =>
      f.toLowerCase().endsWith(".jpg") || f.toLowerCase().endsWith(".jpeg"),
  );

  const djiFile = jpgFiles.find((f) => f.startsWith("DJI_"));
  const panoFiles = jpgFiles.filter((f) => !f.startsWith("DJI_"));

  const answer = await new Promise((resolve) => {
    rl.question(
      `[${newName}]: Confirm wide-angle file structure?\n` +
        `  • Exactly 10 JPG files (found: ${jpgFiles.length})\n` +
        `  • DJI main image: ${djiFile || "MISSING"}\n` +
        `  • 9x PANO refs: ${panoFiles.length} files\n` +
        `Type 'Y' to proceed, 'N' to exit: `,
      (input) => {
        rl.close();
        resolve(input.trim().toLowerCase());
      },
    );
  });

  if (answer !== "y") {
    logger.error(`[${newName}]: User cancelled wide-angle processing`);
    process.exit(1);
  }

  // ========================================================================
  // FOLDER RENAME (IDENTICAL TO handleImage)
  // ========================================================================
  if (originalFolderPath !== newFolderPath) {
    await fs.rename(originalFolderPath, newFolderPath);
    logger.info(
      `[${newName}]: Renamed folder → ${path.basename(newFolderPath)}`,
    );
  } else {
    logger.info(`[${newName}]: Folder name already correct`);
  }

  // ========================================================================
  // CREATE DIRECTORY STRUCTURE
  // ========================================================================
  const modifiedPath = path.join(newFolderPath, MODIFIED_FOLDER);
  const originalPath = path.join(newFolderPath, ORIGINAL_FOLDER);
  const s3Path = path.join(modifiedPath, S3_FOLDER);

  await Promise.all([
    fs.mkdir(modifiedPath, { recursive: true }),
    fs.mkdir(originalPath, { recursive: true }),
    fs.mkdir(s3Path, { recursive: true }),
  ]);

  logger.info(`[${newName}]: Created folder structure`);

  // ========================================================================
  // MOVE 9x PANO REFERENCE IMAGES → original/
  // ========================================================================
  for (const file of panoFiles) {
    const src = path.join(newFolderPath, file);
    const dest = path.join(originalPath, file);
    await fs.rename(src, dest);
    logger.debug(`[${newName}]: PANO ${file} → ${ORIGINAL_FOLDER}/`);
  }

  logger.info(
    `[${newName}]: Moved ${panoFiles.length}x PANO files → ${ORIGINAL_FOLDER}/`,
  );

  // ========================================================================
  // PROCESS DJI MAIN IMAGE (TIFF EQUIVALENT)
  // ========================================================================
  if (!djiFile) {
    logger.warn(`[${newName}]: Missing DJI main image file`);
    return { newFolderPath, originalWidth: null, originalHeight: null };
  }

  let metadata = null;

  const srcDji = path.join(newFolderPath, djiFile);
  const destDji = path.join(modifiedPath, djiFile);
  await fs.rename(srcDji, destDji);
  logger.info(`[${newName}]: DJI ${djiFile} → ${MODIFIED_FOLDER}/`);

  // **IDENTICAL PROCESSING PIPELINE AS TIFF IN handleImage**
  const baseName = path.parse(djiFile).name;
  const tempPngPath = path.join(s3Path, `${baseName}_temp.png`);

  try {
    // Step 1: DJI JPG → normalized PNG (magick, same as TIFF)
    await execFileAsync("magick", [
      destDji,
      "-depth",
      "8",
      "-normalize",
      tempPngPath,
    ]);
    logger.info(`[${newName}]: DJI JPG → PNG: ${path.basename(tempPngPath)}`);

    // Step 2: Extract metadata
    const image = sharp(tempPngPath);
    metadata = await image.metadata();

    // Step 3: High-res lossless WebP (wa_ prefix) with 16k limit
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
      logger.info(`[${newName}]: Resized to ${newWidth}x${newHeight}`);
    }

    const losslessWebpPath = path.join(s3Path, `wa_${baseName}.webp`);
    await hrImage.webp({ lossless: true }).toFile(losslessWebpPath);
    logger.info(
      `[${newName}]: Created wa_${baseName}.webp (${metadata.width}x${metadata.height})`,
    );

    // Step 4: Thumbnail WebP (IDENTICAL to handleImage)
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
    logger.info(`[${newName}]: Created thumbnail ${THUMBNAIL_FILENAME}`);

    // Cleanup
    await fs.unlink(tempPngPath);
    logger.info(`[${newName}]: ✅ Completed wide-angle processing`);
  } catch (error) {
    logger.error(`[${newName}]: DJI processing failed:`, error);
    if (fs.existsSync(tempPngPath))
      await fs.unlink(tempPngPath).catch(() => {});
  }

  // ========================================================================
  // RETURN METADATA (SAME FORMAT AS handleImage)
  // ========================================================================
  return metadata
    ? {
        newFolderPath,
        originalWidth: metadata.width,
        originalHeight: metadata.height,
      }
    : {
        newFolderPath,
        originalWidth: null,
        originalHeight: null,
      };
}
