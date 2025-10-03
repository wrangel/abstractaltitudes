// src/frontend/components/PortfolioGrid.jsx

import { Masonry } from "masonic";
import LoadingErrorHandler from "./LoadingErrorHandler";
import PortfolioItem from "./PortfolioItem";
import { useLoadingError } from "../hooks/useLoadingError";
import { useResponsiveGridWithRatio } from "../hooks/useResponsiveGridWithRatio";
import { useViewportSize } from "../hooks/useViewportSize";
import { buildQueryStringWidthHeight } from "../utils/buildQueryStringWidthHeight";

/**
 * PortfolioGrid component renders a masonry grid layout of portfolio items using Masonic.
 *
 * It handles loading and error states using the useLoadingError hook,
 * and displays the portfolio items in a responsive masonry layout.
 *
 * @param {Object} props - Component props.
 * @param {Array} props.items - Array of portfolio items to display.
 * @param {Function} props.onItemClick - Callback function when an item is clicked.
 *
 * @returns {JSX.Element} The masonry grid wrapped in loading/error handler.
 */
const PortfolioGrid = ({ items, onItemClick }) => {
  const { isLoading, error } = useLoadingError(false);
  const { w } = useViewportSize();
  const { columnWidth, columnGutter, rowGutter } = useResponsiveGridWithRatio(
    16,
    -2 / 16
  );

  const renderItem = ({ data }) => {
    // Responsive column width from grid layout
    const width = Math.floor(columnWidth);

    // Use original dimensions or fallback to 1 to avoid div by zero
    const originalWidth = data.originalWidth || 1;
    const originalHeight = data.originalHeight || 1;

    // Calculate proportional height for aspect ratio
    const height = Math.round((width * originalHeight) / originalWidth);

    // Limit requested image size to thumbnail actual size to avoid upscaling
    const finalWidth = Math.min(width, data.thumbnailWidth || width);
    const finalHeight = Math.min(height, data.thumbnailHeight || height);

    // Build BunnyCDN URL requesting resized image for the calculated size
    const imageSrc = buildQueryStringWidthHeight(data.thumbnailUrl, {
      width: finalWidth,
      height: finalHeight,
    });

    // Pass optimized thumbnail URL and original data to PortfolioItem
    return (
      <PortfolioItem
        key={data.id}
        item={{ ...data, thumbnailUrl: imageSrc }}
        onItemClick={onItemClick}
        useLazyImage={true}
      />
    );
  };

  return (
    <LoadingErrorHandler isLoading={isLoading} error={error}>
      <Masonry
        items={items}
        columnWidth={columnWidth}
        columnGutter={columnGutter}
        rowGutter={rowGutter}
        render={renderItem}
      />
    </LoadingErrorHandler>
  );
};

export default PortfolioGrid;
