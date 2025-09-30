// src/frontend/components/buildQueryString.jsx

// Creates query strings for thumnbnails and actual nonpano media
const CDN_BASE = import.meta.env.VITE_BUNNYCDN_BASE_URL;

export function buildQueryString(
  path,
  { width, height, class: cls } = {},
  needsToken = false
) {
  const u = new URL(path, CDN_BASE);

  // Always set width and height if provided
  if (width) u.searchParams.set("width", width);
  if (height) u.searchParams.set("height", height);

  // Add class only if provided and NOT 'thumbnail'
  if (cls && cls !== "thumbnail") {
    u.searchParams.set("class", cls);
  }

  // Sign private URLs if requested
  if (needsToken) {
    const token = generateBunnyToken(
      u.pathname + u.search,
      process.env.BUNNYCDN_TOKEN_SECRET, // server-side only
      300
    );
    u.searchParams.set("token", token);
  }

  return u.toString();
}
