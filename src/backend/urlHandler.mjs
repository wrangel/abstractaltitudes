// src/backend/urlHandler.mjs

import { Island } from "./models/islandModel.mjs";
import NodeCache from "node-cache";
import { generateBunnyToken } from "./utils/bunnyToken.mjs";
import { URL } from "url";

const urlCache = new NodeCache({ stdTTL: 300 }); // Cache URLs for 5 minutes

/**
 * Generates or retrieves a cached BunnyCDN token signed URL for the given object path with optional query params.
 * @param {string} path - The relative path of the S3 object, e.g. "/folder/file.webp"
 * @param {object} params - Optional query parameters (e.g. { width, height })
 * @returns {Promise<string>} - BunnyCDN signed URL string
 */
export async function signedUrl(path, params = {}) {
  // Build full URL path with query string for signing
  const url = new URL(path, "https://dummybase"); // dummy base just for URL parsing

  if (params.width) url.searchParams.set("width", params.width);
  if (params.height) url.searchParams.set("height", params.height);

  const fullPath = url.pathname + url.search;

  if (urlCache.has(fullPath)) {
    return urlCache.get(fullPath);
  }

  const expires = Math.floor(Date.now() / 1000) + 300; // 5 minutes expiry
  const token = generateBunnyToken(
    fullPath,
    process.env.BUNNYCDN_TOKEN_SECRET,
    expires
  );

  const baseUrl = process.env.VITE_BUNNYCDN_BASE_URL.replace(/\/$/, ""); // trim trailing slash
  // Append token and expires to full path
  const signedUrl = `${baseUrl}${fullPath}${
    fullPath.includes("?") ? "&" : "?"
  }token=${token}&expires=${expires}`;

  console.debug(
    `[signedUrl] Generated signed URL:\nUnsigned path: ${fullPath}\nSigned URL: ${signedUrl}`
  ); // TODO

  urlCache.set(fullPath, signedUrl);
  return signedUrl;
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
      // Raw actualUrl path without width/height; frontend will request signed URLs with size params
      actualUrl = `/${name}/${name}.webp`;
    }

    results.push({ name, type, urls: { thumbnailUrl, actualUrl } });
  }

  return results;
}
