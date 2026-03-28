// src/frontend/App.jsx

import React, { Suspense, lazy, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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
  const location = useLocation();
  const [showMap, setShowMap] = useState(false);

  // We only show the Map if the user explicitly navigates to /map
  // or clicks your new Map toggle.
  const isMapRoute = location.pathname === "/map";

  return (
    <HelmetProvider>
      <div className="App">
        <h1 className="visually-hidden">
          Capturing Breathtaking Aerial Photography
        </h1>

        <ErrorBoundary>
          <Suspense fallback={<LoadingOverlay />}>
            {isMapRoute ? (
              <Map />
            ) : (
              <>
                {/* 1. HERO SECTION */}
                <Home />

                {/* 2. MASONRY SECTION (With an ID for the scroll jump) */}
                <div id="main-content">
                  <Grid />
                </div>
              </>
            )}
          </Suspense>
        </ErrorBoundary>

        {/* This stays to handle your logo/menu/map navigation */}
        <NavigationPages onNavigate={navigate} />
      </div>
    </HelmetProvider>
  );
}

export default React.memo(App);
