// src/frontend/context/WebGLManager.jsx
//
// Enforces a single active Marzipano WebGL context across the whole app.
// Any component that wants to create a viewer must first call acquireContext().
// When it unmounts or no longer needs the context it calls releaseContext().
// If another viewer already holds the context, acquireContext() returns false
// and the caller should skip viewer initialisation.

import { createContext, useContext, useRef, useCallback } from "react";

const WebGLManagerContext = createContext(null);

export function WebGLManagerProvider({ children }) {
  // Stores a cleanup callback provided by the current context owner.
  const ownerCleanupRef = useRef(null);

  /**
   * Try to acquire the global WebGL context slot.
   * @param {() => void} cleanup  Called when another viewer displaces this one.
   * @returns {boolean}  true = you have the slot; false = denied (shouldn't happen
   *                     with the forced-takeover model, but kept for safety).
   */
  const acquireContext = useCallback((cleanup) => {
    // If someone already owns it, forcibly release them first so the
    // browser can GC the old context before we create the new one.
    if (ownerCleanupRef.current) {
      try {
        ownerCleanupRef.current();
      } catch (e) {
        console.warn("WebGLManager: error evicting previous owner", e);
      }
    }
    ownerCleanupRef.current = cleanup ?? null;
    return true;
  }, []);

  /**
   * Release the slot. Only the current owner should call this.
   */
  const releaseContext = useCallback(() => {
    ownerCleanupRef.current = null;
  }, []);

  return (
    <WebGLManagerContext.Provider value={{ acquireContext, releaseContext }}>
      {children}
    </WebGLManagerContext.Provider>
  );
}

export function useWebGLManager() {
  const ctx = useContext(WebGLManagerContext);
  if (!ctx) {
    throw new Error("useWebGLManager must be used inside WebGLManagerProvider");
  }
  return ctx;
}
