// src/frontend/hooks/useItemViewer.jsx

import { useState, useCallback, useMemo, useEffect, useRef } from "react";

const PHOTO_PREFIX = "/photo/";

/**
 * Extracts the photo slug from a pathname, or null when it isn't a photo URL.
 *
 * @param {string} pathname - window.location.pathname.
 * @returns {string|null} Slug without prefix or trailing slash.
 */
function slugFromPath(pathname) {
  if (!pathname.startsWith(PHOTO_PREFIX)) return null;
  let slug = pathname.slice(PHOTO_PREFIX.length).replace(/\/+$/, "");
  try {
    slug = decodeURIComponent(slug);
  } catch {
    return null; // malformed percent-encoding
  }
  return slug || null;
}

/**
 * Custom hook to manage state and navigation for a viewed item in a list.
 *
 * Also mirrors the open item into the URL as /photo/<slug>. This is purely a
 * history/address-bar concern — no component ever unmounts as a result, which
 * is what keeps ViewerPanorama's WebGL context alive across opens.
 */
export const useItemViewer = (items = []) => {
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Whether the current photo URL is a history entry *we* pushed. Decides
  // whether closing can pop back, or has to rewrite the URL in place — the
  // latter when the visitor landed on the photo URL directly from search.
  const pushedHistory = useRef(false);
  const didApplyInitialUrl = useRef(false);

  const selectedItem = useMemo(() => {
    if (!Array.isArray(items)) return null;
    return items.find((item) => item.id === selectedItemId) || null;
  }, [items, selectedItemId]);

  // Resolve an inbound /photo/<slug> deep link, once, as soon as items exist.
  useEffect(() => {
    if (didApplyInitialUrl.current) return;
    if (!Array.isArray(items) || items.length === 0) return;
    didApplyInitialUrl.current = true;

    const slug = slugFromPath(window.location.pathname);
    if (!slug) return;

    const match = items.find((item) => item.slug === slug);
    if (match) {
      setSelectedItemId(match.id);
      setIsModalOpen(true);
      pushedHistory.current = false; // the visitor arrived here; we didn't push
    } else {
      // Unknown slug (renamed or removed photo): fall back to the gallery
      // rather than sitting on a URL that resolves to nothing.
      window.history.replaceState(null, "", "/");
    }
  }, [items]);

  // Mirror state -> URL.
  useEffect(() => {
    // Never write before the inbound URL has been read, or we'd erase it.
    if (!didApplyInitialUrl.current) return;

    // Trailing slash matches what the prerender emits
    // (build/photo/<slug>/index.html), so a shared link never eats an nginx
    // 301 on its way to the static page.
    const desired =
      isModalOpen && selectedItem?.slug
        ? `${PHOTO_PREFIX}${selectedItem.slug}/`
        : "/";

    if (window.location.pathname === desired) return;

    if (desired === "/") {
      if (pushedHistory.current) {
        pushedHistory.current = false;
        window.history.back();
      } else {
        window.history.replaceState(null, "", "/");
      }
      return;
    }

    if (slugFromPath(window.location.pathname)) {
      // Already viewing a photo: next/prev replaces, so clicking through the
      // gallery doesn't bury the entry point under dozens of history entries.
      window.history.replaceState(null, "", desired);
    } else {
      window.history.pushState(null, "", desired);
      pushedHistory.current = true;
    }
  }, [isModalOpen, selectedItem]);

  // Mirror URL -> state, so Back closes the viewer instead of leaving the site.
  useEffect(() => {
    const handlePopState = () => {
      const slug = slugFromPath(window.location.pathname);
      if (!slug) {
        pushedHistory.current = false;
        setIsModalOpen(false);
        return;
      }
      const match = Array.isArray(items)
        ? items.find((item) => item.slug === slug)
        : null;
      if (match) {
        setSelectedItemId(match.id);
        setIsModalOpen(true);
      } else {
        setIsModalOpen(false);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [items]);

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
