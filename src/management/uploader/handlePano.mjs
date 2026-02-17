// src/backend/management/uploader/handlePano.mjs

import fs from "fs/promises";
import path from "path";
import readline from "readline";
import AdmZip from "adm-zip";
import sharp from "sharp";
import logger from "../../backend/utils/logger.mjs";
import vm from "vm";
import {
  THUMBNAIL_WIDTH,
  THUMBNAIL_HEIGHT,
  THUMBNAIL_QUALITY,
  THUMBNAIL_FILENAME,
  MODIFIED_FOLDER,
  ORIGINAL_FOLDER,
  S3_FOLDER,
} from "../../backend/constants.mjs";

/**
 * Parse levels and initialViewParameters from data.js content by evaluating it.
 * @param {string} dataJsContent
 * @returns {{levels: any, initialViewParameters: any} | null}
 */
function parseDataJs(dataJsContent) {
  try {
    const script = new vm.Script(dataJsContent + "\nAPP_DATA;");
    const context = vm.createContext({});
    const APP_DATA = script.runInContext(context);

    if (
      APP_DATA &&
      APP_DATA.scenes &&
      APP_DATA.scenes.length > 0 &&
      APP_DATA.scenes[0]
    ) {
      const scene = APP_DATA.scenes[0];
      return {
        levels: scene.levels || null,
        initialViewParameters: scene.initialViewParameters || null,
      };
    }

    return null;
  } catch (err) {
    console.warn(`Failed to parse data.js using vm: ${err}`);
    return null;
  }
}

/**
 * Manage panorama folder: move files, extract ZIP, create thumbnail, parse metadata.
 * @param {string} mediaFolderPath
 * @param {string} folderName
 * @returns {Promise<{levels: any, initialViewParameters: any} | null>}
 */
export async function handlePano(mediaFolderPath, folderName) {
  const modifiedPath = path.join(mediaFolderPath, MODIFIED_FOLDER);
  const originalPath = path.join(mediaFolderPath, ORIGINAL_FOLDER);
  const s3Folder = path.join(modifiedPath, S3_FOLDER);
  const zipPath = path.join(modifiedPath, "project-title.zip");

  logger.info(`[${folderName}]: Starting pano processing`);

  // --- INTERACTIVE PREFLIGHT CHECK ---
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise((resolve) => {
    rl.question(
      `[${folderName}]: Can you confirm that the following components are present?\n` +
        "  - 32 JPG files\n" +
        "  - PANO_0001 Panorama.jpg\n" +
        "  - project-title.zip\n" +
        "Type 'Y' to proceed, 'N' to exit: ",
      (input) => {
        rl.close();
        resolve(input.trim().toLowerCase());
      },
    );
  });

  if (answer !== "y") {
    logger.error(
      `[${folderName}]: User did not confirm required files. Exiting.`,
    );
    process.exit(1);
  }
  // --- End of interactive check ---

  // Ensure modified and original folders exist
  await fs.mkdir(modifiedPath, { recursive: true });
  await fs.mkdir(originalPath, { recursive: true });

  const rootFiles = await fs.readdir(mediaFolderPath);

  // Single regex to match both originals and previews with any extension
  const panoRegex = /^(.+?)_(\d{4})( Panorama)?\.[^.]+$/i;

  // Process files: split originals (no Panorama) and previews (with Panorama)
  for (const file of rootFiles) {
    const match = file.match(panoRegex);
    if (!match) continue;

    const [, base, index, panoramaSuffix] = match;
    const src = path.join(mediaFolderPath, file);

    if (panoramaSuffix) {
      // ' Panorama' present - preview file => move to modified folder
      const dest = path.join(modifiedPath, file);
      await fs.rename(src, dest);
      logger.info(
        `[${folderName}]: Moved preview file ${file} to modified folder`,
      );
    } else {
      // No ' Panorama' - original file => move to original folder
      const dest = path.join(originalPath, file);
      await fs.rename(src, dest);
      logger.info(
        `[${folderName}]: Moved original file ${file} to original folder`,
      );
    }
  }

  // Special handling of .pts files (already moved above if matched in panoRegex),
  // but if there are any outside this pattern, ensure to move .pts files anyway
  const ptsFiles = rootFiles.filter(
    (f) => f.toLowerCase().endsWith(".pts") && !panoRegex.test(f),
  );
  for (const file of ptsFiles) {
    const src = path.join(mediaFolderPath, file);
    const dest = path.join(modifiedPath, file);
    await fs.rename(src, dest);
    logger.info(`[${folderName}]: Moved pts file ${file} to modified folder`);
  }

  // Move project-title.zip to modified folder if present and not already moved
  if (rootFiles.includes("project-title.zip")) {
    const src = path.join(mediaFolderPath, "project-title.zip");
    const dest = path.join(modifiedPath, "project-title.zip");
    if (src !== dest) {
      await fs.rename(src, dest);
      logger.info(
        `[${folderName}]: Moved project-title.zip to modified folder`,
      );
    }
  }

  // Proceed with extracting ZIP and processing tiles as before
  const extractPath = path.join(s3Folder, "project-title-extract-temp");

  try {
    logger.info(`[${folderName}]: Checking ZIP file at ${zipPath}`);
    const stat = await fs.stat(zipPath);
    if (!stat.isFile() || stat.size === 0) {
      logger.warn(
        `[${folderName}]: ZIP file is missing or empty. Skipping pano.`,
      );
      return null;
    }

    logger.info(`[${folderName}]: Extracting ZIP to ${extractPath}`);
    try {
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(extractPath, true);
    } catch (zipError) {
      logger.error(
        `[${folderName}]: Error extracting ZIP file: ${zipError.message}`,
        zipError,
      );
      throw zipError;
    }
    logger.info(`[${folderName}]: ZIP extraction completed`);

    // Move tiles folder to s3/tiles
    const originalTilesBase = path.join(extractPath, "app-files", "tiles");
    const subfolders = (
      await fs.readdir(originalTilesBase, { withFileTypes: true })
    ).filter((d) => d.isDirectory());

    if (subfolders.length !== 1) {
      logger.warn(
        `[${folderName}]: Expected exactly one subfolder in tiles, found ${subfolders.length}. Skipping tiles move.`,
      );
    } else {
      const singleTileSubfolder = path.join(
        originalTilesBase,
        subfolders[0].name,
      );
      const s3TilesDest = path.join(s3Folder, "tiles");

      try {
        await fs.rm(s3TilesDest, { recursive: true, force: true });
        logger.info(`[${folderName}]: Deleted existing s3/tiles folder`);
      } catch (err) {
        logger.warn(
          `[${folderName}]: Could not delete existing s3/tiles folder: ${err.message}`,
        );
      }

      await fs.rename(singleTileSubfolder, s3TilesDest);
      logger.info(`[${folderName}]: Moved and renamed tiles to s3/tiles`);

      try {
        await fs.rm(originalTilesBase, { recursive: true, force: true });
        logger.info(`[${folderName}]: Deleted extracted tiles base folder`);
      } catch (err) {
        logger.warn(
          `[${folderName}]: Could not delete extracted tiles base folder: ${err.message}`,
        );
      }
    }

    // Parse data.js file for levels and initialViewParameters
    const dataJsPath = path.join(extractPath, "app-files", "data.js");
    let extractedProperties = null;
    try {
      const dataJsContent = await fs.readFile(dataJsPath, "utf8");
      extractedProperties = parseDataJs(dataJsContent);
      if (extractedProperties) {
        logger.info(
          `[${folderName}]: Extracted levels and initialViewParameters from data.js`,
        );
      } else {
        logger.warn(
          `[${folderName}]: Failed to extract levels or initialViewParameters from data.js`,
        );
      }
    } catch (err) {
      logger.warn(`[${folderName}]: Could not read data.js: ${err.message}`);
    }

    // Remove extraction temporary folder
    try {
      await fs.rm(extractPath, { recursive: true, force: true });
      logger.info(`[${folderName}]: Deleted project-title extraction folder`);
    } catch (err) {
      logger.warn(
        `[${folderName}]: Could not delete extraction folder: ${err.message}`,
      );
    }

    // Create thumbnail.webp from first JPG/JPEG in modified folder
    const modifiedFiles = await fs.readdir(modifiedPath);
    const jpgFile = modifiedFiles.find((f) => /\.(jpe?g)$/i.test(f));
    if (!jpgFile) {
      logger.warn(
        `[${folderName}]: No JPG found in modified folder for thumbnail`,
      );
      return extractedProperties;
    }
    const inputPath = path.join(modifiedPath, jpgFile);
    const thumbnailPath = path.join(s3Folder, THUMBNAIL_FILENAME);
    logger.info(`[${folderName}]: Creating thumbnail.webp at ${thumbnailPath}`);
    await sharp(inputPath)
      .resize({
        width: THUMBNAIL_WIDTH,
        height: THUMBNAIL_HEIGHT,
        fit: "inside",
        position: sharp.strategy.attention,
      })
      .webp({ quality: THUMBNAIL_QUALITY })
      .toFile(thumbnailPath);
    logger.info(`[${folderName}]: Created thumbnail.webp successfully`);

    return extractedProperties;
  } catch (err) {
    logger.error(
      `[${folderName}]: Error in handlePano processing: ${err.message}`,
      err,
    );
    throw err;
  }
}
