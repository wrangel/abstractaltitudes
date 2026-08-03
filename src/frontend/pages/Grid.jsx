// src/frontend/pages/Grid.jsx

import React, { useCallback, lazy, Suspense } from "react";
import PortfolioGrid from "../components/PortfolioGrid";
import { useItems } from "../hooks/useItems";
import { useItemViewer } from "../hooks/useItemViewer";
import { useClickCounter } from "../hooks/useClickCounter";
import LoadingOverlay from "../components/LoadingOverlay";
import ErrorBoundary from "../components/ErrorBoundary";
import styles from "../styles/Grid.module.css";

// Lazy because this subtree statically imports OpenSeadragon (~333 KB) and
// Marzipano. It used to sit in a chunk shared by Home and Grid, so every
// visitor downloaded the deep-zoom viewer whether or not they ever opened a
// photo. Safe to defer: PopupViewer is only rendered once an item is
// selected, and stays mounted afterwards — the lazy wrapper resolves once,
// so the WebGL context preservation below is unaffected.
const PopupViewer = lazy(() => import("../components/PopupViewer"));

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

  const { recordClick } = useClickCounter();

  const currentIndex = items.findIndex((item) => item.id === selectedItem?.id);
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === items.length - 1;

  const onItemClick = useCallback(
    (item) => {
      recordClick(item.id);
      handleItemClick(item);
    },
    [handleItemClick, recordClick],
  );
  if (isLoading) return <LoadingOverlay />;

  if (error) {
    return (
      <div className={styles.Grid} role="alert">
        <p>Error: {error}</p>
        <button onClick={refetch}>Retry</button>
      </div>
    );
  }

  // Build the item to pass — keep the last selectedItem alive even while
  // isModalOpen is false so ViewerPanorama is never unmounted mid-session.
  const viewerItem = selectedItem ? { ...selectedItem, isFirst, isLast } : null;

  return (
    <>
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
            <div className={styles.footerLinks}>
              <a
                href="mailto:contact@abstractaltitudes.anonaddy.com"
                className={styles.contactLink}
              >
                Get in touch
              </a>

              {/* Plain link, not a modal: /places/ is a prerendered static
                  page outside the SPA. It also gives crawlers a path from
                  the gallery down to the per-photo pages. */}
              <a href="/places/" className={styles.contactLink}>
                Browse by location
              </a>

              <a href="/license/" className={styles.contactLink}>
                Licensing
              </a>
            </div>

            <ul className={styles.creditsList}>
              {[
                { href: "https://github.com/wrangel", label: "wrangel" },
                { href: "https://www.dji.com", label: "DJI" },
                { href: "https://ptgui.com", label: "PTGui Pro" },
                { href: "https://www.marzipano.net/", label: "Marzipano" },
                {
                  href: "https://openseadragon.github.io/",
                  label: "OpenSeadragon",
                },
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

      {/* Always mounted once an item has been selected — never conditionally
          removed so ViewerPanorama keeps its WebGL context alive. */}
      {viewerItem && (
        <Suspense fallback={<LoadingOverlay />}>
          <PopupViewer
            item={viewerItem}
            isOpen={isModalOpen}
            onClose={handleClosePopup}
            onNext={handleNextItem}
            onPrevious={handlePreviousItem}
          />
        </Suspense>
      )}
    </>
  );
}

export default React.memo(Grid);
