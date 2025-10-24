// src/frontend/components/ViewerPanorama.jsx

import {
  useRef,
  useLayoutEffect,
  useState,
  memo,
  forwardRef,
  useImperativeHandle,
} from "react";
import Marzipano from "marzipano";
import styles from "../styles/ViewerPanorama.module.css";

const DEFAULT_VIEW = { yaw: 0, pitch: 0, fov: Math.PI / 4 };
const AUTO_ROTATE_DELAY = 3000; // ms

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

const ViewerPanorama = forwardRef(function ViewerPanorama(
  { panoPath, levels, initialViewParameters, onReady, onError },
  ref
) {
  const panoramaElement = useRef(null);
  const viewerRef = useRef(null);
  const sceneRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [webglAbsent, setWebglAbsent] = useState(false);
  const autorotateRef = useRef(null);

  /* -------------------------------------------------
   1.  Viewer creation (once, after DOM exists)
   ------------------------------------------------- */
  useLayoutEffect(() => {
    if (!panoramaElement.current || viewerRef.current) return;

    if (!hasWebGL()) {
      setWebglAbsent(true);
      onError?.(new Error("WebGL not supported"));
      return;
    }

    viewerRef.current = new Marzipano.Viewer(panoramaElement.current, {
      controls: {
        mouseViewMode: "drag",
        scrollZoom: false, // we handle wheel ourselves
        pinchZoom: true, // keeps Hammer recogniser active
      },
      stage: {
        pixelRatio: window.devicePixelRatio || 1,
        preserveDrawingBuffer: false,
        generateMipmaps: false,
      },
    });

    const controls = viewerRef.current.controls();
    controls.addEventListener("dragStart", () =>
      viewerRef.current.stopMovement()
    );
    controls.addEventListener("dragEnd", () => {
      if (autorotateRef.current) {
        viewerRef.current.setIdleMovement(
          AUTO_ROTATE_DELAY,
          autorotateRef.current
        );
        viewerRef.current.startMovement(autorotateRef.current);
      }
    });

    const canvas = viewerRef.current.stage().domElement();
    canvas.style.backgroundColor = "black";
    canvas.style.opacity = "1";
    canvas.style.cursor = "default";

    // pinch / track-pad zoom via wheel event
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault(); // stop page scroll / browser zoom
        const view = sceneRef.current?.view();
        if (!view) return;

        const delta = e.deltaY > 0 ? 1.1 : 0.9; // zoom factor
        const newFov = Math.max(
          Math.PI / 6,
          Math.min(Math.PI / 1.5, view.fov() * delta)
        );
        view.setFov(newFov, { duration: 120 });
      },
      { passive: false }
    );

    // autorotate movement
    autorotateRef.current = Marzipano.autorotate({
      yawSpeed: 0.05,
      targetPitch: 0,
    });
  }, [onError]);

  /* -------------------------------------------------
   2.  Scene creation / update
   ------------------------------------------------- */
  useLayoutEffect(() => {
    if (!panoramaElement.current) return;
    if (
      !viewerRef.current ||
      !panoPath ||
      !levels ||
      !Array.isArray(levels) ||
      !levels.length ||
      webglAbsent
    ) {
      return;
    }

    const maxSize = getMaxCubeMapSize();
    const safeLevels = levels.map((l) => {
      if (l.size <= maxSize) return l;
      const ratio = maxSize / l.size;
      return {
        ...l,
        size: maxSize,
        tileSize: Math.max(1, Math.floor(l.tileSize * ratio)),
      };
    });

    const geometry = new Marzipano.CubeGeometry(safeLevels);
    const source = Marzipano.ImageUrlSource.fromString(
      `${panoPath}/{z}/{f}/{y}/{x}.jpg`,
      { cubeMapPreviewUrl: `${panoPath}/preview.jpg` }
    );

    source.addEventListener("error", (err) => {
      console.error("Tile load error:", err);
      onError?.(err);
    });

    const limiter = Marzipano.RectilinearView.limit.traditional(
      1024,
      (120 * Math.PI) / 180
    );
    const previousView = sceneRef.current?.view();
    const viewParams = previousView
      ? {
          yaw: previousView.yaw(),
          pitch: previousView.pitch(),
          fov: previousView.fov(),
        }
      : { ...DEFAULT_VIEW, ...initialViewParameters };

    const view = new Marzipano.RectilinearView(viewParams, limiter);
    sceneRef.current = viewerRef.current.createScene({
      source,
      geometry,
      view,
      pinFirstLevel: true,
    });
    sceneRef.current.switchTo({ transitionDuration: 1000 });

    setLoaded(true);
    onReady?.();

    if (viewerRef.current && autorotateRef.current) {
      viewerRef.current.setIdleMovement(
        AUTO_ROTATE_DELAY,
        autorotateRef.current
      );
      viewerRef.current.startMovement(autorotateRef.current);
    }

    return () => {
      viewerRef.current?.destroyScene(sceneRef.current);
      sceneRef.current = null;
    };
  }, [panoPath, levels, webglAbsent, initialViewParameters, onReady, onError]);

  /* -------------------------------------------------
   3.  View-parameter sync
   ------------------------------------------------- */
  useLayoutEffect(() => {
    if (!sceneRef.current || !initialViewParameters) return;
    const v = sceneRef.current.view();
    v.setYaw(initialViewParameters.yaw ?? DEFAULT_VIEW.yaw);
    v.setPitch(initialViewParameters.pitch ?? DEFAULT_VIEW.pitch);
    v.setFov(initialViewParameters.fov ?? DEFAULT_VIEW.fov);
  }, [initialViewParameters]);

  /* -------------------------------------------------
   4.  Imperative API
   ------------------------------------------------- */
  useImperativeHandle(
    ref,
    () => ({
      lookAt: ({ yaw, pitch, fov, duration = 600 } = {}) => {
        if (!sceneRef.current) return;
        sceneRef.current
          .view()
          .setParameters({ yaw, pitch, fov }, { duration });
      },
      stopAutoRotate: () => viewerRef.current?.stopMovement(),
      startAutoRotate: () => {
        if (viewerRef.current && autorotateRef.current) {
          viewerRef.current.setIdleMovement(
            AUTO_ROTATE_DELAY,
            autorotateRef.current
          );
          viewerRef.current.startMovement(autorotateRef.current);
        }
      },
    }),
    []
  );

  /* -------------------------------------------------
   5.  Cleanup
   ------------------------------------------------- */
  useLayoutEffect(() => {
    return () => {
      viewerRef.current?.destroy();
      viewerRef.current = null;
      sceneRef.current = null;
    };
  }, []);

  /* -------------------------------------------------
   6.  Render
   ------------------------------------------------- */
  if (webglAbsent) {
    return (
      <div className={styles.errorOverlay}>
        <div className={styles.errorMessage}>
          <h1>WebGL unsupported</h1>
          <p>
            This device's browser does not support high-performance 360°
            panoramas. Try Chrome for best results.
          </p>
          {panoPath && (
            <img
              src={`${panoPath}/preview.jpg`}
              alt="Panorama preview"
              className={styles.thumbnail}
              style={{
                width: "100%",
                maxWidth: "1024px",
                display: "block",
                margin: "0 auto",
              }}
            />
          )}
        </div>
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
});

export default memo(ViewerPanorama);
