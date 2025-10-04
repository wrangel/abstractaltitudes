// src/frontend/components/NavigationMedia.jsx

import { memo, useState, useEffect } from "react";
import styles from "../styles/Navigation.module.css";

// Media navigation component with fullscreen and metadata controls
const NavigationMedia = memo(
  ({
    onClose, // Callback to close the media view
    onPrevious, // Callback to go to previous media
    onNext, // Callback to go to next media
    onToggleMetadata, // Callback to toggle metadata panel
    isNavigationMode, // Whether navigation arrows should be shown
    onToggleFullScreen, // Callback to enter fullscreen
    isFirst, // Whether current media is the first
    isLast, // Whether current media is the last
  }) => {
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Track fullscreen state
    useEffect(() => {
      const handleFullscreenChange = () => {
        setIsFullscreen(!!document.fullscreenElement);
      };

      document.addEventListener("fullscreenchange", handleFullscreenChange);
      return () => {
        document.removeEventListener(
          "fullscreenchange",
          handleFullscreenChange
        );
      };
    }, []);

    // Handle close button behavior (exit fullscreen or close)
    const handleClose = () => {
      if (isFullscreen) {
        document.exitFullscreen().catch((err) => {
          console.error(
            `Error exiting fullscreen: ${err.message} (${err.name})`
          );
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
        {/* ← and → arrows for media navigation */}
        {isNavigationMode && !isFullscreen && (
          <>
            {/* ← Previous media arrow */}
            {!isFirst && (
              <button
                className={`${styles.fabButton} ${styles.leftArrow}`}
                aria-label="Previous media"
                onClick={onPrevious}
                type="button"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  width="22"
                  height="22"
                  fill="currentColor"
                >
                  <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                </svg>
              </button>
            )}

            {/* → Next media arrow */}
            {!isLast && (
              <button
                className={`${styles.fabButton} ${styles.rightArrow}`}
                aria-label="Next media"
                onClick={onNext}
                type="button"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  width="22"
                  height="22"
                  fill="currentColor"
                >
                  <path d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z" />
                </svg>
              </button>
            )}
          </>
        )}

        {/* FAB menu with fullscreen, metadata, and close buttons */}
        {!isFullscreen && (
          <div className={styles.fabMenu}>
            {/* [ ] Fullscreen toggle button */}
            <button
              className={styles.fabButton}
              onClick={onToggleFullScreen}
              aria-label="Enter full screen"
              type="button"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 8V4h4" />
                <path d="M20 8V4h-4" />
                <path d="M4 16v4h4" />
                <path d="M20 16v4h-4" />
              </svg>
            </button>

            {/* i Metadata toggle button */}
            <button
              className={styles.fabButton}
              onClick={onToggleMetadata}
              aria-label="Toggle metadata panel"
              type="button"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="2 2 20 20" // ← inset viewBox
                width="20"
                height="20"
                fill="currentColor"
              >
                <path d="M11 7h2v2h-2zm0 4h2v6h-2z" />
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM12 20c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
              </svg>
            </button>

            {/* x Close button */}
            <button
              className={styles.fabButton}
              onClick={handleClose}
              aria-label="Close media navigation"
              type="button"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                width="22"
                height="22"
                fill="currentColor"
              >
                <path d="M18.3 5.71 12 12l6.3 6.29-1.41 1.42L12 13.41l-6.29 6.3-1.42-1.42L10.59 12 4.29 5.71 5.7 4.29 12 10.59l6.29-6.3z" />
              </svg>
            </button>
          </div>
        )}

        {/* x Close button in fullscreen mode */}
        {isFullscreen && (
          <button
            className={styles.fabButton}
            onClick={handleClose}
            aria-label="Exit full screen and close"
            type="button"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              width="20"
              height="20"
              fill="currentColor"
            >
              <path d="M18.3 5.71 12 12l6.3 6.29-1.41 1.42L12 13.41l-6.29 6.3-1.42-1.42L10.59 12 4.29 5.71 5.7 4.29 12 10.59l6.29-6.3z" />
            </svg>
          </button>
        )}
      </div>
    );
  }
);

export default NavigationMedia;
