// src/frontend/App.jsx

import React, { Suspense, lazy } from "react";

import ErrorBoundary from "./components/ErrorBoundary";
import LoadingOverlay from "./components/LoadingOverlay";
import { WebGLManagerProvider } from "./utils/WebGLManager";

const Home = lazy(() => import("./pages/Home"));
const Grid = lazy(() => import("./pages/Grid"));

function App() {
  return (
    <WebGLManagerProvider>
      <div className="App">
        {/* The page's single <h1> lives in Home ("Abstract Altitudes").
            A second, visually-hidden one here split the heading outline. */}
        <ErrorBoundary>
          <Suspense fallback={<LoadingOverlay />}>
            <Home />
            <main id="main-content">
              <Grid />
            </main>
          </Suspense>
        </ErrorBoundary>
      </div>
    </WebGLManagerProvider>
  );
}

export default React.memo(App);
