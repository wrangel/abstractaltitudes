// src/frontend/components/PortfolioItem.jsx

import { memo, useCallback } from "react";
import PropTypes from "prop-types";
import styles from "../styles/PortfolioItem.module.css";
import { describeItem } from "../../shared/describeItem.mjs";

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

  // Both of these used to be the raw Mongo ObjectId — useless to screen
  // readers and to Google Images alike.
  const description = describeItem(item);

  return (
    <div
      className={styles.portfolioItem}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`View ${description}`}
    >
      <img src={item.thumbnailUrl} alt={description} loading="lazy" />
    </div>
  );
});

PortfolioItem.propTypes = {
  item: PropTypes.shape({
    id: PropTypes.string.isRequired,
    thumbnailUrl: PropTypes.string.isRequired,
    viewer: PropTypes.oneOf(["pano", "img"]),
    location: PropTypes.string,
    region: PropTypes.string,
    country: PropTypes.string,
    altitude: PropTypes.number,
  }).isRequired,
  onItemClick: PropTypes.func.isRequired,
};

export default PortfolioItem;
