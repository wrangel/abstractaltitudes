// tests/imageRights.test.mjs
//
// The rules for what gets stamped and with what. The exiftool call itself is
// not run here (CI has no exiftool); it was verified on real files, including
// that the pixels stay byte-identical.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  shouldStamp,
  captureYear,
  rightsArgs,
  LICENSE_URL,
  DATA_MINING,
} from "../src/management/imageRights.mjs";

test("only thumbnails and panorama previews are stamped, not the tiles", () => {
  const yes = ["hd_20261004_152236/thumbnail.webp", "pa_20221204_152512/tiles/preview.jpg", "thumbnail.webp"];
  const no = [
    "hd_20261004_152236/hd_20261004_152236_files/12/3_4.jpeg",
    "pa_20221204_152512/tiles/1/f/0/0.jpg",
    "hd_20261004_152236/hd_20261004_152236.dzi",
    "hd_20261004_152236/thumbnail.webp.bak",
    "pa_20221204_152512/preview.jpg",
  ];
  for (const k of yes) assert.equal(shouldStamp(k), true, k);
  for (const k of no) assert.equal(shouldStamp(k), false, k);
});

test("the copyright year comes from the capture date in the folder name", () => {
  assert.equal(captureYear("hd_20221226_104714/thumbnail.webp"), 2022);
  assert.equal(captureYear("pa_20250403_121314/tiles/preview.jpg"), 2025);
  assert.equal(captureYear("wa_20240212_144355/thumbnail.webp"), 2024);
  const now = new Date("2026-11-12T00:00:00Z");
  assert.equal(captureYear("odd-folder/thumbnail.webp", now), 2026);
  assert.equal(captureYear("thumbnail.webp", now), 2026);
});

test("the rights fields name the holder, the licence page and the AI prohibition", () => {
  const args = rightsArgs(2024);
  const value = (tag) => args.find((a) => a.startsWith(`-${tag}=`) || a.startsWith(`-${tag}#=`))?.split(/#?=/).slice(1).join("=");
  assert.equal(value("XMP-dc:Creator"), "Abstract Altitudes");
  assert.equal(value("XMP-dc:Rights"), "© 2024 Abstract Altitudes. All rights reserved.");
  assert.equal(value("EXIF:Copyright"), "© 2024 Abstract Altitudes. All rights reserved.");
  assert.equal(value("XMP-xmpRights:WebStatement"), LICENSE_URL);
  assert.equal(value("XMP-plus:LicensorURL"), LICENSE_URL);
  assert.equal(value("XMP-plus:DataMining"), "DMI-PROHIBITED-EXCEPTSEARCHENGINEINDEXING");
});

test("the data-mining code is written raw and without the vocabulary prefix", () => {
  // exiftool adds http://ns.useplus.org/ldf/vocab/ itself; passing it too
  // stores the prefix twice and readers show "Unknown".
  assert.ok(!DATA_MINING.startsWith("http"));
  assert.ok(rightsArgs(2026).includes(`-XMP-plus:DataMining#=${DATA_MINING}`));
});
