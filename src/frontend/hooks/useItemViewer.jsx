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
    setIsModalOpen(false);
    setSelectedItemId(null);
  }, []);

  const handleNextItem = useCallback(() => {
    if (!Array.isArray(items)) return;

    setSelectedItemId((currentId) => {
      const currentIdx = items.findIndex((item) => item.id === currentId);
      console.log("[NEXT] currentIdx", currentIdx); // <--- for backward
      if (currentIdx >= 0 && currentIdx < items.length - 1) {
        const nextId = items[currentIdx + 1].id;
        return nextId;
      }
      return currentId;
    });
  }, [items]);

  const handlePreviousItem = useCallback(() => {
    if (!Array.isArray(items)) return;

    setSelectedItemId((currentId) => {
      if (!currentId) return currentId;
      const currentIdx = items.findIndex((item) => item.id === currentId);
      console.log("[PREVIOUS] currentIdx", currentIdx); // <--- add this
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
