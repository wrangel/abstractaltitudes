import { useState, useEffect, useRef, memo } from "react";
import OpenSeadragon from "openseadragon";
import styles from "../styles/ViewerImage.module.css";

const ViewerImage = ({ actualUrl, thumbnailUrl, name, onLoad }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const viewerRef = useRef(null);
  const osdInstance = useRef(null);

  useEffect(() => {
    if (!actualUrl || !viewerRef.current) return;

    let isDestroyed = false;

    const initOSD = () => {
      if (isDestroyed) return;

      if (viewerRef.current) {
        viewerRef.current.innerHTML = "";
      }

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
        checkUpdateInterval: 50,
      });

      osdInstance.current.addHandler("open", () => {
        if (!isDestroyed) {
          setIsLoading(false);
          if (onLoad) onLoad();
        }
      });

      osdInstance.current.addHandler("open-failed", (error) => {
        if (!isDestroyed) {
          // Keep this one so you know if the CDN or S3 fails
          console.error("❌ OSD failed to load:", error);
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
        osdInstance.current.removeAllHandlers();
        osdInstance.current.destroy();
        osdInstance.current = null;
      }
      if (viewerRef.current) {
        viewerRef.current.innerHTML = "";
      }
    };
  }, [actualUrl, onLoad]);

  if (hasError) {
    return (
      <div className={styles.ViewerImage} role="alert">
        <div style={{ color: "#fff", textAlign: "center", paddingTop: "20vh" }}>
          <p>Failed to load high-res image: {name}</p>
          <img
            src={thumbnailUrl}
            alt="fallback"
            style={{ maxWidth: "80%", maxHeight: "60vh", marginTop: "20px" }}
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
          alt="loading"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            zIndex: 1040,
            filter: "blur(10px)",
            opacity: 0.8,
            transition: "opacity 0.5s ease",
          }}
        />
      )}

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
