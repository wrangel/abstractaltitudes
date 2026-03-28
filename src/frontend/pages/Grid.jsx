// src/frontend/pages/Grid.js

import React, { useCallback } from "react";
import PortfolioGrid from "../components/PortfolioGrid";
import PopupViewer from "../components/PopupViewer";
import { useItems } from "../hooks/useItems";
import { useItemViewer } from "../hooks/useItemViewer";
import LoadingOverlay from "../components/LoadingOverlay";
import MascotCorner from "../components/MascotCorner";
import ErrorBoundary from "../components/ErrorBoundary";
import styles from "../styles/Grid.module.css";

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

  const currentIndex = items.findIndex((item) => item.id === selectedItem?.id);
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === items.length - 1;

  const onItemClick = useCallback(handleItemClick, [handleItemClick]);
  const onClose = useCallback(handleClosePopup, [handleClosePopup]);
  const onNext = useCallback(handleNextItem, [handleNextItem]);
  const onPrevious = useCallback(handlePreviousItem, [handlePreviousItem]);

  if (isLoading) return <LoadingOverlay ariaLive="polite" />;

  if (error) {
    return (
      <div className={styles.Grid} role="alert">
        <p>Error: {error}</p>
        <button onClick={refetch}>Retry</button>
      </div>
    );
  }

  return (
    <>
      <MascotCorner />
      <div className={styles.Grid}>
        {items.length > 0 ? (
          <ErrorBoundary>
            <PortfolioGrid items={items} onItemClick={onItemClick} />
          </ErrorBoundary>
        ) : (
          <p>No items to display.</p>
        )}

        <footer className={styles.finalFooter}>
          <div className={styles.footerContent}>
            <ul className={styles.creditsList}>
              {[
                { href: "https://github.com/wrangel", label: "wrangel" },
                { href: "https://www.dji.com", label: "DJI" },
                { href: "https://ptgui.com", label: "PTGui Pro" },
                { href: "https://www.marzipano.net/", label: "Marzipano" },
                {
                  href: "https://www.adobe.com/products/photoshop-lightroom.html",
                  label: "Adobe Lightroom",
                },
              ].map(({ href, label }) => (
                <li key={label}>
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
            <p className={styles.copyright}>© 2026 Abstract Altitudes</p>
          </div>
        </footer>
      </div>

      {isModalOpen && selectedItem && (
        <PopupViewer
          item={{ ...selectedItem, isFirst, isLast }}
          isOpen={isModalOpen}
          onClose={onClose}
          onNext={onNext}
          onPrevious={onPrevious}
          isNavigationMode={true}
        />
      )}
    </>
  );
}

export default React.memo(Grid);
