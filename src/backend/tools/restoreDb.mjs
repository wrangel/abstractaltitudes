// src/backend/tools/restoreDb.mjs

// Restores a backup written by exportDb.mjs, read from stdin. On the NAS:
//
//   gunzip -c backups/db/atlas-2026-11-23.json.gz \
//     | docker exec -i abstractaltitudes-backend-1 node src/backend/tools/restoreDb.mjs
//
// Safe by default: if any collection in the backup already holds documents,
// it stops before writing anything. Pass --replace to drop those collections
// and restore them from the backup — that overwrites the live data, including
// click counts gathered since the backup.
//
// MONGODB_URI, if set, replaces the MONGODB_* variables — e.g. to restore into
// a different database first and look at it before touching the real one.

import mongoose from "mongoose";
import { buildMongoUri } from "../utils/mongoUri.mjs";
import {
  assertBackup,
  countDocuments,
  restorableIndexes,
} from "./backupFormat.mjs";

const { MongoClient, BSON } = mongoose.mongo;
const replace = process.argv.includes("--replace");

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

const client = new MongoClient(process.env.MONGODB_URI || buildMongoUri(), {
  serverSelectionTimeoutMS: 15000,
});

try {
  const backup = BSON.EJSON.parse(await readStdin(), { relaxed: false });
  assertBackup(backup);
  process.stderr.write(
    `Backup from ${backup.exportedAt.toISOString()}: ${countDocuments(backup)} documents\n`,
  );

  await client.connect();
  const db = client.db();
  const entries = Object.entries(backup.collections);

  // Check everything before changing anything.
  const occupied = [];
  for (const [name] of entries) {
    const existing = await db.collection(name).countDocuments({});
    if (existing > 0) occupied.push(`${name} (${existing} documents)`);
  }
  if (occupied.length && !replace) {
    throw new Error(
      `not empty: ${occupied.join(", ")}. Nothing was changed. ` +
        "Re-run with --replace to overwrite them with the backup.",
    );
  }

  for (const [name, { documents, indexes }] of entries) {
    const collection = db.collection(name);
    if (replace) await collection.drop().catch(() => {}); // absent is fine
    if (documents.length) await collection.insertMany(documents);
    const specs = restorableIndexes(indexes);
    if (specs.length) await collection.createIndexes(specs);
    process.stderr.write(`${name}: restored ${documents.length} documents\n`);
  }
  process.stderr.write(`Restored into database "${db.databaseName}".\n`);
} catch (error) {
  process.stderr.write(`Restore failed: ${error.message}\n`);
  process.exitCode = 1;
} finally {
  await client.close();
}
