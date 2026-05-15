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

// Lazy load the heavy 360 viewer
const ViewerPanorama = lazy(() => import("./ViewerPanorama"));

/**
 * MediaContent decides which engine to use:
 * 1. Marzipano (ViewerPanorama) for 360 CubeMaps
 * 2. OpenSeadragon (ViewerImage) for Wide-Angle DZI or Standard JPGs
 */
const MediaContent = memo(({ item, isNavigationMode, onContentLoaded }) => {
  if (item.viewer === "pano") {
    return (
      <ErrorBoundary>
        <Suspense fallback={<LoadingOverlay />}>
          <ViewerPanorama
            panoPath={item.panoPath}
            levels={item.levels}
            initialViewParameters={item.initialViewParameters}
            onReady={onContentLoaded}
          />
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <ViewerImage
        actualUrl={item.dziPath || item.imagePath}
        thumbnailUrl={item.thumbnailUrl}
        name={item.name}
        onLoad={onContentLoaded}
      />
    </ErrorBoundary>
  );
});

const Viewer = ({
  item,
  onClose,
  onNext,
  onPrevious,
  isNavigationMode,
  toggleMode,
}) => {
  const viewerRef = useRef(null);
  const [showMetadata, setShowMetadata] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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
          <MediaContent
            key={item.id} // Forces fresh mount when switching items
            item={item}
            isNavigationMode={isNavigationMode}
            onContentLoaded={handleContentLoaded}
          />
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
