// src/backend/utils/bunnyToken.mjs

// src/backend/utils/bunnyToken.mjs
import NodeCache from "node-cache";
import crypto from "crypto";
import { URL } from "url";

const urlCache = new NodeCache({ stdTTL: 300 }); // 5-min cache

export function generateBunnyToken(
  fullPath, // "/folder/file.webp?width=1421&height=206"
  secret,
  expires,
  userIp = "",
  pathAllowed = ""
) {
  const urlObj = new URL(fullPath, "https://dummy"); // dummy base only for parsing
  const params = urlObj.searchParams;

  if (pathAllowed) params.set("token_path", pathAllowed);

  // sort query params
  const sortedParams = new URLSearchParams([...params.entries()].sort());

  let parameterString = "";
  for (const [k, v] of sortedParams.entries()) {
    if (v) parameterString += (parameterString ? "&" : "") + `${k}=${v}`;
  }

  const signaturePath = pathAllowed || decodeURIComponent(urlObj.pathname);
  const signatureBase =
    secret + signaturePath + expires + userIp + parameterString;

  const hash = crypto
    .createHash("sha256")
    .update(signatureBase)
    .digest("base64");
  const token = hash.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  return { token, expires, urlObj, parameterString };
}

/**
 * Cached helper that adds width/height params, signs, and returns full BunnyCDN URL.
 */
export async function signedUrl(path, params = {}) {
  try {
    const url = new URL(path, "https://dummybase");
    if (params.width) url.searchParams.set("width", params.width);
    if (params.height) url.searchParams.set("height", params.height);

    const fullPath = url.pathname + url.search;

    if (urlCache.has(fullPath)) return urlCache.get(fullPath);

    const expires = Math.floor(Date.now() / 1000) + 300; // 5 min expiry
    const { token } = generateBunnyToken(
      fullPath,
      process.env.BUNNYCDN_TOKEN_SECRET,
      expires
    );

    const baseUrl = process.env.VITE_BUNNYCDN_BASE_URL.replace(/\/$/, "");
    const signedUrl = `${baseUrl}${fullPath}${
      fullPath.includes("?") ? "&" : "?"
    }token=${token}&expires=${expires}`;

    urlCache.set(fullPath, signedUrl);
    return signedUrl;
  } catch (err) {
    console.error("[signedUrl] error:", err);
    throw err;
  }
}
