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
      logger.info("[CACHE HIT] Returning cached combined-data");
      return res.status(200).json(cachedData);
    }

    logger.info("[CACHE MISS] Fetching fresh combined-data");
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

    res.set("Cache-Control", "public, max-age=300");

    res.status(200).json(decorated);
  } catch (error) {
    logger.error("Error fetching combined data", { error });
    next(error); // Forward to global error handler middleware
  }
});

export default router;
