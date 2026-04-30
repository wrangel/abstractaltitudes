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

  // WICHTIG: Wenn sich die URL ändert (nächstes Bild), Status zurücksetzen
  useEffect(() => {
    setIsLoading(true);
    setHasError(false);

    // Altes Panzoom entsorgen, falls vorhanden
    if (panZoomInstanceRef.current) {
      panZoomInstanceRef.current.dispose();
      panZoomInstanceRef.current = null;
    }
  }, [actualUrl]);

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
    // Initialisierung nur, wenn Bild geladen, kein Fehler und Container da
    if (isLoading || hasError || !containerRef.current || !actualUrl) return;

    // Falls durch schnelles Klicken doch noch eine Instanz da ist: weg damit
    if (panZoomInstanceRef.current) {
      panZoomInstanceRef.current.dispose();
    }

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
      zoomDoubleClickGraph: false, // Verhindert Konflikte mit UI
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
      {/* Thumbnail als Platzhalter */}
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
          transition: "opacity 0.3s ease", // Etwas weicherer Übergang
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
