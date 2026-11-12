// src/backend/management/keepBooks.mjs

import {
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { storageClient, STORAGE_BUCKET } from "./storage.mjs";
import logger from "../backend/utils/logger.mjs";
import { Island } from "../backend/models/islandModel.mjs";
import { executeMongoQuery } from "../backend/utils/mongoUtils.mjs";
import { connectDB, closeDB } from "../backend/utils/mongodbConnection.mjs";


/**
 * List top-level folders in the bucket.
 * @param {string} bucketName
 * @returns {Promise<string[]>} Array of top-level folder names (prefixes without trailing slash).
 */
async function listTopLevelFolders(bucketName) {
  const command = new ListObjectsV2Command({
    Bucket: bucketName,
    Delimiter: "/", // group objects by top-level "folders"
  });
  const response = await storageClient.send(command);
  const prefixes = response.CommonPrefixes || [];
  return prefixes.map((p) => p.Prefix.replace(/\/$/, ""));
}

/**
 * Delete all objects under the given top-level folders in the bucket.
 * Handles paging if folder contains many objects.
 *
 * @param {string} bucketName
 * @param {string[]} folders - folder prefixes to delete.
 */
async function deleteFolders(bucketName, folders) {
  if (folders.length === 0) {
    logger.info("No bucket folders to delete.");
    return;
  }

  for (const folder of folders) {
    logger.info(`Deleting bucket folder and all contents: ${folder}/`);

    let continuationToken = undefined;
    do {
      const listCommand = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: folder + "/",
        ContinuationToken: continuationToken,
      });
      const listResponse = await storageClient.send(listCommand);

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
        await storageClient.send(deleteCommand);
      }
    } while (continuationToken);
  }
}

/**
 * Main function:
 * Sync the bucket's top-level folders with MongoDB Island documents.
 * Deletes orphaned bucket folders that don't have a Mongo document.
 */
async function main() {
  try {
    await connectDB();
    logger.info("MongoDB connected");

    const bucketFolders = await listTopLevelFolders(STORAGE_BUCKET);
    const mongoDocs = await executeMongoQuery(
      () => Island.find().lean(),
      "Island"
    );

    const bucketSet = new Set(bucketFolders);
    const mongoSet = new Set(mongoDocs.map((doc) => doc.name));

    const bucketOnly = bucketFolders.filter((folder) => !mongoSet.has(folder));
    const mongoOnly = mongoDocs
      .filter((doc) => !bucketSet.has(doc.name))
      .map((doc) => doc.name);

    logger.info("Folders only in the bucket (no matching Mongo document):", bucketOnly);
    logger.info("Documents only in Mongo (no matching bucket folder):", mongoOnly);

    if (bucketOnly.length === 0) {
      logger.info(
        "No orphaned bucket folders to delete; all match Mongo documents."
      );
    } else {
      logger.warn(`Deleting orphaned bucket folders: ${bucketOnly.join(", ")}`);
      await deleteFolders(STORAGE_BUCKET, bucketOnly);
      logger.info(`Deleted ${bucketOnly.length} orphaned bucket folders.`);
    }
  } catch (error) {
    logger.error("Error deleting orphaned bucket folders:", { error });
  } finally {
    await closeDB();
    logger.info("MongoDB connection closed");
  }
}

// Execute main with global error catch
main().catch((err) => {
  logger.error("Uncaught error in bookKeeper:", { error: err });
});
