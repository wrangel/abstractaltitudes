// src/frontend/constants/index.js

// Use your own marker icons or default markers of Pigeon Maps

// Base domain for your app URLs
export const DOMAIN = "https://abstractaltitudes.com/";

const API_BASE_URL = (() => {
  const raw = import.meta.env.VITE_API_URL;
  if (!raw) throw new Error("VITE_API_URL environment variable is not set");
  return raw.replace(/\/+$/, "");
})();

export const COMBINED_DATA_URL = `${API_BASE_URL}/combined-data`;
