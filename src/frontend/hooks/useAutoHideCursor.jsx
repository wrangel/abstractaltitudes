// src/frontend/hooks/useAutoHideCursor.jsx

import { useState, useRef, useEffect } from "react";

export default function useAutoHideCursor(ref, timeout = 1000) {
  const [hide, setHide] = useState(false);
  const timerRef = useRef();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const showCursor = () => {
      setHide(false);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setHide(true), timeout);
    };

    node.addEventListener("pointermove", showCursor);
    showCursor();

    return () => {
      node.removeEventListener("pointermove", showCursor);
      clearTimeout(timerRef.current);
    };
  }, [ref, timeout]);

  return hide;
}
