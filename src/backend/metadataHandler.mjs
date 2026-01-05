// src/backend/metadataHandler.mjs

import { THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT } from "./constants.mjs";
import logger from "./utils/logger.mjs";

/**
 * Validates input arrays for the beautify function.
 * @param {Array} mongoData - Data retrieved from MongoDB.
 * @param {Array} presignedUrls - URL data from AWS S3.
 * @throws Will throw an error if inputs are not arrays.
 */
function validateInput(mongoData, presignedUrls) {
  if (!Array.isArray(mongoData) || !Array.isArray(presignedUrls)) {
    throw new Error(
      "Invalid input: mongoData and presignedUrls must be arrays"
    );
  }
}

/**
 * Computes intersection and differences between Mongo and AWS data sets.
 * @param {Array} mongoData - Array of MongoDB data objects.
 * @param {Array} presignedUrls - Array of AWS S3 URL objects.
 * @returns {Object} Object with intersected data and data only in one source.
 */
function intersectData(mongoData, presignedUrls) {
  const mongoNames = new Set(mongoData.map((item) => item.name));
  const awsNames = new Set(presignedUrls.map((item) => item.name));

  const intersectedData = mongoData.filter((mongoItem) =>
    awsNames.has(mongoItem.name)
  );
  const onlyInMongo = [...mongoNames].filter((name) => !awsNames.has(name));
  const onlyInAWS = [...awsNames].filter((name) => !mongoNames.has(name));

  return { intersectedData, onlyInMongo, onlyInAWS };
}

/**
 * Processes a single document by augmenting it with URL info.
 * Determines if the media is panorama based on URL pattern.
 * @param {Object} doc - MongoDB document.
 * @param {Array} presignedUrls - AWS S3 presigned URLs array.
 * @returns {Object} Processed document ready for frontend consumption.
 */
function processDocument(doc, presignedUrls) {
  const entry = presignedUrls.find((e) => e.name === doc.name);
  const urls = entry?.urls || {};

  // Detect if this is a pano based on URL containing "/tiles"
  const isPano = !!urls.actualUrl && urls.actualUrl.includes("/tiles");

  // Correctly access nested initialViewParameters
  const initialViewParameters = doc.initialViewParameters || {
    yaw: 0,
    pitch: 0,
    fov: Math.PI / 4,
  };

  return {
    id: doc._id.toString(),
    viewer: isPano ? "pano" : "img",
    drone: doc.drone,
    dateTime: doc.dateTime,
    metadata: formatMetadata(doc),
    latitude: doc.latitude,
    longitude: doc.longitude,
    thumbnailUrl: urls.thumbnailUrl,
    originalWidth: doc.originalWidth || null,
    originalHeight: doc.originalHeight || null,
    thumbnailWidth: THUMBNAIL_WIDTH,
    thumbnailHeight: THUMBNAIL_HEIGHT,
    ...(isPano ? { panoPath: urls.actualUrl } : { actualUrl: urls.actualUrl }),
    initialViewParameters: {
      yaw: initialViewParameters.yaw,
      pitch: initialViewParameters.pitch,
      fov: initialViewParameters.fov,
    },
    levels: doc.levels || [],
  };
}

/**
 * Formats document metadata fields into a readable multiline string.
 * Formats date, time, altitude, location, author, and drone info.
 * @param {Object} doc - Document with metadata fields.
 * @returns {string} Formatted metadata string with line breaks.
 */
function formatMetadata(doc) {
  const dateTime = new Date(doc.dateTime);
  const formattedDate = dateTime.toLocaleDateString("en-US", {
    //weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const formattedTime = dateTime.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short",
  });

  const road = doc.road ? doc.road.replace(/^,\s*/, "") : "";
  const formattedRoad = formatRoadWithLineBreaks(road, 29);
  const location1 = `${doc.location || ""}`.trim(); // Previously: `${doc.location || ""}, ${doc.region || ""}`.trim();
  const location2 = `${doc.country || ""}`.trim();

  return [
    formattedDate,
    formattedTime,
    `${doc.altitude ? doc.altitude.toFixed(0) : ""} meters a.s.l.`,
    formattedRoad,
    location1,
    location2,
    //`by ${doc.author || ""}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Helper function to format road strings with line breaks
 * if they exceed a specified max length.
 * @param {string} road - The road string to format.
 * @param {number} maxLength - Maximum line length.
 * @returns {string} Road string with inserted line breaks.
 */
function formatRoadWithLineBreaks(road, maxLength) {
  if (road.length <= maxLength) {
    return road;
  }

  const words = road.split(" ");
  let currentLine = "";
  const lines = [];

  for (const word of words) {
    if ((currentLine + word).length > maxLength) {
      if (currentLine) {
        lines.push(currentLine.trim());
        currentLine = "";
      }
      // Split very long words if needed
      if (word.length > maxLength) {
        for (let i = 0; i < word.length; i += maxLength) {
          lines.push(word.substr(i, maxLength));
        }
      } else {
        currentLine = word;
      }
    } else {
      currentLine += (currentLine ? " " : "") + word;
    }
  }

  if (currentLine) {
    lines.push(currentLine.trim());
  }

  return lines.join("\n");
}

/**
 * Main exported function.
 * Processes MongoDB and AWS S3 data to produce combined, beautified dataset.
 * @param {Array} mongoData - Raw data from MongoDB.
 * @param {Array} presignedUrls - Raw presigned URL data from AWS S3.
 * @returns {Promise<Array>} Processed and beautified data.
 * @throws {Error} If input validation fails or processing errors occur.
 */
export const beautify = async (mongoData, presignedUrls) => {
  validateInput(mongoData, presignedUrls);

  const { intersectedData, onlyInMongo, onlyInAWS } = intersectData(
    mongoData,
    presignedUrls
  );

  try {
    return intersectedData.map((doc) => processDocument(doc, presignedUrls));
  } catch (error) {
    logger.error("Error in beautify function:", { error });
    throw new Error("Failed to process and beautify data");
  }
};
