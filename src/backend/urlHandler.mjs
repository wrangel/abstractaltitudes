// src/backend/urlHandler.mjs

import { Island } from "./models/islandModel.mjs";

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
      actualUrl = `${process.env.VITE_BUNNYCDN_BASE_URL}/${name}/${name}.dzi`;
    }

    results.push({ name, type, urls: { thumbnailUrl, actualUrl } });
  }

  return results;
}
