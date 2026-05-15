import { useState, useEffect, useRef, memo } from "react";
import OpenSeadragon from "openseadragon";
import styles from "../styles/ViewerImage.module.css";

/**
 * ViewerImage Component
 * Handles high-resolution Deep Zoom Images (DZI) using OpenSeadragon.
 */
const ViewerImage = ({ actualUrl, thumbnailUrl, name, onLoad }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const viewerRef = useRef(null);
  const osdInstance = useRef(null);

  /* -------------------------------------------------
   1. Main OSD Initialization & Teardown
   ------------------------------------------------- */
  useEffect(() => {
    if (!actualUrl || !viewerRef.current) return;

    let isDestroyed = false;

    const initOSD = () => {
      if (isDestroyed || !viewerRef.current) return;

      // Clear container to prevent duplicate canvases
      viewerRef.current.innerHTML = "";

      osdInstance.current = OpenSeadragon({
        element: viewerRef.current,
        prefixUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/openseadragon/4.1.0/images/",
        tileSources: actualUrl,
        crossOriginPolicy: "Anonymous",
        loadTilesWithAjax: true,
        showNavigationControl: false,
        gestureSettingsMouse: { clickToZoom: false },
        visibilityRatio: 1.0,
        constrainDuringPan: true,
        minZoomImageRatio: 1,
        drawer: "canvas",
        // Optimization for mobile memory
        maxImageCacheCount: 50,
      });

      osdInstance.current.addHandler("open", () => {
        if (!isDestroyed) {
          setIsLoading(false);
          if (onLoad) onLoad();
        }
      });

      osdInstance.current.addHandler("open-failed", (error) => {
        if (!isDestroyed) {
          console.error("❌ OpenSeadragon failed:", error);
          setHasError(true);
          setIsLoading(false);
        }
      });
    };

    const timer = setTimeout(initOSD, 1);

    return () => {
      isDestroyed = true;
      clearTimeout(timer);
      if (osdInstance.current) {
        osdInstance.current.destroy();
        osdInstance.current = null;
      }
      if (viewerRef.current) {
        viewerRef.current.innerHTML = "";
      }
    };
  }, [actualUrl, onLoad]);

  /* -------------------------------------------------
   2. Fullscreen/Resize Stability Fix
   ------------------------------------------------- */
  useEffect(() => {
    const handleFsResize = () => {
      if (osdInstance.current) {
        // We delay for 500ms to allow the mobile browser's
        // layout transition (shrinking/growing) to finish.
        setTimeout(() => {
          if (osdInstance.current && osdInstance.current.viewport) {
            // Re-sync the internal canvas size with the new DOM size
            osdInstance.current.forceRedraw();
            // Optional: reset view to ensure image isn't "lost" off-screen
            osdInstance.current.viewport.goHome(true);
          }
        }, 500);
      }
    };

    document.addEventListener("fullscreenchange", handleFsResize);
    window.addEventListener("resize", handleFsResize);

    return () => {
      document.removeEventListener("fullscreenchange", handleFsResize);
      window.removeEventListener("resize", handleFsResize);
    };
  }, []);

  if (hasError) {
    return (
      <div className={styles.ViewerImage} role="alert">
        <div style={{ color: "#fff", textAlign: "center", paddingTop: "20vh" }}>
          <p>Failed to load: {name}</p>
          <img
            src={thumbnailUrl}
            alt="Fallback"
            style={{ maxWidth: "80%", marginTop: "20px" }}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={styles.ViewerImage}
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        background: "#000",
        overflow: "hidden",
      }}
    >
      {isLoading && (
        <img
          src={thumbnailUrl}
          alt="Loading"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            zIndex: 1040,
            filter: "blur(12px)",
            opacity: 0.7,
          }}
        />
      )}
      <div
        ref={viewerRef}
        style={{ width: "100%", height: "100%", zIndex: 1050 }}
      />
    </div>
  );
};

export default memo(ViewerImage);
