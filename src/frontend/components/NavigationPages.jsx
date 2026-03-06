// src/frontend/components/NavigationPages.jsx

import React, { memo } from "react";
import { useLocation } from "react-router-dom";
import styles from "../styles/Navigation.module.css";

const MapIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    fill="currentColor"
    viewBox="0 0 16 16"
  >
    <path
      fillRule="evenodd"
      d="M15.817.113A.5.5 0 0 1 16 .5v14a.5.5 0 0 1-.402.49l-5 1a.5.5 0 0 1-.196 0L5.5 15.01l-4.902.98A.5.5 0 0 1 0 15.5v-14a.5.5 0 0 1 .402-.49l5-1a.5.5 0 0 1 .196 0L10.5.99l4.902-.98a.5.5 0 0 1 .415.103M10 1.91l-4-.8v12.98l4 .8zm1 12.98 4-.8V1.11l-4 .8zm-6-.8V1.11l-4 .8v12.98z"
    />
  </svg>
);

const GridIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    fill="currentColor"
    viewBox="0 0 16 16"
  >
    <path d="M6 1v3H1V1zM1 0a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1V1a1 1 0 0 0-1-1zm14 12v3h-5v-3zm-5-1a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1zM6 8v7H1V8zM1 7a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1zm14-6v7h-5V1zm-5-1a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1V1a1 1 0 0 0-1-1z" />
  </svg>
);

const HomeIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    fill="currentColor"
    viewBox="0 0 16 16"
  >
    <path d="M8.707 1.5a1 1 0 0 0-1.414 0L.646 8.146a.5.5 0 0 0 .708.708L2 8.207V13.5A1.5 1.5 0 0 0 3.5 15h9a1.5 1.5 0 0 0 1.5-1.5V8.207l.646.647a.5.5 0 0 0 .708-.708L13 5.793V2.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1.293zM13 7.207V13.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V7.207l5-5z" />
  </svg>
);

const NavigationPages = memo(({ onNavigate }) => {
  const location = useLocation();
  const isAtRoot = location.pathname === "/";

  const handleAction = (path, isScrollAction) => {
    if (isAtRoot && isScrollAction) {
      const elementId = path === "top" ? "root" : "main-content";
      document
        .getElementById(elementId)
        ?.scrollIntoView({ behavior: "smooth" });
    } else {
      onNavigate(path);
    }
  };

  // Logic:
  // If on Map: Show Home (links to /) and Grid (links to /#grid)
  // If on Home/Grid: Show Map button and a toggle between Top/Gallery
  const renderButtons = () => {
    if (location.pathname === "/map") {
      return (
        <>
          <button
            className={styles.fabButton}
            onClick={() => onNavigate("/")}
            aria-label="Go Home"
          >
            <HomeIcon />
          </button>
          <button
            className={styles.fabButton}
            onClick={() => onNavigate("/")}
            aria-label="Go to Grid"
          >
            <GridIcon />
          </button>
        </>
      );
    }

    return (
      <>
        <button
          className={styles.fabButton}
          onClick={() => onNavigate("/map")}
          aria-label="Open Map"
        >
          <MapIcon />
        </button>
        <button
          className={styles.fabButton}
          onClick={() => handleAction("main-content", true)}
          aria-label="Scroll to Grid"
        >
          <GridIcon />
        </button>
        <button
          className={styles.fabButton}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Scroll to Top"
        >
          <HomeIcon />
        </button>
      </>
    );
  };

  return (
    <nav
      className={styles.fabContainer}
      style={{ zIndex: 950 }}
      aria-label="Navigation"
    >
      <div className={styles.fabMenu}>{renderButtons()}</div>
    </nav>
  );
});

export default NavigationPages;
