// src/frontend/components/ViewerPanorama.jsx

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

  const autorotateActive = useRef(false);
  const lastFrameTime = useRef(performance.now());

  function rotateFrame(now) {
    if (!autorotateActive.current || !sceneRef.current) return;
    const delta = (now - lastFrameTime.current) / 1000;
    lastFrameTime.current = now;
    const view = sceneRef.current.view();
    view.setYaw(view.yaw() + 0.075 * delta);
    requestAnimationFrame(rotateFrame);
  }

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
        }
      },
      { passive: false }
    );

    canvas.style.backgroundColor = "black";
    canvas.style.opacity = "1";
    canvas.style.cursor = "default";
  }, [onError]);

  useLayoutEffect(() => {
    if (!viewerRef.current || !panoPath || !levels?.length || webglAbsent)
      return;

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
      console.error("Tile loading error:", err);
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
      : initialViewParameters || DEFAULT_VIEW;

    const view = new Marzipano.RectilinearView(viewParams, limiter);

    sceneRef.current = viewerRef.current.createScene({
      source,
      geometry,
      view,
      pinFirstLevel: true,
    });
    sceneRef.current.switchTo({ transitionDuration: 1000 });

    autorotateActive.current = true;
    lastFrameTime.current = performance.now();
    requestAnimationFrame(rotateFrame);

    setLoaded(true);
    onReady?.();

    return () => {
      viewerRef.current?.destroyScene(sceneRef.current);
      sceneRef.current = null;
    };
  }, [panoPath, levels, webglAbsent]);

  useLayoutEffect(() => {
    if (!sceneRef.current || !initialViewParameters) return;
    const v = sceneRef.current.view();
    v.setYaw(initialViewParameters.yaw ?? 0);
    v.setPitch(initialViewParameters.pitch ?? 0);
    v.setFov(initialViewParameters.fov ?? Math.PI / 4);
  }, [initialViewParameters]);

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
        autorotateActive.current = false;
      },
      startAutoRotate: () => {
        if (!autorotateActive.current) {
          autorotateActive.current = true;
          lastFrameTime.current = performance.now();
          requestAnimationFrame(rotateFrame);
        }
      },
    }),
    []
  );

  useLayoutEffect(
    () => () => {
      viewerRef.current?.destroy();
      viewerRef.current = null;
      sceneRef.current = null;
    },
    []
  );

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
