// src/frontend/hooks/useClickCounter.jsx

import { useCallback } from "react";
import { ITEMS_URL } from "../constants";

/**
 * Key used to opt out of click tracking in localStorage.
 * Set automatically by visiting https://abstractaltitudes.com/#aa-owner
 * (handled in src/index.jsx before React mounts).
 * Clear it to resume normal tracking:
 *   localStorage.removeItem('aa_owner')
 */
const OWNER_FLAG = "aa_owner";

/**
 * Fire-and-forget click counter hook.
 *
 * Skips tracking when:
 *   - Running in dev mode (import.meta.env.DEV)
 *   - The owner flag is set in localStorage
 *
 * Errors are swallowed silently — the counter is non-critical
 * and must never affect the viewer experience.
 *
 * @returns {{ recordClick: (itemId: string) => void }}
 */
export const useClickCounter = () => {
  const recordClick = useCallback((itemId) => {
    // Option 1: skip in local dev
    if (import.meta.env.DEV) return;

    // Option 2: skip if owner flag is set
    if (localStorage.getItem(OWNER_FLAG) === "1") return;

    // Fire and forget — no await, no state update
    fetch(`${ITEMS_URL}/${itemId}/click`, { method: "POST" }).catch(() => {
      // Silently ignore — network errors must not surface to the user
    });
  }, []);

  return { recordClick };
};
