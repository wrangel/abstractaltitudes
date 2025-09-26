// src/backend/S3Handler.mjs

import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "./utils/awsUtils.mjs";
import { EXPIRATION_TIME } from "./constants.mjs";
import { Island } from "./models/islandModel.mjs";
import NodeCache from "node-cache";

const BUCKET = process.env.AWS_BUCKET; // TODO Kill

// Cache URLs for 5 minutes to avoid redundant signing
const urlCache = new NodeCache({ stdTTL: 300 });

/**
 * Generates or retrieves a cached presigned URL for the given S3 object key.
 * @param {string} key - The S3 object key for which to generate a signed URL
 * @returns {Promise<string>} - Presigned URL string
 */
async function signedUrl(key) {
  if (urlCache.has(key)) {
    return urlCache.get(key);
  }

  const freshUrl = await getSignedUrl(
    s3Client,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn: EXPIRATION_TIME }
  );

  urlCache.set(key, freshUrl);
  return freshUrl;
}

/**
 * Retrieves document names and types from MongoDB Island collection,
 * generates presigned URLs and public URLs as appropriate,
 * and returns an array of name, type, and URLs for frontend consumption.
 * @returns {Promise<Array<{name: string, type: string, urls: {thumbnailUrl: string, actualUrl: string}}>>}
 */
export async function getUrls() {
  const docs = await Island.find().select("name type").lean();

  const results = [];
  for (const { name, type } of docs) {
    const thumbnailUrl = `${BUNNYCDN_BASE_URL}/${name}/thumbnail.webp`;
    let actualUrl;

    if (type === "pano") {
      // Panorama type uses public URL to tiles folder
      actualUrl = `${BUNNYCDN_BASE_URL}/${name}/tiles`;
    } else {
      // Other types get presigned URL for the primary webp image
      actualUrl = await signedUrl(`${name}/${name}.webp`);
    }

    results.push({ name, type, urls: { thumbnailUrl, actualUrl } });
  }

  return results;
}
