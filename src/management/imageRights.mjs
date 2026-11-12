// src/management/imageRights.mjs
//
// Copyright and licensing metadata embedded in the published images, so the
// terms travel with every copy rather than living only on the website.
//
// Until 2026-11 the published files carried no metadata at all: sharp strips
// everything by default, so a copied thumbnail was anonymous. Now each
// thumbnail.webp and panorama tiles/preview.jpg gets IPTC/XMP rights fields
// (read by Google Images, Adobe tools, Finder and most viewers) plus EXIF
// Artist/Copyright for older software. The deep-zoom and panorama tiles are
// left alone: they are fragments, and ~55,000 of them would each grow ~4.6 KB.
//
// Written with exiftool rather than sharp: it edits metadata without
// re-encoding, so pixels stay byte-identical (checked on real files), and the
// same code serves new uploads and the one-off backfill of existing files.
//
// Used by uploader/uploadMedia.mjs (every new upload) and
// scripts/stamp-image-rights.mjs (backfill of what is already in R2).

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const RIGHTS_HOLDER = "Abstract Altitudes";
export const LICENSE_URL = "https://abstractaltitudes.com/license/";
export const SITE_URL = "https://abstractaltitudes.com/";

/**
 * IPTC "Data Mining" (PLUS vocabulary, 2023). Exactly the site's policy:
 * search engines may index, nobody may mine for AI. exiftool adds the
 * http://ns.useplus.org/ldf/vocab/ prefix itself — passing the full URI
 * stores it twice and readers see "Unknown".
 */
export const DATA_MINING = "DMI-PROHIBITED-EXCEPTSEARCHENGINEINDEXING";

/** Object keys that get stamped: the images people actually copy and share. */
export function shouldStamp(key) {
  return /(^|\/)thumbnail\.webp$/.test(key) || /(^|\/)tiles\/preview\.jpg$/.test(key);
}

/**
 * Year for the copyright line, from the folder naming convention
 * "<type>_<YYYYMMDD>_<HHMMSS>" (e.g. hd_20261004_152236). Falls back to the
 * current year for anything that does not follow it.
 */
export function captureYear(key, now = new Date()) {
  const m = key.match(/(?:^|\/)[a-z]{2}_((?:19|20)\d{2})\d{4}_\d{6}(?:\/|$)/);
  return m ? Number(m[1]) : now.getFullYear();
}

/** exiftool arguments for one file. */
export function rightsArgs(year) {
  const notice = `© ${year} ${RIGHTS_HOLDER}. All rights reserved.`;
  return [
    `-XMP-dc:Creator=${RIGHTS_HOLDER}`,
    `-XMP-dc:Rights=${notice}`,
    `-XMP-photoshop:Credit=${RIGHTS_HOLDER}`,
    "-XMP-xmpRights:Marked=True",
    // Google Images' "Licensable" badge reads these two from the file itself.
    `-XMP-xmpRights:WebStatement=${LICENSE_URL}`,
    `-XMP-plus:LicensorName=${RIGHTS_HOLDER}`,
    `-XMP-plus:LicensorURL=${LICENSE_URL}`,
    `-XMP-plus:DataMining#=${DATA_MINING}`,
    `-XMP-plus:OtherConstraints=No use for training, fine-tuning or operating AI/ML models without written permission. See ${LICENSE_URL}`,
    `-XMP-iptcCore:CreatorWorkURL=${SITE_URL}`,
    `-EXIF:Artist=${RIGHTS_HOLDER}`,
    `-EXIF:Copyright=${notice}`,
  ];
}

/** Writes the rights metadata into `file` in place. */
export async function stampImageRights(file, year) {
  await execFileAsync("exiftool", ["-q", "-overwrite_original", ...rightsArgs(year), file]);
}

/** Whether `file` already carries this site's rights statement. */
export async function hasImageRights(file) {
  const { stdout } = await execFileAsync("exiftool", ["-s3", "-XMP-xmpRights:WebStatement", file]);
  return stdout.trim() === LICENSE_URL;
}
