import React, { useEffect, useRef } from 'react';
import { DELIVERY_ZONE_CENTER, DELIVERY_ZONE_RADIUS_METERS } from '../config/deliveryZone';

const DeliveryZoneMap = ({ userCoords }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const circleRef = useRef(null);
  const userMarkerRef = useRef(null);

  useEffect(() => {
    const google = window.google;
    if (!google || !mapRef.current) {
      const t = setTimeout(() => {
        // Retry if Google Maps hasn't loaded yet
      }, 100);
      return () => clearTimeout(t);
    }

    if (!mapInstanceRef.current) {
      // Create the map instance with improved options
      mapInstanceRef.current = new google.maps.Map(mapRef.current, {
        zoom: 14,
        center: { lat: DELIVERY_ZONE_CENTER.lat, lng: DELIVERY_ZONE_CENTER.lng },
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ],
        gestureHandling: 'greedy', // Better touch handling
      });

      // Draw delivery zone circle with improved styling
      circleRef.current = new google.maps.Circle({
        strokeColor: '#1976d2',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#1976d2',
        fillOpacity: 0.1,
        map: mapInstanceRef.current,
        center: { lat: DELIVERY_ZONE_CENTER.lat, lng: DELIVERY_ZONE_CENTER.lng },
        radius: DELIVERY_ZONE_RADIUS_METERS,
        clickable: false, // Don't capture clicks
      });

      // Add center marker with info window
      const centerInfoWindow = new google.maps.InfoWindow({
        content: 'Delivery Center',
      });

      const centerMarker = new google.maps.Marker({
        position: { lat: DELIVERY_ZONE_CENTER.lat, lng: DELIVERY_ZONE_CENTER.lng },
        map: mapInstanceRef.current,
        title: 'Delivery Center',
      });

      centerMarker.addListener('click', () => {
        centerInfoWindow.open(mapInstanceRef.current, centerMarker);
      });

      // Fit map to circle bounds
      const bounds = circleRef.current.getBounds();
      if (bounds) {
        mapInstanceRef.current.fitBounds(bounds);
      }
    }

    // Update or add user marker
    if (userCoords && userCoords.lat && userCoords.lng) {
      const position = { lat: userCoords.lat, lng: userCoords.lng };
      if (!userMarkerRef.current) {
        const userInfoWindow = new google.maps.InfoWindow({
          content: 'Your Location',
        });

        userMarkerRef.current = new google.maps.Marker({
          position,
          map: mapInstanceRef.current,
          title: 'Your Location',
        });

        userMarkerRef.current.addListener('click', () => {
          userInfoWindow.open(mapInstanceRef.current, userMarkerRef.current);
        });
      } else {
        userMarkerRef.current.setPosition(position);
      }
    }
  }, [userCoords]);

  return (
    <div
      ref={mapRef}
      style={{ width: '100%', height: 280, borderRadius: 8, overflow: 'hidden', border: '1px solid #e0e0e0' }}
    />
  );
};

export default DeliveryZoneMap;
