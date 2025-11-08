// src/index.jsx

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter as Router } from "react-router-dom";
import App from "./frontend/App";
import reportWebVitals from "./frontend/reportWebVitals";
import "./frontend/styles/Global.css";

// Import Inter variable font here
import "@fontsource-variable/inter";

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <Router>
      <App />
    </Router>
  </React.StrictMode>
);

reportWebVitals(console.log);
