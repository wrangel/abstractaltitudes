// src/frontend/components/MascotCorner.jsx

import { memo } from "react";
import { Link, useLocation } from "react-router-dom";
import MascotMedia from "./MascotMedia";
import styles from "../styles/MascotCorner.module.css";

const MascotCorner = () => {
  const location = useLocation();
  if (location.pathname === "/") {
    return null;
  }

  return (
    <Link
      to="/"
      aria-label="Go to homepage"
      className={styles.mascotCornerLink}
    >
      <MascotMedia className={styles.mascotCorner} />
    </Link>
  );
};

export default memo(MascotCorner);
