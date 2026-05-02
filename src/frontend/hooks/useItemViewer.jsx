import { useState, useCallback, useMemo, useEffect } from "react";

/**
 * Custom hook to manage state and navigation for a viewed item in a list.
 */
export const useItemViewer = (items = []) => {
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 1. Logge, was der Hook insgesamt an Items empfängt
  useEffect(() => {
    if (items.length > 0) {
      const testItem = items.find((i) => i.name && i.name.includes("20260415"));
    }
  }, [items]);

  const selectedItem = useMemo(() => {
    if (!Array.isArray(items)) return null;
    const item = items.find((item) => item.id === selectedItemId) || null;

    return item;
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
