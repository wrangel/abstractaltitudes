// src/frontend/components/ViewerPanorama.jsx

import { useRef, useLayoutEffect, useState, memo } from "react";
import PropTypes from "prop-types";
import Marzipano from "marzipano";
import styles from "../styles/ViewerPanorama.module.css";

const DEFAULT_VIEW = { yaw: 0, pitch: 0, fov: Math.PI / 4 };

function getMaxCubeMapSize() {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    return gl ? gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE) : 2048;
  } catch {
    return 2048;
  }
}

function hasWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

const ViewerPanorama = ({
  panoPath,
  levels,
  initialViewParameters,
  onReady,
  onError,
}) => {
  const panoramaElement = useRef(null);
  const viewerRef = useRef(null);
  const sceneRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [webglAbsent, setWebglAbsent] = useState(false);

  useLayoutEffect(() => {
    if (!panoramaElement.current || webglAbsent) return;

    // Create viewer if needed
    if (!viewerRef.current) {
      if (!hasWebGL()) {
        setWebglAbsent(true);
        onError?.(new Error("WebGL not supported"));
        return;
      }
      viewerRef.current = new Marzipano.Viewer(panoramaElement.current, {
        controls: {
          mouseViewMode: "drag",
          scrollZoom: true,
          pinchZoom: true,
        },
        stage: {
          pixelRatio: window.devicePixelRatio || 1,
          preserveDrawingBuffer: false,
          generateMipmaps: false,
        },
      });

      const controls = viewerRef.current.controls();
      controls.setFriction?.(0.15);
      controls.setVelocityScale?.(0.25);

      const canvas = viewerRef.current.stage().domElement();
      canvas.addEventListener(
        "wheel",
        (e) => {
          const isPinchGesture =
            e.ctrlKey ||
            e.metaKey ||
            e.deltaMode === 0 ||
            Math.abs(e.deltaY) < 10;
          if (isPinchGesture) {
            e.preventDefault();
            const view = viewerRef.current.view();
            const zoomFactor = e.deltaY > 0 ? 1.05 : 0.95;
            const newFov = Math.max(
              (30 * Math.PI) / 180,
              Math.min((120 * Math.PI) / 180, view.fov() * zoomFactor)
            );
            view.setFov(newFov);
            view.update();
          }
        },
        { passive: false }
      );

      canvas.style.backgroundColor = "black";
      canvas.style.opacity = "1";
      canvas.style.cursor = "default";
    }

    if (!panoPath || !levels?.length) return;

    // Prepare levels safely based on max cube map size
    const maxCubeSize = getMaxCubeMapSize();
    const safeLevels = levels.map((l) => {
      if (l.size <= maxCubeSize) return l;
      const ratio = maxCubeSize / l.size;
      return {
        ...l,
        size: maxCubeSize,
        tileSize: Math.max(1, Math.floor(l.tileSize * ratio)),
      };
    });

    const geometry = new Marzipano.CubeGeometry(safeLevels);
    const source = Marzipano.ImageUrlSource.fromString(
      `${panoPath}/{z}/{f}/{y}/{x}.jpg`,
      { cubeMapPreviewUrl: `${panoPath}/preview.jpg` }
    );

    source.addEventListener("error", (err) => {
      onError?.(err);
      console.error(`Error loading panorama: ${err.message}`);
    });

    const limiter = Marzipano.RectilinearView.limit.traditional(
      1024,
      (120 * Math.PI) / 180
    );

    const viewParams =
      initialViewParameters?.yaw != null &&
      initialViewParameters?.pitch != null &&
      initialViewParameters?.fov != null
        ? initialViewParameters
        : DEFAULT_VIEW;

    const view = new Marzipano.RectilinearView(viewParams, limiter);

    if (sceneRef.current) {
      // Transition out old scene before destroying

      sceneRef.current.switchTo(null, { transitionDuration: 500 });
      setTimeout(() => {
        if (sceneRef.current) {
          sceneRef.current.destroy();
          sceneRef.current = null;
        }

        sceneRef.current = viewerRef.current.createScene({
          source,
          geometry,
          view,
          pinFirstLevel: true,
        });

        sceneRef.current.switchTo({ transitionDuration: 1000 });
      }, 600); // Slightly longer than transition duration
    } else {
      // Initial scene creation
      sceneRef.current = viewerRef.current.createScene({
        source,
        geometry,
        view,
        pinFirstLevel: true,
      });
      sceneRef.current.switchTo({ transitionDuration: 1000 });
    }

    viewerRef.current.setIdleMovement?.(
      3000,
      Marzipano.autorotate({
        yawSpeed: 0.075,
        targetPitch: 0,
        targetFov: Math.PI / 2,
      })
    );

    setLoaded(true);
    onReady?.();
  }, [panoPath, levels, initialViewParameters, onReady, onError, webglAbsent]);

  // Clean up on unmount
  useLayoutEffect(() => {
    return () => {
      viewerRef.current?.destroy();
      viewerRef.current = null;
      sceneRef.current = null;
    };
  }, []);

  if (webglAbsent) {
    return (
      <div className={styles.ViewerPanoramaFallback}>
        <p>
          This device's browser does not support high-performance 360°
          panoramas.
          <br />
          Try Chrome for best results.
        </p>
        {panoPath && (
          <img
            src={`${panoPath}/preview.jpg`}
            alt="Panorama preview"
            className={styles.staticPreview}
            style={{
              width: "100%",
              maxWidth: "1024px",
              margin: "0 auto",
              display: "block",
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div
      ref={panoramaElement}
      className={styles.ViewerPanorama}
      role="application"
      aria-label="360 degree panorama viewer"
      tabIndex={0}
      style={{ backgroundColor: loaded ? undefined : "black" }}
    />
  );
};

ViewerPanorama.propTypes = {
  panoPath: PropTypes.string.isRequired,
  levels: PropTypes.arrayOf(
    PropTypes.shape({
      tileSize: PropTypes.number.isRequired,
      size: PropTypes.number.isRequired,
      fallbackOnly: PropTypes.bool,
    })
  ).isRequired,
  initialViewParameters: PropTypes.shape({
    yaw: PropTypes.number,
    pitch: PropTypes.number,
    fov: PropTypes.number,
  }),
  onReady: PropTypes.func,
  onError: PropTypes.func,
};

export default memo(ViewerPanorama);
