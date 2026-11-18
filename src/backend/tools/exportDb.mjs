// src/backend/tools/exportDb.mjs

// Writes the whole database to stdout as one backup file (see backupFormat.mjs).
//
// Runs inside the backend container, which already has the connection
// settings and — since Atlas only admits the home IP — is where the database
// is reachable from. scripts/backup-db.sh calls it weekly on the NAS:
//
//   docker exec abstractaltitudes-backend-1 node src/backend/tools/exportDb.mjs > backup.json
//
// stdout is the backup; progress and errors go to stderr. Exits non-zero, and
// writes nothing to stdout, if the database is unreachable or holds fewer than
// BACKUP_MIN_DOCS documents — a backup that looks empty must not replace a good one.
//
// MONGODB_URI, if set, replaces the MONGODB_* variables (used by the CI test).

import mongoose from "mongoose";
import { buildMongoUri } from "../utils/mongoUri.mjs";
import { BACKUP_FORMAT } from "./backupFormat.mjs";

const { MongoClient, BSON } = mongoose.mongo;
const MIN_DOCS = Number(process.env.BACKUP_MIN_DOCS ?? 1);

const client = new MongoClient(process.env.MONGODB_URI || buildMongoUri(), {
  serverSelectionTimeoutMS: 15000,
});

try {
  await client.connect();
  const db = client.db();

  const names = (
    await db
      .listCollections({ type: "collection" }, { nameOnly: true })
      .toArray()
  )
    .map((c) => c.name)
    .filter((name) => !name.startsWith("system."))
    .sort();

  const collections = {};
  let total = 0;
  for (const name of names) {
    const collection = db.collection(name);
    const documents = await collection.find({}).sort({ _id: 1 }).toArray();
    const indexes = await collection.indexes();
    collections[name] = { indexes, documents };
    total += documents.length;
    process.stderr.write(`${name}: ${documents.length} documents\n`);
  }

  if (total < MIN_DOCS) {
    throw new Error(
      `only ${total} documents, expected at least ${MIN_DOCS} — not writing a backup that looks empty`,
    );
  }

  const backup = {
    format: BACKUP_FORMAT,
    exportedAt: new Date(),
    database: db.databaseName,
    collections,
  };
  process.stdout.write(BSON.EJSON.stringify(backup, { relaxed: false }) + "\n");
} catch (error) {
  process.stderr.write(`Backup failed: ${error.message}\n`);
  process.exitCode = 1;
} finally {
  await client.close();
}
