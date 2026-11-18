// tests/dbBackup.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildMongoUri } from "../src/backend/utils/mongoUri.mjs";
import {
  BACKUP_FORMAT,
  assertBackup,
  countDocuments,
  restorableIndexes,
} from "../src/backend/tools/backupFormat.mjs";

test("connection string: password escaped, database and TLS as before", () => {
  const uri = buildMongoUri({
    MONGODB_DB_USER: "app",
    MONGODB_DB_PASSWORD: "p@ss/w:rd",
    MONGODB_SERVER: "a.example.net:27017,b.example.net:27017",
    MONGODB_DB: "gallery",
  });
  assert.equal(
    uri,
    "mongodb://app:p%40ss%2Fw%3Ard@a.example.net:27017,b.example.net:27017/gallery?tls=true&authSource=admin&retryWrites=true&w=majority",
  );
});

test("the backup tools never load the logger", () => {
  // Its console transport writes to stdout, which is the backup itself.
  for (const file of [
    "src/backend/utils/mongoUri.mjs",
    "src/backend/tools/backupFormat.mjs",
    "src/backend/tools/exportDb.mjs",
    "src/backend/tools/restoreDb.mjs",
  ]) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(
      source,
      /from\s+["'][^"']*(logger|mongodbConnection)/,
      file,
    );
  }
});

test("restorable indexes drop _id_ and server-side fields", () => {
  const indexes = [
    { v: 2, key: { _id: 1 }, name: "_id_" },
    { v: 2, key: { name: 1 }, name: "name_1", unique: true, background: true },
    {
      v: 2,
      key: { location: "2dsphere" },
      name: "location_2dsphere",
      ns: "db.islands",
    },
  ];
  assert.deepEqual(restorableIndexes(indexes), [
    { key: { name: 1 }, name: "name_1", unique: true, background: true },
    { key: { location: "2dsphere" }, name: "location_2dsphere" },
  ]);
  assert.deepEqual(restorableIndexes(undefined), []);
});

test("assertBackup accepts a real backup and counts its documents", () => {
  const backup = {
    format: BACKUP_FORMAT,
    exportedAt: new Date(),
    database: "gallery",
    collections: {
      islands: { indexes: [], documents: [{ a: 1 }, { a: 2 }] },
      empty: { indexes: [], documents: [] },
    },
  };
  assert.doesNotThrow(() => assertBackup(backup));
  assert.equal(countDocuments(backup), 2);
});

test("assertBackup rejects anything else, with a reason", () => {
  assert.throws(() => assertBackup(null), /not a database backup/);
  assert.throws(
    () => assertBackup({ format: "other" }),
    /not a database backup/,
  );
  assert.throws(
    () => assertBackup({ format: BACKUP_FORMAT }),
    /no collections/,
  );
  assert.throws(
    () => assertBackup({ format: BACKUP_FORMAT, collections: { x: {} } }),
    /"x" has no documents array/,
  );
});
