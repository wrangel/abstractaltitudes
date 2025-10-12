// src/frontend/components/PopupMetadata.jsx
import React from "react";
import PropTypes from "prop-types";
import styles from "../styles/PopupMetadata.module.css";

/**
 * PopupMetadata shows static metadata in a modal popup.
 *
 * Props:
 * - metadata { title, description, attributes }  (object)
 *   OR a plain string (treated as description)
 * - latitude: number (optional)
 * - longitude: number (optional)
 * - previewUrl: string (optional static preview image)
 * - isVisible: boolean (controls display)
 * - onClose: function (called to close popup)
 */
const PopupMetadata = ({
  metadata = {},
  latitude,
  longitude,
  previewUrl,
  isVisible,
  onClose,
}) => {
  // Hide if isVisible is false
  if (!isVisible) return null;

  // Normalise: string -> { description: string }
  const meta =
    typeof metadata === "string" ? { description: metadata } : metadata || {};

  // Coordinate formatter
  const formatCoords = (lat, lng) =>
    lat != null && lng != null ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : null;

  // Render attributes as table rows
  const renderAttributes = (attributes) =>
    attributes && typeof attributes === "object" ? (
      <table className={styles.attributesTable}>
        <tbody>
          {Object.entries(attributes).map(([key, value]) => (
            <tr key={key}>
              <td className={styles.attrKey}>{key}</td>
              <td className={styles.attrValue}>{String(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    ) : null;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
    >
      <div className={styles.container}>
        <button
          className={styles.closeButton}
          type="button"
          aria-label="Close metadata modal"
          onClick={onClose}
        >
          ×
        </button>
        <h2 className={styles.title}>{meta.title || "Metadata"}</h2>
        {previewUrl && (
          <img
            src={previewUrl}
            alt="Preview"
            className={styles.previewImage}
            style={{ width: "100%", maxWidth: "400px", margin: "0 0 1rem 0" }}
          />
        )}
        {meta.description && (
          <p className={styles.description}>{meta.description}</p>
        )}
        {renderAttributes(meta.attributes)}
        {latitude != null && longitude != null && (
          <div className={styles.coordinates}>
            <strong>Coordinates:</strong> {formatCoords(latitude, longitude)}
          </div>
        )}
      </div>
    </div>
  );
};

PopupMetadata.propTypes = {
  metadata: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.shape({
      title: PropTypes.string,
      description: PropTypes.string,
      attributes: PropTypes.object,
    }),
  ]),
  latitude: PropTypes.number,
  longitude: PropTypes.number,
  previewUrl: PropTypes.string,
  isVisible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default PopupMetadata;
