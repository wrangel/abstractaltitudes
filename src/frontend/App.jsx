// src/frontend/App.jsx

import React, { Suspense, lazy } from "react";
import { HelmetProvider } from "react-helmet-async";

import ErrorBoundary from "./components/ErrorBoundary";
import LoadingOverlay from "./components/LoadingOverlay";
import { WebGLManagerProvider } from "./utils/WebGLManager";

const Home = lazy(() => import("./pages/Home"));
const Grid = lazy(() => import("./pages/Grid"));

function App() {
  return (
    <HelmetProvider>
      <WebGLManagerProvider>
        <div className="App">
          <h1 className="visually-hidden">Peaceful Skies</h1>

          <ErrorBoundary>
            <Suspense fallback={<LoadingOverlay />}>
              <Home />
              <div id="main-content">
                <Grid />
              </div>
            </Suspense>
          </ErrorBoundary>
        </div>
      </WebGLManagerProvider>
    </HelmetProvider>
  );
}

export default React.memo(App);
