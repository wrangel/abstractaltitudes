import { useEffect, useRef, useState, memo } from "react";
import OpenSeadragon from "openseadragon";
import styles from "../styles/ViewerImage.module.css";

const ViewerImage = ({ tileSourceUrl, thumbnailUrl, name, onLoad }) => {
  const viewerRef = useRef(null);
  const osdInstance = useRef(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // 🔍 NEW CHECK: We only need the viewer element and the tileSourceUrl
    if (!viewerRef.current || !tileSourceUrl) return;

    // Cleanup before re-initialization
    if (osdInstance.current) {
      try {
        osdInstance.current.destroy();
      } catch (e) {
        console.warn("OSD destroy failed:", e);
      }
      osdInstance.current = null;
    }

    setLoaded(false);

    // =========================
    // VIEWER INIT (DZI Mode)
    // =========================
    const viewer = OpenSeadragon({
      element: viewerRef.current,
      prefixUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/openseadragon/4.1.0/images/",

      // 🔥 THE MAGIC LINK:
      // Instead of a manual object, we pass the URL string to the .dzi file.
      tileSources: tileSourceUrl,

      crossOriginPolicy: "Anonymous",
      loadTilesWithAjax: true, // Recommended for DZI over S3/CDNs

      // Navigation & Clean Look
      showNavigationControl: false,
      showZoomControl: false,
      showHomeControl: false,
      showFullPageControl: false,

      // Performance & Interaction
      gestureSettingsMouse: {
        clickToZoom: true,
        dblClickToZoom: true,
        pinchToZoom: true,
        scrollToZoom: true,
      },

      animationTime: 0.5,
      blendTime: 0.1,
      visibilityRatio: 1.0,
      constrainDuringPan: true,
    });

    osdInstance.current = viewer;

    // =========================
    // EVENTS
    // =========================
    const onOpen = () => {
      setLoaded(true);
      onLoad?.();
    };

    const onFail = (e) => {
      console.error("OSD failed to open DZI:", e.message, tileSourceUrl);
    };

    viewer.addHandler("open", onOpen);
    viewer.addHandler("open-failed", onFail);

    // Cleanup on unmount
    return () => {
      if (osdInstance.current) {
        try {
          osdInstance.current.removeHandler("open", onOpen);
          osdInstance.current.removeHandler("open-failed", onFail);
          osdInstance.current.destroy();
        } catch (e) {
          console.warn("OSD cleanup error:", e);
        }
        osdInstance.current = null;
      }
    };
  }, [tileSourceUrl]); // Re-init only when the DZI URL changes

  return (
    <div
      className={styles.ViewerImage}
      style={{
        width: "100%",
        height: "100%",
        background: "#000",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Placeholder thumbnail */}
      {!loaded && thumbnailUrl && (
        <img
          src={thumbnailUrl}
          alt={name}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            zIndex: 1,
            filter: "blur(5px)",
            transition: "opacity 0.5s ease",
          }}
        />
      )}

      {/* OSD Canvas */}
      <div
        ref={viewerRef}
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          zIndex: 2,
          opacity: loaded ? 1 : 0,
          transition: "opacity 0.3s ease",
        }}
      />
    </div>
  );
};

export default memo(ViewerImage);
