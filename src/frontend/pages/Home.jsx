// src/frontend/pages/Home.js

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useItems } from "../hooks/useItems";
import useWindowHeight from "../hooks/useWindowHeight";
import LazyImage from "../components/LazyImage";
import styles from "../styles/Home.module.css";
import { DOMAIN } from "../constants";
import MascotMedia from "../components/MascotMedia";
import { buildQueryStringWidthHeight } from "../utils/buildQueryStringWidthHeight";
import { useViewportSize } from "../hooks/useViewportSize";
import Viewer from "../components/Viewer";

const Home = () => {
  const navigate = useNavigate();
  const { items } = useItems();
  const [randomPano, setRandomPano] = useState(null);
  const [isPortrait, setIsPortrait] = useState(
    window.innerHeight > window.innerWidth
  );
  const isVeryShort = useWindowHeight(360);
  const { w, h } = useViewportSize();

  // Media items containing pano or img viewer types
  const mediaItems = items.filter(
    (item) => item.viewer === "pano" || item.viewer === "img"
  );

  // State for viewer open and current viewed index
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(null);

  useEffect(() => {
    if (items.length > 0) {
      const panoItems = items.filter((item) => item.viewer === "pano");
      if (panoItems.length > 0) {
        setRandomPano(panoItems[Math.floor(Math.random() * panoItems.length)]);
      }
    }
  }, [items]);

  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const width =
    randomPano && w
      ? Math.min((randomPano.thumbnailWidth || w) * dpr, w * dpr)
      : w * dpr || 0;
  const height =
    randomPano && h
      ? Math.min((randomPano.thumbnailHeight || h) * dpr, h * dpr)
      : h * dpr || 0;

  useEffect(() => {
    const handleResize = () =>
      setIsPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Open viewer with random media item
  const openRandomViewer = () => {
    if (mediaItems.length > 0) {
      const randomIdx = Math.floor(Math.random() * mediaItems.length);
      setCurrentIndex(randomIdx);
      setIsViewerOpen(true);
    }
  };

  // Close viewer and return home
  const closeViewer = () => {
    setIsViewerOpen(false);
    setCurrentIndex(null);
    navigate("/");
  };

  // Navigate to next item, wrap around
  const handleNextItem = () => {
    setCurrentIndex((prev) => (prev + 1) % mediaItems.length);
  };

  // Navigate to previous item, wrap around
  const handlePreviousItem = () => {
    setCurrentIndex((prev) => (prev === 0 ? mediaItems.length - 1 : prev - 1));
  };

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

      {/* Background image wrapper */}
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
        <Viewer
          item={mediaItems[currentIndex]}
          onClose={closeViewer}
          onNext={handleNextItem}
          onPrevious={handlePreviousItem}
          isNavigationMode={true}
        />
      )}

      <div
        className={`${styles.Home} ${isPortrait ? styles.portraitLayout : ""} ${
          isVeryShort ? styles.veryShortViewport : ""
        }`}
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
            aria-label="View random portfolio image or panorama"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") openRandomViewer();
            }}
            style={{ cursor: "pointer" }}
          >
            <MascotMedia
              className={styles.image}
              aria-label="Abstract Altitudes Mascot"
            />
          </div>
        </div>

        <footer className={styles.credits}>
          <div className={`${styles.contentOverlay} ${styles.textShadow}`}>
            <ul className={styles.creditsList}>
              {[
                { href: "https://github.com/wrangel ", label: "wrangel" },
                { href: "https://www.dji.com ", label: "DJI" },
                { href: "https://ptgui.com ", label: "PTGui Pro" },
                { href: "https://www.marzipano.net/ ", label: "Marzipano" },
                {
                  href: "https://www.adobe.com/products/photoshop-lightroom.html ",
                  label: "Adobe Lightroom",
                },
              ].map(({ href, label }) => (
                <li key={label}>
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </footer>
      </div>
    </>
  );
};

export default Home;
