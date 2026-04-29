import { useState, useEffect, useRef, memo } from "react";
import panzoom from "panzoom";
import LazyImage from "./LazyImage";
import styles from "../styles/ViewerImage.module.css";

const ViewerImage = ({ actualUrl, thumbnailUrl, name, onLoad }) => {
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
    // Wait until loading is done, no errors exist, the container is ready,
    // and we have an authorized URL from the parent.
    if (isLoading || hasError || !containerRef.current || !actualUrl) return;
    if (panZoomInstanceRef.current) return;

    const img = containerRef.current.querySelector("img");
    if (img) {
      img.style.maxWidth = "none";
      img.style.maxHeight = "none";
    }

    panZoomInstanceRef.current = panzoom(containerRef.current, {
      maxZoom: 5,
      minZoom: 0.5,
      bounds: true,
      boundsPadding: 0.1,
      beforeWheel: () => false,
      beforeMouseDown: () => false,
    });

    return () => {
      if (panZoomInstanceRef.current) {
        panZoomInstanceRef.current.dispose();
        panZoomInstanceRef.current = null;
      }
    };
  }, [isLoading, hasError, actualUrl]);

  if (hasError) {
    return (
      <div className={styles.ViewerImage} role="alert">
        <p>Failed to load image: {name}</p>
        <img
          src={thumbnailUrl}
          alt="fallback"
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
          width: "100vw",
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
          touchAction: "none",
        }}
      >
        {/* We use actualUrl directly. Viewer.jsx handles the signing. */}
        {actualUrl && (
          <LazyImage
            src={actualUrl}
            alt={name}
            className={styles.image}
            onLoad={handleLoad}
            onError={handleError}
          />
        )}
      </div>

      {showBleep && (
        <button className={styles.bleepButton} type="button" tabIndex={-1}>
          ●
        </button>
      )}
    </div>
  );
};

export default memo(ViewerImage);
