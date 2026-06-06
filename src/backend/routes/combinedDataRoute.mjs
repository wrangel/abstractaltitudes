// src/backend/routes/combinedDataRoute.mjs

import express from "express";
import { getCombinedData } from "../dataHandler.mjs";
import { getCachedData, setCachedData } from "../cache.mjs";
import logger from "../utils/logger.mjs";

const router = express.Router();

router.get("/combined-data", async (req, res, next) => {
  const cacheKey = "combined-data";

  try {
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
      // Keep this! It's great context for your API logs
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

    const decorated = combinedData.map((item, index) => ({
      ...item,
      isFirst: index === 0,
      isLast: index === combinedData.length - 1,
    }));

    setCachedData(cacheKey, decorated);

    // Good practice: Tells browsers/CDNs they can cache it for 5 mins too
    res.set("Cache-Control", "public, max-age=300");

    res.status(200).json(decorated);
  } catch (error) {
    logger.error("Error fetching combined data", { error });
    next(error);
  }
});

export default router;
