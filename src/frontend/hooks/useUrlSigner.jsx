// src/frontend/hooks/useUrlSigner.jsx

import { useState, useEffect } from "react";
import { buildQueryStringSign } from "../utils/buildQueryStringSign.jsx";

export function useSignedUrl(pathWithParams) {
  const [signedUrl, setSignedUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!pathWithParams) {
      setSignedUrl(null);
      return;
    }

    let isCanceled = false;

    buildQueryStringSign(pathWithParams)
      .then((url) => {
        if (!isCanceled) setSignedUrl(url);
      })
      .catch((err) => {
        if (!isCanceled) setError(err);
      });

    return () => {
      isCanceled = true;
    };
  }, [pathWithParams]);

  return { signedUrl, error };
}
