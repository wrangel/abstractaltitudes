import React, { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { APIProvider, Map, Marker } from "@vis.gl/react-google-maps";

import LoadingErrorHandler from "../components/LoadingErrorHandler";
import PopupViewer from "../components/PopupViewer";
import { useItems } from "../hooks/useItems";
import { useItemViewer } from "../hooks/useItemViewer";
import { useLoadingError } from "../hooks/useLoadingError";
import MascotCorner from "../components/MascotCorner";
import ErrorBoundary from "../components/ErrorBoundary";
import { DOMAIN } from "../constants";
import styles from "../styles/Map.module.css";

const MapPage = () => {
  const { items, isLoading: isItemsLoading, error: itemsError } = useItems();
  const { isLoading, error, setErrorMessage, stopLoading } =
    useLoadingError(true);
  const {
    selectedItem,
    isModalOpen,
    handleItemClick,
    handleClosePopup,
    handleNextItem,
    handlePreviousItem,
  } = useItemViewer(items);

  const onItemClick = useCallback(handleItemClick, [handleItemClick]);
  const onClose = useCallback(handleClosePopup, [handleClosePopup]);
  const onNext = useCallback(handleNextItem, [handleNextItem]);
  const onPrevious = useCallback(handlePreviousItem, [handlePreviousItem]);

  // Calculate map view based on item coordinates
  const calculateBounds = (items) => {
    if (!items.length) return { center: { lat: 0, lng: 0 }, zoom: 2 };

    let minLat = items[0].latitude,
      maxLat = items[0].latitude,
      minLng = items[0].longitude,
      maxLng = items[0].longitude;

    items.forEach(({ latitude, longitude }) => {
      if (latitude < minLat) minLat = latitude;
      if (latitude > maxLat) maxLat = latitude;
      if (longitude < minLng) minLng = longitude;
      if (longitude > maxLng) maxLng = longitude;
    });

    const center = { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };
    const latDelta = maxLat - minLat;
    const lngDelta = maxLng - minLng;
    const maxDelta = Math.max(latDelta, lngDelta);

    let zoom;
    if (maxDelta > 60) zoom = 2;
    else if (maxDelta > 30) zoom = 4;
    else if (maxDelta > 15) zoom = 6;
    else if (maxDelta > 10) zoom = 8;
    else if (maxDelta > 5) zoom = 10;
    else if (maxDelta > 2) zoom = 12;
    else zoom = 14;

    return { center, zoom };
  };

  const [view, setView] = useState({ center: { lat: 0, lng: 0 }, zoom: 2 });

  useEffect(() => {
    if (items.length > 0) {
      setView(calculateBounds(items));
    }
  }, [items]);

  useEffect(() => {
    if (!isItemsLoading) stopLoading();
    if (itemsError) setErrorMessage(itemsError);
  }, [isItemsLoading, itemsError, stopLoading, setErrorMessage]);

  // Handle map camera changes (zoom, pan)
  const onCameraChanged = useCallback((event) => {
    const { center, zoom } = event.detail;
    setView({ center, zoom });
  }, []);

  // Use Vite env variable for Google Maps API key
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

  return (
    <>
      <MascotCorner />
      <Helmet>
        <link rel="canonical" href={`${DOMAIN}map`} />
        <title>Abstract Altitudes</title>
        <meta
          name="description"
          content="Explore our interactive map showcasing stunning drone-captured aerial images from various locations. Discover breathtaking views and unique perspectives from above."
        />
      </Helmet>
      <LoadingErrorHandler isLoading={isLoading} error={error}>
        <ErrorBoundary>
          <div
            className={styles.MapContainer}
            style={{ height: "100vh", width: "100vw" }}
          >
            <APIProvider apiKey={apiKey}>
              <Map
                center={view.center}
                zoom={view.zoom}
                onCameraChanged={onCameraChanged}
                // You can provide a mapId if using styled maps, otherwise omit
                // mapId={import.meta.env.VITE_GOOGLE_MAP_ID}
                disableDefaultUI={true}
                gestureHandling="greedy"
                mapTypeId="satellite"
                style={{ height: "100%", width: "100%" }}
              >
                {items.map((item) => (
                  <Marker
                    key={item.id}
                    position={{ lat: item.latitude, lng: item.longitude }}
                    onClick={() => onItemClick(item)}
                    title={item.name || "Map marker"}
                    color="#4DA6FF"
                  />
                ))}
              </Map>
            </APIProvider>

            {isModalOpen && (
              <PopupViewer
                item={selectedItem}
                isOpen={isModalOpen}
                onClose={onClose}
                onNext={onNext}
                onPrevious={onPrevious}
              />
            )}
          </div>
        </ErrorBoundary>
      </LoadingErrorHandler>
    </>
  );
};

export default React.memo(MapPage);
