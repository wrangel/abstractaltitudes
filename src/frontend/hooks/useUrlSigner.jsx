// src/frontend/hooks/useUrlSigner.jsx

import { useState, useEffect } from "react";
import { buildQueryStringSign } from "../utils/buildQueryStringSign.jsx";

export function useSignedUrl(url, skip = false) {
  const [signedUrl, setSigned] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (skip || !url) return; // ← do nothing when skipped

    let aborted = false;
    setError(null);

    fetch(`/api/sign-url?url=${encodeURIComponent(url)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => !aborted && setSigned(data.signedUrl))
      .catch((e) => !aborted && setError(e));

    return () => (aborted = true);
  }, [url, skip]);

  return { signedUrl: skip ? url : signedUrl, error };
}
