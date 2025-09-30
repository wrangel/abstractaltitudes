// src/frontend/components/PortfolioGrid.jsx

import { Masonry } from "masonic";
import LoadingErrorHandler from "./LoadingErrorHandler";
import PortfolioItem from "./PortfolioItem";
import { useLoadingError } from "../hooks/useLoadingError";
import { useResponsiveGridWithRatio } from "../hooks/useResponsiveGridWithRatio";
import { useViewportSize } from "../hooks/useViewportSize";
import { buildQueryString } from "../components/buildQueryString";

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
  const { columnWidth, columnGutter, rowGutter } = useResponsiveGridWithRatio(
    16,
    -2 / 16
  );

  const renderItem = ({ data }) => (
    <PortfolioItem
      key={data.id}
      item={data}
      onItemClick={onItemClick}
      useLazyImage={true}
    />
  );

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
