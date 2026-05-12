// src/frontend/pages/Home.js

import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useItems } from "../hooks/useItems";
import useWindowHeight from "../hooks/useWindowHeight";
import styles from "../styles/Home.module.css";
import { DOMAIN } from "../constants";
import MascotMedia from "../components/MascotMedia";
import { useViewportSize } from "../hooks/useViewportSize";
import PopupViewer from "../components/PopupViewer";
import ViewerPanorama from "../components/ViewerPanorama"; // ← NEW IMPORT

function getSecureRandomIndex(max) {
  const array = new Uint32Array(1);
  window.crypto.getRandomValues(array);
  return array[0] % max;
}

// ← NEW HELPER (copied from Viewer.jsx)
function isValidPanoItem(item) {
  return (
    item.viewer === "pano" &&
    item.panoPath &&
    Array.isArray(item.levels) &&
    item.levels.length > 0
  );
}

const Home = () => {
  const { items } = useItems();
  const [randomPano, setRandomPano] = useState(null);
  const [backgroundPanoReady, setBackgroundPanoReady] = useState(false); // ← NEW STATE
  const [isPortrait, setIsPortrait] = useState(
    window.innerHeight > window.innerWidth,
  );
  const isVeryShort = useWindowHeight(360);
  const { w, h } = useViewportSize();

  const mediaItems = items.filter(
    (item) => item.viewer === "pano" || item.viewer === "img",
  );
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(null);

  useEffect(() => {
    if (items.length > 0) {
      const panoItems = items.filter((item) => item.viewer === "pano");
      if (panoItems.length > 0) {
        const selected = panoItems[getSecureRandomIndex(panoItems.length)];
        setRandomPano(selected);
        setBackgroundPanoReady(false); // ← RESET READY STATE
      }
    }
  }, [items]);

  // ... rest of useEffects unchanged ...

  const openRandomViewer = () => {
    if (mediaItems.length > 0) {
      setCurrentIndex(getSecureRandomIndex(mediaItems.length));
      setIsViewerOpen(true);
    }
  };

  const scrollToGrid = () => {
    document
      .getElementById("main-content")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ← REMOVED: dpr/width/height calculations (no longer needed)

  return (
    <>
      <Helmet>
        <title>Abstract Altitudes</title>
        <link rel="canonical" href={DOMAIN} />
        <meta
          name="description"
          content="Explore drone-captured aerial imagery. Peaceful skies."
        />
      </Helmet>

      {/* ← FULLY REPLACED BACKGROUND SECTION */}
      <div className={styles.backgroundWrapper}>
        {randomPano && isValidPanoItem(randomPano) ? (
          <ViewerPanorama
            panoPath={randomPano.panoPath}
            levels={randomPano.levels}
            initialViewParameters={randomPano.initialViewParameters}
            onReady={() => setBackgroundPanoReady(true)}
            onError={(err) => {
              console.error("Background pano error:", err);
              setRandomPano(null);
            }}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              zIndex: 0,
              pointerEvents: "none", // Non-interactive background
            }}
          />
        ) : (
          <div className={styles.backgroundFallback} aria-hidden="true" />
        )}
        {/* ← GRADIENT OVERLAY (moved from CSS ::after) */}
        {backgroundPanoReady && (
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "30vh",
              background: "linear-gradient(to top, black 0%, transparent 100%)",
              zIndex: 1,
              pointerEvents: "none",
            }}
          />
        )}
      </div>

      {/* ← ALL BELOW UNCHANGED */}
      {isViewerOpen && currentIndex !== null && (
        <PopupViewer
          item={mediaItems[currentIndex]}
          isOpen={isViewerOpen}
          onClose={() => setIsViewerOpen(false)}
          onNext={() =>
            setCurrentIndex((prev) => (prev + 1) % mediaItems.length)
          }
          onPrevious={() =>
            setCurrentIndex((prev) =>
              prev === 0 ? mediaItems.length - 1 : prev - 1,
            )
          }
        />
      )}

      <section
        className={`${styles.Home} ${isPortrait ? styles.portraitLayout : ""} ${
          isVeryShort ? styles.veryShortViewport : ""
        }`}
      >
        <div className={styles.contentOverlay}>
          <div className={`${styles.textWrapper} ${styles.textShadow}`}>
            <h1>Abstract Altitudes</h1>
            <h2>Drone Photography</h2>
          </div>

          <div
            className={styles.imageCenterWrapper}
            onClick={openRandomViewer}
            role="button"
            tabIndex={0}
            aria-label="View random portfolio image"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") openRandomViewer();
            }}
          >
            <MascotMedia className={styles.image} />
          </div>
        </div>

        <div
          className="scroll-indicator"
          onClick={scrollToGrid}
          role="button"
          aria-label="Scroll to gallery"
        >
          <p
            style={{
              fontSize: "0.7rem",
              letterSpacing: "3px",
              marginBottom: "0.5rem",
            }}
          ></p>
          <span>↓</span>
        </div>
      </section>
    </>
  );
};

export default Home;
