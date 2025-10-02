// src/frontend/utils/buildQueryStringSign.jsx

import.meta.env.VITE_BUNNYCDN_BASE_URL;

export async function buildQueryStringSign(pathWithParams) {
  let relativePath = pathWithParams;

  try {
    const url = new URL(pathWithParams);
    const base = new URL(import.meta.env.VITE_BUNNYCDN_BASE_URL);

    // Strip CDN base only if it really belongs to it
    if (url.origin === base.origin && url.pathname.startsWith(base.pathname)) {
      relativePath = url.pathname.slice(base.pathname.length) + url.search;
      if (!relativePath.startsWith("/")) relativePath = "/" + relativePath;
    }
  } catch {
    // Already relative – keep as-is
    relativePath = pathWithParams;
  }

  // Extract query parameters
  const [, search = ""] = relativePath.split("?");
  const params = Object.fromEntries(new URLSearchParams(search));

  const res = await fetch("/api/sign-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: relativePath, ...params }),
  });

  if (!res.ok) throw new Error("Failed to get signed URL");

  const { signedUrl } = await res.json();
  return signedUrl;
}
