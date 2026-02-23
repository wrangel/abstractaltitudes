const reportWebVitals = (onPerfEntry) => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    import("web-vitals")
      .then((webVitals) => {
        // v3+: default export is the object with all metrics
        if (webVitals && typeof webVitals.getCLS === "function") {
          webVitals.getCLS(onPerfEntry);
          webVitals.getFID(onPerfEntry);
          webVitals.getFCP(onPerfEntry);
          webVitals.getLCP(onPerfEntry);
          webVitals.getTTFB(onPerfEntry);
        } else {
          console.warn("web-vitals v3+ structure not found:", webVitals);
        }
      })
      .catch((err) => {
        console.error("Failed to load web-vitals:", err);
      });
  }
};

export default reportWebVitals;
