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

  useEffect(() => {
    // Prevent initialization if the URL or the container element is missing
    if (!actualUrl || !viewerRef.current) return;

    let isDestroyed = false;

    const initOSD = () => {
      if (isDestroyed || !viewerRef.current) return;

      // Clear the container to prevent multiple canvases if React re-renders
      viewerRef.current.innerHTML = "";

      // Initialize OpenSeadragon instance
      osdInstance.current = OpenSeadragon({
        element: viewerRef.current,
        // Standard OSD UI icons from CDN
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
        checkUpdateInterval: 50,
        // Updated from 'useCanvas' to 'drawer' to fix deprecation warning
        drawer: "canvas",
      });

      // Handler for successful image loading
      osdInstance.current.addHandler("open", () => {
        if (!isDestroyed) {
          setIsLoading(false);
          if (onLoad) onLoad();
        }
      });

      // Handler for failed image loading (S3 404, CORS, or Invalid DZI)
      osdInstance.current.addHandler("open-failed", (error) => {
        if (!isDestroyed) {
          console.error("❌ OpenSeadragon failed to load:", error);
          setHasError(true);
          setIsLoading(false);
        }
      });
    };

    // Execute initialization after a micro-task to ensure DOM readiness
    const timer = setTimeout(initOSD, 1);

    // CLEANUP: Executed when component unmounts or URL changes
    return () => {
      isDestroyed = true;
      clearTimeout(timer);

      if (osdInstance.current) {
        // 1. Unbind all event handlers
        osdInstance.current.removeAllHandlers();

        // 2. Immediately stop any pending tile requests (prevents WebGL context loss errors)
        osdInstance.current.close();

        // 3. Destroy the viewer and release GPU resources
        osdInstance.current.destroy();
        osdInstance.current = null;
      }

      // 4. Clean up the DOM element manually to be safe
      if (viewerRef.current) {
        viewerRef.current.innerHTML = "";
      }
    };
  }, [actualUrl, onLoad]);

  // Error State Render
  if (hasError) {
    return (
      <div className={styles.ViewerImage} role="alert">
        <div style={{ color: "#fff", textAlign: "center", paddingTop: "20vh" }}>
          <p>Failed to load high-resolution image: {name}</p>
          <img
            src={thumbnailUrl}
            alt="Fallback preview"
            style={{
              maxWidth: "80%",
              maxHeight: "60vh",
              marginTop: "20px",
              borderRadius: "4px",
              boxShadow: "0 4px 15px rgba(0,0,0,0.5)",
            }}
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
      {/* Blurry Thumbnail: Serves as a placeholder while high-res tiles load */}
      {isLoading && (
        <img
          src={thumbnailUrl}
          alt="Loading high-res preview"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            zIndex: 1040,
            filter: "blur(12px)",
            opacity: 0.7,
            transition: "opacity 0.4s ease",
          }}
        />
      )}

      {/* Target element for OpenSeadragon */}
      <div
        ref={viewerRef}
        style={{
          width: "100%",
          height: "100%",
          zIndex: 1050,
        }}
      />
    </div>
  );
};

export default memo(ViewerImage);
