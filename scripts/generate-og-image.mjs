#!/usr/bin/env node
// scripts/generate-og-image.mjs
//
// Produces public/og-image.jpg — the 1200x630 card that Facebook, LinkedIn,
// Slack, iMessage and X show when someone shares the site root.
//
//   node scripts/generate-og-image.mjs            # newest photo
//   node scripts/generate-og-image.mjs zermatt    # newest whose slug/url matches
//
// Deliberately NOT part of `pnpm frontend:build`: the asset is committed, so
// the share card stays stable until you choose to change it, builds don't
// depend on sharp or on the API being up, and there is always a valid image
// behind og:image even when a build runs offline.
//
// Source images are 1600x-ish thumbnails, so this crops down, never up.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnv } from "vite";
import sharp from "sharp";

const ROOT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_PATH = path.join(ROOT_DIR, "public", "og-image.jpg");
const WIDTH = 1200;
const HEIGHT = 630;

const env = { ...loadEnv("production", ROOT_DIR, ""), ...process.env };
const filter = process.argv[2]?.toLowerCase();

function fail(message) {
  console.error(`[og-image] ${message}`);
  process.exit(1);
}

const apiUrl = env.VITE_API_URL;
if (!apiUrl) fail("VITE_API_URL is not set");

const res = await fetch(`${apiUrl.replace(/\/+$/, "")}/combined-data`);
if (!res.ok) fail(`API returned HTTP ${res.status}`);

const items = (await res.json()).filter((item) => item.thumbnailUrl);
if (items.length === 0) fail("API returned no items with a thumbnail");

// The API sorts newest first, so items[0] is the most recent capture.
const chosen = filter
  ? items.find((item) =>
      `${item.slug ?? ""} ${item.thumbnailUrl}`.toLowerCase().includes(filter),
    )
  : items[0];

if (!chosen) fail(`No item matched "${filter}"`);

const source = Buffer.from(
  await (await fetch(chosen.thumbnailUrl)).arrayBuffer(),
);
const { width, height } = await sharp(source).metadata();
if (width < WIDTH || height < HEIGHT) {
  fail(
    `Source is ${width}x${height}, smaller than ${WIDTH}x${HEIGHT}; ` +
      "pick another photo rather than upscaling.",
  );
}

await sharp(source)
  .resize(WIDTH, HEIGHT, {
    fit: "cover",
    // Entropy-based crop: keeps the horizon/subject rather than blindly
    // centring, which on aerial shots often lands on empty sky or water.
    position: sharp.strategy.attention,
  })
  .jpeg({ quality: 82, progressive: true, mozjpeg: true })
  .toFile(OUT_PATH);

const { size } = await fs.stat(OUT_PATH);
console.log(
  `[og-image] Wrote public/og-image.jpg (${WIDTH}x${HEIGHT}, ` +
    `${(size / 1024).toFixed(0)} KB) from ${chosen.slug || chosen.thumbnailUrl}`,
);
