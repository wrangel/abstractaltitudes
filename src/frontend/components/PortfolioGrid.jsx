// src/frontend/components/PortfolioGrid.jsx

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

  const getColumnWidth = () => {
    if (!w || w <= 0) return 300;

    if (w <= 768) {
      // 1 column on mobile, full width minus a small inset
      return w;
    }

    if (w <= 900) {
      // 2 columns on tablets
      return w / 2 - 24; // gutter 24
    }

    // 3 columns on desktop
    return w / 3 - 24; // gutter 24
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
      <div style={{ padding: 0 }}>
        <Masonry
          items={items || []}
          columnWidth={columnWidth}
          columnGutter={24} // horizontal spacing
          rowGutter={12} // vertical spacing (half of horizontal)
          render={renderItem}
        />
      </div>
    </LoadingErrorHandler>
  );
};

export default PortfolioGrid;
