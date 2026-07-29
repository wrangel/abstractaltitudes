// src/shared/describeItem.mjs
//
// Turns an item's structured place fields into prose. Shared so that a
// thumbnail's alt text and its prerendered page metadata always say the same
// thing — Google penalises the mismatch, and two copies would drift.

/**
 * Comma-joins the place fields that are present, coarsest last.
 * e.g. "Zermatt, Valais, Switzerland"
 *
 * @param {Object} item - Portfolio item.
 * @returns {string} Place string, or "" when no place fields are set.
 */
export function formatPlace(item) {
  if (!item) return "";
  const parts = [item.location, item.region, item.country]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean);
  // Drop a repeated word (a city that is also its canton, say) so we don't
  // emit "Zug, Zug, Switzerland".
  return parts.filter((part, i) => part !== parts[i - 1]).join(", ");
}

/**
 * The kind of media, phrased for prose.
 *
 * @param {Object} item - Portfolio item.
 * @returns {string} e.g. "360° aerial panorama".
 */
function describeKind(item) {
  return item?.viewer === "pano"
    ? "360° aerial panorama"
    : "Aerial drone photograph";
}

/**
 * Descriptive alt text / summary sentence for an item.
 *
 * Falls back progressively: place + altitude → place → generic. Never returns
 * a raw Mongo id, which is what this replaced.
 *
 * @param {Object} item - Portfolio item.
 * @returns {string} Non-empty description.
 */
export function describeItem(item) {
  const kind = describeKind(item);
  const place = formatPlace(item);
  if (!place) return kind;

  const altitude =
    typeof item.altitude === "number" && Number.isFinite(item.altitude)
      ? `, ${item.altitude.toFixed(0)} m above sea level`
      : "";

  return `${kind} of ${place}${altitude}`;
}
