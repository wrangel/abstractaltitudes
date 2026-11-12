// scripts/stamp-image-rights.mjs
//
// Backfill: embed copyright and licence metadata in the thumbnails and
// panorama previews already in R2. New uploads are stamped by the uploader
// (src/management/uploader/uploadMedia.mjs); this catches up on everything
// uploaded before 2026-11, when the published files carried no metadata.
//
//   node --env-file=.env scripts/stamp-image-rights.mjs --dry-run   # count only
//   node --env-file=.env scripts/stamp-image-rights.mjs
//
// Same keys, same image bytes — exiftool edits metadata without re-encoding —
// so Bunny's URLs do not change. Files already stamped are skipped, so a
// re-run is harmless. Afterwards purge Bunny's cache once, or the old copies
// keep being served for up to 30 days.
//
// Needs exiftool (brew install exiftool) and the R2_* settings in .env.

import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { storageClient, STORAGE_BUCKET, contentTypeFor } from "../src/management/storage.mjs";
import {
  shouldStamp,
  captureYear,
  stampImageRights,
  hasImageRights,
} from "../src/management/imageRights.mjs";

const DRY = process.argv.includes("--dry-run");
const CONCURRENCY = 4;

async function listKeys() {
  const keys = [];
  let ContinuationToken;
  do {
    const r = await storageClient.send(
      new ListObjectsV2Command({ Bucket: STORAGE_BUCKET, ContinuationToken }),
    );
    for (const o of r.Contents ?? []) if (shouldStamp(o.Key)) keys.push(o.Key);
    ContinuationToken = r.NextContinuationToken;
  } while (ContinuationToken);
  return keys.sort();
}

const work = await mkdtemp(path.join(tmpdir(), "stamp-rights-"));
const keys = await listKeys();
console.log(`${keys.length} thumbnails and panorama previews in ${STORAGE_BUCKET}${DRY ? " (dry run)" : ""}`);

const counts = { stamped: 0, already: 0, failed: 0 };
let next = 0;

async function worker() {
  while (next < keys.length) {
    const key = keys[next++];
    const file = path.join(work, key.replaceAll("/", "__"));
    try {
      const got = await storageClient.send(new GetObjectCommand({ Bucket: STORAGE_BUCKET, Key: key }));
      await writeFile(file, await got.Body.transformToByteArray());
      if (await hasImageRights(file)) {
        counts.already++;
        continue;
      }
      if (DRY) {
        counts.stamped++;
        continue;
      }
      await stampImageRights(file, captureYear(key));
      if (!(await hasImageRights(file))) throw new Error("stamp did not verify");
      await storageClient.send(
        new PutObjectCommand({
          Bucket: STORAGE_BUCKET,
          Key: key,
          Body: await readFile(file),
          ContentType: contentTypeFor(key),
        }),
      );
      counts.stamped++;
    } catch (err) {
      counts.failed++;
      console.log(`  FAILED ${key}: ${err.message}`);
    } finally {
      await rm(file, { force: true });
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));
await rm(work, { recursive: true, force: true });

console.log(
  `${DRY ? "would stamp" : "stamped"}: ${counts.stamped}   already stamped: ${counts.already}   failed: ${counts.failed}`,
);
if (!DRY && counts.stamped) console.log("Now purge Bunny's cache (Pull zone → Purge Cache) so the stamped files are served.");
process.exit(counts.failed ? 1 : 0);
