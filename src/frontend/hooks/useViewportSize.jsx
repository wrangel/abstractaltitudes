// src/frontend/hooks/useViewportSize.jsx

import { useState, useEffect } from "react";

export function useViewportSize() {
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const update = () =>
      setSize({
        w: Math.max(document.documentElement.clientWidth, window.innerWidth),
        h: Math.max(document.documentElement.clientHeight, window.innerHeight),
      });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return size;
}
