// src/frontend/hooks/useItems.jsx

import { useState, useEffect, useCallback, useDebugValue } from "react";
import { COMBINED_DATA_URL } from "../constants";

let cachedItems = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const useItems = () => {
  const [items, setItems] = useState(cachedItems ? [...cachedItems] : []);
  const [isLoading, setIsLoading] = useState(!cachedItems);
  const [error, setError] = useState(null);

  useDebugValue(items, (items) => `Items count: ${items.length}`);

  const isSameArray = (a, b) => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  };

  const fetchData = useCallback(async (signal) => {
    const now = Date.now();

    if (cachedItems && now - cacheTimestamp < CACHE_TTL) {
      setItems((prev) =>
        isSameArray(prev, cachedItems) ? prev : [...cachedItems]
      );
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(COMBINED_DATA_URL, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();

      setItems((prev) => (isSameArray(prev, data) ? prev : data));
      cachedItems = [...data];
      cacheTimestamp = Date.now();
    } catch (e) {
      if (e.name === "AbortError") {
        setError("Request timed out. Please try again.");
      } else {
        setError("Failed to load items. Please try again later.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetchData(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchData]);

  const clearCache = useCallback(() => {
    cachedItems = null;
    cacheTimestamp = 0;
    setItems([]);
    setIsLoading(true);

    const controller = new AbortController();
    fetchData(controller.signal);
  }, [fetchData]);

  return { items, isLoading, error, refetch: fetchData, clearCache };
};
