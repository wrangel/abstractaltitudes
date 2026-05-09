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

export async function handleImage(originalFolderPath, newName) {
  const parentDir = path.dirname(originalFolderPath);
  const newFolderPath = path.join(parentDir, newName);

  logger.info(`[${newName}]: Starting HDR image processing`);

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
      `[${newName}]: Confirm HDR file structure?\n` +
        `  - JPGs: ${jpgFiles.length} (Expected 5)\n` +
        `  - TIFFs: ${tiffFiles.length} (Expected 1)\n` +
        "Type 'Y' to proceed, 'N' to exit: ",
      (input) => {
        rl.close();
        resolve(input.trim().toLowerCase());
      },
    );
  });

  if (answer !== "y") {
    logger.error(`[${newName}]: User aborted processing.`);
    process.exit(1);
  }

  if (originalFolderPath !== newFolderPath) {
    await fs.rename(originalFolderPath, newFolderPath);
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
    await fs.rename(
      path.join(newFolderPath, file),
      path.join(originalPath, file),
    );
  }

  if (tiffFiles.length === 1) {
    const srcTiff = path.join(newFolderPath, tiffFiles[0]);
    const destTiff = path.join(modifiedPath, `${newName}.tiff`);
    await fs.rename(srcTiff, destTiff);

    const tempPngPath = path.join(s3Path, `${newName}_temp.png`);

    try {
      // Normalize and convert to PNG for processing
      await execFileAsync("magick", [
        destTiff,
        "-depth",
        "8",
        "-normalize",
        tempPngPath,
      ]);

      const image = sharp(tempPngPath);
      const metadata = await image.metadata();

      // GENERATE DEEP ZOOM TILES
      // This creates {newName}.dzi and {newName}_files/
      const dziOutputPath = path.join(s3Path, newName);
      await image
        .tile({
          size: 256,
          overlap: 1,
          layout: "dz",
          format: "jpeg",
          quality: 90,
        })
        .toFile(dziOutputPath);

      // GENERATE THUMBNAIL
      await image
        .webp({ lossless: false, quality: THUMBNAIL_QUALITY })
        .resize({
          width: THUMBNAIL_WIDTH,
          height: THUMBNAIL_HEIGHT,
          fit: "inside",
        })
        .toFile(path.join(s3Path, THUMBNAIL_FILENAME));

      await fs.unlink(tempPngPath);
      logger.info(`[${newName}]: ✅ HDR DZI and Thumbnail completed`);

      return {
        newFolderPath,
        originalWidth: metadata.width,
        originalHeight: metadata.height,
      };
    } catch (error) {
      logger.error(`[${newName}]: Processing failed`, error);
    }
  }

  return { newFolderPath, originalWidth: null, originalHeight: null };
}
