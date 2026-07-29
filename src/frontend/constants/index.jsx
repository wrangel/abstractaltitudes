// src/frontend/constants/index.js

const API_BASE_URL = (() => {
  const raw = import.meta.env.VITE_API_URL;
  if (!raw) throw new Error("VITE_API_URL environment variable is not set");
  return raw.replace(/\/+$/, "");
})();

export const COMBINED_DATA_URL = `${API_BASE_URL}/combined-data`;
export const ITEMS_URL = `${API_BASE_URL}/items`;
