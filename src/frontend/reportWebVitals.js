const reportWebVitals = (onPerfEntry) => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    import("web-vitals")
      .then((webVitals) => {
        // v3+: use onCLS, onFCP, etc. directly
        if (typeof webVitals.onCLS === "function") {
          webVitals.onCLS(onPerfEntry);
          webVitals.onFCP(onPerfEntry);
          webVitals.onLCP(onPerfEntry);
          webVitals.onTTFB(onPerfEntry);
          // onFID deprecated, replaced by onINP in v3
          if (webVitals.onINP) webVitals.onINP(onPerfEntry);
        } else {
          console.warn(
            "Unexpected web-vitals structure:",
            Object.keys(webVitals),
          );
        }
      })
      .catch((err) => {
        console.error("Failed to load web-vitals:", err);
      });
  }
};

export default reportWebVitals;
