// scripts/lib/ogImage.mjs
//
// Renders the 1200x630 social share card. Shared by the build-time prerender
// and the manual `scripts/generate-og-image.mjs`.
//
// Panoramas are skipped: an equirectangular frame cropped to a 1.9:1 card
// shows the stretched, distorted middle band rather than a readable scene.
// Only if the collection contains no flat images at all does it fall back to
// using one.

import sharp from "sharp";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/**
 * Picks the photo to render, newest first (the API sorts descending).
 *
 * @param {Array<Object>} items - Items from combined-data.
 * @param {string} [filter] - Case-insensitive substring matched against slug.
 * @returns {Object|null} Chosen item.
 */
export function pickOgSource(items, filter) {
  const usable = items.filter((item) => item.thumbnailUrl);
  const flat = usable.filter((item) => item.viewer !== "pano");
  const pool = flat.length > 0 ? flat : usable;

  if (!filter) return pool[0] ?? null;

  const needle = filter.toLowerCase();
  return (
    pool.find((item) =>
      `${item.slug ?? ""} ${item.thumbnailUrl}`.toLowerCase().includes(needle),
    ) ?? null
  );
}

/**
 * Downloads the chosen thumbnail and writes a 1200x630 JPEG.
 *
 * @param {Object} options
 * @param {Array<Object>} options.items - Items from combined-data.
 * @param {string} options.outPath - Destination .jpg path.
 * @param {string} [options.filter] - Optional slug substring.
 * @returns {Promise<{item: Object, bytes: number}>}
 * @throws When no candidate exists, the fetch fails, or the source is smaller
 *   than the card — upscaling a share image is worse than keeping the old one.
 */
export async function buildOgImage({ items, outPath, filter }) {
  const item = pickOgSource(items, filter);
  if (!item) {
    throw new Error(
      filter ? `no item matched "${filter}"` : "no item has a thumbnail",
    );
  }

  const res = await fetch(item.thumbnailUrl);
  if (!res.ok) throw new Error(`thumbnail fetch returned HTTP ${res.status}`);
  const source = Buffer.from(await res.arrayBuffer());

  const { width, height } = await sharp(source).metadata();
  if (width < OG_WIDTH || height < OG_HEIGHT) {
    throw new Error(
      `source is ${width}x${height}, smaller than ${OG_WIDTH}x${OG_HEIGHT}`,
    );
  }

  const { size } = await sharp(source)
    .resize(OG_WIDTH, OG_HEIGHT, {
      fit: "cover",
      // Entropy-based crop: keeps the subject rather than blindly centring,
      // which on aerial shots often lands on empty sky or water.
      position: sharp.strategy.attention,
    })
    .jpeg({ quality: 82, progressive: true, mozjpeg: true })
    .toFile(outPath);

  return { item, bytes: size };
}
