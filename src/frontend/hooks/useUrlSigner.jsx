// useUrlSigner.jsx

import { useState, useEffect } from "react";

export function useSignedUrl(url, skip = false) {
  const [signedUrl, setSigned] = useState(skip ? url : null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (skip || !url) return;

    const controller = new AbortController();

    fetch(`/api/sign-url?url=${encodeURIComponent(url)}`, {
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
          setSigned(url); // fall back to raw URL
        }
      });

    return () => controller.abort(); // abort on unmount / url change
  }, [url, skip]);

  return { signedUrl: skip ? url : signedUrl, error };
}
