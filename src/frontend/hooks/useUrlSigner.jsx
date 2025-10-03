// useUrlSigner.jsx

import { useState, useEffect } from "react";

/**
 * Extracts width and height from a URL's query parameters.
 * Returns { width, height } as numbers if present, undefined otherwise.
 */
function extractParamsFromUrl(url) {
  try {
    const { search } = new URL(url, "https://dummybase"); // fallback base for relative URLs
    const params = new URLSearchParams(search);
    const width = params.get("width");
    const height = params.get("height");
    return {
      width: width ? Number(width) : undefined,
      height: height ? Number(height) : undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Converts a full CDN URL to a path + search string (for backend signing).
 * If already relative, returns as-is.
 */
function getRelativePath(fullUrl) {
  try {
    // Replace with your CDN base if needed, or keep as general
    const { pathname, search } = new URL(fullUrl, "https://dummybase");
    return pathname + search;
  } catch {
    return fullUrl;
  }
}

/**
 * React hook for obtaining a signed BunnyCDN URL for a resource.
 *
 * @param {string} url - CDN URL (full or relative, with optional width/height query params)
 * @param {boolean} skip - If true, do not sign (for public/pano resources)
 *
 * @returns {object} { signedUrl, error }
 */
export function useSignedUrl(url, skip = false) {
  const [signedUrl, setSigned] = useState(skip ? url : null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (skip || !url) return;

    const controller = new AbortController();
    const { width, height } = extractParamsFromUrl(url);

    const body = JSON.stringify({
      path: getRelativePath(url),
      ...(width !== undefined && { width }),
      ...(height !== undefined && { height }),
    });

    fetch("/api/sign-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then((data) => setSigned(data.signedUrl))
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.warn("[useSignedUrl]", err);
          setError(err);
          setSigned(url); // optionally fall back to unsigned URL
        }
      });

    return () => controller.abort();
  }, [url, skip]);

  return { signedUrl: skip ? url : signedUrl, error };
}
