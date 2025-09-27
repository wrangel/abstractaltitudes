// src/backend/utils/bunnyToken.mjs

import crypto from "crypto";

export function generateBunnyToken(path, secret, expirationSeconds) {
  const expires = Math.floor(Date.now() / 1000) + expirationSeconds;
  const tokenString = secret + path + expires;

  // Use SHA-256 instead of MD5
  const hash = crypto.createHash("sha256").update(tokenString).digest("base64");
  const safeHash = hash
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return `?token=${safeHash}&expires=${expires}`;
}
