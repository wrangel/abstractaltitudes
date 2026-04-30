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
 * Berechnet die Flat-Levels für Marzipano basierend auf der Bildgröße.
 */
function calculateFlatLevels(width, height, tileSize = 512) {
  const levels = [];
  let currentWidth = width;
  let currentHeight = height;
  while (currentWidth > tileSize || currentHeight > tileSize) {
    levels.unshift({ width: currentWidth, height: currentHeight, tileSize });
    currentWidth = Math.round(currentWidth / 2);
    currentHeight = Math.round(currentHeight / 2);
  }
  levels.unshift({ width: currentWidth, height: currentHeight, tileSize });
  return levels;
}

export async function handleImage(originalFolderPath, newName) {
  const parentDir = path.dirname(originalFolderPath);
  const newFolderPath = path.join(parentDir, newName);

  logger.info(`[${newName}]: Starting image processing`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const files = await fs.readdir(originalFolderPath);
  const jpgFiles = files.filter((f) => /\.jpe?g$/i.test(f));
  const tiffFiles = files.filter((f) => /\.tiff?$/i.test(f));

  const answer = await new Promise((resolve) => {
    rl.question(
      `[${newName}]: Confirm components?\n` +
        `  - JPGs: ${jpgFiles.length} (Expected 5)\n` +
        `  - TIFFs: ${tiffFiles.length} (Expected 1)\n` +
        "Type 'Y' to proceed: ",
      (input) => {
        rl.close();
        resolve(input.trim().toLowerCase());
      },
    );
  });

  if (answer !== "y") {
    logger.error(`[${newName}]: User aborted.`);
    process.exit(1);
  }

  if (originalFolderPath !== newFolderPath) {
    await fs.rename(originalFolderPath, newFolderPath);
  }

  const modifiedPath = path.join(newFolderPath, MODIFIED_FOLDER);
  const originalPath = path.join(newFolderPath, ORIGINAL_FOLDER);
  const s3Path = path.join(modifiedPath, S3_FOLDER);
  const tilesPath = path.join(s3Path, "tiles");

  await Promise.all([
    fs.mkdir(modifiedPath, { recursive: true }),
    fs.mkdir(originalPath, { recursive: true }),
    fs.mkdir(s3Path, { recursive: true }),
    fs.mkdir(tilesPath, { recursive: true }),
  ]);

  for (const file of jpgFiles) {
    await fs.rename(
      path.join(newFolderPath, file),
      path.join(originalPath, file),
    );
  }

  let resultData = {
    newFolderPath,
    originalWidth: null,
    originalHeight: null,
    levels: null,
    viewer: "img",
  };

  if (tiffFiles.length === 1) {
    const tiffFile = tiffFiles[0];
    const destTiff = path.join(modifiedPath, `${newName}.tiff`);
    await fs.rename(path.join(newFolderPath, tiffFile), destTiff);

    const tempPngPath = path.join(s3Path, `${newName}_temp.png`);

    try {
      // 1. TIFF -> PNG (für Sharp Verarbeitung)
      logger.info(`[${newName}]: Converting TIFF to temporary PNG...`);
      await execFileAsync("magick", [
        destTiff,
        "-depth",
        "8",
        "-normalize",
        tempPngPath,
      ]);

      const image = sharp(tempPngPath);
      const metadata = await image.metadata();
      resultData.originalWidth = metadata.width;
      resultData.originalHeight = metadata.height;

      // 2. Tiles generieren (google layout -> z/y/x Struktur)
      logger.info(`[${newName}]: Generating tiles in ${tilesPath}...`);
      await sharp(tempPngPath)
        .tile({
          size: 512,
          layout: "google",
        })
        .toFile(tilesPath);

      resultData.levels = calculateFlatLevels(metadata.width, metadata.height);

      // 3. Thumbnail erstellen
      logger.info(`[${newName}]: Generating thumbnail...`);
      await image
        .clone()
        .resize({
          width: THUMBNAIL_WIDTH,
          height: THUMBNAIL_HEIGHT,
          fit: "inside",
        })
        .webp({ quality: THUMBNAIL_QUALITY })
        .toFile(path.join(s3Path, THUMBNAIL_FILENAME));

      // Cleanup
      await fs.unlink(tempPngPath);
      logger.info(`[${newName}]: Processing complete.`);
    } catch (error) {
      logger.error(`[${newName}]: Error:`, error);
    }
  }

  return resultData;
}
