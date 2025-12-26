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

  const actualWidth = item.originalWidth || w;
  const actualHeight = item.originalHeight || h;

  const requestedWidth = Math.min(w, actualWidth);
  const requestedHeight = Math.min(h, actualHeight);

  // resize + sign only for images
  const resizedActualUrl =
    item.viewer === "img"
      ? buildQueryStringWidthHeight(item.actualUrl, {
          width: requestedWidth,
          height: requestedHeight,
        })
      : item.actualUrl;

  const { signedUrl, error } = useSignedUrl(
    resizedActualUrl,
    /* skip = */ item.viewer !== "img"
  );

  const [showMetadata, setShowMetadata] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const viewerRef = useRef(null);

  useKeyboardNavigation(onClose, onPrevious, onNext);

  const toggleMetadata = useCallback(() => {
    setShowMetadata((prev) => !prev);
  }, []);

  const handleContentLoaded = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleCloseMetadata = useCallback(() => {
    setShowMetadata(false);
  }, []);

  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === "Escape") {
        if (showMetadata) {
          setShowMetadata(false);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener("keydown", handleEscKey);
    return () => {
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [showMetadata, onClose]);

  useEffect(() => {
    if (item.viewer === "pano" && !isValidPanoItem(item)) return;

    const handleArrowKeys = (event) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (onPrevious) onPrevious();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        if (onNext) onNext();
      }
    };

    document.addEventListener("keydown", handleArrowKeys);
    return () => {
      document.removeEventListener("keydown", handleArrowKeys);
    };
  }, [item.viewer, onPrevious, onNext]);

  const toggleFullScreen = useCallback(() => {
    const node = viewerRef.current;
    if (!node) return;

    if (!document.fullscreenElement) {
      // Important: must be triggered by a direct user gesture like onClick
      node
        .requestFullscreen()
        .then(() => {})
        .catch((err) => {
          console.error("Fullscreen request failed:", err);
        });
    } else {
      document.exitFullscreen();
    }
  }, []);

  const hideCursor = useAutoHideCursor(viewerRef, 800);

  useEffect(() => {
    if (error) console.error("Error fetching signed URL:", error);
  }, [error]);

  // keep original panorama object intact, only patch images
  const mediaItem = useMemo(() => {
    if (item.viewer === "img") {
      return { ...item, actualUrl: signedUrl || resizedActualUrl };
    }
    return item;
  }, [item, signedUrl, resizedActualUrl]);

  return (
    <div
      className={`${styles.viewer} ${hideCursor ? styles["hide-cursor"] : ""}`}
      ref={viewerRef}
      role="region"
      aria-label={`Media viewer for ${item.name || "item"}`}
      tabIndex={-1}
    >
      {isLoading && <LoadingOverlay thumbnailUrl={item.thumbnailUrl} />}

      <MediaContent
        key={mediaItem.id}
        item={mediaItem}
        isNavigationMode={isNavigationMode}
        onContentLoaded={handleContentLoaded}
      />

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
