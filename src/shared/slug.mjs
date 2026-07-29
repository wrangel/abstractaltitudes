// src/shared/slug.mjs
//
// Shared by the backend (which stamps `slug` onto every API item and resolves
// incoming /photo/<slug> requests) and the frontend (which pushes those URLs
// as the viewer opens). Both sides MUST derive slugs from this one function —
// a divergence here means deep links silently stop resolving.

/**
 * Lowercases, strips diacritics, and reduces to [a-z0-9-].
 *
 * Diacritic folding matters here: place names in this collection are largely
 * European ("Zürich", "Grindelwald", "Vallée de Joux"), and a raw
 * encodeURIComponent would produce percent-escaped URLs that read as garbage
 * in search results.
 *
 * @param {string} value - Arbitrary text.
 * @returns {string} URL-safe slug segment, possibly empty.
 */
export function slugify(value) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Builds the canonical URL slug for a photo.
 *
 * Shape: <location>-<region>-<country>-<name>, e.g.
 *   "zermatt-valais-switzerland-pano-20230715-143022"
 *
 * The place words carry the search terms; the trailing `name` (already unique
 * in Mongo, and derived from the capture timestamp) guarantees uniqueness when
 * several photos share a location. Consecutive duplicate words are collapsed
 * so a "Zug, Zug, Switzerland" style record doesn't stutter.
 *
 * @param {Object} doc - Item with name plus optional location/region/country.
 * @returns {string} Slug, or "" when the item has no usable name.
 */
export function buildItemSlug(doc) {
  if (!doc) return "";

  const nameSlug = slugify(doc.name);
  if (!nameSlug) return "";

  const placeWords = [doc.location, doc.region, doc.country]
    .map(slugify)
    .filter(Boolean)
    .join("-")
    .split("-")
    .filter(Boolean)
    .filter((word, i, all) => word !== all[i - 1]);

  return placeWords.length ? `${placeWords.join("-")}-${nameSlug}` : nameSlug;
}
