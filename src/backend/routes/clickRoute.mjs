// src/backend/routes/clickRoute.mjs

import express from "express";
import rateLimit from "express-rate-limit";
import { Island } from "../models/islandModel.mjs";
import logger from "../utils/logger.mjs";

const router = express.Router();

/**
 * Tight per-IP rate limit for the click endpoint.
 * Prevents trivial counter inflation — 20 clicks/min per IP is generous
 * for normal browsing but stops any simple script.
 */
const clickLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

/**
 * POST /api/items/:id/click
 *
 * Increments the click counter for one item.
 * Private — the count is stored in MongoDB but never returned
 * in the public combined-data response.
 * Returns 204 on success (no body needed).
 */
router.post("/items/:id/click", clickLimiter, async (req, res, next) => {
  const { id } = req.params;

  if (!OBJECT_ID_RE.test(id)) {
    return res.status(400).json({ error: "Invalid item id" });
  }

  try {
    const result = await Island.findByIdAndUpdate(id, { $inc: { clicks: 1 } });

    if (!result) {
      return res.status(404).json({ error: "Item not found" });
    }

    res.status(204).end();
  } catch (error) {
    logger.error("Error incrementing click count", { error, id });
    next(error);
  }
});

export default router;
