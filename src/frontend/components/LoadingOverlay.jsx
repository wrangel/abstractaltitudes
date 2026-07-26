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
          srcSet={`${thumbnailUrl}?width=300 300w, ${thumbnailUrl}?width=768 768w, ${thumbnailUrl}?width=1280 1280w`}
          sizes="(max-width: 600px) 80vw, (max-width: 1200px) 50vw, 33vw"
        />
      )}
      <div className={styles.spinner} aria-label="Loading indicator" />
    </div>
  );
};

export default LoadingOverlay;
