// tests/shared.test.mjs
//
// Covers src/shared/ — the modules the backend, the frontend and the build
// scripts all depend on. Run with `pnpm test:unit`.
//
// Uses node:test, so there is no test framework to install or keep updated.

import test from "node:test";
import assert from "node:assert/strict";

import { slugify, buildItemSlug } from "../src/shared/slug.mjs";
import { describeItem, formatPlace } from "../src/shared/describeItem.mjs";
import { sizedImageUrl, thumbnailSrcSet } from "../src/shared/imageUrl.mjs";
import {
  escapeHtml,
  photoPath,
  photoUrl,
  photoTitle,
  photoDescription,
  buildPhotoSeoBlock,
  buildSitemap,
} from "../src/shared/photoMeta.mjs";
import {
  buildPlacePages,
  MIN_PHOTOS_PER_PAGE,
  MAX_PHOTOS_PER_GRID,
} from "../src/shared/placePages.mjs";

const ORIGIN = "https://abstractaltitudes.com";

const item = (over = {}) => ({
  id: "1",
  slug: "zermatt-valais-switzerland-pa-1",
  viewer: "img",
  location: "Zermatt",
  region: "Valais",
  country: "Switzerland",
  altitude: 2870.4,
  latitude: 46.0207,
  longitude: 7.7491,
  dateTime: "2023-07-15T14:30:22.000Z",
  thumbnailUrl: "https://cdn.example/x/thumbnail.webp",
  ...over,
});

// ---------------------------------------------------------------------------
// Slugs are permanent URLs. Once Google has indexed /photo/<slug>/, changing
// how a slug is derived silently 404s every indexed link and every shared URL.
// These are lock-in tests: if one fails, that is the signal to think hard,
// not to update the expectation.
// ---------------------------------------------------------------------------
test("slug: known inputs produce stable URLs", () => {
  assert.equal(
    buildItemSlug({
      location: "Zermatt",
      region: "Valais",
      country: "Switzerland",
      name: "pano_20230715_143022",
    }),
    "zermatt-valais-switzerland-pano-20230715-143022",
  );
  assert.equal(
    buildItemSlug({
      location: "Hospental",
      region: "Uri",
      country: "Switzerland",
      name: "pa_20251012_200855",
    }),
    "hospental-uri-switzerland-pa-20251012-200855",
  );
});

test("slug: folds diacritics and collapses repeated place words", () => {
  assert.equal(slugify("Zürich"), "zurich");
  assert.equal(slugify("Vallée de Joux"), "vallee-de-joux");
  // City that is also its canton must not stutter.
  assert.equal(
    buildItemSlug({
      location: "Zürich",
      region: "Zürich",
      country: "Switzerland",
      name: "img_1",
    }),
    "zurich-switzerland-img-1",
  );
});

test("slug: degrades safely", () => {
  assert.equal(buildItemSlug({ name: "img_1" }), "img-1", "no place data");
  assert.equal(buildItemSlug({ location: "X" }), "", "no name means no URL");
  assert.equal(buildItemSlug(null), "");
  assert.equal(slugify(undefined), "");
  // Must never emit a leading dash — that produced "/photo/-img-1/" once.
  assert.ok(!buildItemSlug({ name: "img_1" }).startsWith("-"));
});

// ---------------------------------------------------------------------------
// Escaping. Place names come from reverse geocoding, i.e. third-party data.
// ---------------------------------------------------------------------------
test("escapeHtml neutralises quotes and tags", () => {
  assert.equal(escapeHtml(`a"b<c>d&e'f`), "a&quot;b&lt;c&gt;d&amp;e&#39;f");
  assert.equal(escapeHtml(null), "");
  assert.equal(escapeHtml(undefined), "");
});

test("hostile place name cannot break out of an attribute or a script tag", () => {
  const hostile = item({
    location: `Bad "Quote" </script><script>alert(1)</script>`,
    region: "",
  });
  const html = buildPhotoSeoBlock(hostile, ORIGIN);

  assert.ok(!html.includes("<script>alert"), "no raw script tag survives");
  assert.ok(!/content="[^"]*"[^>]*alert\(1\)/.test(html), "no attribute escape");
  // JSON-LD must escape "<" so a value containing </script> cannot close the tag.
  assert.ok(html.includes("\\u003c/script>"), "script close is unicode-escaped");
  assert.equal(
    (html.match(/<script/g) || []).length,
    (html.match(/<\/script>/g) || []).length,
    "script tags stay balanced",
  );
});

test("photo SEO block emits exactly one title and one canonical", () => {
  const html = buildPhotoSeoBlock(item(), ORIGIN);
  assert.equal((html.match(/<title>/g) || []).length, 1);
  assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(ld["@type"], "ImageObject");
  assert.equal(ld.contentLocation.name, "Zermatt, Valais, Switzerland");
  assert.equal(ld.contentLocation.geo.latitude, 46.0207);
});

test("geo is omitted when coordinates are missing", () => {
  const html = buildPhotoSeoBlock(
    item({ latitude: undefined, longitude: undefined }),
    ORIGIN,
  );
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(ld.contentLocation.geo, undefined);
});

// ---------------------------------------------------------------------------
// URL forms: internal links relative, canonical/sitemap absolute.
// ---------------------------------------------------------------------------
test("photoPath is relative, photoUrl is absolute, both trailing-slashed", () => {
  assert.equal(photoPath(item()), "/photo/zermatt-valais-switzerland-pa-1/");
  assert.equal(
    photoUrl(item(), ORIGIN),
    "https://abstractaltitudes.com/photo/zermatt-valais-switzerland-pa-1/",
  );
});

test("titles lead with the place and distinguish panoramas", () => {
  assert.match(photoTitle(item()), /^Aerial Photograph of Zermatt, Valais/);
  assert.match(photoTitle(item({ viewer: "pano" })), /^360° Aerial Panorama of/);
  assert.equal(
    photoTitle(item({ location: "", region: "", country: "" })),
    "Abstract Altitudes - Aerial Photography",
  );
});

test("descriptions of complete records fill the displayed 120-160 window", () => {
  for (const over of [
    {},
    { viewer: "pano" },
    { location: "Höfn", region: "Austurland", country: "Iceland" },
  ]) {
    const d = photoDescription(item(over));
    assert.ok(
      d.length >= 120 && d.length <= 165,
      `description was ${d.length} chars: ${d}`,
    );
  }
});

test("sparse records stay short rather than padded with filler", () => {
  // Missing region AND altitude leaves too little real material to reach 120.
  // Inventing boilerplate to hit a character count is worse for both readers
  // and search engines than a genuinely shorter line, so this asserts a floor,
  // not the display window.
  const d = photoDescription(item({ region: "", altitude: undefined }));
  assert.ok(d.length >= 100 && d.length <= 165, `was ${d.length}: ${d}`);
  assert.ok(d.includes("Zermatt"), "still leads with the real place");
});

// ---------------------------------------------------------------------------
// CDN resizing.
// ---------------------------------------------------------------------------
test("image URLs get a width param, and pre-parameterised URLs are untouched", () => {
  assert.equal(
    sizedImageUrl("https://cdn.example/a.webp", 480),
    "https://cdn.example/a.webp?width=480",
  );
  const signed = "https://cdn.example/a.webp?token=abc";
  assert.equal(sizedImageUrl(signed, 480), signed, "never corrupt a query string");
  assert.equal(thumbnailSrcSet(signed), "");
  assert.equal(sizedImageUrl(null, 480), null);
});

test("srcset includes the 960 step that avoids rounding up to 1200", () => {
  const set = thumbnailSrcSet("https://cdn.example/a.webp");
  assert.ok(set.includes("?width=960 960w"));
  assert.equal(set.split(",").length, 5);
});

// ---------------------------------------------------------------------------
// Place hubs.
// ---------------------------------------------------------------------------
const many = (n, over = {}) =>
  Array.from({ length: n }, (_, i) =>
    item({ id: String(i), slug: `s${i}`, ...over }),
  );

test("a place below the threshold gets no page of its own", () => {
  const items = [
    ...many(MIN_PHOTOS_PER_PAGE, { country: "Bigland", region: "Solo" }),
    ...many(MIN_PHOTOS_PER_PAGE - 1, { country: "Tinyland", region: "Alone" }),
  ];
  const paths = buildPlacePages(items, ORIGIN).map((p) => p.path);
  assert.ok(paths.includes("places/bigland"));
  assert.ok(!paths.some((p) => p.includes("tinyland")), "no thin country page");
});

test("photos in a page-less region still get linked from the country page", () => {
  const items = [
    ...many(MIN_PHOTOS_PER_PAGE, { country: "Bigland", region: "Big" }),
    ...many(1, { country: "Bigland", region: "Small", slug: "orphan" }),
  ];
  const pages = buildPlacePages(items, ORIGIN);
  const country = pages.find((p) => p.path === "places/bigland");
  assert.ok(!pages.some((p) => p.path.includes("small")), "no page for Small");
  assert.ok(country.html.includes("/photo/orphan/"), "linked on country page");
});

test("photos in a country too small for a page are still linked from the index", () => {
  const items = [
    ...many(MIN_PHOTOS_PER_PAGE, { country: "Bigland", region: "Big" }),
    ...many(1, { country: "Croatia", region: "Istria", slug: "croatia-one" }),
    ...many(2, { country: "Slovenia", region: "Gorenjska" }).map((it, i) => ({
      ...it,
      slug: `slovenia-${i}`,
    })),
  ];
  const pages = buildPlacePages(items, ORIGIN);
  const index = pages.find((p) => p.path === "places");

  assert.ok(
    !pages.some((p) => /croatia|slovenia/.test(p.path)),
    "no thin country pages are created",
  );
  // But every one of their photos must still be reachable by a crawler.
  for (const slug of ["croatia-one", "slovenia-0", "slovenia-1"]) {
    assert.ok(
      index.html.includes(`/photo/${slug}/`),
      `${slug} must be linked from /places/`,
    );
  }
  assert.match(index.html, /Elsewhere/);
  assert.match(index.html, /Croatia and Slovenia|Slovenia and Croatia/);
});

test("grids cap and say so", () => {
  const pages = buildPlacePages(
    many(MAX_PHOTOS_PER_GRID + 20, { country: "Bigland", region: "Solo" }),
    ORIGIN,
  );
  const country = pages.find((p) => p.path === "places/bigland");
  assert.equal(
    (country.html.match(/<img /g) || []).length,
    MAX_PHOTOS_PER_GRID,
  );
  assert.match(country.html, /Showing the 48 most recent of 68/);
});

test("place pages link internally with relative paths only", () => {
  const pages = buildPlacePages(
    many(MIN_PHOTOS_PER_PAGE, { country: "Bigland", region: "Solo" }),
    ORIGIN,
  );
  for (const page of pages) {
    // Anchors only — canonical/og:url are absolute on purpose, and asserted
    // separately below.
    const anchors = [...page.html.matchAll(/<a\s+href="([^"]+)"/g)].map(
      (m) => m[1],
    );
    assert.ok(anchors.length > 0, `${page.path} has links`);
    for (const href of anchors) {
      assert.ok(
        href.startsWith("/"),
        `${page.path} links to ${href}; internal links must be host-relative`,
      );
    }
    assert.match(page.html, /<link rel="canonical" href="https:\/\//);
  }
});

test("items without a country produce no hub pages at all", () => {
  assert.deepEqual(buildPlacePages([item({ country: undefined })], ORIGIN), []);
  assert.deepEqual(buildPlacePages([], ORIGIN), []);
});

// ---------------------------------------------------------------------------
// Sitemap.
// ---------------------------------------------------------------------------
test("sitemap contains root, place hubs and one image entry per photo", () => {
  const xml = buildSitemap([item(), item({ slug: "b", id: "2" })], ORIGIN, [
    `${ORIGIN}/places/switzerland/`,
  ]);
  assert.equal((xml.match(/<url>/g) || []).length, 4, "root + 1 hub + 2 photos");
  assert.equal((xml.match(/<image:image>/g) || []).length, 2);
  assert.ok(xml.includes("xmlns:image="), "image namespace declared");
  assert.ok(xml.startsWith('<?xml version="1.0"'));
});

test("sitemap escapes hostile captions", () => {
  const xml = buildSitemap([item({ location: 'a & b <c>' })], ORIGIN, []);
  assert.ok(!/<image:caption>[^<]*<c>/.test(xml));
  assert.ok(xml.includes("&amp;"));
});

// ---------------------------------------------------------------------------
// Descriptions feed both alt text and page metadata; they must never be empty.
// ---------------------------------------------------------------------------
test("describeItem always returns something useful", () => {
  assert.equal(
    describeItem(item()),
    "Aerial drone photograph of Zermatt, Valais, Switzerland, 2870 m above sea level",
  );
  assert.equal(describeItem(item({ viewer: "pano" })).startsWith("360°"), true);
  assert.equal(describeItem({}), "Aerial drone photograph", "no place data");
  assert.equal(describeItem(null), "Aerial drone photograph");
  assert.equal(formatPlace(null), "");
  // An id must never leak into alt text again.
  assert.ok(!describeItem(item()).includes("1".repeat(24)));
});
