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
const API_URL = env.VITE_API_URL;
const FETCH_TIMEOUT_MS = 20000;

const SEO_BLOCK = /<!--\s*seo:start\s*-->[\s\S]*?<!--\s*seo:end\s*-->/;

/** Logs a warning and exits 0 — prerendering is never allowed to fail a build. */
function skip(reason) {
  console.warn(`[prerender] Skipped: ${reason}`);
  console.warn("[prerender] Photo pages will use the default index.html tags.");
  process.exit(0);
}

async function fetchItems() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_URL.replace(/\/+$/, "")}/combined-data`, {
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("expected an array");
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  if (!API_URL) skip("VITE_API_URL is not set");

  let indexHtml;
  try {
    indexHtml = await fs.readFile(path.join(BUILD_DIR, "index.html"), "utf8");
  } catch {
    skip("build/index.html not found — run `vite build` first");
  }

  if (!SEO_BLOCK.test(indexHtml)) {
    skip("no <!-- seo:start --> / <!-- seo:end --> markers in build/index.html");
  }

  let items;
  try {
    items = await fetchItems();
  } catch (err) {
    skip(`could not reach ${API_URL} (${err.message})`);
  }

  const usable = items.filter((item) => item.slug && item.thumbnailUrl);
  const dropped = items.length - usable.length;

  if (items.length > 0 && usable.length === 0) {
    // Almost always a deploy-order problem rather than bad data: `slug` and
    // the place fields come from the backend, so the API has to be running
    // the newer code before the frontend build can prerender anything.
    skip(
      `all ${items.length} item(s) came back without a slug — the API is ` +
        "probably older than this frontend. Deploy the backend first, then rebuild.",
    );
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

  const placePages = buildPlacePages(usable, ORIGIN);
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
