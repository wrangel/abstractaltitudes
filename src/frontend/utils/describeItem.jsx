// src/frontend/utils/describeItem.jsx
//
// Builds human- and crawler-readable text from an item's structured place
// fields (location / region / country / altitude, supplied by the backend's
// processDocument). Used for image alt text today; the same helpers should
// feed per-photo <title> tags and ImageObject JSON-LD when those exist.

/**
 * Comma-joins the place fields that are actually present, coarsest last.
 * e.g. "Zermatt, Valais, Switzerland"
 *
 * @param {Object} item - Portfolio item.
 * @returns {string} Place string, or "" when no place fields are set.
 */
function formatPlace(item) {
  if (!item) return "";
  return [item.location, item.region, item.country]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(", ");
}

/**
 * Descriptive alt text for a portfolio thumbnail.
 *
 * Falls back progressively: full place + altitude → place → a generic
 * description. Never returns the raw Mongo id, which is what this replaced.
 *
 * @param {Object} item - Portfolio item.
 * @returns {string} Alt text, always non-empty.
 */
export function describeItem(item) {
  const kind =
    item?.viewer === "pano"
      ? "360° aerial panorama"
      : "Aerial drone photograph";

  const place = formatPlace(item);
  if (!place) return kind;

  const altitude =
    typeof item.altitude === "number" && Number.isFinite(item.altitude)
      ? `, ${item.altitude.toFixed(0)} m above sea level`
      : "";

  return `${kind} of ${place}${altitude}`;
}
