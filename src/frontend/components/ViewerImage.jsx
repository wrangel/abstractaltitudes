// src/frontend/components/ViewerImage.jsx

import { useState, useEffect, useRef, memo } from "react";
import panzoom from "panzoom";
import LazyImage from "./LazyImage";
import styles from "../styles/ViewerImage.module.css";

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

const ViewerImage = ({
  actualUrl,
  thumbnailUrl,
  name,
  isNavigationMode,
  onLoad,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showBleep, setShowBleep] = useState(false);

  const containerRef = useRef(null);
  const panZoomInstanceRef = useRef(null);

  const handleLoad = () => {
    setIsLoading(false);
    setShowBleep(true);
    if (onLoad) onLoad();
    setTimeout(() => setShowBleep(false), 500);
  };

  const handleError = () => {
    setHasError(true);
    setIsLoading(false);
  };

  useEffect(() => {
    if (!isLoading && !hasError && containerRef.current) {
      const img = containerRef.current.querySelector("img");
      if (!panZoomInstanceRef.current && img) {
        panZoomInstanceRef.current = panzoom(img);
        // Debounce panzoom events (example: zoom and pan triggers)
        panZoomInstanceRef.current.on(
          "pan",
          debounce(() => {
            // You can add logic here if needed on pan event.
          }, 50)
        );
        panZoomInstanceRef.current.on(
          "zoom",
          debounce(() => {
            // You can add logic here if needed on zoom event.
          }, 50)
        );
      }
    }

    return () => {
      if (panZoomInstanceRef.current) {
        panZoomInstanceRef.current.dispose();
        panZoomInstanceRef.current = null;
      }
    };
  }, [isLoading, hasError]);

  useEffect(() => {
    if (panZoomInstanceRef.current) {
      isNavigationMode
        ? panZoomInstanceRef.current.resume()
        : panZoomInstanceRef.current.pause();
    }
  }, [isNavigationMode]);

  if (hasError) {
    return (
      <div className={styles.ViewerImage} role="alert" aria-live="assertive">
        <p>Failed to load image: {name}</p>
        <img
          src={thumbnailUrl}
          alt={`${name} thumbnail fallback`}
          className={styles.thumbnailFullViewport}
        />
      </div>
    );
  }

  return (
    <div className={styles.ViewerImage}>
      <img
        src={thumbnailUrl}
        alt={`${name} thumbnail`}
        className={styles.thumbnailFullViewport}
        style={{
          opacity: isLoading ? 1 : 0,
          pointerEvents: "none",
          position: "fixed",
          inset: 0,
          width: "100%",
          height: "100vh",
          objectFit: "contain",
          zIndex: 1040,
          transition: "opacity 0.15s ease",
        }}
      />
      <div
        ref={containerRef}
        className={styles.panzoomContainer}
        style={{
          opacity: isLoading ? 0 : 1,
          pointerEvents: isLoading ? "none" : "auto",
          width: "100%",
          height: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          position: "relative",
          zIndex: 1050,
          transition: "opacity 0.15s ease",
        }}
        tabIndex={0}
        aria-label={name}
        role="img"
      >
        <LazyImage
          src={actualUrl}
          alt={name}
          className={styles.image}
          onLoad={handleLoad}
          onError={handleError}
        />
      </div>
      {showBleep && (
        <button
          className={styles.bleepButton}
          aria-label="Image loaded indicator"
          type="button"
          tabIndex={-1}
          onClick={() => console.info("Bleep indicator clicked")}
        >
          ●
        </button>
      )}
    </div>
  );
};

export default memo(ViewerImage);
