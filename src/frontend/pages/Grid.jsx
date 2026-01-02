// src/frontend/pages/Grid.js

import React, { useCallback } from "react";
import { Helmet } from "react-helmet-async";
import PortfolioGrid from "../components/PortfolioGrid";
import PopupViewer from "../components/PopupViewer";
import { useItems } from "../hooks/useItems";
import { useItemViewer } from "../hooks/useItemViewer";
import LoadingOverlay from "../components/LoadingOverlay";
import MascotCorner from "../components/MascotCorner";
import ErrorBoundary from "../components/ErrorBoundary";
import styles from "../styles/Grid.module.css";
import { DOMAIN } from "../constants";

function Grid() {
  const { items, isLoading, error, refetch } = useItems();

  const {
    selectedItem,
    isModalOpen,
    handleItemClick,
    handleClosePopup,
    handleNextItem,
    handlePreviousItem,
  } = useItemViewer(items);

  // Calculate current index FRESH each render (no memoization)
  const currentIndex = items.findIndex((item) => item.id === selectedItem?.id);
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === items.length - 1;

  const onItemClick = useCallback(handleItemClick, [handleItemClick]);
  const onClose = useCallback(handleClosePopup, [handleClosePopup]);
  const onNext = useCallback(handleNextItem, [handleNextItem]);
  const onPrevious = useCallback(handlePreviousItem, [handlePreviousItem]);

  if (isLoading) {
    return (
      <LoadingOverlay
        ariaLive="polite"
        ariaLabel="Loading gallery images, please wait"
      />
    );
  }

  if (error) {
    return (
      <div
        className={styles.Home}
        role="alert"
        aria-live="assertive"
        tabIndex={-1}
      >
        <p>Error: {error}</p>
        <button onClick={refetch}>Retry</button>
      </div>
    );
  }

  return (
    <>
      <MascotCorner />
      <Helmet>
        <link rel="canonical" href={`${DOMAIN}grid`} />
        <title>Abstract Altitudes</title>
        <meta
          name="description"
          content="Explore our gallery of stunning drone-captured aerial images. View our portfolio of breathtaking landscapes and unique perspectives from above."
        />
      </Helmet>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <main
        id="main-content"
        aria-label="Portfolio gallery"
        className={styles.Home}
      >
        {items.length > 0 ? (
          <ErrorBoundary>
            <PortfolioGrid items={items} onItemClick={onItemClick} />
          </ErrorBoundary>
        ) : (
          <p>No items to display.</p>
        )}
        {isModalOpen && selectedItem && (
          <PopupViewer
            item={{
              ...selectedItem,
              isFirst, // Fresh calculation
              isLast, // Fresh calculation
            }}
            isOpen={isModalOpen}
            onClose={onClose}
            onNext={onNext}
            onPrevious={onPrevious}
            isNavigationMode={true}
          />
        )}
      </main>
    </>
  );
}

export default React.memo(Grid);
