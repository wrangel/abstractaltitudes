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
 * handleImage
 * Processes a TIFF file into Deep Zoom Tiles (DZI) and a WebP thumbnail.
 */
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
        `  - JPGs: ${jpgFiles.length}\n` +
        `  - TIFFs: ${tiffFiles.length}\n` +
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

  // Rename folder if necessary
  if (originalFolderPath !== newFolderPath) {
    await fs.rename(originalFolderPath, newFolderPath);
  }

  const modifiedPath = path.join(newFolderPath, MODIFIED_FOLDER);
  const originalPath = path.join(newFolderPath, ORIGINAL_FOLDER);
  const s3Path = path.join(modifiedPath, S3_FOLDER);

  // Create structure
  // Note: We no longer manually create a 'tiles' folder because
  // Sharp's DZI layout creates its own '{name}_files' directory.
  await Promise.all([
    fs.mkdir(modifiedPath, { recursive: true }),
    fs.mkdir(originalPath, { recursive: true }),
    fs.mkdir(s3Path, { recursive: true }),
  ]);

  // Move JPGs to the Original folder
  for (const file of jpgFiles) {
    await fs.rename(
      path.join(newFolderPath, file),
      path.join(originalPath, file),
    );
  }

  const resultData = {
    newFolderPath,
    originalWidth: null,
    originalHeight: null,
    levels: [], // DZI handles levels internally via the XML file
    viewer: "img",
  };

  if (tiffFiles.length === 1) {
    const tiffFile = tiffFiles[0];
    const destTiff = path.join(modifiedPath, `${newName}.tiff`);
    await fs.rename(path.join(newFolderPath, tiffFile), destTiff);

    const tempPngPath = path.join(s3Path, `${newName}_temp.png`);

    try {
      logger.info(`[${newName}]: Converting TIFF → PNG (Magick)`);

      // Conversion and normalization using ImageMagick
      await execFileAsync("magick", [
        destTiff,
        "-depth",
        "8",
        "-normalize",
        tempPngPath,
      ]);

      const image = sharp(tempPngPath);
      const metadata = await image.metadata();

      // Set metadata for DB entry
      resultData.originalWidth = metadata.width;
      resultData.originalHeight = metadata.height;

      logger.info(`[${newName}]: Generating Deep Zoom Tiles (DZI layout)`);

      /**
       * SHARP TILING STRATEGY:
       * layout: 'dzi' creates a .dzi XML file and a folder named ${newName}_files.
       * This is the native format for OpenSeadragon and eliminates 404 errors
       * caused by incorrect manual level mapping.
       */
      await sharp(tempPngPath)
        .tile({
          size: 512,
          layout: "dz", // Change "dzi" to "dz"
        })
        .toFile(path.join(s3Path, `${newName}`));

      logger.info(`[${newName}]: Generating webp thumbnail`);

      // Create WebP Thumbnail
      await image
        .clone()
        .resize({
          width: THUMBNAIL_WIDTH,
          height: THUMBNAIL_HEIGHT,
          fit: "inside",
        })
        .webp({ quality: THUMBNAIL_QUALITY })
        .toFile(path.join(s3Path, THUMBNAIL_FILENAME));

      // Cleanup temporary PNG
      await fs.unlink(tempPngPath);

      logger.info(`[${newName}]: Image processing completed successfully`);
    } catch (err) {
      logger.error(`[${newName}]: Processing failed`, err);
      throw err;
    }
  }

  return resultData;
}
