// src/shared/describeItem.mjs
//
// Turns an item's structured place fields into prose. Shared so a thumbnail's
// alt text and its prerendered page metadata always say the same thing — two
// copies would drift, and Google treats the mismatch as a signal.

/**
 * "Zermatt, Valais, Switzerland", skipping blanks and collapsing a repeated
 * word so a city that is also its canton doesn't read "Zug, Zug, Switzerland".
 */
export function formatPlace(item) {
  if (!item) return "";
  const parts = [item.location, item.region, item.country]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean);
  return parts.filter((part, i) => part !== parts[i - 1]).join(", ");
}

function describeKind(item) {
  return item?.viewer === "pano"
    ? "360° aerial panorama"
    : "Aerial drone photograph";
}

/**
 * Alt text / summary sentence. Degrades from place + altitude, to place, to a
 * bare description — never returns the raw Mongo id this replaced.
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
