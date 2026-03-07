import { useEffect, useRef, useCallback } from "react";

export const useScrollReveal = () => {
  const observerRef = useRef(null);

  useEffect(() => {
    // Check if browser supports IntersectionObserver
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      return;
    }
  }, []);

  const setRef = useCallback((node) => {
    if (node && observerRef.current) {
      observerRef.current.observe(node);
    }
  }, []);

  return setRef;
};
