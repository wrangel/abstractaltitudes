// src/frontend/components/PortfolioGrid.jsx

import { Masonry } from "masonic";
import PortfolioItem from "./PortfolioItem";
import LoadingErrorHandler from "./LoadingErrorHandler";
import { useLoadingError } from "../hooks/useLoadingError";
import { useViewportSize } from "../hooks/useViewportSize";
import { useScrollReveal } from "../hooks/useScrollReveal";

const PortfolioGrid = ({ items, onItemClick }) => {
  const { isLoading, error } = useLoadingError(false);
  const { w } = useViewportSize();
  const revealRef = useScrollReveal();

  const gutter = 24;

  const getColumnWidth = () => {
    if (!w || w <= 0) return 300;
    return Math.floor(w / 3) - gutter; // Responsive 3 columns
  };

  const columnWidth = getColumnWidth();

  const renderItem = ({ data, width }) => {
    return (
      <PortfolioItem
        item={data}
        width={width}
        onItemClick={onItemClick}
        revealRef={revealRef}
      />
    );
  };

  return (
    <LoadingErrorHandler isLoading={isLoading} error={error}>
      <div style={{ padding: "0 20px" }}>
        <Masonry
          items={items || []}
          columnWidth={columnWidth}
          columnGutter={gutter}
          rowGutter={gutter}
          render={renderItem}
        />
      </div>
    </LoadingErrorHandler>
  );
};

export default PortfolioGrid;
