// src/frontend/components/PortfolioGrid.jsx
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

  const renderItem = ({ data }) => (
    <PortfolioItem item={data} onItemClick={onItemClick} />
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
