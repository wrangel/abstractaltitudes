// src/frontend/components/NavigationPages.jsx

import React, { memo } from "react";
import { useLocation } from "react-router-dom";
import styles from "../styles/Navigation.module.css";

// Map button icon (Bootstrap map)
const MapIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    fill="currentColor"
    className="bi bi-map"
    viewBox="0 0 16 16"
    aria-hidden="true"
    focusable="false"
  >
    <path
      fillRule="evenodd"
      d="M15.817.113A.5.5 0 0 1 16 .5v14a.5.5 0 0 1-.402.49l-5 1a.5.5 0 0 1-.196 0L5.5 15.01l-4.902.98A.5.5 0 0 1 0 15.5v-14a.5.5 0 0 1 .402-.49l5-1a.5.5 0 0 1 .196 0L10.5.99l4.902-.98a.5.5 0 0 1 .415.103M10 1.91l-4-.8v12.98l4 .8zm1 12.98 4-.8V1.11l-4 .8zm-6-.8V1.11l-4 .8v12.98z"
    />
  </svg>
);

// Grid button icon (Bootstrap columns-gap)
const GridIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    fill="currentColor"
    className="bi bi-columns-gap"
    viewBox="0 0 16 16"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M6 1v3H1V1zM1 0a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1V1a1 1 0 0 0-1-1zm14 12v3h-5v-3zm-5-1a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1zM6 8v7H1V8zM1 7a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1zm14-6v7h-5V1zm-5-1a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1V1a1 1 0 0 0-1-1z" />
  </svg>
);

const NavigationPages = memo(({ onNavigate }) => {
  const location = useLocation();

  // Use icons instead of text in button config
  const buttonConfig = {
    "/": [
      { label: <MapIcon />, path: "/map", aria: "Map" },
      { label: <GridIcon />, path: "/grid", aria: "Grid" },
    ],
    "/map": [{ label: <GridIcon />, path: "/grid", aria: "Grid" }],
    "/grid": [{ label: <MapIcon />, path: "/map", aria: "Map" }],
  };

  const buttons = buttonConfig[location.pathname] || [];

  return (
    <nav
      className={styles.fabContainer}
      style={{ zIndex: 950 }}
      aria-label="Page navigation"
      role="navigation"
    >
      <div className={styles.fabMenu}>
        {buttons.map(({ label, path, aria }) => (
          <button
            key={path}
            className={`${styles.fabButton} ${
              location.pathname === path ? styles.active : ""
            }`}
            onClick={() => onNavigate(path)}
            aria-label={`Go to ${aria}`}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
});

export default NavigationPages;
