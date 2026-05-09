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

export async function handleWideAngle(originalFolderPath, newName) {
  const parentDir = path.dirname(originalFolderPath);
  const newFolderPath = path.join(parentDir, newName);

  logger.info(`[${newName}]: Starting wide-angle processing`);

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
      `[${newName}]: Confirm wide-angle structure?\n` +
        `  - DJI Main: ${djiFile || "MISSING"}\n` +
        `  - PANO Refs: ${panoFiles.length} (Expected 9)\n` +
        "Type 'Y' to proceed, 'N' to exit: ",
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

  await Promise.all([
    fs.mkdir(modifiedPath, { recursive: true }),
    fs.mkdir(originalPath, { recursive: true }),
    fs.mkdir(s3Path, { recursive: true }),
  ]);

  for (const file of panoFiles) {
    await fs.rename(
      path.join(newFolderPath, file),
      path.join(originalPath, file),
    );
  }

  if (djiFile) {
    const srcDji = path.join(newFolderPath, djiFile);
    const destDji = path.join(modifiedPath, `${newName}.jpg`);
    await fs.rename(srcDji, destDji);

    const tempPngPath = path.join(s3Path, `wa_${newName}_temp.png`);

    try {
      await execFileAsync("magick", [
        destDji,
        "-depth",
        "8",
        "-normalize",
        tempPngPath,
      ]);

      const image = sharp(tempPngPath);
      const metadata = await image.metadata();

      // GENERATE WIDE-ANGLE DEEP ZOOM TILES
      // Output: wa_{newName}.dzi and wa_{newName}_files/
      const dziOutputPath = path.join(s3Path, `wa_${newName}`);
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
      logger.info(`[${newName}]: ✅ Wide-angle DZI completed`);

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
