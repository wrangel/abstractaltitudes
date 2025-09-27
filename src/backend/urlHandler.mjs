// src/backend/urlHandler.mjs

import { Island } from "./models/islandModel.mjs";
import NodeCache from "node-cache";
import { generateBunnyToken } from "./utils/bunnyToken.mjs";

const urlCache = new NodeCache({ stdTTL: 300 }); // Cache URLs for 5 minutes

/**
 * Generates or retrieves a cached BunnyCDN token signed URL for the given object path.
 * @param {string} path - The relative path of the S3 object, e.g. "/folder/file.webp"
 * @returns {Promise<string>} - BunnyCDN signed URL string
 */
async function signedUrl(path) {
  if (urlCache.has(path)) {
    return urlCache.get(path);
  }

  const token = generateBunnyToken(
    path,
    process.env.BUNNYCDN_TOKEN_SECRET,
    300
  ); // 5 min expiry
  const url = `${process.env.VITE_BUNNYCDN_BASE_URL}${path}${token}`;

  urlCache.set(path, url);
  return url;
}

/**
 * Retrieves document names and types from MongoDB Island collection,
 * generates BunnyCDN signed URLs for private assets and direct BunnyCDN URLs for public assets,
 * and returns an array of name, type, and URLs for frontend consumption.
 * @returns {Promise<Array<{name: string, type: string, urls: {thumbnailUrl: string, actualUrl: string}}>>}
 */
export async function getUrls() {
  const docs = await Island.find().select("name type").lean();

  const results = [];
  for (const { name, type } of docs) {
    const thumbnailUrl = `${process.env.VITE_BUNNYCDN_BASE_URL}/${name}/thumbnail.webp`;
    let actualUrl;

    if (type === "pano") {
      // Public pano content served by BunnyCDN URL directly
      actualUrl = `${process.env.VITE_BUNNYCDN_BASE_URL}/${name}/tiles`;
    } else {
      // Private content signed with BunnyCDN token URLs
      actualUrl = await signedUrl(`/${name}/${name}.webp`);
    }

    results.push({ name, type, urls: { thumbnailUrl, actualUrl } });
  }

  return results;
}
