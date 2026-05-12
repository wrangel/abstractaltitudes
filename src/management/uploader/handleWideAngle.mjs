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

export async function handleWideAngle(originalFolderPath, newName) {
  const parentDir = path.dirname(originalFolderPath);
  const newFolderPath = path.join(parentDir, newName);

  logger.info(`[${newName}]: Starting wide-angle processing`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // 1. Read files and filter for BOTH JPG and TIFF
  const files = await fs.readdir(originalFolderPath);
  const imageFiles = files.filter((f) => /\.(jpe?g|tiff?)$/i.test(f));

  // Find the DJI source - Prioritize TIFF if both exist
  const djiFile =
    imageFiles.find(
      (f) => f.startsWith("DJI_") && f.toLowerCase().endsWith(".tif"),
    ) || imageFiles.find((f) => f.startsWith("DJI_"));

  // This automatically grabs every image that ISN'T the main DJI file
  const panoFiles = imageFiles.filter((f) => f !== djiFile);

  const answer = await new Promise((resolve) => {
    rl.question(
      `[${newName}]: Confirm wide-angle structure?\n` +
        `  - DJI Main Source: ${djiFile || "MISSING"}\n` +
        `  - PANO Refs Found: ${panoFiles.length}\n` + // Dynamically reports 9, 15, etc.
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

  // 2. Rename the top-level folder if necessary
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

  // 3. Move ALL reference files to original/ (handles any number of images)
  for (const file of panoFiles) {
    await fs.rename(
      path.join(newFolderPath, file),
      path.join(originalPath, file),
    );
  }

  if (djiFile) {
    const srcDji = path.join(newFolderPath, djiFile);
    const ext = path.extname(djiFile);
    const destDji = path.join(modifiedPath, `${newName}${ext}`);

    await fs.rename(srcDji, destDji);

    try {
      // Initialize Sharp: Flatten handles TIFF transparency, Normalize handles contrast
      const pipeline = sharp(destDji)
        .flatten({ background: "#ffffff" })
        .normalize();

      const metadata = await pipeline.metadata();

      // 4. GENERATE DEEP ZOOM TILES (Standardized to JPEG for web)
      const dziOutputPath = path.join(s3Path, newName);

      await pipeline
        .clone()
        .tile({
          size: 256,
          overlap: 1,
          layout: "dz",
          format: "jpeg",
          quality: 90,
        })
        .toFile(dziOutputPath);

      // 5. GENERATE WEB CONTENT THUMBNAIL
      await pipeline
        .clone()
        .webp({ lossless: false, quality: THUMBNAIL_QUALITY })
        .resize({
          width: THUMBNAIL_WIDTH,
          height: THUMBNAIL_HEIGHT,
          fit: "inside",
        })
        .toFile(path.join(s3Path, THUMBNAIL_FILENAME));

      logger.info(
        `[${newName}]: ✅ Processed ${panoFiles.length + 1} total images.`,
      );

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
