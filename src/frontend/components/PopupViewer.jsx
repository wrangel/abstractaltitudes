// src/frontend/components/PopupViewer.jsx

import React, { useState } from "react";
import FullScreenModal from "./FullScreenModal";
import Viewer from "./Viewer";
import ErrorBoundary from "./ErrorBoundary";

const PopupViewer = ({ item, isOpen, onClose, onNext, onPrevious }) => {
  const [isNavigationMode, setIsNavigationMode] = useState(true);

  const toggleMode = () => {
    setIsNavigationMode((prevMode) => !prevMode);
  };

  if (!item) return null;

  return (
    <ErrorBoundary>
      <FullScreenModal isOpen={isOpen} onClose={onClose}>
        <div style={{ width: "100%", height: "100%" }}>
          <Viewer
            item={item}
            isOpen={isOpen}
            onClose={onClose}
            onNext={onNext}
            onPrevious={onPrevious}
            isNavigationMode={isNavigationMode}
            toggleMode={toggleMode}
          />
        </div>
      </FullScreenModal>
    </ErrorBoundary>
  );
};

export default React.memo(PopupViewer);
