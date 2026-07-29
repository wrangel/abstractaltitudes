// src/backend/routes/combinedDataRoute.mjs

import express from "express";
import { getCombinedData } from "../dataHandler.mjs";
import { getCachedData, setCachedData } from "../cache.mjs";
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
