// src/frontend/components/buildSrc.jsx

// Creates query strings for thumnbnails and actual nonpano media
const CDN_BASE = import.meta.env.VITE_BUNNYCDN_BASE_URL;

export function buildSrc(
  path,
  { width, height, class: cls } = {},
  needsToken = false
) {
  const u = new URL(path, CDN_BASE);

  // 1. explicit pixel size (overrides any class)
  if (!u.pathname.endsWith("/thumbnail.webp")) {
    if (width) u.searchParams.set("width", width);
    if (height) u.searchParams.set("height", height);
  }

  // 2. automatic “thumbnail” class for thumbnail.webp
  if (u.pathname.endsWith("/thumbnail.webp")) {
    u.searchParams.set("class", "thumbnail");
  }

  // 3. allow caller to override/extend classes
  if (cls) u.searchParams.set("class", cls);

  // 4. sign private urls
  if (needsToken) {
    const token = generateBunnyToken(
      u.pathname + u.search,
      process.env.BUNNYCDN_TOKEN_SECRET, // ← server-side only
      300
    );
    u.searchParams.set("token", token);
  }

  return u.toString();
}
