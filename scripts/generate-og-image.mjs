#!/usr/bin/env node
// scripts/generate-og-image.mjs
//
// Refreshes the committed fallback card at public/og-image.jpg.
//
//   node scripts/generate-og-image.mjs            # newest non-panorama
//   node scripts/generate-og-image.mjs zermatt    # newest whose slug matches
//
// `pnpm frontend:build` already regenerates build/og-image.jpg on every build,
// so this is only needed to update the committed fallback — the image that
// ships when a build cannot reach the API, and the one in git for review.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnv } from "vite";

import { buildOgImage, OG_WIDTH, OG_HEIGHT } from "./lib/ogImage.mjs";

const ROOT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_PATH = path.join(ROOT_DIR, "public", "og-image.jpg");

const env = { ...loadEnv("production", ROOT_DIR, ""), ...process.env };
const filter = process.argv[2];

function fail(message) {
  console.error(`[og-image] ${message}`);
  process.exit(1);
}

const apiUrl = env.VITE_API_URL;
if (!apiUrl) fail("VITE_API_URL is not set");

const res = await fetch(`${apiUrl.replace(/\/+$/, "")}/combined-data`);
if (!res.ok) fail(`API returned HTTP ${res.status}`);

try {
  const { item, bytes } = await buildOgImage({
    items: await res.json(),
    outPath: OUT_PATH,
    filter,
  });
  await fs.stat(OUT_PATH);
  console.log(
    `[og-image] Wrote public/og-image.jpg (${OG_WIDTH}x${OG_HEIGHT}, ` +
      `${(bytes / 1024).toFixed(0)} KB) from ${item.slug || item.thumbnailUrl}`,
  );
} catch (err) {
  fail(err.message);
}
