import React from "react";
import { Masonry } from "masonic";
import PortfolioItem from "./PortfolioItem";
import LoadingErrorHandler from "./LoadingErrorHandler";
import { useLoadingError } from "../hooks/useLoadingError";
import { useViewportSize } from "../hooks/useViewportSize";
import { buildQueryStringWidthHeight } from "../utils/buildQueryStringWidthHeight";
import { useScrollReveal } from "../hooks/useScrollReveal";

const PortfolioGrid = ({ items, onItemClick }) => {
  const { isLoading, error } = useLoadingError(false);
  const { w } = useViewportSize();
  const revealRef = useScrollReveal();

  const gutter = 24;

  const getColumnWidth = () => {
    // Safety check: if viewport width isn't loaded yet, return a sensible default
    if (!w || w <= 0) return 300;
  };

  const columnWidth = getColumnWidth();
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

  const renderItem = ({ data }) => {
    const width = Math.floor(columnWidth);
    const originalWidth = data.originalWidth || 1;
    const originalHeight = data.originalHeight || 1;
    const height = Math.round((width * originalHeight) / originalWidth);
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
