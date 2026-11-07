// src/management/storage.mjs
//
// The one object-storage client for the management scripts (upload, keep-books).
// Nothing in the backend or frontend talks to storage: visitors get images from
// Bunny, which pulls from this bucket by URL.
//
// Storage is Cloudflare R2 since 2026-11. R2 speaks the S3 API, so this is the
// AWS SDK pointed at R2's endpoint — the rest of the code still sends ordinary
// S3 commands. Before that it was AWS S3 (bucket melville-island), where every
// image Bunny fetched was billed as egress; R2 has none.
//
// Content-Type is set on upload (see contentType.mjs). The old bucket stored
// everything as application/octet-stream and relied on Bunny guessing from the
// extension; that still works, but the origin should not depend on it.

import { S3Client } from "@aws-sdk/client-s3";

const required = [
  "R2_ENDPOINT",
  "R2_BUCKET",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  throw new Error(
    `Missing storage settings in .env: ${missing.join(", ")} (see README, "Object storage")`,
  );
}

export const STORAGE_BUCKET = process.env.R2_BUCKET;

export const storageClient = new S3Client({
  endpoint: process.env.R2_ENDPOINT,
  // R2 ignores the region; the SDK insists on one, and "auto" is R2's own value.
  region: "auto",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  maxAttempts: 3,
});

export { contentTypeFor } from "./contentType.mjs";
