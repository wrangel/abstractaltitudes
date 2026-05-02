import { useEffect, useRef, useState, memo } from "react";
import OpenSeadragon from "openseadragon";
import styles from "../styles/ViewerImage.module.css";

const ViewerImage = ({ actualUrl, levels, thumbnailUrl, name, onLoad }) => {
  const viewerRef = useRef(null);
  const osdInstance = useRef(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Sicherheits-Check: Wir brauchen URL und valide Levels
    if (!viewerRef.current || !actualUrl || !levels?.length) return;

    // =========================
    // CLEANUP (Vor Neu-Initialisierung)
    // =========================
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
    // LEVELS (Sortierung sicherstellen)
    // =========================
    const sortedLevels = [...levels].sort((a, b) => a.width - b.width);
    const maxLevel = sortedLevels[sortedLevels.length - 1];

    if (!maxLevel || !maxLevel.width || !maxLevel.height) {
      console.error("OSD: Invalid level dimensions", maxLevel);
      return;
    }

    // =========================
    // TILE SOURCE (Mapping für Google-Layout)
    // =========================
    const tileSource = {
      width: maxLevel.width,
      height: maxLevel.height,
      tileSize: sortedLevels[0]?.tileSize || 512,
      tileOverlap: 0,
      minLevel: 0,
      maxLevel: sortedLevels.length - 1,

      // Schaut in S3-Ordner: tiles/{z}/{x}/{y}.jpg
      getTileUrl: (level, x, y) => {
        return `${actualUrl}/${level}/${x}/${y}.jpg`;
      },
    };

    // =========================
    // VIEWER INIT
    // =========================
    const viewer = OpenSeadragon({
      element: viewerRef.current,
      prefixUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/openseadragon/4.1.0/images/",

      tileSources: tileSource,

      // 🔥 DER ENTSCHEIDENDE FIX FÜR DEN WEBGL-CRASH / CORS:
      crossOriginPolicy: "Anonymous",

      // Navigationselemente ausblenden (für sauberen Look)
      showNavigationControl: false,
      showZoomControl: false,
      showHomeControl: false,
      showFullPageControl: false,

      // Performance & Interaktion
      gestureSettingsMouse: {
        clickToZoom: true,
        dblClickToZoom: true,
        pinchToZoom: true,
        scrollToZoom: true,
      },

      animationTime: 0.4,
      blendTime: 0.2,
      immediateRender: true,
      visibilityRatio: 1.0,
      constrainDuringPan: true,
      imageSmoothingEnabled: true,
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
      console.error("OSD failed to open image:", e);
    };

    viewer.addHandler("open", onOpen);
    viewer.addHandler("open-failed", onFail);

    // Initialer Zoom auf das ganze Bild
    let raf;
    viewer.addOnceHandler("fully-loaded-change", () => {
      raf = requestAnimationFrame(() => {
        viewer.viewport?.goHome(true);
      });
    });

    // =========================
    // CLEANUP BEIM UNMOUNT
    // =========================
    return () => {
      if (raf) cancelAnimationFrame(raf);
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
  }, [actualUrl, levels]); // Re-init wenn sich URL oder Levels ändern

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
      {/* Thumbnail als Platzhalter während des Ladens */}
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

      {/* Das eigentliche OSD Canvas */}
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
