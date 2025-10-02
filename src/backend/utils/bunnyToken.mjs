// src/backend/utils/bunnyToken.mjs

import NodeCache from "node-cache";
import crypto from "crypto";
import { URL } from "url";

const urlCache = new NodeCache({ stdTTL: 300 }); // Cache URLs for 5 minutes

function addCountries(url, allowed, blocked) {
  let modifiedUrl = url;
  if (allowed) {
    const urlObj = new URL(modifiedUrl);
    modifiedUrl +=
      (urlObj.search === "" ? "?" : "&") + "token_countries=" + allowed;
  }
  if (blocked) {
    const urlObj = new URL(modifiedUrl);
    modifiedUrl +=
      (urlObj.search === "" ? "?" : "&") + "token_countries_blocked=" + blocked;
  }
  return modifiedUrl;
}

export function generateBunnyToken(
  fullUrl,
  secret,
  expires,
  userIp = "",
  pathAllowed = ""
) {
  const urlWithCountries = addCountries(fullUrl, null, null); // adjust if country restrictions apply

  const urlObj = new URL(urlWithCountries);
  const params = urlObj.searchParams;

  if (pathAllowed) {
    params.set("token_path", pathAllowed);
  }

  // Sort params by key
  const sortedParams = new URLSearchParams([...params.entries()].sort());

  // Build parameter string, skipping empty values
  let parameterString = "";
  for (const [key, value] of sortedParams.entries()) {
    if (value) {
      if (parameterString.length) parameterString += "&";
      parameterString += `${key}=${value}`;
    }
  }

  // Signature base string
  const signaturePath = pathAllowed || decodeURIComponent(urlObj.pathname);
  const signatureBase =
    secret + signaturePath + expires + userIp + parameterString;

  // Hash and encode token
  const hash = crypto
    .createHash("sha256")
    .update(signatureBase)
    .digest("base64");
  const token = hash.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  return { token, expires, urlObj, parameterString };
}

/**
 * Generates or retrieves a cached BunnyCDN token signed URL
 */
export async function signedUrl(path, params = {}) {
  try {
    // Construct base URL with params width/height
    const url = new URL(path, "https://dummybase");
    if (params.width) url.searchParams.set("width", params.width);
    if (params.height) url.searchParams.set("height", params.height);

    const fullPath = url.pathname + url.search;

    if (urlCache.has(fullPath)) {
      return urlCache.get(fullPath);
    }

    const expires = Math.floor(Date.now() / 1000) + 300; // 5 min expiry
    const { token } = generateBunnyToken(
      fullPath,
      process.env.BUNNYCDN_TOKEN_SECRET,
      expires
    );

    const baseUrl = process.env.VITE_BUNNYCDN_BASE_URL.replace(/\/$/, ""); // trim trailing slash

    // Append token and expires to full path
    const signedUrl = `${baseUrl}${fullPath}${
      fullPath.includes("?") ? "&" : "?"
    }token=${token}&expires=${expires}`;

    console.debug(
      `[signedUrl] Generated signed URL:\nUnsigned path: ${fullPath}\nSigned URL: ${signedUrl}`
    );

    urlCache.set(fullPath, signedUrl);
    return signedUrl;
  } catch (error) {
    console.error("[signedUrl] Error generating signed URL:", error);
    throw error;
  }
}
