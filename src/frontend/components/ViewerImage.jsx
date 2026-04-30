import { useRef, useEffect, useState, memo } from "react";
import Marzipano from "marzipano";
import styles from "../styles/ViewerImage.module.css";

const ViewerImage = ({ actualUrl, levels, thumbnailUrl, name, onLoad }) => {
  const viewerElement = useRef(null);
  const viewerInstance = useRef(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // --- DEBUG LOGS START ---
    console.log("DEBUG [ViewerImage]: Component mounted/updated", { name });
    console.log("DEBUG [ViewerImage]: actualUrl (Tiles-Pfad):", actualUrl);
    console.log(
      "DEBUG [ViewerImage]: levels (Anzahl):",
      levels?.length,
      levels,
    );

    if (!viewerElement.current) {
      console.warn(
        "DEBUG [ViewerImage]: viewerElement (DOM) noch nicht bereit.",
      );
      return;
    }

    if (!actualUrl || !levels?.length) {
      console.error("DEBUG [ViewerImage]: Fehlende Daten für Tiled-View!", {
        actualUrl,
        levels,
      });
      return;
    }
    // --- DEBUG LOGS END ---

    // 1. Instanz erstellen
    try {
      console.log("DEBUG [ViewerImage]: Initialisiere Marzipano Viewer...");
      viewerInstance.current = new Marzipano.Viewer(viewerElement.current, {
        controls: {
          mouseViewMode: "drag",
          scrollZoom: true,
        },
      });

      // 2. Geometrie (Flat für flache Bilder)
      const geometry = new Marzipano.FlatGeometry(levels);
      console.log("DEBUG [ViewerImage]: FlatGeometry erstellt.");

      // 3. Source (ACHTUNG: Pfad-Muster für flache Bilder ohne {f})
      const tilePath = `${actualUrl}/{z}/{y}/{x}.jpg`;
      console.log("DEBUG [ViewerImage]: Tile-Pfad Muster:", tilePath);

      const source = Marzipano.ImageUrlSource.fromString(tilePath, {
        cubeMapPreviewUrl: `${actualUrl}/preview.jpg`,
      });

      // 4. View & Limiter
      const limiter = Marzipano.FlatView.limit.visible(geometry);
      const view = new Marzipano.FlatView({ fov: Math.PI / 2 }, limiter);

      // 5. Szene erstellen
      const scene = viewerInstance.current.createScene({
        source,
        geometry,
        view,
        pinFirstLevel: true,
      });

      console.log("DEBUG [ViewerImage]: Szene erstellt, schalte um...");
      scene.switchTo({ transitionDuration: 500 }, () => {
        console.log("DEBUG [ViewerImage]: Szene erfolgreich aktiviert.");
        setLoaded(true);
        if (onLoad) onLoad();
      });
    } catch (err) {
      console.error(
        "DEBUG [ViewerImage]: KRITISCHER FEHLER bei Marzipano Initialisierung:",
        err,
      );
    }

    // Cleanup: Verhindert Speicherlecks und doppelte Viewer beim Navigieren
    return () => {
      console.log("DEBUG [ViewerImage]: Cleanup - Zerstöre Instanz für:", name);
      if (viewerInstance.current) {
        viewerInstance.current.destroy();
        viewerInstance.current = null;
      }
    };
  }, [actualUrl, levels, onLoad, name]);

  return (
    <div
      className={styles.ViewerImage}
      style={{
        background: "#000",
        width: "100%",
        height: "100%",
        position: "relative",
      }}
    >
      {/* 1. Platzhalter (Thumbnail) */}
      {!loaded && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
          }}
        >
          <img
            src={thumbnailUrl}
            alt={`${name} loading`}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              opacity: 0.5,
            }}
          />
          <div
            style={{
              position: "absolute",
              color: "#fff",
              background: "rgba(0,0,0,0.5)",
              padding: "5px 10px",
              borderRadius: "4px",
            }}
          >
            Initialisiere High-Res Tiles...
          </div>
        </div>
      )}

      {/* 2. Marzipano Container */}
      <div
        ref={viewerElement}
        style={{
          width: "100%",
          height: "100%",
          opacity: loaded ? 1 : 0,
          transition: "opacity 0.4s ease",
          zIndex: 5,
        }}
      />
    </div>
  );
};

export default memo(ViewerImage);
