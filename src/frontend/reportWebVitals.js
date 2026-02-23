const reportWebVitals = (onPerfEntry) => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    import("web-vitals")
      .then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
        // Safety check: if any metric is missing, skip
        if (typeof getCLS !== "function") {
          console.warn("web-vitals metrics not loaded correctly");
          return;
        }
        getCLS(onPerfEntry);
        getFID(onPerfEntry);
        getFCP(onPerfEntry);
        getLCP(onPerfEntry);
        getTTFB(onPerfEntry);
      })
      .catch((err) => {
        console.error("Failed to load web-vitals:", err);
      });
  }
};

export default reportWebVitals;
