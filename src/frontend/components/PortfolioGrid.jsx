// src/frontend/components/PortfolioGrid.jsx

import LoadingErrorHandler from "./LoadingErrorHandler";
import { useLoadingError } from "../hooks/useLoadingError";
import { useViewportSize } from "../hooks/useViewportSize";

const PortfolioGrid = ({ items, onItemClick }) => {
  const { isLoading, error } = useLoadingError(false);
  const { w } = useViewportSize();

  // --- NEW COLUMN CALCULATION ---
  // We want to force 2-3 columns.
  // Gutters: 24px is a nice breathable space for high-end photography
  const gutter = 24;

  const getColumnWidth = () => {
    if (w > 1200) {
      // Desktop: Aim for 3 columns.
      // (Total Width - (Gutters * 2)) / 3
      return Math.floor((w - gutter * 2 - 80) / 3);
    } else if (w > 600) {
      // Tablet/Small Desktop: Aim for 2 columns.
      return Math.floor((w - gutter - 40) / 2);
    }
    // Mobile: 1 column
    return w - 40;
  };

  const columnWidth = getColumnWidth();
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

  const renderItem = ({ data }) => {
    const width = Math.floor(columnWidth);
    const originalWidth = data.originalWidth || 1;
    const originalHeight = data.originalHeight || 1;
    const height = Math.round((width * originalHeight) / originalWidth);

    // Fade-in class added here for that smooth scroll entrance
    return (
      <div className="grid-item-fade">
        <PortfolioItem
          key={data.id}
          item={{
            ...data,
            thumbnailUrl: buildQueryStringWidthHeight(data.thumbnailUrl, {
              width: Math.round(width * dpr),
              height: Math.round(height * dpr),
            }),
          }}
          onItemClick={onItemClick}
          useLazyImage={true}
        />
      </div>
    );
  };

  return (
    <LoadingErrorHandler isLoading={isLoading} error={error}>
      <Masonry
        items={items}
        columnWidth={columnWidth}
        columnGutter={gutter}
        rowGutter={gutter}
        render={renderItem}
      />
    </LoadingErrorHandler>
  );
};

export default PortfolioGrid;
