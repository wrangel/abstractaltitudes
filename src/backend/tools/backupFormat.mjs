// src/backend/tools/backupFormat.mjs

// The database backup file: one Extended JSON (canonical) document holding
// every collection with its documents and indexes. Canonical EJSON keeps the
// BSON types — ObjectId, Date, Int32 vs Double — so a restore is exact, and
// the file stays readable in any text editor.
//
//   {
//     "format": "abstractaltitudes-db-backup/1",
//     "exportedAt": <Date>,
//     "database": "…",
//     "collections": {
//       "<name>": { "indexes": [ … ], "documents": [ … ] }
//     }
//   }

export const BACKUP_FORMAT = "abstractaltitudes-db-backup/1";

/**
 * Index definitions as createIndexes() accepts them: without the implicit
 * _id index (it always exists) and without server-side fields (v, ns).
 */
export function restorableIndexes(indexes = []) {
  return indexes
    .filter((index) => index.name !== "_id_")
    .map(({ v: _v, ns: _ns, ...spec }) => spec);
}

/** Throws a readable error unless `backup` looks like a file exportDb wrote. */
export function assertBackup(backup) {
  if (!backup || backup.format !== BACKUP_FORMAT) {
    throw new Error(
      `not a database backup (expected format "${BACKUP_FORMAT}", got ${JSON.stringify(backup?.format)})`,
    );
  }
  if (!backup.collections || typeof backup.collections !== "object") {
    throw new Error("backup has no collections");
  }
  for (const [name, entry] of Object.entries(backup.collections)) {
    if (!Array.isArray(entry?.documents)) {
      throw new Error(`collection "${name}" has no documents array`);
    }
  }
}

/** Total number of documents across all collections. */
export function countDocuments(backup) {
  return Object.values(backup.collections).reduce(
    (sum, { documents }) => sum + documents.length,
    0,
  );
}
