// src/frontend/hooks/useItems.jsx

import { useState, useEffect, useCallback, useDebugValue } from "react";
import { COMBINED_DATA_URL } from "../constants";

// Simple in‑memory cache shared across hook instances
let cachedItems = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// 🔥 Use your backend's datetime field here
// Assumes every item has item.dateTime (ISO string or similar)
const parseItemDate = (item) => {
  const t = new Date(item.dateTime).getTime();
  return Number.isNaN(t) ? 0 : t;
};

// Newest → oldest
const sortItemsByDateDesc = (items) =>
  [...items].sort((a, b) => parseItemDate(b) - parseItemDate(a));

// Shallow identity check; compares by reference and length
const isSameArray = (a, b) => {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

export const useItems = () => {
  const [items, setItems] = useState(cachedItems ? [...cachedItems] : []);
  const [isLoading, setIsLoading] = useState(!cachedItems);
  const [error, setError] = useState(null);

  useDebugValue(items, (items) => `Items count: ${items.length}`);

  const fetchData = useCallback(async () => {
    const now = Date.now();

    // Use cached, already-sorted items if cache is still valid
    if (cachedItems && now - cacheTimestamp < CACHE_TTL) {
      setItems((prev) =>
        isSameArray(prev, cachedItems) ? prev : [...cachedItems]
      );
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(COMBINED_DATA_URL, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const arrayData = Array.isArray(data) ? data : [];

      // 🔥 Canonical sort: newest first
      const sortedData = sortItemsByDateDesc(arrayData);

      setItems((prev) => (isSameArray(prev, sortedData) ? prev : sortedData));

      // Cache the sorted result
      cachedItems = [...sortedData];
      cacheTimestamp = Date.now();
    } catch (e) {
      if (e.name === "AbortError") {
        setError("Request timed out. Please try again.");
      } else {
        setError("Failed to load items. Please try again later.");
      }
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const clearCache = useCallback(() => {
    cachedItems = null;
    cacheTimestamp = 0;
    setItems([]);
    setIsLoading(true);
    fetchData();
  }, [fetchData]);

  return { items, isLoading, error, refetch: fetchData, clearCache };
};
