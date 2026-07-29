// src/backend/routes/combinedDataRoute.mjs

import express from "express";
import { getCombinedData } from "../dataHandler.mjs";
import { getCachedData, setCachedData } from "../cache.mjs";
import { isDatabaseConnected } from "../utils/mongodbConnection.mjs";
import logger from "../utils/logger.mjs";

const router = express.Router();

router.get("/combined-data", async (req, res, next) => {
  const cacheKey = "combined-data";

  try {
    // Same Cache-Control on both paths — previously only the cache-miss
    // branch set it, so a cached hit shipped with no caching header at all.
    res.set("Cache-Control", "public, max-age=300");

    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
      logger.info("[API] Combined-data served from cache");
      return res.status(200).json(cachedData);
    }

    // Cache is cold and the database is not up yet. Say so honestly with a
    // 503 and a Retry-After rather than letting the query hang for the full
    // server-selection timeout and surface as a generic 500 — the client
    // shows "Failed to load items" either way, but this makes the cause
    // legible in logs and lets caches and crawlers behave sensibly.
    if (!isDatabaseConnected()) {
      logger.warn("[API] Combined-data requested while database unavailable");
      res.set("Retry-After", "10");
      return res
        .status(503)
        .json({ error: "Database unavailable, please retry shortly." });
    }

    logger.info("[API] Cache miss. Fetching fresh combined-data from DB");
    const combinedData = await getCombinedData();

    if (!Array.isArray(combinedData)) {
      const error = new Error("Invalid combined data format; expected array");
      error.status = 500;
      return next(error);
    }

    setCachedData(cacheKey, combinedData);

    res.status(200).json(combinedData);
  } catch (error) {
    logger.error("Error fetching combined data", { error });
    next(error);
  }
});

export default router;
