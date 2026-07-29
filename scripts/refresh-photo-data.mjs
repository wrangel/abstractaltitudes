#!/usr/bin/env node
// scripts/refresh-photo-data.mjs
//
// Writes data/photos.json — a committed snapshot of the fields the build needs
// to prerender photo pages, /places/ hubs and the sitemap.
//
//   pnpm data:refresh                     # from $VITE_API_URL
//   PRERENDER_API_URL=http://nas:8081/api pnpm data:refresh
//
// Why a snapshot exists at all: the build used to fetch this live, which meant
// `pnpm test` and `pnpm prod` could only succeed while the production API was
// healthy — so an outage blocked building the very fix for that outage, and a
// purely local stack build depended on a remote host. The snapshot decouples
// the build from all of that: DNS, hairpin NAT, deploy order, uptime.
//
// Run it after adding photos. Staleness is visible in `git diff`, and the
// prerender warns when the snapshot is old.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnv } from "vite";

const ROOT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_PATH = path.join(ROOT_DIR, "data", "photos.json");

const env = { ...loadEnv("production", ROOT_DIR, ""), ...process.env };
const ORIGIN = (env.SITE_ORIGIN || "https://abstractaltitudes.com")
  .trim()
  .replace(/\/+$/, "");

const RAW_API = env.PRERENDER_API_URL || env.VITE_API_URL;
if (!RAW_API) {
  console.error("[data] VITE_API_URL is not set");
  process.exit(1);
}
const API_URL = /^https?:\/\//i.test(RAW_API)
  ? RAW_API
  : new URL(RAW_API, `${ORIGIN}/`).href;

// Only the fields the prerender actually reads. Keeps the committed file small
// and its diffs readable, and avoids parking presigned or volatile values in
// git.
const KEEP = [
  "id",
  "slug",
  "viewer",
  "location",
  "region",
  "country",
  "altitude",
  "latitude",
  "longitude",
  "dateTime",
  "thumbnailUrl",
];

// Neither the URL nor a raw fetch error is logged. Both derive from the
// environment, and a connection string may legitimately embed credentials
// (http://user:pass@host/api) that would then sit in CI output for anyone with
// access to the build. Naming the variables to check is just as actionable
// without putting a secret-bearing value in a log.
let res;
try {
  res = await fetch(`${API_URL.replace(/\/+$/, "")}/combined-data`);
} catch (err) {
  console.error(
    `[data] Could not reach the API (${err.cause?.code ?? err.name}). ` +
      "Check VITE_API_URL / PRERENDER_API_URL and that the backend is running.",
  );
  process.exit(1);
}

if (!res.ok) {
  console.error(
    `[data] API returned HTTP ${res.status}. ` +
      "Check VITE_API_URL / PRERENDER_API_URL.",
  );
  process.exit(1);
}

const raw = await res.json();
if (!Array.isArray(raw) || raw.length === 0) {
  console.error("[data] API returned no items");
  process.exit(1);
}

const items = raw
  .filter((item) => item.slug && item.thumbnailUrl)
  .map((item) => Object.fromEntries(KEEP.map((k) => [k, item[k]])));

if (items.length === 0) {
  console.error(
    "[data] No item had a slug — the API is older than this frontend. " +
      "Deploy the backend first.",
  );
  process.exit(1);
}

await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
await fs.writeFile(
  OUT_PATH,
  `${JSON.stringify({ fetchedAt: new Date().toISOString(), items }, null, 2)}\n`,
  "utf8",
);

const { size } = await fs.stat(OUT_PATH);
console.log(
  `[data] Wrote data/photos.json — ${items.length} items, ${(size / 1024).toFixed(0)} KB. ` +
    "Commit it so builds can run offline.",
);
