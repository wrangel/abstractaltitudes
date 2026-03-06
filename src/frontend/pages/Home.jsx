import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useItems } from "../hooks/useItems";
import useWindowHeight from "../hooks/useWindowHeight";
import LazyImage from "../components/LazyImage";
import styles from "../styles/Home.module.css";
import { DOMAIN } from "../constants";
import MascotMedia from "../components/MascotMedia";
import { buildQueryStringWidthHeight } from "../utils/buildQueryStringWidthHeight";
import { useViewportSize } from "../hooks/useViewportSize";
import PopupViewer from "../components/PopupViewer";

function getSecureRandomIndex(max) {
  const array = new Uint32Array(1);
  window.crypto.getRandomValues(array);
  return array[0] % max;
}

const Home = () => {
  const { items } = useItems();
  const [randomPano, setRandomPano] = useState(null);
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
        setRandomPano(panoItems[getSecureRandomIndex(panoItems.length)]);
      }
    }
  }, [items]);

  useEffect(() => {
    const handleResize = () =>
      setIsPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const openRandomViewer = () => {
    if (mediaItems.length > 0) {
      setCurrentIndex(getSecureRandomIndex(mediaItems.length));
      setIsViewerOpen(true);
    }
  };

  const scrollToGrid = () => {
    document
      .getElementById("main-content")
      ?.scrollIntoView({ behavior: "smooth" });
  };

  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const width = randomPano ? w * dpr : 0;
  const height = randomPano ? h * dpr : 0;

  return (
    <>
      <Helmet>
        <title>Abstract Altitudes</title>
        <link rel="canonical" href={DOMAIN} />
        <meta
          name="description"
          content="Explore drone-captured aerial imagery. From lofty heights, we muse on marvels."
        />
      </Helmet>

      {/* FIXED BACKGROUND: Parallax effect as grid scrolls over */}
      {randomPano && (
        <div className={styles.backgroundWrapper}>
          <LazyImage
            src={buildQueryStringWidthHeight(randomPano.thumbnailUrl, {
              width,
              height,
            })}
            alt="Background panorama"
            className={styles.backgroundImage}
            placeholderSrc=""
          />
        </div>
      )}

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
        className={`${styles.Home} ${isPortrait ? styles.portraitLayout : ""} ${isVeryShort ? styles.veryShortViewport : ""}`}
      >
        <div className={styles.contentOverlay}>
          <div className={`${styles.textWrapper} ${styles.textShadow}`}>
            <h1>
              From lofty heights,
              <br />
              <span className={styles.break}>we muse on marvels</span>
            </h1>
            <h2>Abstract Altitudes</h2>
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

        {/* Cinematic Scroll Prompt */}
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
          >
            EXPLORE
          </p>
          <span>↓</span>
        </div>
      </section>
    </>
  );
};

export default Home;
