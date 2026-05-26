// src/index.jsx

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter as Router } from "react-router-dom";
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
    <Router>
      <App />
    </Router>
  </React.StrictMode>
);

reportWebVitals(console.log);
