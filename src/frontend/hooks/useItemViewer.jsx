// src/frontend/hooks/useItemViewer.jsx

import { useState, useCallback, useMemo } from "react";

/**
 * Custom hook to manage state and navigation for a viewed item in a list.
 */
export const useItemViewer = (items = []) => {
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const selectedItem = useMemo(() => {
    if (!Array.isArray(items)) return null;
    return items.find((item) => item.id === selectedItemId) || null;
  }, [items, selectedItemId]);

  const handleItemClick = useCallback((clickedItem) => {
    if (clickedItem?.id) {
      setSelectedItemId(clickedItem.id);
      setIsModalOpen(true);
    }
  }, []);

  const handleClosePopup = useCallback(() => {
    // Only close the modal — do NOT clear selectedItemId.
    // Keeping selectedItemId alive means Grid keeps PopupViewer mounted,
    // which keeps ViewerPanorama and its WebGL context alive between opens.
    setIsModalOpen(false);
  }, []);

  const handleNextItem = useCallback(() => {
    if (!Array.isArray(items)) return;

    setSelectedItemId((currentId) => {
      const currentIdx = items.findIndex((item) => item.id === currentId);
      if (currentIdx >= 0 && currentIdx < items.length - 1) {
        return items[currentIdx + 1].id;
      }
      return currentId;
    });
  }, [items]);

  const handlePreviousItem = useCallback(() => {
    if (!Array.isArray(items)) return;

    setSelectedItemId((currentId) => {
      if (!currentId) return currentId;
      const currentIdx = items.findIndex((item) => item.id === currentId);
      if (currentIdx > 0) {
        return items[currentIdx - 1].id;
      }
      return currentId;
    });
  }, [items]);

  return {
    selectedItem,
    isModalOpen,
    handleItemClick,
    handleClosePopup,
    handleNextItem,
    handlePreviousItem,
  };
};
