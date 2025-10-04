// src/frontend/components/NavigationPages.jsx

import React, { memo } from "react";
import { useLocation } from "react-router-dom";
import styles from "../styles/Navigation.module.css";

const NavigationPages = memo(({ onNavigate }) => {
  const location = useLocation();

  // Button config based on location
  const buttonConfig = {
    "/": [
      { label: "Map", path: "/map" },
      { label: "Grid", path: "/grid" },
    ],
    "/map": [{ label: "Grid", path: "/grid" }],
    "/grid": [{ label: "Map", path: "/map" }],
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
        {buttons.map(({ label, path }) => (
          <button
            key={path}
            className={`${styles.fabButton} ${
              location.pathname === path ? styles.active : ""
            }`}
            onClick={() => onNavigate(path)}
            aria-label={`Go to ${label}`}
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
