// src/frontend/components/PopupViewer.jsx

import React, { useState, useCallback } from "react";
import FullScreenModal from "./FullScreenModal";
import Viewer from "./Viewer";
import ErrorBoundary from "./ErrorBoundary";

const PopupViewer = ({ item, isOpen, onClose, onNext, onPrevious }) => {
  const [isNavigationMode, setIsNavigationMode] = useState(true);

  const toggleMode = useCallback(() => {
    setIsNavigationMode((prevMode) => !prevMode);
  }, []);

  // Never return null — doing so unmounts Viewer and destroys the WebGL
  // context. Visibility is controlled by FullScreenModal via display:none.
  return (
    <ErrorBoundary>
      <FullScreenModal isOpen={isOpen} onClose={onClose}>
        <div
          style={{
            width: "100%",
            height: "100%",
            maxWidth: "95vw",
            maxHeight: "90vh",
            display: "flex",
            flexDirection: "column",
          }}
        >
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
