// src/index.jsx

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./frontend/App";
import reportWebVitals from "./frontend/reportWebVitals";
import "./frontend/styles/Global.css";

// Import Inter variable font here
import "@fontsource-variable/inter";

// Owner opt-out: visiting https://abstractaltitudes.com/#aa-owner sets a
// persistent localStorage flag that suppresses click tracking.
// Bookmark that URL once per browser — no DevTools needed.
// Clear with: localStorage.removeItem('aa_owner')
if (window.location.hash === "#aa-owner") {
  localStorage.setItem("aa_owner", "1");
  history.replaceState(null, "", window.location.pathname);
}

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Dev-only: this was logging Core Web Vitals to every visitor's console in
// production. Swap console.log for a beacon to a real endpoint if you ever
// want field data (Search Console reports CWV independently either way).
if (import.meta.env.DEV) {
  reportWebVitals(console.log);
}
