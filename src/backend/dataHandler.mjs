// src/backend/dataHandler.mjs

import { Island } from "./models/islandModel.mjs";
import { getUrls } from "./urlHandler.mjs";
import { beautify } from "./metadataHandler.mjs";

/**
 * Fetches and combines data from MongoDB and AWS S3.
 *
 * Retrieves Island documents from MongoDB and presigned URLs from S3,
 * then processes them to produce combined and beautified data.
 *
 * @returns {Promise<Array>} Combined and processed data array.
 * @throws {Error} If there's an issue fetching or processing the data.
 */
export async function getCombinedData() {
  try {
    // Fetch data from MongoDB and S3 in parallel
    const [mongoData, presignedUrls] = await Promise.all([
      fetchMongoData(),
      getUrls(),
    ]);

    // Validate fetched data
    if (!Array.isArray(mongoData) || mongoData.length === 0) {
      throw new Error("No data found in MongoDB");
    }
    if (!Array.isArray(presignedUrls) || presignedUrls.length === 0) {
      throw new Error("No presigned URLs found in AWS S3");
    }

    // Combine and process the fetched data
    const combinedData = await beautify(mongoData, presignedUrls);

    return combinedData;
  } catch (error) {
    console.error("Error in getCombinedData:", error);
    throw new Error("Failed to fetch or process combined data");
  }
}

/**
 * Fetches Island data from MongoDB, sorted by dateTime descending.
 *
 * Uses Mongoose's lean() for plain JS objects and sorting for newest first.
 *
 * @returns {Promise<Array>} Array of Island documents.
 * @throws {Error} When failing to fetch from MongoDB.
 */
async function fetchMongoData() {
  try {
    const data = await Island.find().lean().sort({ dateTime: -1 }).exec();

    if (!data || data.length === 0) {
      console.warn("No data found in MongoDB");
      return [];
    }
    return data;
  } catch (error) {
    console.error("Error fetching data from MongoDB:", error);
    throw new Error("Failed to fetch data from MongoDB");
  }
}
