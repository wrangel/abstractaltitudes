// src/frontend/components/ViewerPanorama.jsx
import {
  useRef,
  useLayoutEffect,
  useEffect,
  useState,
  memo,
  forwardRef,
  useImperativeHandle,
  useMemo,
} from "react";
import Marzipano from "marzipano";
import styles from "../styles/ViewerPanorama.module.css";
import { useWebGLManager } from "../utils/WebGLManager";
import { hasWebGL, getMaxCubeMapSize } from "../utils/webglSupport";

const DEFAULT_VIEW = { yaw: 0, pitch: 0, fov: Math.PI / 4 };
const AUTO_ROTATE_DELAY = 3000;

function destroyViewer(viewerRef, sceneRef, panoramaElement) {
  if (viewerRef.current) {
    try {
      viewerRef.current.stopMovement();
    } catch (_) {}
    try {
      viewerRef.current.destroy();
    } catch (_) {}
    viewerRef.current = null;
  }
  sceneRef.current = null;
  if (panoramaElement?.current) {
    panoramaElement.current.innerHTML = "";
  }
}

const ViewerPanorama = forwardRef(function ViewerPanorama(
  { panoPath, levels, initialViewParameters, onReady, onError, unmanaged = false },
  ref,
) {
  const instanceId = useMemo(() => Math.random().toString(36).substring(7), []);
  const panoramaElement = useRef(null);
  const viewerRef = useRef(null);
  const sceneRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [webglAbsent, setWebglAbsent] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const autorotateRef = useRef(null);
  const fsTransitionRef = useRef(false);
  const isTearingDownRef = useRef(false);
  const repaintPollRef = useRef(null);

  const { acquireContext, releaseContext } = useWebGLManager();

  const onErrorRef = useRef(onError);
  const acquireContextRef = useRef(acquireContext);
  const releaseContextRef = useRef(releaseContext);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);
  useEffect(() => {
    acquireContextRef.current = acquireContext;
  }, [acquireContext]);
  useEffect(() => {
    releaseContextRef.current = releaseContext;
  }, [releaseContext]);

  /* -------------------------------------------------
    1.  Viewer creation — runs ONCE
    ------------------------------------------------- */
  useEffect(() => {
    if (!panoramaElement.current || viewerRef.current) return;

    if (!hasWebGL()) {
      setWebglAbsent(true);
      onErrorRef.current?.(new Error("WebGL not supported"));
      return;
    }

    isTearingDownRef.current = false;

    if (!unmanaged) {
      const granted = acquireContextRef.current(() => {
        isTearingDownRef.current = true;
        destroyViewer(viewerRef, sceneRef, panoramaElement);
      }, instanceId);
      if (!granted) return;
    }

    const isMobile = /Mobi|Android/i.test(navigator.userAgent);

    viewerRef.current = new Marzipano.Viewer(panoramaElement.current, {
      controls: { mouseViewMode: "drag", scrollZoom: false, pinchZoom: true },
      stage: {
        pixelRatio: window.devicePixelRatio || 1,
        preserveDrawingBuffer: false,
        generateMipmaps: false,
      },
      network: { concurrency: isMobile ? 2 : 4 },
      renderer: { textureStoreCapacity: isMobile ? 24 : 100 },
    });

    const controls = viewerRef.current.controls();
    controls.addEventListener("dragStart", () =>
      viewerRef.current?.stopMovement(),
    );
    controls.addEventListener("dragEnd", () => {
      if (autorotateRef.current && viewerRef.current) {
        viewerRef.current.setIdleMovement(
          AUTO_ROTATE_DELAY,
          autorotateRef.current,
        );
        viewerRef.current.startMovement(autorotateRef.current);
      }
    });

    const stageEl = viewerRef.current.stage().domElement();
    const canvas =
      stageEl.tagName === "CANVAS"
        ? stageEl
        : (stageEl.querySelector("canvas") ?? stageEl);

    canvas.style.backgroundColor = "black";
    canvas.style.opacity = "1";
    canvas.style.cursor = "default";

    const wheelTarget =
      stageEl.tagName === "CANVAS"
        ? (stageEl.parentElement ?? stageEl)
        : stageEl;

    const handleWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const view = sceneRef.current?.view();
      if (!view) return;
      const delta = e.deltaY > 0 ? 1.1 : 0.9;
      const newFov = Math.max(
        Math.PI / 6,
        Math.min(Math.PI / 1.5, view.fov() * delta),
      );
      view.setFov(newFov, { duration: 120 });
    };
    wheelTarget.addEventListener("wheel", handleWheel, { passive: false });

    const handleContextLost = (e) => {
      e.preventDefault();
      if (isTearingDownRef.current) return;
      console.warn("WebGL context lost.");
      setContextLost(true);
      if (viewerRef.current) {
        try {
          viewerRef.current.stopMovement();
        } catch (_) {}
        try {
          viewerRef.current.destroy();
        } catch (_) {}
        viewerRef.current = null;
      }
      sceneRef.current = null;
    };
    canvas.addEventListener("webglcontextlost", handleContextLost, false);

    const handleContextRestored = () => {
      isTearingDownRef.current = false;
      setContextLost(false);
      setLoaded(false);
    };
    canvas.addEventListener(
      "webglcontextrestored",
      handleContextRestored,
      false,
    );

    autorotateRef.current = Marzipano.autorotate({
      yawSpeed: 0.05,
      targetPitch: 0,
    });

    return () => {
      isTearingDownRef.current = true;
      wheelTarget.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -------------------------------------------------
    2.  Scene creation / update
    ------------------------------------------------- */
  useEffect(() => {
    if (!panoramaElement.current) return;
    if (
      !viewerRef.current ||
      !panoPath ||
      !levels ||
      !Array.isArray(levels) ||
      !levels.length ||
      webglAbsent
    )
      return;

    let isEffectActive = true;

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
      { cubeMapPreviewUrl: `${panoPath}/preview.jpg` },
    );
    source.addEventListener("error", (err) => {
      console.error("Tile load error:", err);
      onErrorRef.current?.(err);
    });

    const limiter = Marzipano.RectilinearView.limit.vfov(
      (30 * Math.PI) / 180,
      (120 * Math.PI) / 180,
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
      pinFirstLevel: false,
    });

    try {
      if (isEffectActive && viewerRef.current) {
        sceneRef.current.switchTo({ transitionDuration: 1000 });
      }
    } catch (e) {
      console.warn("switchTo failed:", e);
    }

    if (isEffectActive) {
      setLoaded(true);
      onReady?.();
    }

    if (isEffectActive && viewerRef.current && autorotateRef.current) {
      viewerRef.current.setIdleMovement(
        AUTO_ROTATE_DELAY,
        autorotateRef.current,
      );
      viewerRef.current.startMovement(autorotateRef.current);
    }

    if (isEffectActive && document.fullscreenElement && viewerRef.current) {
      try {
        viewerRef.current.updateSize();
      } catch (_) {}
      requestAnimationFrame(() => {
        if (!viewerRef.current || !isEffectActive) return;
        try {
          viewerRef.current.updateSize();
        } catch (_) {}
        if (autorotateRef.current) {
          try {
            viewerRef.current.startMovement(autorotateRef.current);
            viewerRef.current.setIdleMovement(
              AUTO_ROTATE_DELAY,
              autorotateRef.current,
            );
          } catch (_) {}
        }
      });
    }

    return () => {
      isEffectActive = false;
      if (fsTransitionRef.current) return;
      if (viewerRef.current && sceneRef.current) {
        try {
          viewerRef.current.destroyScene(sceneRef.current);
        } catch (e) {
          console.warn("destroyScene skipped:", e);
        }
      }
      sceneRef.current = null;
    };
  }, [
    panoPath,
    levels,
    webglAbsent,
    contextLost,
    initialViewParameters,
    onReady,
  ]);

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
            autorotateRef.current,
          );
          viewerRef.current.startMovement(autorotateRef.current);
        }
      },
      forceRepaint: () => {
        if (repaintPollRef.current) clearInterval(repaintPollRef.current);

        const doRepaint = () => {
          if (!viewerRef.current) return;
          fsTransitionRef.current = true;
          try {
            viewerRef.current.updateSize();
          } catch (_) {
            fsTransitionRef.current = false;
            return;
          }
          requestAnimationFrame(() => {
            if (!viewerRef.current) {
              fsTransitionRef.current = false;
              return;
            }
            try {
              if (autorotateRef.current)
                viewerRef.current.startMovement(autorotateRef.current);
            } catch (_) {}
            requestAnimationFrame(() => {
              fsTransitionRef.current = false;
              if (!viewerRef.current) return;
              try {
                viewerRef.current.updateSize();
              } catch (_) {}
              if (autorotateRef.current) {
                try {
                  viewerRef.current.setIdleMovement(
                    AUTO_ROTATE_DELAY,
                    autorotateRef.current,
                  );
                } catch (_) {}
              }
            });
          });
        };

        if (viewerRef.current && sceneRef.current) {
          doRepaint();
          return;
        }

        let attempts = 0;
        repaintPollRef.current = setInterval(() => {
          attempts++;
          if (viewerRef.current && sceneRef.current) {
            clearInterval(repaintPollRef.current);
            repaintPollRef.current = null;
            doRepaint();
          } else if (attempts >= 30) {
            clearInterval(repaintPollRef.current);
            repaintPollRef.current = null;
          }
        }, 100);
      },
    }),
    [],
  );

  /* -------------------------------------------------
    5.  Absolute cleanup
    ------------------------------------------------- */
  /* -------------------------------------------------
    5.  Absolute cleanup
    ------------------------------------------------- */
  useEffect(() => {
    return () => {
      if (repaintPollRef.current) clearInterval(repaintPollRef.current);
      isTearingDownRef.current = true;
      fsTransitionRef.current = false;
      destroyViewer(viewerRef, sceneRef, panoramaElement);

      if (!unmanaged) {
        requestAnimationFrame(() => {
          try {
            releaseContextRef.current(instanceId);
          } catch (e) {
            console.warn("Context release skipped:", e);
          }
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceId]);

  /* -------------------------------------------------
    6.  Render
    ------------------------------------------------- */
  if (webglAbsent) {
    return (
      <div className={styles.errorOverlay}>
        <div className={styles.errorMessage}>
          <h1>WebGL unsupported</h1>
          <p>This device or browser does not support WebGL configurations.</p>
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

  if (contextLost) {
    return (
      <div className={styles.errorOverlay}>
        <div className={styles.errorMessage}>
          <h1>Display connection lost</h1>
          <p>The GPU context was interrupted. Waiting for recovery…</p>
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
