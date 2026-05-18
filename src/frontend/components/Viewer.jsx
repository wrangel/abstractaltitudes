import {
  useState,
  useEffect,
  useRef,
  useCallback,
  memo,
  Suspense,
  lazy,
} from "react";
import NavigationMedia from "./NavigationMedia";
import ViewerImage from "./ViewerImage";
import PopupMetadata from "./PopupMetadata";
import LoadingOverlay from "./LoadingOverlay";
import useKeyboardNavigation from "../hooks/useKeyboardNavigation";
import ErrorBoundary from "./ErrorBoundary";
import styles from "../styles/Viewer.module.css";
import useAutoHideCursor from "../hooks/useAutoHideCursor";

const ViewerPanorama = lazy(() => import("./ViewerPanorama"));

const Viewer = ({
  item,
  onClose,
  onNext,
  onPrevious,
  isNavigationMode,
  toggleMode,
}) => {
  const viewerRef = useRef(null);
  const panoramaRef = useRef(null);
  const fsResizeTimerRef = useRef(null);
  const [showMetadata, setShowMetadata] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Reset loading state whenever the item changes
  useEffect(() => {
    setIsLoading(true);
    setShowMetadata(false);
  }, [item.id]);

  useKeyboardNavigation(onClose, onPrevious, onNext);

  const toggleMetadata = useCallback(
    () => setShowMetadata((prev) => !prev),
    [],
  );
  const handleContentLoaded = useCallback(() => setIsLoading(false), []);
  const handleCloseMetadata = useCallback(() => setShowMetadata(false), []);

  const toggleFullScreen = useCallback(() => {
    const node = viewerRef.current;
    if (!node) return;
    if (!document.fullscreenElement) {
      node.requestFullscreen().catch((err) => console.error(err));
    } else {
      document.exitFullscreen();
    }
  }, []);

  // Own the fullscreenchange listener at this level so it fires even on the
  // first open, before ViewerPanorama has finished lazy-loading and mounting.
  // ViewerPanorama exposes forceRepaint() via its imperative ref handle.
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (fsResizeTimerRef.current) clearTimeout(fsResizeTimerRef.current);
      fsResizeTimerRef.current = setTimeout(() => {
        panoramaRef.current?.forceRepaint();
      }, 600);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      if (fsResizeTimerRef.current) clearTimeout(fsResizeTimerRef.current);
    };
  }, []);

  const hideCursor = useAutoHideCursor(viewerRef, 800);

  return (
    <div
      className={`${styles.viewer} ${hideCursor ? styles["hide-cursor"] : ""}`}
      ref={viewerRef}
      tabIndex={-1}
    >
      {isLoading && <LoadingOverlay thumbnailUrl={item.thumbnailUrl} />}

      {(item.imagePath || item.panoPath || item.dziPath) && (
        <div
          style={{
            width: "100%",
            height: "100%",
            position: "absolute",
            inset: 0,
          }}
        >
          {item.viewer === "pano" ? (
            // No key — never remount the panorama viewer between items.
            // ViewerPanorama handles panoPath changes internally via Effect #2.
            <ErrorBoundary>
              <Suspense fallback={<LoadingOverlay />}>
                <ViewerPanorama
                  ref={panoramaRef}
                  panoPath={item.panoPath}
                  levels={item.levels}
                  initialViewParameters={item.initialViewParameters}
                  onReady={handleContentLoaded}
                />
              </Suspense>
            </ErrorBoundary>
          ) : (
            // key is fine here — ViewerImage/OpenSeadragon is cheap to remount
            // and needs a full reset when switching between image items.
            <ErrorBoundary key={item.id}>
              <ViewerImage
                actualUrl={item.dziPath || item.imagePath}
                thumbnailUrl={item.thumbnailUrl}
                name={item.name}
                onLoad={handleContentLoaded}
              />
            </ErrorBoundary>
          )}
        </div>
      )}

      <NavigationMedia
        onClose={onClose}
        onNext={onNext}
        onPrevious={onPrevious}
        onToggleMetadata={toggleMetadata}
        isNavigationMode={isNavigationMode}
        toggleMode={toggleMode}
        onToggleFullScreen={toggleFullScreen}
        isFirst={item.isFirst}
        isLast={item.isLast}
      />

      <PopupMetadata
        metadata={item.metadata}
        latitude={item.latitude}
        longitude={item.longitude}
        onClose={handleCloseMetadata}
        isVisible={showMetadata}
      />
    </div>
  );
};

export default memo(Viewer);
