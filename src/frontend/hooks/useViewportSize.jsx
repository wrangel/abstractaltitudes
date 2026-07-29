// src/frontend/hooks/useViewportSize.jsx

import { useState, useEffect } from "react";

export function useViewportSize() {
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const measure = () => ({
      w: Math.max(document.documentElement.clientWidth, window.innerWidth),
      h: Math.max(document.documentElement.clientHeight, window.innerHeight),
    });

    // Coalesce to one update per frame. resize fires continuously while a
    // window is dragged, and each state change re-lays-out the masonry grid.
    let frame = null;
    const onResize = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        // Skip the render entirely when the dimensions didn't actually change
        // (mobile browsers fire resize on scroll as toolbars collapse).
        setSize((prev) => {
          const next = measure();
          return prev.w === next.w && prev.h === next.h ? prev : next;
        });
      });
    };

    setSize(measure());
    window.addEventListener("resize", onResize);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return size;
}
