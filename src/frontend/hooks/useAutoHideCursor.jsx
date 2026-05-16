import { useState, useRef, useEffect } from "react";

export default function useAutoHideCursor(ref, timeout = 1000) {
  const [hide, setHide] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const isFullscreenForNode = () => document.fullscreenElement === node;

    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const startTimer = () => {
      clearTimer();
      timerRef.current = setTimeout(() => {
        // Re-check ref is still mounted and still fullscreen
        if (ref.current && isFullscreenForNode()) {
          setHide(true);
        }
      }, timeout);
    };

    const showCursorAndMaybeScheduleHide = () => {
      setHide(false);
      if (!isFullscreenForNode()) {
        clearTimer();
        return;
      }
      startTimer();
    };

    const handleFullscreenChange = () => {
      if (!isFullscreenForNode()) {
        setHide(false);
        clearTimer();
      } else {
        showCursorAndMaybeScheduleHide();
      }
    };

    node.addEventListener("pointermove", showCursorAndMaybeScheduleHide);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    // Only start the hide cycle if already fullscreen when hook mounts
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
