// src/shared/imageUrl.mjs
//
// BunnyCDN Optimizer is enabled on the pull zone, so appending ?width=N returns
// a resized variant. It matters a lot here: stored thumbnails are ~1600px webp
// at 200-500 KB while a grid cell renders at 240-500 CSS px. Measured on a
// representative thumbnail: 511 KB full vs 51 KB at width=480.
//
// Both helpers pass through URLs that already carry a query string, so a
// pre-signed or already-sized URL is never corrupted.

// Widths offered via srcset, covering 1x and 2x for the grid. The 960 step
// exists because a 3-column grid on a 2x display needs ~820px: without it the
// browser rounds up to 1200 (118 KB) instead of 960 (77 KB).
export const THUMBNAIL_WIDTHS = [320, 480, 768, 960, 1200];

export function sizedImageUrl(url, width) {
  if (!url || typeof url !== "string" || url.includes("?")) return url;
  return `${url}?width=${width}`;
}

export function thumbnailSrcSet(url) {
  if (!url || typeof url !== "string" || url.includes("?")) return "";
  return THUMBNAIL_WIDTHS.map((w) => `${sizedImageUrl(url, w)} ${w}w`).join(
    ", ",
  );
}
