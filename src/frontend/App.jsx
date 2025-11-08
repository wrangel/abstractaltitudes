// src/frontend/App.jsx

import React, { Suspense, lazy } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { preload } from "swr";

import ErrorBoundary from "./components/ErrorBoundary";
import NavigationPages from "./components/NavigationPages";
import LoadingOverlay from "./components/LoadingOverlay";
import { COMBINED_DATA_URL } from "./constants";

const fetcher = (url) => fetch(url).then((res) => res.json());

preload(COMBINED_DATA_URL, fetcher);

const Home = lazy(() => import("./pages/Home"));
const Grid = lazy(() => import("./pages/Grid"));
const Map = lazy(() => import("./pages/Map"));

function App() {
  const navigate = useNavigate();

  return (
    <HelmetProvider>
      <div className="App">
        {/* Visually hidden heading for accessibility and SEO */}
        <h1 className="visually-hidden">
          Capturing Breathtaking Aerial Photography
        </h1>

        <ErrorBoundary>
          <Suspense fallback={<LoadingOverlay />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/grid" element={<Grid />} />
              <Route path="/map" element={<Map />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>

        <NavigationPages onNavigate={navigate} />
      </div>
    </HelmetProvider>
  );
}

export default React.memo(App);
