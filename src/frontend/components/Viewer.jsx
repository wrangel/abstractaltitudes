// src/frontend/components/Viewer.jsx

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  memo,
  Suspense,
  lazy,
  useMemo,
} from "react";
import NavigationMedia from "./NavigationMedia";
import ViewerImage from "./ViewerImage";
import PopupMetadata from "./PopupMetadata";
import LoadingOverlay from "./LoadingOverlay";
import useKeyboardNavigation from "../hooks/useKeyboardNavigation";
import ErrorBoundary from "./ErrorBoundary";
import styles from "../styles/Viewer.module.css";
import useAutoHideCursor from "../hooks/useAutoHideCursor";
import { useViewportSize } from "../hooks/useViewportSize";
import { buildQueryStringWidthHeight } from "../utils/buildQueryStringWidthHeight";
import { useSignedUrl } from "../hooks/useUrlSigner";

function isValidPanoItem(item) {
  return (
    item.viewer === "pano" &&
    item.panoPath &&
    Array.isArray(item.levels) &&
    item.levels.length > 0
  );
}

const ViewerPanorama = lazy(() => import("./ViewerPanorama"));

const MediaContent = memo(({ item, isNavigationMode, onContentLoaded }) => {
  if (item.viewer === "pano") {
    if (!isValidPanoItem(item)) {
      return (
        <div
          role="alert"
          style={{ color: "red", padding: "2rem", background: "#fff" }}
        >
          Panorama data is missing or incomplete.
        </div>
      );
    }
    return (
      <ErrorBoundary>
        <Suspense fallback={<div>Loading panorama viewer…</div>}>
          <ViewerPanorama
            panoPath={item.panoPath}
            levels={item.levels}
            initialViewParameters={item.initialViewParameters}
            onReady={onContentLoaded}
            onError={(err) => console.error("Panorama error:", err)}
          />
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <ViewerImage
        actualUrl={item.actualUrl}
        thumbnailUrl={item.thumbnailUrl}
        name={item.name}
        onLoad={onContentLoaded}
        isNavigationMode={isNavigationMode}
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
  const { w, h } = useViewportSize();
  const viewerRef = useRef(null);
  const [showMetadata, setShowMetadata] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Memoize sizing to prevent signature floods
  const resizedActualUrl = useMemo(() => {
    if (item.viewer !== "img") return item.actualUrl;

    const actualWidth = item.originalWidth || w;
    const actualHeight = item.originalHeight || h;

    // Step the dimensions by 50px to debounce window resizing
    const reqW = Math.round(Math.min(w, actualWidth) / 50) * 50;
    const reqH = Math.round(Math.min(h, actualHeight) / 50) * 50;

    return buildQueryStringWidthHeight(item.actualUrl, {
      width: reqW,
      height: reqH,
    });
  }, [
    item.actualUrl,
    item.viewer,
    item.originalWidth,
    item.originalHeight,
    w,
    h,
  ]);

  // 2. Fetch the signature
  const { signedUrl, error } = useSignedUrl(
    resizedActualUrl,
    item.viewer !== "img",
  );

  // 3. Prepare the item for children - ensure actualUrl is ONLY the signed one if available
  const mediaItem = useMemo(() => {
    if (item.viewer === "img") {
      return { ...item, actualUrl: signedUrl || null };
    }
    return item;
  }, [item, signedUrl]);

  useKeyboardNavigation(null, onPrevious, onNext);

  const toggleMetadata = useCallback(
    () => setShowMetadata((prev) => !prev),
    [],
  );
  const handleContentLoaded = useCallback(() => setIsLoading(false), []);
  const handleCloseMetadata = useCallback(() => setShowMetadata(false), []);

  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === "Escape") {
        showMetadata ? setShowMetadata(false) : onClose();
      }
    };
    document.addEventListener("keydown", handleEscKey);
    return () => document.removeEventListener("keydown", handleEscKey);
  }, [showMetadata, onClose]);

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

  useEffect(() => {
    if (error) console.error("Error fetching signed URL:", error);
  }, [error]);

  return (
    <div
      className={`${styles.viewer} ${hideCursor ? styles["hide-cursor"] : ""}`}
      ref={viewerRef}
      role="region"
      aria-label={`Media viewer for ${item.name || "item"}`}
      tabIndex={-1}
    >
      {isLoading && <LoadingOverlay thumbnailUrl={item.thumbnailUrl} />}

      {/* Only render content once we have a signed URL (for images) or if it's a pano */}
      {(mediaItem.actualUrl || item.viewer === "pano") && (
        <MediaContent
          key={mediaItem.id}
          item={mediaItem}
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

      <ErrorBoundary>
        <PopupMetadata
          metadata={item.metadata}
          latitude={item.latitude}
          longitude={item.longitude}
          onClose={handleCloseMetadata}
          isVisible={showMetadata}
        />
      </ErrorBoundary>
    </div>
  );
};

export default memo(Viewer);
