import { createContext, useContext, useRef, useCallback } from "react";

const WebGLManagerContext = createContext(null);

export function WebGLManagerProvider({ children }) {
  const ownerCleanupRef = useRef(null);
  const currentOwnerId = useRef(null);

  const acquireContext = useCallback((cleanup, id) => {
    // If a different component tries to acquire, evict the old one
    if (ownerCleanupRef.current && currentOwnerId.current !== id) {
      try {
        ownerCleanupRef.current();
      } catch (e) {
        console.warn("WebGLManager: error evicting previous owner", e);
      }
    }
    ownerCleanupRef.current = cleanup ?? null;
    currentOwnerId.current = id;
    return true;
  }, []);

  const releaseContext = useCallback((id) => {
    // ONLY release if the ID matches the current owner
    if (currentOwnerId.current === id) {
      ownerCleanupRef.current = null;
      currentOwnerId.current = null;
    }
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
