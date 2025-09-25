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

  // Draggable popup logic keeping original smoothness approach
  const handleDragStart = (e) => {
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
      passive: false, // changed to false for touchmove to avoid scroll during drag
    });
    document.addEventListener(isTouch ? "touchend" : "mouseup", onUp);
  };

  const style = {
    ...(popupPosition.x === 0 && popupPosition.y === 0
      ? {}
      : {
          transform: "none",
          left: `${popupPosition.x}px`,
          top: `${popupPosition.y}px`,
          position: "absolute",
        }),
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
        className={styles.dragPill}
        onClick={onClose}
        onTouchEnd={(e) => {
          e.preventDefault();
          onClose();
        }}
        aria-label="Close metadata popup"
        type="button"
      />
      <div className={styles.content}>
        <pre>{metadata}</pre>

        {/* Lazy load panorama image */}
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
