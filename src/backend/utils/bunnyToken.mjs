// src/backend/utils/bunnyToken.mjs

import crypto from "crypto";

export function generateBunnyToken(path, secret, expirationSeconds) {
  const expires = Math.floor(Date.now() / 1000) + expirationSeconds;
  let tokenString = secret + path + expires;

  // MD5 hash, base64, then make URL safe
  const hash = crypto.createHash("md5").update(tokenString).digest("base64");
  const safeHash = hash
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return `?token=${safeHash}&expires=${expires}`;
}
