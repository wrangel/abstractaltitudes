// src/frontend/App.jsx

import React, { Suspense, lazy } from "react";
import { HelmetProvider } from "react-helmet-async";
import { preload } from "swr";

import ErrorBoundary from "./components/ErrorBoundary";
import LoadingOverlay from "./components/LoadingOverlay";
import { COMBINED_DATA_URL } from "./constants";

const fetcher = (url) => fetch(url).then((res) => res.json());
preload(COMBINED_DATA_URL, fetcher);

const Home = lazy(() => import("./pages/Home"));
const Grid = lazy(() => import("./pages/Grid"));

function App() {
  return (
    <HelmetProvider>
      <div className="App">
        <h1 className="visually-hidden">
          Capturing Breathtaking Aerial Photography
        </h1>

        <ErrorBoundary>
          <Suspense fallback={<LoadingOverlay />}>
            <Home />
            <div id="main-content">
              <Grid />
            </div>
          </Suspense>
        </ErrorBoundary>
      </div>
    </HelmetProvider>
  );
}

export default React.memo(App);
