// src/frontend/components/PortfolioItem.jsx

import { memo, useCallback } from "react";
import PropTypes from "prop-types";
import styles from "../styles/PortfolioItem.module.css";
import { describeItem } from "../../shared/describeItem.mjs";
import { sizedImageUrl, thumbnailSrcSet } from "../../shared/imageUrl.mjs";

/** One clickable gallery thumbnail. Renders nothing if the item has no image. */
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
      {/* sizes mirrors PortfolioGrid's column maths: 1 column up to 768px,
          2 up to 900px, 3 above. Without it the browser assumes 100vw and
          picks a needlessly large variant. */}
      <img
        src={sizedImageUrl(item.thumbnailUrl, 480)}
        srcSet={thumbnailSrcSet(item.thumbnailUrl)}
        sizes="(max-width: 768px) 100vw, (max-width: 900px) 50vw, 33vw"
        alt={description}
        loading="lazy"
        decoding="async"
      />
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
