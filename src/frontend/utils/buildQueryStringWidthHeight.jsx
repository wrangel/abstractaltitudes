// src/frontend/utils/buildQueryStringWidthHeight.jsx

// Creates query strings for thumbnails and actual non-pano media
const CDN_BASE = import.meta.env.VITE_BUNNYCDN_BASE_URL;

export function buildQueryStringWidthHeight(
  path,
  { width, height, class: cls } = {},
) {
  if (!path) return "";

  // 1. Clean the path
  const cleanPath = path.replace(/^\/+/, "");

  // 2. We use a dummy base because we only care about the resulting
  // path and query string for the signer
  const u = new URL(cleanPath, "https://dummy.com");

  if (width) u.searchParams.set("width", Math.round(width));
  if (height) u.searchParams.set("height", Math.round(height));
  if (cls && cls !== "thumbnail") u.searchParams.set("class", cls);

  // 3. Return ONLY the path and query string: "/folder/img.webp?width=100"
  // This is what the BunnyCDN token algorithm actually signs.
  return u.pathname + u.search;
}
