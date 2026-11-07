// src/backend/management/keepBooks.mjs

import {
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { storageClient as s3Client, STORAGE_BUCKET } from "./storage.mjs";
import logger from "../backend/utils/logger.mjs";
import { Island } from "../backend/models/islandModel.mjs";
import { executeMongoQuery } from "../backend/utils/mongoUtils.mjs";
import { connectDB, closeDB } from "../backend/utils/mongodbConnection.mjs";


/**
 * List top-level folder prefixes in an S3 bucket.
 * @param {string} bucketName
 * @returns {Promise<string[]>} Array of top-level folder names (prefixes without trailing slash).
 */
async function listTopLevelFolders(bucketName) {
  const command = new ListObjectsV2Command({
    Bucket: bucketName,
    Delimiter: "/", // group objects by top-level "folders"
  });
  const response = await s3Client.send(command);
  const prefixes = response.CommonPrefixes || [];
  return prefixes.map((p) => p.Prefix.replace(/\/$/, ""));
}

/**
 * Delete all objects under the given folder prefixes in an S3 bucket.
 * Handles paging if folder contains many objects.
 *
 * @param {string} bucketName
 * @param {string[]} folders - folder prefixes to delete.
 */
async function deleteS3Folders(bucketName, folders) {
  if (folders.length === 0) {
    logger.info("No S3 folders to delete.");
    return;
  }

  for (const folder of folders) {
    logger.info(`Deleting S3 folder and all contents: ${folder}/`);

    let continuationToken = undefined;
    do {
      const listCommand = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: folder + "/",
        ContinuationToken: continuationToken,
      });
      const listResponse = await s3Client.send(listCommand);

      continuationToken = listResponse.IsTruncated
        ? listResponse.NextContinuationToken
        : undefined;

      if (listResponse.Contents && listResponse.Contents.length > 0) {
        const deleteParams = {
          Bucket: bucketName,
          Delete: {
            Objects: listResponse.Contents.map((obj) => ({ Key: obj.Key })),
            Quiet: false,
          },
        };
        const deleteCommand = new DeleteObjectsCommand(deleteParams);
        await s3Client.send(deleteCommand);
      }
    } while (continuationToken);
  }
}

/**
 * Main function:
 * Sync S3 folder prefixes with MongoDB Island documents.
 * Deletes orphaned S3 folders that don't have a Mongo document.
 */
async function main() {
  try {
    await connectDB();
    logger.info("MongoDB connected");

    const s3Folders = await listTopLevelFolders(STORAGE_BUCKET);
    const mongoDocs = await executeMongoQuery(
      () => Island.find().lean(),
      "Island"
    );

    const s3Set = new Set(s3Folders);
    const mongoSet = new Set(mongoDocs.map((doc) => doc.name));

    const s3Only = s3Folders.filter((folder) => !mongoSet.has(folder));
    const mongoOnly = mongoDocs
      .filter((doc) => !s3Set.has(doc.name))
      .map((doc) => doc.name);

    logger.info("Folders only in S3 (no matching Mongo document):", s3Only);
    logger.info("Documents only in Mongo (no matching S3 folder):", mongoOnly);

    if (s3Only.length === 0) {
      logger.info(
        "No orphaned S3 folders to delete; all match Mongo documents."
      );
    } else {
      logger.warn(`Deleting orphaned S3 folders: ${s3Only.join(", ")}`);
      await deleteS3Folders(STORAGE_BUCKET, s3Only);
      logger.info(`Deleted ${s3Only.length} orphaned S3 folders.`);
    }
  } catch (error) {
    logger.error("Error deleting orphaned S3 folders:", { error });
  } finally {
    await closeDB();
    logger.info("MongoDB connection closed");
  }
}

// Execute main with global error catch
main().catch((err) => {
  logger.error("Uncaught error in bookKeeper:", { error: err });
});
