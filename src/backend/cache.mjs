// src/backend/cache.mjs

/**
 * @module cache
 *
 * Simple in-memory caching layer using NodeCache with TTL.
 * Provides functions to get, set, invalidate cache entries,
 * and print cache statistics for debugging.
 */

import NodeCache from "node-cache";
import logger from "./utils/logger.mjs";

// Cache TTL of 60 seconds, cleanup every 120 seconds
const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

/**
 * Retrieves cached data by key.
 * Logs cache hit or miss at debug level for low-noise observability.
 * @param {string} key - Cache key
 * @returns {*} Cached value or undefined if not found
 */
export const getCachedData = (key) => {
  try {
    const data = cache.get(key);
    if (data) {
      logger.debug(`[CACHE] Cache hit for key=${key}`);
    } else {
      logger.debug(`[CACHE] Cache miss for key=${key}`);
    }
    return data;
  } catch (error) {
    logger.error(
      `[CACHE ERROR] getCachedData failed for key=${key}: ${error.message}`,
      { error },
    );
    return undefined;
  }
};

/**
 * Stores data in cache with the given key.
 * Overwrites existing entries.
 * @param {string} key - Cache key
 * @param {*} value - Data to cache
 */
export const setCachedData = (key, value) => {
  try {
    cache.set(key, value);
    logger.debug(`[CACHE] Cache set for key=${key}`);
  } catch (error) {
    logger.error(
      `[CACHE ERROR] setCachedData failed for key=${key}: ${error.message}`,
      { error },
    );
  }
};

/**
 * Deletes a cache entry by key.
 * Useful for manual invalidation when underlying data updates.
 * @param {string} key - Cache key
 */
export const invalidateCache = (key) => {
  try {
    cache.del(key);
    logger.info(`[CACHE] Cache explicitly invalidated for key=${key}`);
  } catch (error) {
    logger.error(
      `[CACHE ERROR] invalidateCache failed for key=${key}: ${error.message}`,
      { error },
    );
  }
};

/**
 * Logs cache statistics to help with debugging cache usage and performance.
 */
export const printCacheStats = () => {
  try {
    const stats = cache.getStats();
    logger.info("[CACHE STATS]", stats);
  } catch (error) {
    logger.error(`[CACHE ERROR] printCacheStats failed: ${error.message}`, {
      error,
    });
  }
};
