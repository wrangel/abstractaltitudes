// src/backend/management/uploader/handleWideAngle.mjs

import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import logger from "../../backend/utils/logger.mjs";
import { MEDIA_PREFIXES } from "./constants.mjs";

/**
 * Process wide-angle media folder with 10 JPEGs (1 DJI + 9 PANO files).
 * - Moves 9 PANO files to original/
 * - Processes DJI file: copies to modified/, converts to wa_*.webp
 * @param {string} folderPath - Full path to media folder
 * @param {string} newName - New folder name for metadata
 * @returns {Promise<{originalWidth: number, originalHeight: number}|null>} Image dimensions or null on failure
 */
export async function handleWideAngle(folderPath, newName) {
  logger.info(`handleWideAngle: Processing ${folderPath}`);

  try {
    // Count JPEGs in folder
    const files = await fs.readdir(folderPath);
    const jpegFiles = files.filter((file) =>
      file.toLowerCase().endsWith(".jpg"),
    );

    logger.debug(`Found ${jpegFiles.length} JPEG files`);

    if (jpegFiles.length !== 10) {
      logger.warn(
        `handleWideAngle: Expected 10 JPEGs, found ${jpegFiles.length}`,
      );
      return null;
    }

    // Find DJI file (longer name: DJI_YYYYMMDDHHMMSS_NNNN_D.JPG) and 9 PANO files
    const djiFile = jpegFiles.find((file) => file.startsWith("DJI_"));
    const panoFiles = jpegFiles.filter((file) => !file.startsWith("DJI_"));

    if (!djiFile || panoFiles.length !== 9) {
      logger.warn(
        `handleWideAngle: Invalid pattern - need 1 DJI (${djiFile ? "found" : "missing"}) + 9 PANO (${panoFiles.length} found)`,
      );
      return null;
    }

    // Ensure original/ and modified/ directories exist
    const originalDir = path.join(folderPath, "original");
    const modifiedDir = path.join(folderPath, "modified");

    await fs.mkdir(originalDir, { recursive: true });
    await fs.mkdir(modifiedDir, { recursive: true });

    // Copy 9 PANO files to original/
    logger.debug(`Copying ${panoFiles.length} PANO files to original/`);
    for (const panoFile of panoFiles) {
      const src = path.join(folderPath, panoFile);
      const dest = path.join(originalDir, panoFile);
      await fs.copyFile(src, dest);
    }

    // Process DJI file
    const djiSrc = path.join(folderPath, djiFile);
    const djiDest = path.join(modifiedDir, djiFile);

    // Copy original JPG to modified/
    await fs.copyFile(djiSrc, djiDest);
    logger.debug(`Copied DJI file: ${djiFile}`);

    // Convert to WebP with wa_ prefix using Sharp
    const baseName = path.basename(djiFile, path.extname(djiFile));
    const webpName = `${MEDIA_PREFIXES.wide_angle}${baseName}.webp`;
    const webpDest = path.join(modifiedDir, webpName);

    const metadata = await sharp(djiSrc).metadata();
    await sharp(djiSrc)
      .resize(1920, 1080, { fit: "cover", position: "center" })
      .webp({ quality: 80 })
      .toFile(webpDest);

    logger.info(
      `handleWideAngle: Created ${webpName} (${metadata.width}x${metadata.height})`,
    );

    // Return dimensions for metadata
    return {
      originalWidth: metadata.width,
      originalHeight: metadata.height,
    };
  } catch (error) {
    logger.error(`handleWideAngle failed for ${folderPath}:`, { error });
    return null;
  }
}
