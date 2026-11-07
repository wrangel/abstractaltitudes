// src/management/contentType.mjs
//
// Content-Type for uploaded objects, from the file extension. Kept apart from
// storage.mjs so it can be imported — and tested — without storage credentials.

// Every extension the bucket holds, plus the formats the uploader produces.
const CONTENT_TYPES = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  dzi: "application/xml", // OpenSeadragon deep-zoom descriptor
  xml: "application/xml",
  json: "application/json",
};

/**
 * Content-Type for an object key, from its extension.
 *
 * @param {string} key - Object key, e.g. "hd_20261004_152236/thumbnail.webp".
 * @returns {string} MIME type; application/octet-stream when unknown.
 */
export function contentTypeFor(key) {
  const dot = key.lastIndexOf(".");
  const ext = dot === -1 ? "" : key.slice(dot + 1).toLowerCase();
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}
