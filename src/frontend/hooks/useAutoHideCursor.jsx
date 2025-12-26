// src/frontend/hooks/useAutoHideCursor.jsx

import { useState, useRef, useEffect } from "react";

export default function useAutoHideCursor(ref, timeout = 1000) {
  const [hide, setHide] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const isFullscreenForNode = () => document.fullscreenElement === node; // null when not in fullscreen [web:3][web:21]

    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const startTimer = () => {
      clearTimer();
      timerRef.current = setTimeout(() => {
        // Only hide if still fullscreen for this node
        if (isFullscreenForNode()) {
          setHide(true);
        }
      }, timeout);
    };

    const showCursorAndMaybeScheduleHide = () => {
      // Any pointer movement shows cursor again
      setHide(false);

      // If not fullscreen, do not schedule hiding
      if (!isFullscreenForNode()) {
        clearTimer();
        return;
      }

      startTimer();
    };

    const handleFullscreenChange = () => {
      if (!isFullscreenForNode()) {
        // Left fullscreen: show cursor and cancel timer
        setHide(false);
        clearTimer();
      } else {
        // Entered fullscreen: begin auto‑hide cycle
        showCursorAndMaybeScheduleHide();
      }
    };

    // Pointer movement only matters while this node is present
    node.addEventListener("pointermove", showCursorAndMaybeScheduleHide);

    // Listen at document level for fullscreen transitions. [web:24][web:27]
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    // If already in fullscreen when hook mounts, start cycle
    if (isFullscreenForNode()) {
      showCursorAndMaybeScheduleHide();
    } else {
      setHide(false);
    }

    return () => {
      node.removeEventListener("pointermove", showCursorAndMaybeScheduleHide);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      clearTimer();
    };
  }, [ref, timeout]);

  return hide;
}
