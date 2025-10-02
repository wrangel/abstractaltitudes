// src/frontend/utils/buildQueryStringSign.jsx

const CDN_BASE = import.meta.env.VITE_BUNNYCDN_BASE_URL;

// Accepts a URL path with width/height query string already applied (no token yet)
export async function buildQueryStringSign(pathWithParams) {
  // Remove base URL if accidentally included
  const relativePath = pathWithParams.replace(CDN_BASE, "");

  // Call backend API to get signed URL
  const response = await fetch("/api/sign-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: relativePath }),
  });

  if (!response.ok) throw new Error("Failed to get signed URL");

  const data = await response.json();
  return data.signedUrl; // The fully signed BunnyCDN URL
}
