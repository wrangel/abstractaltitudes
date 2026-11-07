// tests/contentType.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";

import { contentTypeFor } from "../src/management/contentType.mjs";

test("every extension in the bucket gets a real type, not octet-stream", () => {
  // The 2026-11 inventory of the old S3 bucket: 54,927 objects in these types.
  const cases = {
    "hd_20230115_171157/hd_20230115_171157_files/12/3_4.jpeg": "image/jpeg",
    "pa_20250403_121314/tiles/1/f/0/0.jpg": "image/jpeg",
    "hd_20261004_152236/thumbnail.webp": "image/webp",
    "hd_20230115_171157/hd_20230115_171157.dzi": "application/xml",
    "hd_20230115_171157/hd_20230115_171157.xml": "application/xml",
  };
  for (const [key, type] of Object.entries(cases)) {
    assert.equal(contentTypeFor(key), type, key);
  }
});

test("extensions are matched case-insensitively", () => {
  assert.equal(contentTypeFor("A/B.JPG"), "image/jpeg");
  assert.equal(contentTypeFor("A/B.WebP"), "image/webp");
});

test("unknown or missing extensions fall back to octet-stream", () => {
  for (const key of ["a/b.bin", "a/README", "hd_20230115_171157/"]) {
    assert.equal(contentTypeFor(key), "application/octet-stream", key);
  }
});

test("a dot in a folder name is not mistaken for an extension", () => {
  assert.equal(contentTypeFor("v1.2/thumbnail"), "application/octet-stream");
});
