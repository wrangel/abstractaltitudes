// src/backend/management/uploader/uploadMedia.mjs

import fs from "fs/promises";
import path from "path";
import { Upload } from "@aws-sdk/lib-storage";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import {
  storageClient,
  STORAGE_BUCKET,
  contentTypeFor,
} from "../storage.mjs";
import logger from "../../backend/utils/logger.mjs";
import { shouldStamp, stampImageRights, captureYear } from "../imageRights.mjs";

// Cloudflare R2 since 2026-11, reached through the S3 API (hence the AWS SDK)
// — see ../storage.mjs. The local staging folder is still called modified/S3
// on disk; renaming it would split the media archive into two layouts.
const BUCKET_NAME = STORAGE_BUCKET;

/**
 * Checks whether the bucket already holds anything under the given folder.
 * @param {string} bucketName
 * @param {string} prefix - folder name in the bucket
 * @returns {Promise<boolean>} true if folder has contents
 */
async function folderExistsInBucket(bucketName, prefix) {
  const command = new ListObjectsV2Command({
    Bucket: bucketName,
    Prefix: prefix.endsWith("/") ? prefix : prefix + "/",
    MaxKeys: 1,
  });
  try {
    const data = await storageClient.send(command);
    return data.Contents && data.Contents.length > 0;
  } catch (err) {
    logger.error(
      `Error checking existence of prefix ${prefix} in bucket ${bucketName}: ${err.message}`,
    );
    return false;
  }
}

/**
 * Recursively upload all files in localDir to the bucket under prefix.
 * @param {string} localDir - absolute path of local folder (e.g. X/modified/S3)
 * @param {string} prefix - folder in the bucket (e.g. renamed folder name X)
 */
async function uploadDirectory(localDir, prefix) {
  const entries = await fs.readdir(localDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue; // skip dotfiles

    const fullPath = path.join(localDir, entry.name);
    const key = `${prefix}/${entry.name}`; // preserve folder structure relative to prefix

    if (entry.isDirectory()) {
      await uploadDirectory(fullPath, key);
    } else if (entry.isFile()) {
      // Thumbnails and panorama previews carry the copyright and licence
      // terms inside the file — see ../imageRights.mjs. Stamped here, the one
      // step every image passes through, rather than in each of the three
      // handlers that create them.
      if (shouldStamp(key)) {
        await stampImageRights(fullPath, captureYear(key));
        logger.info(`Embedded rights metadata in ${key}`);
      }

      logger.info(`Uploading ${fullPath} to ${BUCKET_NAME}/${key}`);
      const fileStream = (await import("fs")).createReadStream(fullPath);

      const uploader = new Upload({
        client: storageClient,
        params: {
          Bucket: BUCKET_NAME,
          Key: key,
          Body: fileStream,
          // Set here rather than left to Bunny's guess from the extension.
          // No StorageClass or ServerSideEncryption: those were AWS-specific
          // (INTELLIGENT_TIERING, AES256). R2 has one class for this use and
          // always encrypts at rest.
          ContentType: contentTypeFor(key),
        },
        queueSize: 4,
        partSize: 5 * 1024 * 1024,
      });

      try {
        await uploader.done();
        logger.info(`Uploaded: ${key}`);
      } catch (err) {
        logger.error(`Failed to upload ${key}`, { error: err });
        throw err;
      }
    }
  }
}

/**
 * Uploads the local staging folder 'modified/S3' to the R2 bucket, under the renamed folder name.
 * @param {string} mediaFolderPath - absolute path to media folder renamed (e.g. /.../pa_20250403_121314)
 * @param {string} folderName - renamed folder name, used as the folder in the bucket (e.g. pa_20250403_121314)
 */
export async function uploadMedia(mediaFolderPath, folderName) {
  const stagingPath = path.join(mediaFolderPath, "modified", "S3");

  /*
  logger.info(`Checking whether ${folderName}/ already exists in ${BUCKET_NAME}...`);
  const exists = await folderExistsInBucket(BUCKET_NAME, folderName);
  if (exists) {
    logger.info(
      `${folderName}/ already exists in ${BUCKET_NAME}. Skipping upload.`
    );
    return;
  }*/ // TODO Uncomment

  logger.info(
    `Uploading contents of ${stagingPath} to ${BUCKET_NAME} under ${folderName}/`,
  );
  await uploadDirectory(stagingPath, folderName);
  logger.info(`Completed upload of folder ${folderName}`);
}
