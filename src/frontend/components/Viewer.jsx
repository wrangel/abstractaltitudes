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
import ViewerImage from "./ViewerImage"; // The DZI Component
import PopupMetadata from "./PopupMetadata";
import LoadingOverlay from "./LoadingOverlay";
import useKeyboardNavigation from "../hooks/useKeyboardNavigation";
import ErrorBoundary from "./ErrorBoundary";
import styles from "../styles/Viewer.module.css";
import useAutoHideCursor from "../hooks/useAutoHideCursor";

const ViewerPanorama = lazy(() => import("./ViewerPanorama"));

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
        actualUrl={item.imagePath}
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

      {(item.imagePath || item.panoPath) && (
        <MediaContent
          key={item.id}
          item={item}
          isNavigationMode={isNavigationMode}
          onContentLoaded={handleContentLoaded}
        />
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
