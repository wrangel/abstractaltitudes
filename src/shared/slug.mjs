// src/shared/slug.mjs
//
// Shared by the backend (stamps `slug` onto every API item, and would resolve
// inbound /photo/<slug> requests) and the frontend (pushes those URLs as the
// viewer opens). Both sides MUST derive slugs from this one function — a
// divergence means deep links silently stop resolving.

/**
 * Lowercases, strips diacritics, reduces to [a-z0-9-].
 *
 * Diacritic folding matters: place names here are largely European ("Zürich",
 * "Vallée de Joux"), and percent-escaped URLs read as garbage in search results.
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
 * Canonical URL slug for a photo:
 *   "zermatt-valais-switzerland-pano-20230715-143022"
 *
 * The place words carry the search terms; the trailing `name` (unique in Mongo,
 * derived from the capture timestamp) keeps it unique when several photos share
 * a location. Consecutive duplicate words are collapsed. Returns "" for an item
 * with no usable name, which callers treat as "not addressable".
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
