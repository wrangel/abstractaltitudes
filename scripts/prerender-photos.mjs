#!/usr/bin/env node
// scripts/prerender-photos.mjs
//
// Runs after `vite build`: writes build/photo/<slug>/index.html per photo,
// the /places/ hub pages, and sitemap.xml. See "Per-photo pages (SEO)" in
// README.md for the deploy-order constraint and staleness trade-off.
//
// Static files rather than request-time injection because in production nginx
// serves the HTML and only proxies /api/ to Express — a runtime handler would
// need nginx routing changes plus the frontend build copied into the backend
// image. nginx's existing `try_files $uri $uri/ /index.html` picks these up.
//
// Never fails the build: shipping without prerendered pages is a temporary SEO
// regression, a broken deploy is worse.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnv } from "vite";

import { buildPhotoSeoBlock, buildSitemap } from "../src/shared/photoMeta.mjs";
import { buildPlacePages } from "../src/shared/placePages.mjs";
import { buildLicensePage } from "../src/shared/licensePage.mjs";
import { buildOgImage } from "./lib/ogImage.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, "..");
const BUILD_DIR = path.join(ROOT_DIR, "build");

// Resolve config exactly the way `vite build` just did, so a local build
// picks up .env while the Docker build picks up its ARG-derived ENV. Real
// process env wins, matching Vite's own precedence.
const env = {
  ...loadEnv(process.env.NODE_ENV || "production", ROOT_DIR, ""),
  ...process.env,
};

const ORIGIN = (env.SITE_ORIGIN || "https://abstractaltitudes.com")
  .trim()
  .replace(/\/+$/, "");

// Optional freshener only. In production VITE_API_URL is "/api" — correct for
// the browser, which resolves it against the site origin and lets nginx proxy
// it, but not something Node can fetch during a build, so relative values are
// resolved against SITE_ORIGIN. PRERENDER_API_URL overrides the host.
const RAW_API = env.PRERENDER_API_URL || env.VITE_API_URL;
const API_URL = RAW_API
  ? /^https?:\/\//i.test(RAW_API)
    ? RAW_API
    : new URL(RAW_API, `${ORIGIN}/`).href
  : null;

const SNAPSHOT_PATH = path.join(ROOT_DIR, "data", "photos.json");
const SNAPSHOT_STALE_DAYS = 30;

// Docker sets this so a production image can never ship the footer's
// "Browse by location" link with no /places/ pages behind it. It is only
// reachable now if BOTH the snapshot and the API are unavailable, which in
// practice means data/photos.json was never committed.
const REQUIRED = /^(1|true)$/i.test(env.REQUIRE_PRERENDER || "");

const FETCH_TIMEOUT_MS = 20000;

const SEO_BLOCK = /<!--\s*seo:start\s*-->[\s\S]*?<!--\s*seo:end\s*-->/;

/**
 * Abandons prerendering. Fails the build when REQUIRE_PRERENDER is set,
 * otherwise warns and exits 0.
 */
function skip(reason) {
  if (REQUIRED) {
    console.error(`[prerender] FAILED: ${reason}`);
    console.error("");
    console.error("[prerender] The build reads data/photos.json and falls back");
    console.error("[prerender] to it whenever the API is unreachable, so this");
    console.error("[prerender] means the snapshot is missing or empty.");
    console.error("[prerender]   • Generate and commit it:  pnpm data:refresh");
    console.error("[prerender]   • Or ship without photo/places pages:");
    console.error("[prerender]     REQUIRE_PRERENDER=0 (stopgap only).");
    process.exit(1);
  }
  console.warn(`[prerender] Skipped: ${reason}`);
  console.warn("[prerender] Photo pages will use the default index.html tags.");
  process.exit(0);
}

/**
 * True for failures worth retrying: the backend restarting behind nginx, a
 * gateway blip, a dropped connection. A 404 or a malformed body will not fix
 * itself, so those fail immediately.
 */
function isTransient(err) {
  return err.transientStatus === true || err.name === "TypeError";
}

async function fetchItemsOnce() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_URL.replace(/\/+$/, "")}/combined-data`, {
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      // 5xx and 429 are the backend being restarted, overloaded, or absent
      // behind its proxy — all things a few seconds may fix.
      err.transientStatus = res.status >= 500 || res.status === 429;
      throw err;
    }
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("expected an array");
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetches with a couple of backoff retries.
 *
 * A deploy commonly restarts the backend while the frontend image builds, so a
 * single 502 should not cost the whole attempt — but this is best-effort now,
 * so the retries are short.
 */
async function fetchItems() {
  const delays = [2000, 4000];
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchItemsOnce();
    } catch (err) {
      if (attempt >= delays.length || !isTransient(err)) throw err;
      console.warn(
        `[prerender] API not ready (${err.message}); retrying in ${
          delays[attempt] / 1000
        }s…`,
      );
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }
  }
}

/** Reads the committed snapshot, or null when it is absent or unreadable. */
async function readSnapshot() {
  try {
    const raw = JSON.parse(await fs.readFile(SNAPSHOT_PATH, "utf8"));
    if (!Array.isArray(raw.items) || raw.items.length === 0) return null;
    return raw;
  } catch {
    return null;
  }
}

/**
 * Resolves the item data, preferring the live API but never depending on it.
 *
 * The API gives the freshest data, so it is tried first. When it is
 * unreachable — an outage, a local build with no network, a Synology whose
 * router will not hairpin its own domain — the committed snapshot takes over
 * and the build proceeds. Only the absence of both is fatal.
 */
async function loadItems() {
  if (API_URL) {
    try {
      const items = await fetchItems();
      if (items.some((item) => item.slug)) {
        console.log(`[prerender] Using live API data (${items.length} items).`);
        return items;
      }
      console.warn(
        "[prerender] API returned items without slugs (older backend); " +
          "falling back to the snapshot.",
      );
    } catch (err) {
      console.warn(`[prerender] API unavailable (${err.message}).`);
    }
  }

  const snapshot = await readSnapshot();
  if (!snapshot) return null;

  const ageDays = (Date.now() - Date.parse(snapshot.fetchedAt)) / 86400000;
  if (Number.isFinite(ageDays) && ageDays > SNAPSHOT_STALE_DAYS) {
    console.warn(
      `[prerender] data/photos.json is ${Math.round(ageDays)} days old; ` +
        "run `pnpm data:refresh` to pick up newer photos.",
    );
  }
  console.log(
    `[prerender] Using committed snapshot (${snapshot.items.length} items, ` +
      `fetched ${snapshot.fetchedAt}).`,
  );
  return snapshot.items;
}

async function main() {
  let indexHtml;
  try {
    indexHtml = await fs.readFile(path.join(BUILD_DIR, "index.html"), "utf8");
  } catch {
    skip("build/index.html not found — run `vite build` first");
  }

  if (!SEO_BLOCK.test(indexHtml)) {
    skip("no <!-- seo:start --> / <!-- seo:end --> markers in build/index.html");
  }

  const items = await loadItems();
  if (!items) {
    skip("no data — the API is unreachable and data/photos.json is missing");
  }

  const usable = items.filter((item) => item.slug && item.thumbnailUrl);
  const dropped = items.length - usable.length;

  if (usable.length === 0) {
    skip(`none of the ${items.length} item(s) has both a slug and a thumbnail`);
  }

  if (dropped > 0) {
    console.warn(
      `[prerender] ${dropped} item(s) lack a slug or thumbnail; not prerendered.`,
    );
  }

  const seen = new Map();
  let written = 0;

  for (const item of usable) {
    // A duplicate slug would mean two photos silently overwriting each other's
    // page, so surface it rather than letting the last write win quietly.
    if (seen.has(item.slug)) {
      console.warn(
        `[prerender] Duplicate slug "${item.slug}" (ids ${seen.get(item.slug)} and ${item.id}); keeping the first.`,
      );
      continue;
    }
    seen.set(item.slug, item.id);

    const html = indexHtml.replace(SEO_BLOCK, () =>
      buildPhotoSeoBlock(item, ORIGIN),
    );
    const dir = path.join(BUILD_DIR, "photo", item.slug);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "index.html"), html, "utf8");
    written++;
  }

  // Refresh the share card from the newest non-panorama. Vite has already
  // copied public/og-image.jpg into build/, so any failure here simply leaves
  // that committed image in place rather than shipping a broken og:image.
  try {
    const { item } = await buildOgImage({
      items: usable,
      outPath: path.join(BUILD_DIR, "og-image.jpg"),
    });
    console.log(`[prerender] Share card rendered from ${item.slug}`);
  } catch (err) {
    console.warn(
      `[prerender] Share card not regenerated (${err.message}); ` +
        "keeping the committed public/og-image.jpg.",
    );
  }

  const placePages = [...buildPlacePages(usable, ORIGIN), buildLicensePage(ORIGIN)];
  for (const page of placePages) {
    const dir = path.join(BUILD_DIR, page.path);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "index.html"), page.html, "utf8");
  }

  const placeUrls = placePages.map((page) => `${ORIGIN}/${page.path}/`);
  await fs.writeFile(
    path.join(BUILD_DIR, "sitemap.xml"),
    buildSitemap(usable, ORIGIN, placeUrls),
    "utf8",
  );

  console.log(
    `[prerender] Wrote ${written} photo page(s), ${placePages.length} place page(s), ` +
      `and a sitemap with ${written + placeUrls.length + 1} URL(s).`,
  );
}

main().catch((err) => {
  // Unexpected failure: still don't break the build, but make it loud.
  console.warn(`[prerender] Unexpected error: ${err.stack || err.message}`);
  process.exit(0);
});
