// src/backend/management/uploader/collectMetadata.mjs

import { readdir, readFile } from "fs/promises";
import path from "path";
import fetch from "node-fetch"; // for reverse geocoding API calls
import ExifParser from "exif-parser";
import logger from "../../backend/utils/logger.mjs";
import {
  CONTRIBUTORS,
  REVERSE_GEO_ADDRESS_COMPONENTS,
  REVERSE_GEO_URL_ELEMENTS,
  DRONE_MODELS,
  MEDIA_PREFIXES,
  EXIF_TAGS,
  ALTITUDE_UNIT,
  UNKNOWN_VALUE,
} from "../../backend/constants.mjs";

import readline from "readline";

/**
 * Async prompt for user input in console.
 * @param {string} promptText
 * @returns {Promise<string>}
 */
function question(promptText) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(promptText, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * Validate the input against valid options, reprompt if invalid.
 * @param {string} input
 * @param {string[]} validOptions
 * @param {string} inputType
 * @returns {Promise<string>}
 */
async function validateInput(input, validOptions, inputType) {
  while (!validOptions.includes(input)) {
    input = await question(
      `Please choose one of (${validOptions.join(", ")}) as ${inputType}: `,
    );
  }
  return input;
}

/**
 * Parse altitude value from string or number.
 * Supports fractional strings and "m" suffix.
 * @param {string|number} altitudeValue
 * @returns {number|null}
 */
function getAltitude(altitudeValue) {
  if (typeof altitudeValue === "string") {
    if (altitudeValue.endsWith(ALTITUDE_UNIT)) return parseFloat(altitudeValue);
    const [num, denom] = altitudeValue.split("/").map(Number);
    if (!isNaN(num) && !isNaN(denom)) return num / denom;
    return null;
  }
  if (typeof altitudeValue === "number") return altitudeValue;
  return null;
}

/**
 * Parse coordinate value from string or number.
 * Supports fractional strings.
 * @param {string|number} coordValue
 * @returns {number}
 */
function getCoordinates(coordValue) {
  if (typeof coordValue === "string" && coordValue.includes("/")) {
    const [num, denom] = coordValue.split("/").map(Number);
    return num / denom;
  }
  return Number(coordValue);
}

/**
 * Parse EXIF date/time string to Date object.
 * Format expected: "YYYY:MM:DD HH:MM:SS"
 * @param {string} str
 * @returns {Date|null}
 */
function getDate(str) {
  const [datePart, timePart] = str.split(" ");
  if (!datePart || !timePart) return null;
  const [year, month, day] = datePart.split(":").map(Number);
  const [hour, min, sec] = timePart.split(":").map(Number);
  return new Date(year, month - 1, day, hour, min, sec);
}

/**
 * Determine media type by counting JPGs in directory.
 * @param {string} parentDir
 * @returns {Promise<string>}
 */
async function determineMediaType(parentDir) {
  try {
    const files = await readdir(parentDir);
    const imageCount = files.filter((file) => file.endsWith(".JPG")).length;

    if (imageCount <= 5) return "hdr";
    if (imageCount >= 26 && imageCount <= 35) return "pano";
    return "wide_angle";
  } catch (err) {
    console.error(`Error determining media type for ${parentDir}:`, err);
    return "unknown";
  }
}

/**
 * Perform reverse geocoding for longitude and latitude via API.
 * @param {number} longitude
 * @param {number} latitude
 * @returns {Promise<Object>} Address component object
 */
async function reverseGeocode(longitude, latitude) {
  const createReverseGeoUrl = (lon, lat) =>
    `${REVERSE_GEO_URL_ELEMENTS[0]}${lon},${lat}${REVERSE_GEO_URL_ELEMENTS[1]}${process.env.MAPBOX_SECRET_TOKEN}`;
  const url = createReverseGeoUrl(longitude, latitude);

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const json = await response.json();

    const geoData = REVERSE_GEO_ADDRESS_COMPONENTS.reduce((data, component) => {
      const value =
        json.features.find((doc) => doc.id.startsWith(component))?.text ?? null;
      if (component === "address") data.road = value;
      else if (component === "place") data.location = value;
      else if (component === "postcode") data.postalCode = value;
      else data[component] = value;
      return data;
    }, {});

    return geoData;
  } catch (error) {
    logger.error("Reverse geocoding error:", { error });
    return {
      country: null,
      region: null,
      location: null,
      postalCode: null,
      road: null,
    };
  }
}

/**
 * Reads EXIF metadata from the first JPEG in the parent directory.
 * Also detects drone model, prepares media name, reverse geocodes location.
 * @param {string} parentDir
 * @param {string} mediaType
 * @param {string} author
 * @returns {Promise<Object|null>}
 */
async function readExifFromFirstJPG(parentDir, mediaType, author) {
  try {
    const files = await readdir(parentDir);
    const jpgFile = files.find(
      (file) =>
        file.toLowerCase().endsWith(".jpg") ||
        file.toLowerCase().endsWith(".jpeg"),
    );
    if (!jpgFile) {
      logger.warn(`No JPEG file found in ${parentDir}`);
      return null;
    }

    const filePath = path.join(parentDir, jpgFile);
    const imgBuffer = await readFile(filePath);
    const parser = ExifParser.create(imgBuffer);
    const exifData = parser.parse();

    let drone = UNKNOWN_VALUE;
    if (exifData.tags[EXIF_TAGS.MODEL]) {
      const modelCode = exifData.tags[EXIF_TAGS.MODEL]
        .replace(/[\[\]]/g, "")
        .trim();
      drone = DRONE_MODELS[modelCode] || UNKNOWN_VALUE;
    }

    const type = mediaType;
    const prefix = MEDIA_PREFIXES[type] || "";

    let dateTimeString = UNKNOWN_VALUE;
    if (exifData.tags[EXIF_TAGS.DATE_TIME_ORIGINAL]) {
      const d = new Date(exifData.tags[EXIF_TAGS.DATE_TIME_ORIGINAL] * 1000);
      const pad = (n) => n.toString().padStart(2, "0");
      dateTimeString =
        `${d.getFullYear()}:${pad(d.getMonth() + 1)}:${pad(d.getDate())} ` +
        `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }

    const dateTime =
      dateTimeString === UNKNOWN_VALUE ? null : getDate(dateTimeString);

    let name = "";
    if (dateTime) {
      const pad = (n) => n.toString().padStart(2, "0");
      name = `${prefix}${dateTime.getFullYear()}${pad(
        dateTime.getMonth() + 1,
      )}${pad(dateTime.getDate())}_${pad(dateTime.getHours())}${pad(
        dateTime.getMinutes(),
      )}${pad(dateTime.getSeconds())}`;
    } else {
      name = prefix + UNKNOWN_VALUE;
    }

    const longitude = getCoordinates(exifData.tags[EXIF_TAGS.GPS_LONGITUDE]);
    const latitude = getCoordinates(exifData.tags[EXIF_TAGS.GPS_LATITUDE]);
    const altitude = getAltitude(exifData.tags[EXIF_TAGS.GPS_ALTITUDE]);

    const geoData = await reverseGeocode(longitude, latitude);

    return {
      originalName: path.basename(parentDir),
      drone,
      type,
      name,
      dateTimeString,
      dateTime,
      longitude,
      latitude,
      altitude,
      geoData,
      filePath,
      author,
    };
  } catch (err) {
    console.error("Error reading EXIF", err);
    return null;
  }
}

/**
 * Prompt user for the author of media, validating input.
 * @param {string} mediaName
 * @returns {Promise<string>}
 */
async function promptAuthorForMedia(mediaName) {
  const authorInput = await question(`Author of --> ${mediaName} <--: `);
  return await validateInput(authorInput.trim(), CONTRIBUTORS, "author");
}

/**
 * Main function to collect metadata for one media directory.
 * @param {string} mediaDirPath
 * @returns {Promise<{meta Object}|null>}
 */
export async function collectMetadata(mediaDirPath) {
  const mediaType = await determineMediaType(mediaDirPath);
  const originalName = path.basename(mediaDirPath);
  const author = await promptAuthorForMedia(originalName);

  const exifData = await readExifFromFirstJPG(mediaDirPath, mediaType, author);
  if (!exifData) return null;

  const metadata = {
    name: exifData.name,
    type: exifData.type,
    author: exifData.author,
    drone: exifData.drone,
    dateTimeString: exifData.dateTimeString,
    dateTime: exifData.dateTime,
    latitude: exifData.latitude,
    longitude: exifData.longitude,
    altitude: exifData.altitude,
    country: exifData.geoData.country,
    region: exifData.geoData.region,
    location: exifData.geoData.location,
    postalCode: exifData.geoData.postalCode,
    road: exifData.geoData.road,
    noViews: 0,
  };

  return { metadata };
}
