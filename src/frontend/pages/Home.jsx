import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import { useItems } from "../hooks/useItems";
import useWindowHeight from "../hooks/useWindowHeight";
import styles from "../styles/Home.module.css";
import PopupViewer from "../components/PopupViewer";
import { hasWebGL } from "../utils/webglSupport";

const ViewerPanorama = lazy(() => import("../components/ViewerPanorama"));

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

const Home = () => {
  const { items } = useItems();

  const canUsePano = hasWebGL();

  const [backgroundPano, setBackgroundPano] = useState(null);
  const [backgroundImage, setBackgroundImage] = useState(null);

  const [isPortrait, setIsPortrait] = useState(
    window.innerHeight > window.innerWidth,
  );
  const isVeryShort = useWindowHeight(360);

  // Memoized: this array is a dependency of openBackgroundViewer below, so a
  // fresh array every render would rebuild that callback every render too.
  const mediaItems = useMemo(
    () =>
      canUsePano
        ? items.filter(isValidPanoItem)
        : items.filter((item) => item.viewer === "img"),
    [items, canUsePano],
  );

  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(null);

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
      }
    } else {
      const imgItems = items.filter(
        (item) => item.viewer === "img" && item.thumbnailUrl,
      );
      if (imgItems.length > 0) {
        setBackgroundImage(imgItems[getSecureRandomIndex(imgItems.length)]);
      }
    }
  }, [items, canUsePano]);

  useEffect(() => {
    const handleResize = () =>
      setIsPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const openBackgroundViewer = useCallback(() => {
    if (mediaItems.length === 0) return;
    const backgroundItem = canUsePano ? backgroundPano : backgroundImage;
    const idx = backgroundItem
      ? mediaItems.findIndex((item) => item.id === backgroundItem.id)
      : -1;
    setCurrentIndex(idx !== -1 ? idx : getSecureRandomIndex(mediaItems.length));
    setIsViewerOpen(true);
  }, [mediaItems, canUsePano, backgroundPano, backgroundImage]);

  const handleViewerClose = useCallback(() => {
    setIsViewerOpen(false);
    setCurrentIndex(null);
  }, []);

  const scrollToGrid = () => {
    document
      .getElementById("main-content")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // isFirst/isLast forced false: navigation below wraps around via modulo,
  // so there's never a true boundary — both nav arrows should always show.
  const popupItem =
    currentIndex !== null
      ? { ...mediaItems[currentIndex], isFirst: false, isLast: false }
      : null;

  // The background VP stays mounted the whole time; it just suspends
  // (releases context, pauses Marzipano) while the popup is open so the
  // two instances never hold the WebGL context simultaneously.
  const showBackgroundPano = canUsePano && !!backgroundPano;

  // No <title>/<meta> here on purpose: this is the only page, so index.html
  // is the single source of truth. Per-photo pages should render <title> and
  // <meta> tags inline — React 19 hoists them into <head> natively, no
  // helmet library needed.
  return (
    <>
      <div className={styles.backgroundWrapper}>
        {showBackgroundPano ? (
          <Suspense
            fallback={
              <div className={styles.backgroundFallback} aria-hidden="true" />
            }
          >
            <ViewerPanorama
              panoPath={backgroundPano.panoPath}
              levels={backgroundPano.levels}
              initialViewParameters={backgroundPano.initialViewParameters}
              onError={handleBackgroundError}
              unmanaged
            />
          </Suspense>
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
            onClick={openBackgroundViewer}
            role="button"
            tabIndex={0}
            aria-label="View this portfolio item"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") openBackgroundViewer();
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
