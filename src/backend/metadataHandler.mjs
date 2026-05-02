// src/backend/metadataHandler.mjs

import { THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT } from "./constants.mjs";
import logger from "./utils/logger.mjs";

/**
 * Validates input arrays for the beautify function.
 */
function validateInput(mongoData, presignedUrls) {
  if (!Array.isArray(mongoData) || !Array.isArray(presignedUrls)) {
    throw new Error(
      "Invalid input: mongoData and presignedUrls must be arrays",
    );
  }
}

/**
 * Computes intersection between Mongo and AWS data sets.
 */
function intersectData(mongoData, presignedUrls) {
  const awsNames = new Set(presignedUrls.map((item) => item.name));

  const intersectedData = mongoData.filter((mongoItem) =>
    awsNames.has(mongoItem.name),
  );

  return { intersectedData };
}

/**
 * Processes a single document.
 */
function processDocument(doc, presignedUrls) {
  const entry = presignedUrls.find((e) => e.name === doc.name);
  const urls = entry?.urls || {};

  const initialViewParameters = doc.initialViewParameters || {
    yaw: 0,
    pitch: 0,
    fov: Math.PI / 4,
  };

  // ==========================================================
  // LEVELS MAPPING
  // Da die DB jetzt width/height/tileSize hat, nehmen wir sie direkt.
  // ==========================================================
  let levels = Array.isArray(doc.levels) ? doc.levels : [];

  if (doc.type === "hdr" && levels.length > 0) {
    levels = levels
      .map((level) => ({
        tileSize: level.tileSize || 512,
        width: level.width || level.size, // Fallback auf 'size' falls alte Daten existieren
        height:
          level.height ||
          Math.round(
            (level.width || level.size) *
              (doc.originalHeight / doc.originalWidth),
          ),
      }))
      // Nur valide Level an das Frontend schicken
      .filter((l) => l.width > 0 && l.height > 0)
      .sort((a, b) => a.width - b.width);
  }

  return {
    id: doc._id.toString(),
    name: doc.name,
    viewer: doc.type === "pano" ? "pano" : "img",
    drone: doc.drone,
    dateTime: doc.dateTime,

    metadata: formatMetadata(doc),

    latitude: doc.latitude,
    longitude: doc.longitude,

    thumbnailUrl: urls.thumbnailUrl,
    actualUrl: urls.actualUrl,

    thumbnailWidth: THUMBNAIL_WIDTH,
    thumbnailHeight: THUMBNAIL_HEIGHT,

    initialViewParameters: {
      yaw: initialViewParameters.yaw,
      pitch: initialViewParameters.pitch,
      fov: initialViewParameters.fov,
    },

    levels,
  };
}

/**
 * Formats metadata strings.
 */
function formatMetadata(doc) {
  const dateTime = new Date(doc.dateTime);

  const formattedDate = dateTime.toLocaleDateString("en-US", {
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

  const location1 = `${doc.location || ""}`.trim();
  const location2 = `${doc.country || ""}`.trim();

  return [
    formattedDate,
    formattedTime,
    `${doc.altitude ? doc.altitude.toFixed(0) : ""} meters a.s.l.`,
    formattedRoad,
    location1,
    location2,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Road formatter for UI readability.
 */
function formatRoadWithLineBreaks(road, maxLength) {
  if (road.length <= maxLength) return road;
  const words = road.split(" ");
  let currentLine = "";
  const lines = [];

  for (const word of words) {
    if ((currentLine + word).length > maxLength) {
      if (currentLine) lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine += (currentLine ? " " : "") + word;
    }
  }
  if (currentLine) lines.push(currentLine.trim());
  return lines.join("\n");
}

/**
 * Main entry point for data transformation.
 */
export const beautify = async (mongoData, presignedUrls) => {
  validateInput(mongoData, presignedUrls);

  const { intersectedData } = intersectData(mongoData, presignedUrls);

  try {
    return intersectedData.map((doc) => processDocument(doc, presignedUrls));
  } catch (error) {
    logger.error("Error in beautify function:", { error });
    throw new Error("Failed to process and beautify data");
  }
};
