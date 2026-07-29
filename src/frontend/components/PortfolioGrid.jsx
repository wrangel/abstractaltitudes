// src/frontend/components/PortfolioGrid.jsx
import { useCallback } from "react";
import { Masonry } from "masonic";
import PortfolioItem from "./PortfolioItem";
import { useViewportSize } from "../hooks/useViewportSize";

const PortfolioGrid = ({ items, onItemClick }) => {
  const { w } = useViewportSize();

  const columnWidth = !w || w <= 0
    ? 300
    : w <= 768
    ? w
    : w <= 900
    ? w / 2 - 24
    : w / 3 - 24;

  // Masonry keys its cell cache off this function's identity, so recreating
  // it every render made the whole grid re-render on any parent update.
  const renderItem = useCallback(
    ({ data }) => <PortfolioItem item={data} onItemClick={onItemClick} />,
    [onItemClick],
  );

  return (
    <div style={{ padding: 0 }}>
      <Masonry
        items={items || []}
        columnWidth={columnWidth}
        columnGutter={24}
        rowGutter={12}
        render={renderItem}
      />
    </div>
  );
};

export default PortfolioGrid;
