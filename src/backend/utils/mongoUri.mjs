// src/backend/utils/mongoUri.mjs

// The MongoDB connection string, built from the MONGODB_* variables.
//
// Deliberately imports nothing (no logger): the backup tools write the backup
// itself to stdout, and the logger's console transport would mix log lines
// into it.
//
// MONGODB_SERVER holds the shard host list, so connecting needs DNS for each
// host. That makes a broken resolver inside the container look identical to
// an Atlas access-list rejection — Atlas returns the same "not whitelisted"
// hint either way. Check DNS first when this starts failing.
export function buildMongoUri(env = process.env) {
  return `mongodb://${env.MONGODB_DB_USER}:${encodeURIComponent(
    env.MONGODB_DB_PASSWORD,
  )}@${env.MONGODB_SERVER}/${
    env.MONGODB_DB
  }?tls=true&authSource=admin&retryWrites=true&w=majority`;
}
