// src/frontend/components/NavigationMedia.jsx

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
          handleFullscreenChange
        );
      };
    }, []);

    const handleClose = () => {
      if (isFullscreen) {
        document.exitFullscreen().catch((err) => {
          console.error(
            `Error attempting to exit full-screen mode: ${err.message} (${err.name})`
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
        style={{ zIndex: 1100 }}
        role="navigation"
        aria-label="Media navigation controls"
      >
        {isNavigationMode && !isFullscreen && (
          <>
            {!isFirst && (
              <button
                className={styles.leftArrow}
                aria-label="Previous media"
                onClick={onPrevious}
                type="button"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="currentColor"
                >
                  <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                </svg>
              </button>
            )}
            {!isLast && (
              <button
                className={styles.rightArrow}
                aria-label="Next media"
                onClick={onNext}
                type="button"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="currentColor"
                >
                  <path d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z" />
                </svg>
              </button>
            )}
          </>
        )}

        {!isFullscreen && (
          <div className={styles.fabMenu}>
            <button
              className={styles.fab}
              onClick={onToggleFullScreen}
              aria-label="Enter full screen"
              type="button"
            >
              {/* Fullscreen icon (orthogonal corners) */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M4 8V4h4" />
                <path d="M20 8V4h-4" />
                <path d="M4 16v4h4" />
                <path d="M20 16v4h-4" />
              </svg>
            </button>

            <button
              className={styles.fab}
              onClick={onToggleMetadata}
              aria-label="Toggle metadata panel"
              type="button"
            >
              {/* Info icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="currentColor"
              >
                <path d="M11 7h2v2h-2zm0 4h2v6h-2z" />
                <path
                  d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM12 20c-4.41 0-8-3.59-8-8s3.59-8 
                        8-8 8 3.59 8 8-3.59 8-8 8z"
                />
              </svg>
            </button>

            <button
              className={styles.fab}
              onClick={handleClose}
              aria-label="Close media navigation"
              type="button"
            >
              {/* Close (X) icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="currentColor"
              >
                <path
                  d="M18.3 5.71 12 12l6.3 6.29-1.41 1.42L12 13.41l-6.29 6.3-1.42-1.42L10.59 
                        12 4.29 5.71 5.7 4.29 12 10.59l6.29-6.3z"
                />
              </svg>
            </button>
          </div>
        )}

        {isFullscreen && (
          <button
            className={styles.fab}
            onClick={handleClose}
            aria-label="Exit full screen and close"
            type="button"
          >
            {/* Close icon only */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="currentColor"
            >
              <path
                d="M18.3 5.71 12 12l6.3 6.29-1.41 1.42L12 13.41l-6.29 6.3-1.42-1.42L10.59 
                      12 4.29 5.71 5.7 4.29 12 10.59l6.29-6.3z"
              />
            </svg>
          </button>
        )}
      </div>
    );
  }
);

export default NavigationMedia;
