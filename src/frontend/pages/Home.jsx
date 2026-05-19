import { useState, useEffect, useCallback, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { useItems } from "../hooks/useItems";
import useWindowHeight from "../hooks/useWindowHeight";
import styles from "../styles/Home.module.css";
import { DOMAIN } from "../constants";
import { useViewportSize } from "../hooks/useViewportSize";
import PopupViewer from "../components/PopupViewer";
import ViewerPanorama from "../components/ViewerPanorama";
import { hasWebGL } from "../utils/webglSupport";

function getSecureRandomIndex(max) {
  const array = new Uint32Array(1);
  window.crypto.getRandomValues(array);
  return array[0] % max;
}

function isValidPanoItem(item) {
  return (
    item.viewer === "pano" &&
    item.panoPath &&
    Array.isArray(item.levels) &&
    item.levels.length > 0
  );
}

function isAppleBrowser() {
  return (
    /iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent) &&
    typeof window.ApplePaySession !== "undefined"
  );
}

const Home = () => {
  const { items } = useItems();

  const canUsePano = !isAppleBrowser() && hasWebGL();

  const [backgroundPano, setBackgroundPano] = useState(null);
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [backgroundPanoReady, setBackgroundPanoReady] = useState(false);

  const [isPortrait, setIsPortrait] = useState(
    window.innerHeight > window.innerWidth,
  );
  const isVeryShort = useWindowHeight(360);
  const { w, h } = useViewportSize();

  const mediaItems = canUsePano
    ? items.filter(isValidPanoItem)
    : items.filter((item) => item.viewer === "img");

  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(null);

  // Incremented every time the popup closes so the background VP gets a
  // completely fresh React fiber (new key → new instance → null refs →
  // Effect #1 runs clean). Without this, React can carry over stale fiber
  // state from the previous mount and the Effect #1 guard
  // `if (viewerRef.current) return` silently skips viewer creation.
  const [bgKey, setBgKey] = useState(0);

  // Stable callback refs so ViewerPanorama's Effect #1 deps never change
  const handleBackgroundReadyRef = useRef(() => setBackgroundPanoReady(true));
  const handleBackgroundErrorRef = useRef(null);
  const handleBackgroundReady = useCallback(
    () => setBackgroundPanoReady(true),
    [],
  );
  const handleBackgroundError = useCallback((err) => {
    console.error("Background pano error:", err);
    setBackgroundPano(null);
  }, []);

  useEffect(() => {
    if (items.length === 0) return;
    if (canUsePano) {
      const panoItems = items.filter(isValidPanoItem);
      if (panoItems.length > 0) {
        setBackgroundPano(panoItems[getSecureRandomIndex(panoItems.length)]);
        setBackgroundPanoReady(false);
      }
    } else {
      const imgItems = items.filter(
        (item) => item.viewer === "img" && item.thumbnailUrl,
      );
      if (imgItems.length > 0) {
        setBackgroundImage(imgItems[getSecureRandomIndex(imgItems.length)]);
      }
    }
  }, [items]);

  useEffect(() => {
    const handleResize = () =>
      setIsPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const openRandomViewer = useCallback(() => {
    if (mediaItems.length === 0) return;
    setCurrentIndex(getSecureRandomIndex(mediaItems.length));
    setIsViewerOpen(true);
  }, [mediaItems]);

  const handleViewerClose = useCallback(() => {
    setIsViewerOpen(false);
    setCurrentIndex(null);
    // Force a completely fresh ViewerPanorama fiber for the background.
    // A new key guarantees null refs on mount so Effect #1's guard
    // `if (viewerRef.current) return` never skips viewer creation.
    setBgKey((k) => k + 1);
  }, []);

  const scrollToGrid = () => {
    document
      .getElementById("main-content")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const popupItem = currentIndex !== null ? mediaItems[currentIndex] : null;

  // Never have two ViewerPanorama instances alive simultaneously —
  // they would evict each other via WebGLManager causing a chaos loop.
  // Tie visibility directly to isViewerOpen: when the modal is open the
  // popup's ViewerPanorama holds the WebGL context; when it's closed
  // (FullScreenModal returns null → popup VP unmounts) the background
  // VP can safely remount and re-acquire it.
  // Do NOT use !popupItem here — currentIndex stays set after close in
  // Grid and would keep showBackgroundPano false forever.
  const showBackgroundPano = canUsePano && backgroundPano && !isViewerOpen;

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

      <div className={styles.backgroundWrapper}>
        {showBackgroundPano ? (
          <ViewerPanorama
            key={bgKey}
            panoPath={backgroundPano.panoPath}
            levels={backgroundPano.levels}
            initialViewParameters={backgroundPano.initialViewParameters}
            onReady={handleBackgroundReady}
            onError={handleBackgroundError}
          />
        ) : backgroundImage ? (
          <img
            src={backgroundImage.thumbnailUrl}
            alt=""
            aria-hidden="true"
            className={styles.backgroundImage}
          />
        ) : (
          <div className={styles.backgroundFallback} aria-hidden="true" />
        )}
        <div className={styles.backgroundGradient} aria-hidden="true" />
      </div>

      {popupItem && (
        <PopupViewer
          item={popupItem}
          isOpen={isViewerOpen}
          onClose={handleViewerClose}
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
          <div
            className={`${styles.textWrapper} ${styles.textShadow} ${styles.textClickable}`}
            onClick={openRandomViewer}
            role="button"
            tabIndex={0}
            aria-label="View random portfolio item"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") openRandomViewer();
            }}
          >
            <h1>Abstract Altitudes</h1>
            <h2>Drone Photography</h2>
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
          />
          <span>↓</span>
        </div>
      </section>
    </>
  );
};

export default Home;
