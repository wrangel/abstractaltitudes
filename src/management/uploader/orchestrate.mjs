// src/backend/management/uploader/orchestrate.mjs

import { readdir } from "fs/promises";
import path from "path";
import logger from "../../backend/utils/logger.mjs";
import { connectDB, closeDB } from "../../backend/utils/mongodbConnection.mjs";

import { collectMetadata } from "./collectMetadata.mjs";
import { handleFolder } from "./handleFolder.mjs";
import { handleImage } from "./handleImage.mjs";
import { handlePano } from "./handlePano.mjs";
import { uploadMetadata } from "./uploadMetadata.mjs";
import { uploadMedia } from "./uploadMedia.mjs";
import { convertThenArchive } from "./archive.mjs";

const DRY_RUN = process.env.NODE_DRY_RUN === "1";

/**
 * Orchestrate processing of multiple media folders.
 * Connects to MongoDB, processes folders, uploads metadata and media,
 * and closes the DB connection when finished or on errors.
 */
export async function orchestrate() {
  try {
    await connectDB();
    logger.info("MongoDB connected");

    const baseDir = process.env.INPUT_DIRECTORY;
    const entries = await readdir(baseDir, { withFileTypes: true });
    const mediaFolders = entries
      .filter((ent) => ent.isDirectory())
      .map((dir) => path.join(baseDir, dir.name));

    if (mediaFolders.length === 0) {
      logger.info("No media folders to process.");
      return;
    }

    logger.info(`Found ${mediaFolders.length} media folders.`);

    for (const mediaDirPath of mediaFolders) {
      logger.info(`Processing folder: ${mediaDirPath}`);
      try {
        // Collect metadata info about media in folder
        const processed = await collectMetadata(mediaDirPath);
        if (!processed || !processed.metadata) {
          logger.warn(`No metadata returned for ${mediaDirPath}, skipping.`);
          continue;
        }

        const mediaType = processed.metadata.type;
        const newName = processed.metadata.name;

        // Rename folder to new name before processing media files
        const newFolderPath = await handleFolder(mediaDirPath, newName);

        let panoExtraProps = null;

        // Branch handling based on media type
        if (mediaType === "hdr" || mediaType === "wide_angle") {
          await handleImage(newFolderPath, newName);
          const imageData = await handleImage(newFolderPath, newName);
          if (imageData) {
            processed.metadata.originalWidth = imageData.originalWidth;
            processed.metadata.originalHeight = imageData.originalHeight;
          }
        } else if (mediaType === "pano") {
          panoExtraProps = await handlePano(newFolderPath, newName);
        } else {
          logger.warn(`Unknown media type: ${mediaType}`);
        }

        // Merge pano-specific properties if any
        if (panoExtraProps) {
          processed.metadata.levels = panoExtraProps.levels || null;
          processed.metadata.initialViewParameters =
            panoExtraProps.initialViewParameters || null;
        }

        // Upload metadata to MongoDB
        if (!DRY_RUN) await uploadMetadata(processed.metadata);

        logger.info(`Completed processing for folder: ${mediaDirPath}`);

        // Upload media files to S3
        if (!DRY_RUN) await uploadMedia(newFolderPath, newName);

        // Archive media files
        // TODO Test first -- await convertThenArchive(newFolderPath, newName);
      } catch (error) {
        logger.error(`Error processing folder ${mediaDirPath}`, { error });
      }
    }
  } catch (err) {
    logger.error("Failed MongoDB connection or orchestration:", err);
    throw err;
  } finally {
    // Always close DB connection after completion or error
    await closeDB();
  }
}

// Auto launch orchestration process with global error catch
orchestrate().catch((err) => {
  logger.error("Uncaught error in orchestrator:", { error: err });
});
