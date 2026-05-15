# Project Code Dump
Generated on: 2026-05-15T17:42:54.630Z

## File: src/frontend/components/ErrorBoundary.jsx
```javascript
// src/frontend/components/ErrorBoundary.jsx

import React from "react";
import LoadingErrorHandler from "./LoadingErrorHandler";

/**
 * ErrorBoundary component to catch JavaScript errors in child components
 * and display a consistent error UI using LoadingErrorHandler.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error) {
    // Update state to display fallback UI
    return {
      hasError: true,
      errorMessage: error.message || "An error occurred.",
    };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details for monitoring
    console.error("Uncaught error:", error, errorInfo);
    // Optionally call an external logging service here
  }

  handleRetry = () => {
    // Reset error state to attempt re-render of children
    this.setState({ hasError: false, errorMessage: null });
  };

  render() {
    if (this.state.hasError) {
      // Render LoadingErrorHandler with error styling and retry button
      return (
        <LoadingErrorHandler isLoading={false} error={this.state.errorMessage}>
          {/* Provide a retry button to reset the error */}
          <button
            onClick={this.handleRetry}
            aria-label="Retry"
            type="button"
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1rem",
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </LoadingErrorHandler>
      );
    }

    // Render normally if no error
    return this.props.children;
  }
}

export default ErrorBoundary;

```

## File: src/frontend/components/FullScreenModal.jsx
```javascript
// src/frontend/components/FullScreenModal.jsx

import { useEffect, useRef, memo } from "react";
import PropTypes from "prop-types";
import styles from "../styles/FullScreenModal.module.css";

/**
 * FullScreenModal component renders a fullscreen modal dialog with focus trapping and keyboard controls.
 */
const FullScreenModal = memo(({ isOpen, onClose, children }) => {
  const modalRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement;

      const focusableSelector =
        'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"]), [contenteditable]';
      const focusableElements =
        modalRef.current.querySelectorAll(focusableSelector);
      const firstFocusableElement = focusableElements[0];
      firstFocusableElement?.focus();

      const handleKeyDown = (event) => {
        const focusableElements =
          modalRef.current.querySelectorAll(focusableSelector);
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.key === "Tab") {
          if (event.shiftKey && document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          } else if (
            !event.shiftKey &&
            document.activeElement === lastElement
          ) {
            event.preventDefault();
            firstElement.focus();
          }
        }

        if (event.key === "Escape") {
          onClose();
        }
      };

      document.addEventListener("keydown", handleKeyDown);

      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        if (
          triggerRef.current &&
          document.activeElement !== triggerRef.current
        ) {
          triggerRef.current.focus();
        }
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.fullscreenOverlay} onClick={onClose}>
      <div
        className={styles.fullscreenContent}
        onClick={(e) => e.stopPropagation()} // Prevent closing modal when clicking inside content
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
      >
        <h2 id="modal-title" className={styles.visuallyHidden}>
          Modal Title
        </h2>
        {children}
        <button
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close Modal"
          type="button"
        >
          ×
        </button>
      </div>
    </div>
  );
});

FullScreenModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
};

export default FullScreenModal;

```

## File: src/frontend/components/LazyImage.jsx
```javascript
// src/frontend/components/LazyImage.jsx

import { useEffect, useRef, useState } from "react";

// 1. Add onLoad and onError to the destructured props
const LazyImage = ({
  src,
  alt,
  className,
  style,
  width,
  height,
  onLoad,
  onError,
}) => {
  const imgRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!imgRef.current) return;

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries, observerInstance) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setIsVisible(true);
              observerInstance.disconnect();
            }
          });
        },
        { rootMargin: "100px" },
      );

      observer.observe(imgRef.current);
      return () => observer.disconnect();
    } else {
      setIsVisible(true);
    }
  }, []);

  return (
    <img
      ref={imgRef}
      src={isVisible ? src : undefined}
      alt={alt}
      className={className}
      // 2. Attach the listeners here
      onLoad={onLoad}
      onError={onError}
      style={{
        ...style,
        width,
        height,
        aspectRatio: width && height ? `${width} / ${height}` : undefined,
      }}
      loading="lazy"
      width={width}
      height={height}
    />
  );
};

export default LazyImage;

```

## File: src/frontend/components/LoadingErrorHandler.jsx
```javascript
// src/frontend/components/LoadingErrorHandler.jsx

import PropTypes from "prop-types";
import styles from "../styles/LoadingErrorHandler.module.css";

/**
 * LoadingErrorHandler component renders either a loading spinner,
 * an error message, or its children content based on the current state.
 *
 * Useful for managing loading and error states in UI while fetching data.
 *
 * @param {Object} props - Component props.
 * @param {boolean} props.isLoading - Whether data is currently loading.
 * @param {string} [props.error] - Optional error message to display.
 * @param {React.ReactNode} props.children - The child components to render when not loading or error.
 *
 * @returns {React.ReactElement} The loading UI, error UI, or children content.
 */
const LoadingErrorHandler = ({ isLoading, error, children }) => {
  if (isLoading) {
    // Show loading spinner with accessible role and label
    return (
      <div
        className={styles.container}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className={styles.spinner} aria-label="Loading indicator" />
      </div>
    );
  }

  if (error) {
    // Show error message with aria-live for screen readers
    return (
      <div className={styles.container} role="alert" aria-live="assertive">
        <p className={`${styles.message} ${styles.error}`}>Error: {error}</p>
      </div>
    );
  }

  // If no loading or error, render children content normally
  return children;
};

LoadingErrorHandler.propTypes = {
  isLoading: PropTypes.bool.isRequired,
  error: PropTypes.string,
  children: PropTypes.node.isRequired,
};

export default LoadingErrorHandler;

```

## File: src/frontend/components/LoadingOverlay.jsx
```javascript
// src/frontend/components/LoadingOverlay.jsx

import styles from "../styles/LoadingOverlay.module.css";

/**
 * LoadingOverlay component displays a full overlay with a spinner
 * and optional thumbnail image while content is loading.
 *
 * Typically used to indicate background loading state with visual feedback.
 *
 * @param {Object} props - Component props
 * @param {string} [props.thumbnailUrl] - Optional URL of a thumbnail image to show while loading
 * @returns {JSX.Element} An overlay with spinner and optional thumbnail
 */
const LoadingOverlay = ({ thumbnailUrl }) => {
  return (
    <div
      className={styles.loadingOverlay}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {thumbnailUrl && (
        <img
          src={thumbnailUrl}
          alt="Thumbnail"
          className={styles.thumbnail}
          loading="lazy"
          decoding="async"
          srcSet={`${thumbnailUrl}?w=300 300w, ${thumbnailUrl}?w=768 768w, ${thumbnailUrl}?w=1280 1280w`}
          sizes="(max-width: 600px) 80vw, (max-width: 1200px) 50vw, 33vw"
        />
      )}
      <div className={styles.spinner} aria-label="Loading indicator" />
    </div>
  );
};

export default LoadingOverlay;

```

## File: src/frontend/components/NavigationMedia.jsx
```javascript
import { memo, useState, useEffect } from "react";
import styles from "../styles/Navigation.module.css";

const NavigationMedia = memo(
  ({
    onClose,
    onPrevious,
    onNext,
    onToggleMetadata,
    isNavigationMode,
    onToggleFullScreen,
    isFirst,
    isLast,
  }) => {
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
      const handleFullscreenChange = () => {
        setIsFullscreen(!!document.fullscreenElement);
      };

      document.addEventListener("fullscreenchange", handleFullscreenChange);
      return () => {
        document.removeEventListener(
          "fullscreenchange",
          handleFullscreenChange,
        );
      };
    }, []);

    const handleClose = () => {
      if (document.fullscreenElement) {
        document.addEventListener(
          "fullscreenchange",
          function handler() {
            document.removeEventListener("fullscreenchange", handler);
            onClose();
          },
          { once: true },
        );
        document.exitFullscreen().catch((err) => {
          console.error(`Error exiting fullscreen: ${err.message}`);
        });
      } else {
        onClose();
      }
    };

    return (
      <div
        className={`${styles.fabContainer} ${
          isFullscreen ? styles.fullscreen : ""
        }`}
        role="navigation"
        aria-label="Media navigation controls"
      >
        {isNavigationMode && !isFullscreen && (
          <>
            {!isFirst && (
              <button
                className={`${styles.fabButton} ${styles.leftArrow}`}
                aria-label="Previous media"
                onClick={onPrevious}
                type="button"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                >
                  <path
                    fillRule="evenodd"
                    d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8"
                  />
                </svg>
              </button>
            )}

            {!isLast && (
              <button
                className={`${styles.fabButton} ${styles.rightArrow}`}
                aria-label="Next media"
                onClick={onNext}
                type="button"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                >
                  <path
                    fillRule="evenodd"
                    d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8"
                  />
                </svg>
              </button>
            )}
          </>
        )}

        {!isFullscreen && (
          <div className={styles.fabMenu}>
            <button
              className={styles.fabButton}
              onClick={onToggleFullScreen}
              aria-label="Enter full screen"
              type="button"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                fill="currentColor"
                viewBox="0 0 16 16"
              >
                <path d="M1.5 1a.5.5 0 0 0-.5-.5v4a.5.5 0 0 1-1 0v-4A1.5 1.5 0 0 1 1.5 0h4a.5.5 0 0 1 0 1zM10 .5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 16 1.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5M.5 10a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 0 14.5v-4a.5.5 0 0 1 .5-.5m15 0a.5.5 0 0 1 .5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5" />
              </svg>
            </button>

            <button
              className={styles.fabButton}
              onClick={onToggleMetadata}
              aria-label="Toggle metadata panel"
              type="button"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                fill="currentColor"
                viewBox="0 0 16 16"
              >
                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16" />
                <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0" />
              </svg>
            </button>

            <button
              className={styles.fabButton}
              onClick={handleClose}
              aria-label="Close media navigation"
              type="button"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                fill="currentColor"
                viewBox="0 0 16 16"
              >
                <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8z" />
              </svg>
            </button>
          </div>
        )}

        {isFullscreen && (
          <button
            className={styles.fabButton}
            onClick={handleClose}
            aria-label="Exit full screen and close"
            type="button"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              fill="currentColor"
              viewBox="0 0 16 16"
            >
              <path d="M5.5 0a.5.5 0 0 1 .5.5v4A1.5 1.5 0 0 1 4.5 6h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5m5 0a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 10 4.5v-4a.5.5 0 0 1 .5-.5M0 10.5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 6 11.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5m10 1a1.5 1.5 0 0 1 1.5-1.5h4a.5.5 0 0 1 0 1h-4a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0z" />
            </svg>
          </button>
        )}
      </div>
    );
  },
);

export default NavigationMedia;

```

## File: src/frontend/components/PopupMetadata.jsx
```javascript
// src/frontend/components/PopupMetadata.jsx

import { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import LazyImage from "./LazyImage";
import styles from "../styles/PopupMetadata.module.css";

const PopupMetadata = ({
  metadata,
  latitude,
  longitude,
  panoramaUrl,
  panoramaThumbUrl,
  onClose,
  isVisible,
}) => {
  const zoomLevel = 13;
  const [isBelowThreshold, setIsBelowThreshold] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const popupRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setIsBelowThreshold(window.innerHeight < 500);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Focus management when popup opens/closes for accessibility
  useEffect(() => {
    if (isVisible) {
      triggerRef.current = document.activeElement;
      popupRef.current?.focus();
    } else {
      if (triggerRef.current && document.activeElement !== triggerRef.current) {
        triggerRef.current.focus();
      }
    }
  }, [isVisible]);

  // Draggable popup handlers
  const handleDragStart = (e) => {
    const target = e.target;

    // 1) If the user starts on the close button or another interactive element,
    //    DON'T start dragging and DON'T prevent the click.
    if (
      target.closest &&
      (target.closest(`.${styles.closeIcon}`) || // your X button
        target.closest("button, a, input, textarea, select, [role='button']"))
    ) {
      return;
    }

    // 2) For real drags, we do the old behavior
    e.stopPropagation();
    e.preventDefault();

    const popup = popupRef.current;
    if (!popup) return;

    const startRect = popup.getBoundingClientRect();
    const parentRect = popup.offsetParent.getBoundingClientRect();

    let baseLeft = startRect.left - parentRect.left;
    let baseTop = startRect.top - parentRect.top;

    popup.style.transform = "none";
    popup.style.left = `${baseLeft}px`;
    popup.style.top = `${baseTop}px`;

    const isTouch = e.type === "touchstart";
    const pointer = isTouch ? e.touches[0] : e;
    let lastX = pointer.clientX;
    let lastY = pointer.clientY;

    const onMove = (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      const p = isTouch ? ev.touches[0] : ev;
      baseLeft += p.clientX - lastX;
      baseTop += p.clientY - lastY;
      lastX = p.clientX;
      lastY = p.clientY;
      popup.style.left = `${baseLeft}px`;
      popup.style.top = `${baseTop}px`;
    };

    const onUp = (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      setPopupPosition({ x: baseLeft, y: baseTop });
      document.removeEventListener(isTouch ? "touchmove" : "mousemove", onMove);
      document.removeEventListener(isTouch ? "touchend" : "mouseup", onUp);
    };

    document.addEventListener(isTouch ? "touchmove" : "mousemove", onMove, {
      passive: false,
    });
    document.addEventListener(isTouch ? "touchend" : "mouseup", onUp);
  };

  const style = {
    transform: "none",
    left: `${popupPosition.x}px`,
    top: `${popupPosition.y}px`,
    position: "absolute",
    opacity: isVisible ? 1 : 0,
    pointerEvents: isVisible ? "auto" : "none",
  };

  const googleMapsUrl = `https://www.google.com/maps/embed/v1/place?key=${
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  }&q=${latitude},${longitude}&zoom=${zoomLevel}&maptype=satellite`;
  const googleMapsLink = `https://www.google.com/maps?q=${latitude},${longitude}&zoom=${zoomLevel}&maptype=satellite`;

  return (
    <div
      className={styles.PopupMetadata}
      ref={popupRef}
      style={style}
      onMouseDown={handleDragStart}
      onTouchStart={handleDragStart}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      aria-label="Metadata popup"
    >
      <button
        className={styles.closeIcon}
        onClick={onClose}
        aria-label="Close metadata popup"
        type="button"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          fill="currentColor"
          className="bi bi-x-lg"
          viewBox="0 0 16 16"
        >
          <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8z" />
        </svg>
      </button>

      <div className={styles.content}>
        <pre>{metadata}</pre>

        {isVisible && panoramaUrl && (
          <LazyImage
            src={panoramaUrl}
            placeholderSrc={panoramaThumbUrl}
            alt="Panorama view"
            className={styles.panoramaImage}
          />
        )}

        {isVisible &&
          (isBelowThreshold ? (
            <a
              href={googleMapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.maplink}
            >
              View on map
            </a>
          ) : (
            <iframe
              className={styles.mapIframe}
              width="100%"
              style={{ height: "50vh" }}
              src={googleMapsUrl}
              title={`Map location at latitude ${latitude} and longitude ${longitude}`}
              allowFullScreen
              loading="lazy"
            />
          ))}
      </div>
    </div>
  );
};

PopupMetadata.propTypes = {
  metadata: PropTypes.string.isRequired,
  latitude: PropTypes.number.isRequired,
  longitude: PropTypes.number.isRequired,
  panoramaUrl: PropTypes.string,
  panoramaThumbUrl: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  isVisible: PropTypes.bool.isRequired,
};

export default PopupMetadata;

```

## File: src/frontend/components/PopupViewer.jsx
```javascript
// src/frontend/components/PopupViewer.jsx

import React, { useState } from "react";
import FullScreenModal from "./FullScreenModal";
import Viewer from "./Viewer";
import ErrorBoundary from "./ErrorBoundary";

const PopupViewer = ({ item, isOpen, onClose, onNext, onPrevious }) => {
  const [isNavigationMode, setIsNavigationMode] = useState(true);

  const toggleMode = () => {
    setIsNavigationMode((prevMode) => !prevMode);
  };

  if (!item) return null;

  return (
    <ErrorBoundary>
      <FullScreenModal isOpen={isOpen} onClose={onClose}>
        {/* ✅ FIXED: Constrain Viewer to proper size */}
        <div
          style={{
            width: "100%",
            height: "100%",
            maxWidth: "95vw",
            maxHeight: "90vh",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Viewer
            item={item}
            isOpen={isOpen}
            onClose={onClose}
            onNext={onNext}
            onPrevious={onPrevious}
            isNavigationMode={isNavigationMode}
            toggleMode={toggleMode}
          />
        </div>
      </FullScreenModal>
    </ErrorBoundary>
  );
};

export default React.memo(PopupViewer);

```

## File: src/frontend/components/PortfolioGrid.jsx
```javascript
// src/frontend/components/PortfolioGrid.jsx

// src/frontend/components/PortfolioGrid.jsx
import { Masonry } from "masonic";
import PortfolioItem from "./PortfolioItem";
import LoadingErrorHandler from "./LoadingErrorHandler";
import { useLoadingError } from "../hooks/useLoadingError";
import { useViewportSize } from "../hooks/useViewportSize";
import { useScrollReveal } from "../hooks/useScrollReveal";

const PortfolioGrid = ({ items, onItemClick }) => {
  const { isLoading, error } = useLoadingError(false);
  const { w } = useViewportSize();
  const revealRef = useScrollReveal();

  const getColumnWidth = () => {
    if (!w || w <= 0) return 300;

    if (w <= 768) {
      // 1 column on mobile, full width minus a small inset
      return w;
    }

    if (w <= 900) {
      // 2 columns on tablets
      return w / 2 - 24; // gutter 24
    }

    // 3 columns on desktop
    return w / 3 - 24; // gutter 24
  };

  const columnWidth = getColumnWidth();

  const renderItem = ({ data, width }) => {
    return (
      <PortfolioItem
        item={data}
        width={width}
        onItemClick={onItemClick}
        revealRef={revealRef}
      />
    );
  };

  return (
    <LoadingErrorHandler isLoading={isLoading} error={error}>
      <div style={{ padding: 0 }}>
        <Masonry
          items={items || []}
          columnWidth={columnWidth}
          columnGutter={24} // horizontal spacing
          rowGutter={12} // vertical spacing (half of horizontal)
          render={renderItem}
        />
      </div>
    </LoadingErrorHandler>
  );
};

export default PortfolioGrid;

```

## File: src/frontend/components/PortfolioItem.jsx
```javascript
// src/frontend/components/PortfolioItem.jsx

import { memo, useCallback } from "react";
import PropTypes from "prop-types";
import styles from "../styles/PortfolioItem.module.css";

/**
 * PortfolioItem component renders a single clickable portfolio item with accessibility support.
 *
 * It handles click and keyboard activation (Enter or Space) to trigger onItemClick callback.
 * Displays the thumbnail image with lazy loading.
 * Uses memo to prevent unnecessary re-renders.
 *
 * @param {Object} props - Component props.
 * @param {Object} props.item - Portfolio item data.
 * @param {string} props.item.id - Unique item identifier.
 * @param {string} props.item.thumbnailUrl - Thumbnail image URL.
 * @param {Function} props.onItemClick - Click handler function receiving the item.
 *
 * @returns {JSX.Element|null} Rendered portfolio item or null on invalid data.
 */
const PortfolioItem = memo(({ item, onItemClick }) => {
  const handleClick = useCallback(() => {
    onItemClick(item);
  }, [item, onItemClick]);

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onItemClick(item);
      }
    },
    [item, onItemClick]
  );

  if (!item || !item.thumbnailUrl) {
    console.warn("PortfolioItem: Invalid item data");
    return null;
  }

  return (
    <div
      className={styles.portfolioItem}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`View portfolio item ${item.id}`}
    >
      <img
        src={item.thumbnailUrl}
        alt={item.id || "Portfolio item"}
        loading="lazy"
      />
    </div>
  );
});

PortfolioItem.propTypes = {
  item: PropTypes.shape({
    id: PropTypes.string.isRequired,
    thumbnailUrl: PropTypes.string.isRequired,
  }).isRequired,
  onItemClick: PropTypes.func.isRequired,
};

export default PortfolioItem;

```

## File: src/frontend/components/Viewer.jsx
```javascript
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
            key={item.id}
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

```

## File: src/frontend/components/ViewerImage.jsx
```javascript
import { useState, useEffect, useRef, memo } from "react";
import OpenSeadragon from "openseadragon";
import styles from "../styles/ViewerImage.module.css";

/**
 * ViewerImage Component
 * Handles high-resolution Deep Zoom Images (DZI) using OpenSeadragon.
 */
const ViewerImage = ({ actualUrl, thumbnailUrl, name, onLoad }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const viewerRef = useRef(null);
  const osdInstance = useRef(null);

  useEffect(() => {
    if (!actualUrl || !viewerRef.current) return;

    let isDestroyed = false;

    const initOSD = () => {
      if (isDestroyed || !viewerRef.current) return;

      viewerRef.current.innerHTML = "";

      osdInstance.current = OpenSeadragon({
        element: viewerRef.current,
        prefixUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/openseadragon/4.1.0/images/",
        tileSources: actualUrl,
        crossOriginPolicy: "Anonymous",
        loadTilesWithAjax: true,
        showNavigationControl: false,
        gestureSettingsMouse: { clickToZoom: false },
        visibilityRatio: 1.0,
        constrainDuringPan: true,
        minZoomImageRatio: 1,
        checkUpdateInterval: 50,
        drawer: "canvas",
        // Mobile asset reduction optimization limits
        maxImageCacheCount: 50,
      });

      osdInstance.current.addHandler("open", () => {
        if (!isDestroyed) {
          setIsLoading(false);
          if (onLoad) onLoad();
        }
      });

      osdInstance.current.addHandler("open-failed", (error) => {
        if (!isDestroyed) {
          console.error("❌ OpenSeadragon failed to load:", error);
          setHasError(true);
          setIsLoading(false);
        }
      });
    };

    const timer = setTimeout(initOSD, 1);

    return () => {
      isDestroyed = true;
      clearTimeout(timer);

      if (osdInstance.current) {
        osdInstance.current.removeAllHandlers();
        try {
          osdInstance.current.close();
          osdInstance.current.destroy();
        } catch (e) {
          console.warn("OSD close notice:", e);
        }
        osdInstance.current = null;
      }

      if (viewerRef.current) {
        viewerRef.current.innerHTML = "";
      }
    };
  }, [actualUrl, onLoad]);

  if (hasError) {
    return (
      <div className={styles.ViewerImage} role="alert">
        <div style={{ color: "#fff", textAlign: "center", paddingTop: "20vh" }}>
          <p>Failed to load high-resolution image: {name}</p>
          <img
            src={thumbnailUrl}
            alt="Fallback preview"
            style={{
              maxWidth: "80%",
              maxHeight: "60vh",
              marginTop: "20px",
              borderRadius: "4px",
              boxShadow: "0 4px 15px rgba(0,0,0,0.5)",
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={styles.ViewerImage}
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        background: "#000",
        overflow: "hidden",
      }}
    >
      {isLoading && (
        <img
          src={thumbnailUrl}
          alt="Loading high-res preview"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            zIndex: 1040,
            filter: "blur(12px)",
            opacity: 0.7,
            transition: "opacity 0.4s ease",
          }}
        />
      )}

      <div
        ref={viewerRef}
        style={{
          width: "100%",
          height: "100%",
          zIndex: 1050,
        }}
      />
    </div>
  );
};

export default memo(ViewerImage);

```

## File: src/frontend/components/ViewerPanorama.jsx
```javascript
import {
  useRef,
  useLayoutEffect,
  useEffect,
  useState,
  memo,
  forwardRef,
  useImperativeHandle,
} from "react";
import Marzipano from "marzipano";
import styles from "../styles/ViewerPanorama.module.css";

const DEFAULT_VIEW = { yaw: 0, pitch: 0, fov: Math.PI / 4 };
const AUTO_ROTATE_DELAY = 3000;

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
  ref,
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
  useEffect(() => {
    if (!panoramaElement.current || viewerRef.current) return;

    if (!hasWebGL()) {
      setWebglAbsent(true);
      onError?.(new Error("WebGL not supported"));
      return;
    }

    const isMobile = /Mobi|Android/i.test(navigator.userAgent);

    viewerRef.current = new Marzipano.Viewer(panoramaElement.current, {
      controls: {
        mouseViewMode: "drag",
        scrollZoom: false,
        pinchZoom: true,
      },
      stage: {
        pixelRatio: window.devicePixelRatio || 1,
        preserveDrawingBuffer: false,
        generateMipmaps: false,
      },
      network: {
        concurrency: isMobile ? 2 : 4,
      },
      renderer: {
        textureStoreCapacity: isMobile ? 24 : 100,
      },
    });

    const controls = viewerRef.current.controls();
    controls.addEventListener("dragStart", () =>
      viewerRef.current.stopMovement(),
    );
    controls.addEventListener("dragEnd", () => {
      if (autorotateRef.current) {
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
      console.warn("WebGL context lost — GPU ran out of resources.");
    };
    canvas.addEventListener("webglcontextlost", handleContextLost, false);

    // Increased to 400ms — mobile fullscreen transitions take longer than 150ms
    const handleFullscreenChange = () => {
      setTimeout(() => {
        if (viewerRef.current) {
          try {
            viewerRef.current.updateSize();
          } catch (e) {
            console.warn("updateSize after fullscreen:", e);
          }
        }
      }, 400);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    autorotateRef.current = Marzipano.autorotate({
      yawSpeed: 0.05,
      targetPitch: 0,
    });

    return () => {
      wheelTarget.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [onError]);

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
      { cubeMapPreviewUrl: `${panoPath}/preview.jpg` },
    );

    source.addEventListener("error", (err) => {
      console.error("Tile load error:", err);
      onError?.(err);
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
    sceneRef.current.switchTo({ transitionDuration: 1000 });

    setLoaded(true);
    onReady?.();

    if (viewerRef.current && autorotateRef.current) {
      viewerRef.current.setIdleMovement(
        AUTO_ROTATE_DELAY,
        autorotateRef.current,
      );
      viewerRef.current.startMovement(autorotateRef.current);
    }

    return () => {
      if (viewerRef.current && sceneRef.current) {
        viewerRef.current.destroyScene(sceneRef.current);
      }
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
            autorotateRef.current,
          );
          viewerRef.current.startMovement(autorotateRef.current);
        }
      },
    }),
    [],
  );

  /* -------------------------------------------------
   5.  Absolute Cleanup
   ------------------------------------------------- */
  useEffect(() => {
    return () => {
      if (viewerRef.current) {
        viewerRef.current.stopMovement();
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
      sceneRef.current = null;

      if (panoramaElement.current) {
        panoramaElement.current.innerHTML = "";
      }
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

```

## File: src/frontend/hooks/useAutoHideCursor.jsx
```javascript
import { useState, useRef, useEffect } from "react";

export default function useAutoHideCursor(ref, timeout = 1000) {
  const [hide, setHide] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const isFullscreenForNode = () => document.fullscreenElement === node;

    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const startTimer = () => {
      clearTimer();
      timerRef.current = setTimeout(() => {
        // Re-check ref is still mounted and still fullscreen
        if (ref.current && isFullscreenForNode()) {
          setHide(true);
        }
      }, timeout);
    };

    const showCursorAndMaybeScheduleHide = () => {
      setHide(false);
      if (!isFullscreenForNode()) {
        clearTimer();
        return;
      }
      startTimer();
    };

    const handleFullscreenChange = () => {
      if (!isFullscreenForNode()) {
        setHide(false);
        clearTimer();
      } else {
        showCursorAndMaybeScheduleHide();
      }
    };

    node.addEventListener("pointermove", showCursorAndMaybeScheduleHide);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    // Only start the hide cycle if already fullscreen when hook mounts
    if (isFullscreenForNode()) {
      showCursorAndMaybeScheduleHide();
    } else {
      setHide(false);
    }

    return () => {
      node.removeEventListener("pointermove", showCursorAndMaybeScheduleHide);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      clearTimer();
    };
  }, [ref, timeout]);

  return hide;
}

```

## File: src/frontend/hooks/useItemViewer.jsx
```javascript
// src/frontend/hooks/useItemViewer.jsx

import { useState, useCallback, useMemo } from "react";

/**
 * Custom hook to manage state and navigation for a viewed item in a list.
 */
export const useItemViewer = (items = []) => {
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const selectedItem = useMemo(() => {
    if (!Array.isArray(items)) return null;
    return items.find((item) => item.id === selectedItemId) || null;
  }, [items, selectedItemId]);

  const handleItemClick = useCallback((clickedItem) => {
    if (clickedItem?.id) {
      setSelectedItemId(clickedItem.id);
      setIsModalOpen(true);
    }
  }, []);

  const handleClosePopup = useCallback(() => {
    setIsModalOpen(false);
    setSelectedItemId(null);
  }, []);

  const handleNextItem = useCallback(() => {
    if (!Array.isArray(items)) return;

    setSelectedItemId((currentId) => {
      const currentIdx = items.findIndex((item) => item.id === currentId);
      if (currentIdx >= 0 && currentIdx < items.length - 1) {
        const nextId = items[currentIdx + 1].id;
        return nextId;
      }
      return currentId;
    });
  }, [items]);

  const handlePreviousItem = useCallback(() => {
    if (!Array.isArray(items)) return;

    setSelectedItemId((currentId) => {
      if (!currentId) return currentId;
      const currentIdx = items.findIndex((item) => item.id === currentId);
      if (currentIdx > 0) {
        return items[currentIdx - 1].id;
      }
      return currentId;
    });
  }, [items]);

  return {
    selectedItem,
    isModalOpen,
    handleItemClick,
    handleClosePopup,
    handleNextItem,
    handlePreviousItem,
  };
};

```

## File: src/frontend/hooks/useItems.jsx
```javascript
// src/frontend/hooks/useItems.jsx

import { useState, useEffect, useCallback, useDebugValue } from "react";
import { COMBINED_DATA_URL } from "../constants";

// Simple in‑memory cache shared across hook instances
let cachedItems = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// 🔥 Use your backend's datetime field here
// Assumes every item has item.dateTime (ISO string or similar)
const parseItemDate = (item) => {
  const t = new Date(item.dateTime).getTime();
  return Number.isNaN(t) ? 0 : t;
};

// Newest → oldest
const sortItemsByDateDesc = (items) =>
  [...items].sort((a, b) => parseItemDate(b) - parseItemDate(a));

// Shallow identity check; compares by reference and length
const isSameArray = (a, b) => {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

export const useItems = () => {
  const [items, setItems] = useState(cachedItems ? [...cachedItems] : []);
  const [isLoading, setIsLoading] = useState(!cachedItems);
  const [error, setError] = useState(null);

  useDebugValue(items, (items) => `Items count: ${items.length}`);

  const fetchData = useCallback(async () => {
    const now = Date.now();

    // Use cached, already-sorted items if cache is still valid
    if (cachedItems && now - cacheTimestamp < CACHE_TTL) {
      setItems((prev) =>
        isSameArray(prev, cachedItems) ? prev : [...cachedItems],
      );
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(COMBINED_DATA_URL, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      const arrayData = Array.isArray(data) ? data : [];

      // 🔥 Canonical sort: newest first
      const sortedData = sortItemsByDateDesc(arrayData);

      setItems((prev) => (isSameArray(prev, sortedData) ? prev : sortedData));

      // Cache the sorted result
      cachedItems = [...sortedData];
      cacheTimestamp = Date.now();
    } catch (e) {
      if (e.name === "AbortError") {
        setError("Request timed out. Please try again.");
      } else {
        setError("Failed to load items. Please try again later.");
      }
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const clearCache = useCallback(() => {
    cachedItems = null;
    cacheTimestamp = 0;
    setItems([]);
    setIsLoading(true);
    fetchData();
  }, [fetchData]);

  return { items, isLoading, error, refetch: fetchData, clearCache };
};

```

## File: src/frontend/hooks/useKeyboardNavigation.jsx
```javascript
// src/frontend/hooks/useKeyboardNavigation.js

import { useEffect, useCallback } from "react";

/**
 * Custom hook to add keyboard navigation event listeners for Escape, ArrowLeft, and ArrowRight keys.
 *
 * Binds keydown events to these keys and calls appropriate callback functions.
 * Cleans up event listeners automatically when component unmounts or dependencies change.
 *
 * @param {Function} onClose - Callback to invoke on "Escape" key press.
 * @param {Function} onPrevious - Callback to invoke on "ArrowLeft" key press.
 * @param {Function} onNext - Callback to invoke on "ArrowRight" key press.
 */
const useKeyboardNavigation = (onClose, onPrevious, onNext) => {
  const handleKeyDown = useCallback(
    (event) => {
      if (event.repeat) return; // ignore holding key down firing repeatedly

      if (event.key === "Escape" && typeof onClose === "function") {
        onClose();
      } else if (
        event.key === "ArrowLeft" &&
        typeof onPrevious === "function"
      ) {
        event.preventDefault();
        onPrevious();
      } else if (event.key === "ArrowRight" && typeof onNext === "function") {
        event.preventDefault();
        onNext();
      }
    },
    [onClose, onPrevious, onNext]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);
};

export default useKeyboardNavigation;

```

## File: src/frontend/hooks/useLoadingError.jsx
```javascript
// src/frontend/hooks/useLoadingError.js

import { useState, useCallback } from "react";

/**
 * Custom hook to manage loading and error states in React components.
 *
 * Provides helper functions to start and stop loading,
 * set and clear error messages, along with state values.
 *
 * @param {boolean} [initialLoadingState=true] - Optional initial loading state.
 * @returns {Object} An object containing:
 *   - isLoading: Boolean indicating if loading is in progress.
 *   - error: Current error message or null.
 *   - startLoading: Function to set loading state to true.
 *   - stopLoading: Function to set loading state to false.
 *   - setErrorMessage: Function to set an error message.
 *   - clearError: Function to clear the current error message.
 */
export const useLoadingError = (initialLoadingState = true) => {
  const [isLoading, setIsLoading] = useState(initialLoadingState);
  const [error, setError] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const startLoading = useCallback(() => {
    setIsLoading(true);
    setIsSuccess(false);
    setError(null);
  }, []);

  const stopLoading = useCallback(() => setIsLoading(false), []);

  const setLoading = useCallback((value) => setIsLoading(value), []);

  const setErrorMessage = useCallback((message) => {
    let normalizedMsg = null;
    if (typeof message === "string") {
      normalizedMsg = message;
    } else if (message instanceof Error) {
      normalizedMsg = message.message || "An error occurred";
    }
    setError(normalizedMsg);
    setIsLoading(false);
    setIsSuccess(false);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const markSuccess = useCallback(() => {
    setIsLoading(false);
    setIsSuccess(true);
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setIsSuccess(false);
  }, []);

  return {
    isLoading,
    error,
    isSuccess,
    startLoading,
    stopLoading,
    setLoading,
    setErrorMessage,
    clearError,
    markSuccess,
    reset,
  };
};

```

## File: src/frontend/hooks/useScrollReveal.jsx
```javascript
import { useEffect, useRef, useCallback } from "react";

export const useScrollReveal = () => {
  const observerRef = useRef(null);

  useEffect(() => {
    // Check if browser supports IntersectionObserver
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      return;
    }
  }, []);

  const setRef = useCallback((node) => {
    if (node && observerRef.current) {
      observerRef.current.observe(node);
    }
  }, []);

  return setRef;
};

```

## File: src/frontend/hooks/useViewportSize.jsx
```javascript
// src/frontend/hooks/useViewportSize.jsx

import { useState, useEffect } from "react";

export function useViewportSize() {
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const update = () =>
      setSize({
        w: Math.max(document.documentElement.clientWidth, window.innerWidth),
        h: Math.max(document.documentElement.clientHeight, window.innerHeight),
      });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return size;
}

```

## File: src/frontend/hooks/useWindowHeight.jsx
```javascript
// src/frontend/hooks/useWindowHeight.jsx

import { useState, useLayoutEffect } from "react";

/**
 * Custom hook that returns a boolean indicating if the viewport height is less than or equal to the threshold.
 * @param {number} threshold - Height in pixels to consider very short viewport. Default 360.
 * @returns {boolean} - true if viewport height <= threshold
 */
const useWindowHeight = (threshold = 360) => {
  const [isVeryShort, setIsVeryShort] = useState(() =>
    typeof window !== "undefined" ? window.innerHeight <= threshold : false
  );

  useLayoutEffect(() => {
    const handleResize = () => {
      setIsVeryShort(window.innerHeight <= threshold);
    };

    window.addEventListener("resize", handleResize);
    handleResize(); // Initialize on mount

    return () => window.removeEventListener("resize", handleResize);
  }, [threshold]);

  return isVeryShort;
};

export default useWindowHeight;

```

## File: src/frontend/pages/Grid.jsx
```javascript
// src/frontend/pages/Grid.js

// src/frontend/pages/Grid.js
import React, { useCallback } from "react";
import PortfolioGrid from "../components/PortfolioGrid";
import PopupViewer from "../components/PopupViewer";
import { useItems } from "../hooks/useItems";
import { useItemViewer } from "../hooks/useItemViewer";
import LoadingOverlay from "../components/LoadingOverlay";
import ErrorBoundary from "../components/ErrorBoundary";
import styles from "../styles/Grid.module.css";

function Grid() {
  const { items, isLoading, error, refetch } = useItems();

  const {
    selectedItem,
    isModalOpen,
    handleItemClick,
    handleClosePopup,
    handleNextItem,
    handlePreviousItem,
  } = useItemViewer(items);

  const currentIndex = items.findIndex((item) => item.id === selectedItem?.id);
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === items.length - 1;

  const onItemClick = useCallback(handleItemClick, [handleItemClick]);
  const onClose = useCallback(handleClosePopup, [handleClosePopup]);
  const onNext = useCallback(handleNextItem, [handleNextItem]);
  const onPrevious = useCallback(handlePreviousItem, [handlePreviousItem]);

  if (isLoading) return <LoadingOverlay ariaLive="polite" />;

  if (error) {
    return (
      <div className={styles.Grid} role="alert">
        <p>Error: {error}</p>
        <button onClick={refetch}>Retry</button>
      </div>
    );
  }

  return (
    <>
      <div className={styles.Grid}>
        {items.length > 0 ? (
          <ErrorBoundary>
            <PortfolioGrid items={items} onItemClick={onItemClick} />
          </ErrorBoundary>
        ) : (
          <p>No items to display.</p>
        )}

        <footer className={styles.finalFooter}>
          <div className={styles.footerContent}>
            <ul className={styles.creditsList}>
              {[
                { href: "https://github.com/wrangel", label: "wrangel" },
                { href: "https://www.dji.com", label: "DJI" },
                { href: "https://ptgui.com", label: "PTGui Pro" },
                { href: "https://www.marzipano.net/", label: "Marzipano" },
                {
                  href: "https://openseadragon.github.io/",
                  label: "OpenSeadragon",
                },
                {
                  href: "https://www.adobe.com/products/photoshop-lightroom.html",
                  label: "Adobe Lightroom",
                },
              ].map(({ href, label }) => (
                <li key={label}>
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
            <p className={styles.copyright}>© 2026 Abstract Altitudes</p>
          </div>
        </footer>
      </div>

      {isModalOpen && selectedItem && (
        <PopupViewer
          item={{ ...selectedItem, isFirst, isLast }}
          isOpen={isModalOpen}
          onClose={onClose}
          onNext={onNext}
          onPrevious={onPrevious}
          isNavigationMode={true}
        />
      )}
    </>
  );
}

export default React.memo(Grid);

```

## File: src/frontend/pages/Home.jsx
```javascript
// src/frontend/pages/Home.js

import { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { useItems } from "../hooks/useItems";
import useWindowHeight from "../hooks/useWindowHeight";
import styles from "../styles/Home.module.css";
import { DOMAIN } from "../constants";
import { useViewportSize } from "../hooks/useViewportSize";
import PopupViewer from "../components/PopupViewer";
import ViewerPanorama from "../components/ViewerPanorama";
import { hasWebGL } from "../utils/webglSupport";

function getSecureRandomIndex(max) {
  const array = new Uint32Array(1);
  window.crypto.getRandomValues(array);
  return array[0] % max;
}

function isValidPanoItem(item) {
  return (
    item.viewer === "pano" &&
    item.panoPath &&
    Array.isArray(item.levels) &&
    item.levels.length > 0
  );
}

function isAppleBrowser() {
  return (
    /iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent) &&
    typeof window.ApplePaySession !== "undefined"
  );
}

const Home = () => {
  const { items } = useItems();

  const canUsePano = !isAppleBrowser() && hasWebGL();

  const [backgroundPano, setBackgroundPano] = useState(null);
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [backgroundPanoReady, setBackgroundPanoReady] = useState(false);

  const [isPortrait, setIsPortrait] = useState(
    window.innerHeight > window.innerWidth,
  );
  const isVeryShort = useWindowHeight(360);
  const { w, h } = useViewportSize();

  const mediaItems = canUsePano
    ? items.filter(isValidPanoItem)
    : items.filter((item) => item.viewer === "img");

  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(null);

  useEffect(() => {
    if (items.length === 0) return;

    if (canUsePano) {
      const panoItems = items.filter(isValidPanoItem);
      if (panoItems.length > 0) {
        setBackgroundPano(panoItems[getSecureRandomIndex(panoItems.length)]);
        setBackgroundPanoReady(false);
      }
    } else {
      const imgItems = items.filter(
        (item) => item.viewer === "img" && item.thumbnailUrl,
      );
      if (imgItems.length > 0) {
        setBackgroundImage(imgItems[getSecureRandomIndex(imgItems.length)]);
      }
    }
  }, [items]);

  useEffect(() => {
    const handleResize = () =>
      setIsPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const openRandomViewer = useCallback(() => {
    if (mediaItems.length === 0) return;
    setCurrentIndex(getSecureRandomIndex(mediaItems.length));
    setIsViewerOpen(true);
  }, [mediaItems]);

  const scrollToGrid = () => {
    document
      .getElementById("main-content")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <Helmet>
        <title>Abstract Altitudes</title>
        <link rel="canonical" href={DOMAIN} />
        <meta
          name="description"
          content="Explore drone-captured aerial imagery. Peaceful skies."
        />
      </Helmet>

      <div className={styles.backgroundWrapper}>
        {canUsePano && backgroundPano ? (
          <ViewerPanorama
            panoPath={backgroundPano.panoPath}
            levels={backgroundPano.levels}
            initialViewParameters={backgroundPano.initialViewParameters}
            onReady={() => setBackgroundPanoReady(true)}
            onError={(err) => {
              console.error("Background pano error:", err);
              setBackgroundPano(null);
            }}
          />
        ) : backgroundImage ? (
          <img
            src={backgroundImage.thumbnailUrl}
            alt=""
            aria-hidden="true"
            className={styles.backgroundImage}
          />
        ) : (
          <div className={styles.backgroundFallback} aria-hidden="true" />
        )}
        <div className={styles.backgroundGradient} aria-hidden="true" />
      </div>

      {isViewerOpen && currentIndex !== null && (
        <PopupViewer
          item={mediaItems[currentIndex]}
          isOpen={isViewerOpen}
          onClose={() => setIsViewerOpen(false)}
          onNext={() =>
            setCurrentIndex((prev) => (prev + 1) % mediaItems.length)
          }
          onPrevious={() =>
            setCurrentIndex((prev) =>
              prev === 0 ? mediaItems.length - 1 : prev - 1,
            )
          }
        />
      )}

      <section
        className={`${styles.Home} ${isPortrait ? styles.portraitLayout : ""} ${
          isVeryShort ? styles.veryShortViewport : ""
        }`}
      >
        <div className={styles.contentOverlay}>
          <div
            className={`${styles.textWrapper} ${styles.textShadow} ${styles.textClickable}`}
            onClick={openRandomViewer}
            role="button"
            tabIndex={0}
            aria-label="View random portfolio item"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") openRandomViewer();
            }}
          >
            <h1>Abstract Altitudes</h1>
            <h2>Drone Photography</h2>
          </div>
        </div>

        <div
          className="scroll-indicator"
          onClick={scrollToGrid}
          role="button"
          aria-label="Scroll to gallery"
        >
          <p
            style={{
              fontSize: "0.7rem",
              letterSpacing: "3px",
              marginBottom: "0.5rem",
            }}
          />
          <span>↓</span>
        </div>
      </section>
    </>
  );
};

export default Home;

```

## File: src/frontend/styles/ErrorBoundary.module.css
```css
/* src/frontend/styles/ErrorBoundary.module.css */

.errorBoundary {
  text-align: center;
  padding: var(--spacing-large);
  border: 0.0625rem solid var(--error-border-color);
  background-color: var(--error-bg-color);
  color: var(--error-text-color);
  font-family: var(--font-family);
  max-width: 600px;
  margin: var(--spacing-large) auto;
  border-radius: var(--popup-border-radius);
}

.errorBoundary h1 {
  margin-bottom: var(--spacing-medium);
  font-size: var(--font-size-large);
}

.errorBoundary p {
  margin-bottom: var(--spacing-medium);
  font-size: var(--font-size-small);
}

.errorBoundary button {
  background-color: var(--primary-color);
  color: white;
  border: none;
  padding: var(--spacing-small) var(--spacing-medium);
  cursor: pointer;
  transition: background-color var(--transition-duration),
    transform var(--transition-duration);
  font-size: var(--font-size-small);
  font-family: inherit;
  border-radius: 4px;
}

.errorBoundary button:hover,
.errorBoundary button:focus {
  background-color: var(--primary-color-dark);
  transform: translateY(-2px);
}

.errorBoundary button:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}

@media (max-width: 768px) {
  .errorBoundary {
    padding: var(--spacing-medium);
    margin: var(--spacing-medium);
  }

  .errorBoundary h1 {
    font-size: var(--font-size-medium);
  }
}

```

## File: src/frontend/styles/FullScreenModal.module.css
```css
/* src/frontend/styles/FullScreenModal.module.css */

.fullscreenOverlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--overlay-bg-color);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.fullscreenContent {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.closeButton {
  position: absolute;
  top: var(--spacing-medium);
  right: var(--spacing-medium);
  background: none;
  border: none;
  color: var(--text-color);
  font-size: var(--font-size-large);
  cursor: pointer;
  padding: var(--spacing-small);
  transition: opacity var(--transition-duration) ease;
  opacity: 0.8;
}

.closeButton:hover,
.closeButton:focus {
  opacity: 1;
  outline: none;
}

.closeButton:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px #005fcc; /* bright blue outline */
  border-radius: 4px; /* so it doesn't look harsh */
}

.visuallyHidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 768px) {
  .closeButton {
    font-size: var(--font-size-medium);
    top: var(--spacing-small);
    right: var(--spacing-small);
  }
}

```

## File: src/frontend/styles/Global.css
```css
:root {
  /* Colors & spacing */
  --background-color: black;
  --text-color: white;
  --gutter-size: 20px;
  --transition-duration: 0.3s;

  /* Cross-platform stack */
  --font-stack:
    Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue",
    Arial, sans-serif;

  /* Core design colors */
  --primary-color: #4da6ff;
  --primary-color-dark: #3b8cc2;
  --error-border-color: #f44336;
  --error-bg-color: #ffe6e6;
  --error-text-color: #f44336;

  /* Spacing */
  --spacing-large: 2rem;
  --spacing-medium: 1rem;
  --spacing-small: 0.75rem;

  /* Typography */
  --font-size-large: 2.38rem;
  --font-size-medium: calc(var(--font-size-large) * 0.84);
  --font-size-small: 1.25rem;

  /* Inter Variable tuning */
  --body-wght: 150;
  --track-tight: -0.005em;
  --mascot-color: rgba(255, 255, 255, 0.8);

  /* Interface bits */
  --spinner-size: 50px;
  --spinner-border: 3px;
  --spinner-color: rgba(255, 255, 255, 0.3);
  --spinner-border-top: #fff;

  --overlay-bg-color: rgba(0, 0, 0, 0.7);
  --thumbnail-opacity: 0.5;

  --zoom-control-bg: white;
  --zoom-control-border-radius: 4px;
  --zoom-control-box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);

  --popup-bg-color: rgba(0, 0, 0, 0.7);
  --popup-text-color: white;
  --popup-padding: 10px;
  --popup-border-radius: 5px;

  --text-shadow-heavy:
    0 0 5px rgba(0, 0, 0, 0.8), 0 0 10px rgba(0, 0, 0, 0.6),
    0 0 20px rgba(0, 0, 0, 0.4);
  --overlay-bg-medium: rgba(0, 0, 0, 0.35);
  --overlay-bg-heavy: rgba(0, 0, 0, 0.7);
  --overlay-border-radius: 0.5rem;
  --overlay-box-shadow: 0 4px 15px rgba(0, 0, 0, 0.7);
}

/* Base layout */
html {
  scroll-behavior: smooth;
  background: var(--background-color);
}

body {
  background-color: var(--background-color);
  color: var(--text-color);
  margin: 0;
  padding: 0;
  font-family: var(--font-stack);
  font-weight: var(--body-wght);
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
  overflow-y: auto;
}

/* Scroll Indicator for Home section */
.scroll-indicator {
  position: absolute;
  bottom: 5vh;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  z-index: 10;
  color: var(--text-color);
  text-shadow: var(--text-shadow-heavy);
  animation: bounce 2s infinite;
}

.scroll-indicator span {
  font-size: 2rem;
  line-height: 1;
}

.map-fab:hover {
  transform: scale(1.05);
  background-color: var(--primary-color-dark);
}

/* Entrance animation for Masonry Grid Items */
.grid-item-fade {
  opacity: 0;
  transform: translateY(20px);
  animation: slideUpFade 0.6s ease-out forwards;
}

@keyframes slideUpFade {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes bounce {
  0%,
  20%,
  50%,
  80%,
  100% {
    transform: translate(-50%, 0);
  }
  40% {
    transform: translate(-50%, -10px);
  }
  60% {
    transform: translate(-50%, -5px);
  }
}

/* Standard accessibility */
.visually-hidden {
  position: absolute !important;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

```

## File: src/frontend/styles/Grid.module.css
```css
.Grid {
  text-align: center;
  padding: var(--spacing-large) 0;
  max-width: 100%;
  margin: 0 auto;
  position: relative;
  z-index: 1;
  background-color: var(--background-color);

  /* Prevent horizontal overflow created by inner padding */
  overflow-x: hidden;
}

/* Footer content wrapper */
.footerContent {
  max-width: 800px;
  margin: 0 auto;
  text-align: center;
}

/* Final Footer Styling */
.finalFooter {
  margin-top: 5rem;
  padding: 4rem 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

/* Credits list */
.creditsList {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  list-style: none;
  padding: 0;
  margin: 0 0 1.5rem 0;
  gap: 1.5rem;
}

.creditsList a {
  color: var(--text-color);
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 300;
  opacity: 0.7;
  transition:
    opacity var(--transition-duration),
    color var(--transition-duration);
}

.creditsList a:hover {
  opacity: 1;
  color: var(--primary-color);
}

.copyright {
  font-size: 0.8rem;
  opacity: 0.4;
  letter-spacing: 1px;
  font-weight: 300 !important;
}

/* Tighter spacing on mobile */
@media (max-width: 768px) {
  .Grid {
    padding: var(--spacing-medium) 0;
  }

  .creditsList {
    flex-direction: column;
    gap: 1rem;
  }
}

```

## File: src/frontend/styles/Home.module.css
```css
/* src/frontend/styles/Home.module.css - FULL FILE */
/* Original perfect sizing + Inter thin font only */

.Home {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  width: 100%;
  padding: var(--spacing-medium);
  box-sizing: border-box;
  position: relative;
  z-index: 1;
  overflow: hidden;
}

.backgroundWrapper {
  position: absolute;
  inset: 0;
  overflow: hidden;
  z-index: 0;
  pointer-events: none;
}

.backgroundWrapper canvas {
  display: block !important;
  width: 100% !important;
  height: 100% !important;
  object-fit: cover;
}

.backgroundFallback {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%);
}

.backgroundImage {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.backgroundGradient {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 40vh;
  background: linear-gradient(to top, black 0%, transparent 100%);
  z-index: 1;
  pointer-events: none;
}

.contentOverlay {
  background-color: var(--overlay-bg-medium);
  backdrop-filter: blur(8px);
  border-radius: var(--overlay-border-radius);
  padding: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: var(--overlay-box-shadow);
  z-index: 2;
  position: relative;
}

.textWrapper {
  text-align: center;
  color: var(--text-color);
}

.textShadow {
  text-shadow: var(--text-shadow-heavy);
}

.textClickable {
  cursor: pointer;
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
  border-radius: var(--overlay-border-radius, 8px);
  padding: 0.5rem 1rem;
  margin-bottom: var(--spacing-medium);
}

.textClickable:hover {
  opacity: 0.85;
  transform: scale(1.02);
}

.textClickable:active {
  transform: scale(0.98);
}

.textClickable:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.6);
  outline-offset: 4px;
}

/* FORCE INTER THIN - keeps original perfect sizing via CSS vars */
.Home h1,
.Home h1 span {
  font-family: "Inter", sans-serif !important;
  font-weight: 100 !important;
  -webkit-font-smoothing: antialiased !important;
  -moz-osx-font-smoothing: grayscale !important;
}

.Home h2 {
  font-family: "Inter", sans-serif !important;
  font-weight: 100 !important;
  font-style: italic !important;
  -webkit-font-smoothing: antialiased !important;
  opacity: 0.88 !important;
}

.scroll-indicator * {
  font-family: "Inter", sans-serif !important;
  font-weight: 100 !important;
}

.Home h1 {
  font-size: var(--font-size-large);
  margin: 0 0 0.5rem 0;
  line-height: 1.2;
}

.Home h2 {
  font-size: var(--font-size-medium);
  margin: 0.5rem 0 0 0;
}

.break {
  display: block;
}

.portraitLayout {
  padding-top: 2vh;
}

.veryShortViewport {
  padding-top: 5vh !important;
}

@media (max-width: 768px) {
  .Home h1 {
    font-size: var(--font-size-medium);
  }
}

```

## File: src/frontend/styles/LoadingErrorHandler.module.css
```css
/* src/frontend/components/LoadingErrorHandler.module.css */

.container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  width: 100%;
  padding: var(--spacing-medium);
  box-sizing: border-box;
  background-color: var(--background-color);
}

.message {
  font-size: var(--message-font-size);
  color: var(--message-color);
  font-family: var(--font-family);
  text-align: center;
  max-width: 600px;
  line-height: 1.4;
}

.error {
  color: var(--error-text-color);
  border: 1px solid var(--error-border-color);
  background-color: var(--error-bg-color);
  padding: var(--spacing-medium);
  border-radius: var(--popup-border-radius);
}

.spinner {
  width: var(--spinner-size);
  height: var(--spinner-size);
  border: var(--spinner-border) solid var(--spinner-color);
  border-top: var(--spinner-border) solid var(--spinner-border-top);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@media (max-width: 768px) {
  .message {
    font-size: calc(var(--message-font-size) * 0.9);
  }

  .spinner {
    width: calc(var(--spinner-size) * 0.8);
    height: calc(var(--spinner-size) * 0.8);
  }
}

```

## File: src/frontend/styles/LoadingOverlay.module.css
```css
/* src/styles/LoadingOverlay.module.css */

.loadingOverlay {
  position: fixed; /* Changed to fixed for full viewport coverage */
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: var(--overlay-bg-color); /* Use variable */
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1050; /* Ensure it appears above other content */
}

.thumbnail {
  max-width: 80%;
  max-height: 80%;
  opacity: var(--thumbnail-opacity); /* Use variable */
}

.spinner {
  position: absolute;
  width: var(--spinner-size); /* Use variable */
  height: var(--spinner-size); /* Use variable */
  border: var(--spinner-border) solid var(--spinner-color); /* Use variable */
  border-radius: 50%;
  border-top: var(--spinner-border) solid var(--spinner-border-top); /* Use variable */
  animation: spin 1s linear infinite;
}

/* Optional Accessibility Improvement */
.spinner::after {
  content: "Loading..."; /* Screen reader text for accessibility */
  position: absolute;
  left: -9999px; /* Visually hide but keep accessible */
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

/* Media Queries for Responsiveness */
@media (max-width: 768px) {
  .thumbnail {
    max-width: 90%; /* Allow more space on smaller screens */
    max-height: 90%;
  }

  .spinner {
    width: calc(
      var(--spinner-size) * 0.8
    ); /* Slightly smaller spinner on mobile */
    height: calc(var(--spinner-size) * 0.8);
  }
}

```

## File: src/frontend/styles/MascotCorner.module.css
```css
/* src/frontend/styles/MascotCorner.module.css */

.mascotCornerLink {
  cursor: pointer;
  display: inline-block; /* to wrap the img tightly */
}

.mascotCorner {
  position: fixed;
  top: 1.8vw;
  right: 1.4vw;
  width: 90px;
  height: auto;
  z-index: 2500;
  user-select: none;
  /* pointer-events: auto by default because of link wrapper */
}

```

## File: src/frontend/styles/Navigation.module.css
```css
:root {
  --control-right: 1rem;
  --icon-size-default: 20px;
  --icon-size-arrow: 22px;
  --fab-hover-color: rgba(0, 0, 0, 0.6);
  --fab-active-color: var(--primary-color);
}

.fabContainer {
  position: fixed;
  bottom: var(--spacing-large);
  right: var(--control-right);
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  z-index: 1100;
}

.fabMenu {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-small);
}

/* Shared FAB + Arrow button style */
.fabButton {
  width: 44px;
  height: 44px;
  padding: 0.5rem;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.4);
  color: #fff;
  border: none;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  transition: background-color var(--transition-duration);
  box-shadow: var(--overlay-box-shadow);
  user-select: none;
  font-size: 0.875rem;
  font-weight: 500;
}

/* Default icon size */
.fabButton svg {
  width: var(--icon-size-default);
  height: var(--icon-size-default);
  pointer-events: none;
}

/* Larger arrow icons */
.leftArrow svg,
.rightArrow svg {
  width: var(--icon-size-arrow);
  height: var(--icon-size-arrow);
}

/* Hover and focus states */
.fabButton:hover {
  background-color: var(--fab-hover-color);
}

.fabButton:focus {
  outline: none;
}

.fabButton.active {
  background-color: var(--fab-active-color);
}

/* Arrow positioning */
.leftArrow {
  position: fixed;
  top: 50%;
  transform: translateY(-50%);
  left: var(--control-right);
  z-index: 1200;
}

.rightArrow {
  position: fixed;
  top: 50%;
  transform: translateY(-50%);
  right: var(--control-right);
  z-index: 1200;
}

/* Responsive tweaks */
@media (max-width: 600px), (max-height: 600px) {
  .fabContainer {
    bottom: var(--spacing-small);
    right: var(--spacing-small);
  }

  .fabMenu {
    flex-direction: row;
    gap: 0.5rem;
  }

  .fabButton {
    width: 40px;
    height: 40px;
    padding: 0.4rem;
  }

  .rightArrow {
    bottom: 4.5rem;
    top: auto;
    right: var(--spacing-small);
  }

  .leftArrow {
    bottom: 4.5rem;
    top: auto;
    left: var(--spacing-small);
  }
}

/* Optional guide line */
.fabContainer::before {
  content: "";
  position: fixed;
  top: 0;
  bottom: 0;
  right: var(--control-right);
  width: 1px;
  background: rgba(255, 255, 255, 0.08);
  pointer-events: none;
  z-index: 900;
}

```

## File: src/frontend/styles/PopupMetadata.module.css
```css
/* src/frontend/styles/PopupMetadata.module.css */

.PopupMetadata {
  position: absolute;
  top: var(--spacing-medium);
  left: var(--spacing-medium);
  background-color: var(--popup-bg-color);
  color: var(--popup-text-color);
  padding: var(--popup-padding);
  border-radius: var(--popup-border-radius);
  z-index: 1600;
  max-width: var(--max-width-popup);
  width: auto;
  box-sizing: border-box;
  font-size: 0.9rem;
  font-family: var(--font-stack);
  text-shadow: var(--text-shadow-heavy);
  cursor: grab;
  user-select: none;
  transition: transform var(--transition-duration) ease;
  will-change: transform;
}

.PopupMetaactive {
  cursor: grabbing;
  user-select: none;
}

.content {
  text-align: center;
  padding-top: 14px;
  user-select: text;
}

.maplink {
  display: block;
  margin-top: var(--spacing-small);
  color: var(--link-color);
  text-decoration: none;
  font-family: var(--font-stack);
  text-shadow: var(--text-shadow-heavy);
  transition: color var(--transition-duration);
}

.maplink:hover,
.maplink:focus {
  text-decoration: underline;
}

.mapIframe {
  width: 100%;
  height: 50vh;
  border: none;
}

.thumbnailFullViewport {
  will-change: opacity;
}

.panoramaImage,
.mapIframe {
  width: 100%;
  aspect-ratio: 16 / 9;
  display: block;
}

.closeIcon {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 36px;
  height: 36px;
  background: rgba(0, 0, 0, 0.4);
  border: none;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 3;
  color: white;
  transition: background-color var(--transition-duration);
}

.closeIcon:hover {
  background-color: var(--fab-hover-color);
}

```

## File: src/frontend/styles/PortfolioItem.module.css
```css
/* src/frontend/styles/PortfolioItem.module.css */

.portfolioItem {
  margin-bottom: var(--gutter-size); /* Use variable for margin */
  overflow: hidden;
  cursor: pointer;
  position: relative; /* Ensure positioning for pseudo-elements */
  display: flex;
  justify-content: center; /* Center items horizontally */
  align-items: center; /* Center items vertically */
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); /* Optional: Add a subtle shadow */
  transition: transform var(--transition-duration) ease,
    box-shadow var(--transition-duration) ease; /* Use variable for transitions */
}

.portfolioItem img {
  width: 100%;
  height: auto;
  display: block;
  transition: transform var(--transition-duration) ease; /* Use variable for transition duration */
}

.portfolioItem:hover {
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2); /* Increase shadow on hover */
  transform: translateY(-5px); /* Slightly lift the item on hover */
}

.portfolioItem:hover img {
  transform: scale(1.08); /* Scale image on hover */
}

.portfolioItem:before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.05); /* Optional: Add a subtle overlay */
  opacity: 0;
  transition: opacity var(--transition-duration) ease; /* Use variable for transition duration */
}

.portfolioItem:hover:before {
  opacity: 1; /* Show the overlay on hover */
}

```

## File: src/frontend/styles/Viewer.module.css
```css
/* src/frontend/styles/Viewer.module.css */

.viewer {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: #000;
  overflow: hidden;
  z-index: 1000; /* High z-index to cover the gallery */
  display: block;
}

/* Ensure the hide-cursor logic applies to the OSD canvas specifically */
.hide-cursor,
.hide-cursor *,
.hide-cursor canvas {
  cursor: none !important;
}

.PopupMetadata {
  position: absolute;
  bottom: 20px;
  left: 20px;
  background-color: rgba(0, 0, 0, 0.8);
  color: #fff;
  padding: 15px;
  border-radius: 8px;
  z-index: 2000; /* Above the viewer */
  transition: opacity 0.3s ease;
}

```

## File: src/frontend/styles/ViewerImage.module.css
```css
/* src/frontend/styles/ViewerImage.module.css */

.ViewerImage {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1050;
  background-color: black;
  /*
    CHANGED: overflow:hidden → overflow:clip
    overflow:hidden creates a scroll container, which causes the browser to
    swallow wheel events before panzoom can handle them. overflow:clip clips
    visually but does NOT create a scroll container, so wheel events propagate
    correctly to panzoom.
  */
  overflow: clip;
  transition: background-color var(--transition-duration) ease;
}

.ViewerImage.loaded {
  background-color: black;
}

.thumbnailFullViewport {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  object-fit: contain;
  z-index: 1040;
  background-color: black;
}

.hidden {
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--transition-duration) ease-in-out;
}

.panzoomContainer {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  z-index: 1050;
  /*
    ADDED: touch-action:none tells the browser to pass ALL touch and pointer
    events to JavaScript (panzoom) instead of handling pinch-zoom natively.
    Without this, mobile Safari/Chrome intercept the gesture before panzoom.
  */
  touch-action: none;
}

.image {
  /*
    REMOVED: max-width / max-height
    These constrain the element dimensions panzoom uses to compute its
    transform origin, which breaks zoom at scale > 1. Size is now controlled
    by the flexbox container. object-fit:contain is kept only as a pre-init
    fallback and is overridden by panzoom's inline style once active.
  */
  display: block;
  object-fit: contain;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.3);
  transition: opacity var(--transition-duration) ease-in-out;
  /* ADD THESE FOR DESKTOP */
  user-select: none; /* Prevents accidental text highlighting */
  -webkit-user-drag: none; /* Stops the 'ghost image' drag behavior in Chrome/Safari */
  pointer-events: auto; /* Ensures the image itself can still be 'grabbed' by panzoom */
}

.bleepButton {
  position: fixed;
  bottom: 1.5rem;
  left: 1.5rem;
  width: 2rem;
  height: 2rem;
  background-color: #2c4bd6;
  border: none;
  border-radius: 50%;
  cursor: default;
  opacity: 0.8;
  z-index: 1100;
  box-shadow: 0 0 10px #2c4bd6aa;
  font-size: 1.5rem;
  line-height: 1rem;
  color: black;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

@media (max-width: 768px) {
  .image {
    max-width: 100%;
    height: auto;
  }
}

```

## File: src/frontend/styles/ViewerPanorama.module.css
```css
/* src/frontend/styles/ViewerPanorama.module.css */

.ViewerPanorama {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100vh;
  background-color: var(--panorama-bg-color, black);
  z-index: 1050;
  overflow: hidden;
  /*
    ADDED: touch-action:none prevents the browser from claiming pinch-zoom
    gestures for native page zoom. Marzipano's Hammer.js recogniser then
    receives all touch events and handles pinch-to-zoom correctly on mobile.
  */
  touch-action: none;
}

.ViewerPanorama canvas {
  width: 100% !important;
  height: 100% !important;
  display: block;
  /* Repeated here so the rule applies regardless of how Marzipano nests the canvas */
  touch-action: none;
}

.thumbnail {
  position: absolute;
  top: 50%;
  left: 50%;
  max-width: 80%;
  max-height: 80%;
  transform: translate(-50%, -50%);
  opacity: var(--thumbnail-opacity, 0.5);
  z-index: 1051;
  pointer-events: none;
}

.errorOverlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--background-color, black);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1060;
  color: var(--text-color, white);
  text-align: center;
}

.errorMessage h1 {
  font-weight: bold;
  margin-bottom: 0.5rem;
}

```

## File: src/frontend/utils/webglSupport.jsx
```javascript
// src/frontend/utils/webglSupport.js

export function hasWebGL() {
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

```

## File: vite.config.mjs
```javascript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  plugins: [
    react({
      jsxInclude: ["**/*.jsx", "**/*.js"],
    }),
    visualizer({
      open: true,
      filename: "stats.html",
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:8081",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: "build",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            // use package name as chunk id for better splitting
            const parts = id.split("node_modules/");
            if (parts.length > 1) {
              const pkgName = parts[1].split("/")[0];
              return `vendor_${pkgName}`;
            }
          }
        },
      },
    },
  },
  resolve: {
    alias: {},
  },
  define: {
    global: "globalThis",
  },
});

```

## File: package.json
```text
{
  "name": "abstractaltitudes",
  "version": "2.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "frontend:dev": "vite",
    "frontend:build": "vite build",
    "frontend:preview": "vite preview",
    "dev": "./scripts/dev-deploy.sh",
    "manage": "./scripts/manage-tasks.sh",
    "manage:dry": "./scripts/manage-tasks.sh -n",
    "test": "./scripts/test-deploy.sh",
    "prod": "./scripts/prod-build.sh"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.1046.0",
    "@fontsource-variable/inter": "^5.2.8",
    "compression": "^1.8.1",
    "concurrently": "^9.2.1",
    "cors": "^2.8.6",
    "express": "^5.2.1",
    "express-rate-limit": "^8.5.2",
    "express-static-gzip": "^3.0.1",
    "fs-extra": "^11.3.5",
    "helmet": "^8.1.0",
    "knip": "^6.13.1",
    "marzipano": "^0.10.2",
    "masonic": "^4.1.0",
    "mongoose": "^9.6.2",
    "node-cache": "^5.1.2",
    "openseadragon": "^6.0.2",
    "prop-types": "^15.8.1",
    "react": "^19.2.6",
    "react-dom": "^19.2.6",
    "react-helmet-async": "^3.0.0",
    "react-router-dom": "^7.15.1",
    "swr": "^2.4.1",
    "web-vitals": "^5.2.0",
    "winston": "^3.19.0",
    "winston-daily-rotate-file": "^5.0.0"
  },
  "devDependencies": {
    "@aws-sdk/lib-storage": "^3.1046.0",
    "@vitejs/plugin-react": "^6.0.1",
    "adm-zip": "^0.5.17",
    "exif-parser": "^0.1.12",
    "node-fetch": "^3.3.2",
    "rollup-plugin-visualizer": "^7.0.1",
    "sharp": "^0.34.5",
    "vite": "^8.0.13"
  },
  "pnpm": {
    "overrides": {
      "three@<0.125.0": ">=0.125.0",
      "postcss@<8.4.31": ">=8.4.31",
      "nth-check@<2.0.1": ">=2.0.1",
      "serialize-javascript@<6.0.2": ">=6.0.2",
      "react-router@<7.5.2": ">=7.5.2",
      "tmp@<=0.2.3": ">=0.2.4"
    },
    "onlyBuiltDependencies": [
      "sharp"
    ]
  },
  "browserslist": {
    "production": [
      ">0.2%",
      "not dead",
      "not op_mini all"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  }
}

```

