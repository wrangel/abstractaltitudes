// src/backend/utils/mongodbConnection.mjs

import dns from "node:dns/promises";
import net from "node:net";

import mongoose from "mongoose";
import logger from "../utils/logger.mjs";

const INITIAL_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 60000;
const SERVER_SELECTION_TIMEOUT_MS = 10000;

// MONGODB_SERVER holds the shard host list, so connecting needs DNS for each
// host. That makes a broken resolver inside the container look identical to
// an Atlas access-list rejection — Atlas returns the same "not whitelisted"
// hint either way. Check DNS first when this starts failing.
function buildUri() {
  return `mongodb://${process.env.MONGODB_DB_USER}:${encodeURIComponent(
    process.env.MONGODB_DB_PASSWORD,
  )}@${process.env.MONGODB_SERVER}/${
    process.env.MONGODB_DB
  }?tls=true&authSource=admin&retryWrites=true&w=majority`;
}

/**
 * Connects once, throwing on failure.
 *
 * Used by the one-shot management scripts (keepBooks, the uploader) and the
 * performance test, where failing fast is right: a batch job should stop
 * rather than retry forever against a database it cannot reach.
 */
const connectDB = async () => {
  try {
    await mongoose.connect(buildUri(), {
      serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
    });
    logger.info("Successfully connected to MongoDB");
  } catch (err) {
    logger.error("MongoDB connection error:", err);
    throw err;
  }
};

/** True once Mongoose has an open connection. Drives the /ready endpoint. */
const isDatabaseConnected = () => mongoose.connection.readyState === 1;

/**
 * Works out which layer is actually broken and returns a one-line verdict.
 *
 * DNS failure, blocked egress and an Atlas access-list rejection all surface as
 * the same "IP isn't whitelisted" message, which sends you hunting in the wrong
 * place — it cost a long detour once already. Resolving the host and opening a
 * bare TCP socket separates them definitively.
 */
async function diagnoseConnectivity() {
  const host = (process.env.MONGODB_SERVER || "")
    .split(",")[0]
    .split(":")[0]
    .trim();
  if (!host) return "DIAGNOSIS: MONGODB_SERVER is empty.";

  let address;
  try {
    ({ address } = await dns.lookup(host));
  } catch (err) {
    return (
      `DIAGNOSIS: DNS lookup of ${host} failed (${err.code}). This is a ` +
      "container DNS problem, NOT the Atlas access list. Check the resolver " +
      "inside the container and the `dns:` entries in docker-compose.yml."
    );
  }

  const reachable = await new Promise((resolve) => {
    const socket = net.connect({ host: address, port: 27017 });
    const done = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(5000);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });

  return reachable
    ? `DIAGNOSIS: DNS and TCP to ${host} (${address}:27017) both work, so the ` +
        "network is fine — this is almost certainly the Atlas IP access list " +
        "or credentials."
    : `DIAGNOSIS: ${host} resolves to ${address} but TCP port 27017 is not ` +
        "reachable. Egress is being blocked (firewall or router), not DNS.";
}

let stopped = false;

/**
 * Connects in the background, retrying with exponential backoff, never
 * rejecting.
 *
 * For the long-running server. Previously a failed initial connect threw, the
 * `app.listen()` waiting on it never ran, and the unhandled rejection killed
 * the process — so a transient DNS blip became a restart loop with no health
 * endpoint left running to explain why. Now the HTTP server stays up and the
 * connection heals by itself once the network recovers.
 *
 * Only the initial connection is retried here; afterwards Mongoose's own
 * reconnection logic takes over, and the listeners below make it visible.
 */
const connectWithRetry = async () => {
  let everConnected = false;

  mongoose.connection.on("disconnected", () => {
    // Only meaningful after a real connection. Mongoose also emits this on
    // every failed initial attempt, which made the startup log claim it would
    // "reconnect" to something it had never reached.
    if (!stopped && everConnected) {
      logger.warn("MongoDB disconnected; Mongoose will reconnect");
    }
  });
  mongoose.connection.on("reconnected", () => {
    logger.info("MongoDB reconnected");
  });

  let attempt = 0;
  let delay = INITIAL_RETRY_DELAY_MS;

  while (!stopped) {
    attempt++;
    try {
      await mongoose.connect(buildUri(), {
        serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
      });
      everConnected = true;
      logger.info(
        `Successfully connected to MongoDB${
          attempt > 1 ? ` (attempt ${attempt})` : ""
        }`,
      );
      return;
    } catch (err) {
      if (stopped) return;
      logger.error(
        `MongoDB connection attempt ${attempt} failed; retrying in ${Math.round(
          delay / 1000,
        )}s.`,
        { error: err.message },
      );
      // Atlas returns the same "not whitelisted" hint whether the real cause
      // is name resolution, egress filtering, or the access list — so probe
      // once and say which it actually is instead of leaving it ambiguous.
      if (attempt === 1) logger.error(await diagnoseConnectivity());
      await new Promise((resolve) => setTimeout(resolve, delay));
      // Capped so recovery stays prompt after a long outage.
      delay = Math.min(delay * 2, MAX_RETRY_DELAY_MS);
    }
  }
};

const closeDB = async () => {
  stopped = true;
  try {
    await mongoose.connection.close();
    logger.info("MongoDB connection closed");
  } catch (err) {
    logger.error("Failed to close MongoDB connection:", err);
  }
};

export { connectDB, connectWithRetry, isDatabaseConnected, closeDB };
