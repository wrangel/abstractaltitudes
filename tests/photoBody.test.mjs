// tests/photoBody.test.mjs
//
// The visible content of prerendered photo pages: what crawlers, link
// previews and visitors without JavaScript see before React replaces it.

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildPhotoBody, placeLinks, captureMoment, photoHeading } from "../src/shared/photoBody.mjs";
import { describeItem } from "../src/shared/describeItem.mjs";

const item = {
  slug: "hofn-austurland-iceland-hd-20230503-144904",
  viewer: "img",
  location: "Höfn",
  region: "Austurland",
  country: "Iceland",
  altitude: 131.4,
  dateTime: "2023-05-03T14:49:04.000Z",
  thumbnailUrl: "https://abstractaltitudes.b-cdn.net/hd_20230503_144904/thumbnail.webp",
};
const existing = new Set(["/places/", "/places/iceland/", "/places/iceland/austurland/", "/license/"]);

test("the heading is the page title without the brand", () => {
  assert.equal(photoHeading(item), "Aerial Photograph of Höfn, Austurland, Iceland at 131 m");
});

test("the photo is shown with its descriptive alt text", () => {
  const html = buildPhotoBody(item);
  assert.match(html, /<h1[^>]*>Aerial Photograph of Höfn, Austurland, Iceland at 131 m<\/h1>/);
  assert.ok(html.includes(`alt="${describeItem(item)}"`));
  assert.ok(html.includes("srcset="));
});

test("capture time is the camera's local time from the slug, not UTC", () => {
  // dateTime stores 19:34Z for a photo the camera took at 21:34.
  assert.equal(
    captureMoment({ slug: "premantura-istria-croatia-hd-20260728-213430", dateTime: "2026-07-28T19:34:30.000Z" }),
    "28 July 2026, 21:34",
  );
  // A late-evening shot must not slip to the previous day.
  assert.equal(captureMoment({ slug: "x-hd-20240101-003000", dateTime: "2023-12-31T23:30:00.000Z" }), "1 January 2024, 00:30");
  // Without the slug convention, fall back to the stored date.
  assert.equal(captureMoment({ slug: "odd", dateTime: "2023-05-03T14:49:04.000Z" }), "3 May 2023");
  assert.equal(captureMoment({}), "");
});

test("place links point only at place pages that exist", () => {
  assert.deepEqual(placeLinks(item, existing).map((l) => l.path), ["/places/iceland/", "/places/iceland/austurland/"]);
  // Region too small for its own page: country link only, no dead region link.
  assert.deepEqual(placeLinks(item, new Set(["/places/iceland/"])).map((l) => l.path), ["/places/iceland/"]);
  assert.deepEqual(placeLinks(item, new Set()), []);
  assert.deepEqual(placeLinks({ ...item, country: "" }, existing), []);
});

test("neighbours are linked as prev/next, and every link is host-relative", () => {
  const prev = { ...item, slug: "a-x-hd-20230101-000000", location: "A" };
  const next = { ...item, slug: "b-x-hd-20230101-000001", location: "B" };
  const html = buildPhotoBody(item, { places: placeLinks(item, existing), previous: prev, next });
  assert.ok(html.includes('rel="prev" href="/photo/a-x-hd-20230101-000000/"'));
  assert.ok(html.includes('rel="next" href="/photo/b-x-hd-20230101-000001/"'));
  for (const href of html.match(/href="[^"]*"/g)) assert.match(href, /^href="\//, href);
  assert.ok(html.includes('href="/license/"'));
});

test("place names cannot inject markup", () => {
  const html = buildPhotoBody({ ...item, location: '<script>alert(1)</script>', region: 'a"b' });
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
});

test("panoramas say panorama", () => {
  const html = buildPhotoBody({ ...item, viewer: "pano" });
  assert.match(html, /360° aerial panorama/);
  assert.match(html, /zoomable panorama opens/);
});
