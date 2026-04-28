// src/frontend/components/ViewerImage.jsx

import { useState, useEffect, useRef, memo } from "react";
import panzoom from "panzoom";
import LazyImage from "./LazyImage";
import styles from "../styles/ViewerImage.module.css";

const ViewerImage = ({
  actualUrl,
  thumbnailUrl,
  name,
  onLoad,
  // isNavigationMode intentionally not used here — panzoom is always active.
  // The navigation arrows are controlled by the parent; zoom is independent.
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
    if (isLoading || hasError || !containerRef.current) return;
    if (panZoomInstanceRef.current) return;

    // Remove CSS size constraints from the img so panzoom can scale freely.
    // max-width/max-height cap the transform origin and break zoom at scale > 1.
    const img = containerRef.current.querySelector("img");
    if (img) {
      img.style.maxWidth = "none";
      img.style.maxHeight = "none";
    }

    // Apply panzoom to the CONTAINER div, not to the img element.
    // Applying to img causes conflicts with CSS constraints and produces
    // an unpredictable transform origin.
    panZoomInstanceRef.current = panzoom(containerRef.current, {
      maxZoom: 5,
      minZoom: 0.5,
      bounds: true,
      boundsPadding: 0.1,
      // Returning false means "handle this event" (don't skip).
      // Prevents the browser intercepting wheel/pinch for native page zoom.
      beforeWheel: () => false,
      beforeMouseDown: () => false,
    });

    return () => {
      if (panZoomInstanceRef.current) {
        panZoomInstanceRef.current.dispose();
        panZoomInstanceRef.current = null;
      }
    };
  }, [isLoading, hasError]);

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
      {/* Low-res thumbnail visible while the high-res image loads */}
      <img
        src={thumbnailUrl}
        alt={`${name} thumbnail`}
        className={styles.thumbnailFullViewport}
        style={{
          opacity: isLoading ? 1 : 0,
          pointerEvents: "none",
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100vh",
          objectFit: "contain",
          zIndex: 1040,
          transition: "opacity 0.15s ease",
        }}
      />

      {/* panzoom attaches to this wrapper div */}
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
          // Hand all touch/pointer gestures to JS.
          // Without this, mobile browsers intercept pinch for native page zoom
          // before panzoom can process it.
          touchAction: "none",
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
