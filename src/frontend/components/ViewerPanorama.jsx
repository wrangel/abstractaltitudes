import {
  useRef,
  useLayoutEffect,
  useState,
  memo,
  forwardRef,
  useImperativeHandle,
} from "react";
import PropTypes from "prop-types";
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
  const autorotateRef = useRef(null); // for autorotate control

  /* --- Initialize viewer once --- */
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

    // Pause autorotate on drag start
    controls.addEventListener("dragStart", () => {
      viewerRef.current.stopMovement(); // immediately stop autorotate
    });

    // Resume autorotate after drag
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
    // Optional: handle zooming with mouse wheel
    // ... (your existing wheel event code) ...

    // Style
    canvas.style.backgroundColor = "black";
    canvas.style.opacity = "1";
    canvas.style.cursor = "default";

    // Create autorotate movement
    autorotateRef.current = Marzipano.autorotate({
      yawSpeed: 0.05,
      targetPitch: 0, // horizon level
    });
  }, [onError]);

  /* --- Scene creation / update --- */
  useLayoutEffect(() => {
    if (!viewerRef.current || !panoPath || !levels?.length || webglAbsent)
      return;

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
      : { yaw: 0, pitch: 0, fov: Math.PI / 4 };

    // Create view
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

    // Start autorotate with horizon target
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
  }, [panoPath, levels, webglAbsent]);

  /* --- Set initial view --- */
  useLayoutEffect(() => {
    if (!sceneRef.current || !initialViewParameters) return;
    const v = sceneRef.current.view();
    v.setYaw(initialViewParameters.yaw ?? 0);
    v.setPitch(initialViewParameters.pitch ?? 0);
    v.setFov(initialViewParameters.fov ?? Math.PI / 4);
  }, [initialViewParameters]);

  /* --- Expose controls --- */
  useImperativeHandle(
    ref,
    () => ({
      lookAt: ({ yaw, pitch, fov, duration = 600 } = {}) => {
        if (!sceneRef.current) return;
        sceneRef.current
          .view()
          .setParameters({ yaw, pitch, fov }, { duration });
      },
      stopAutoRotate: () => {
        viewerRef.current?.stopMovement(); // disables both autorotate and manual controls
      },
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

  /* --- Cleanup --- */
  useLayoutEffect(() => {
    return () => {
      viewerRef.current?.destroy();
      viewerRef.current = null;
      sceneRef.current = null;
    };
  }, []);

  /* --- Render fallback --- */
  if (webglAbsent) {
    return (
      <div className={styles.ViewerPanoramaFallback}>
        <p>
          This device's browser does not support high-performance 360°
          panoramas. Try Chrome for best results.
        </p>
        {panoPath && (
          <img
            src={`${panoPath}/preview.jpg`}
            alt="Panorama preview"
            className={styles.staticPreview}
            style={{
              width: "100%",
              maxWidth: "1024px",
              display: "block",
              margin: "0 auto",
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
});

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
