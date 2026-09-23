import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  TextField,
  Typography,
  Paper,
  Button,
  CircularProgress,
  Autocomplete
} from '@mui/material';
import { DELIVERY_ZONE_CENTER, DELIVERY_ZONE_RADIUS_METERS } from '../config/deliveryZone';

const AddressMapForm = ({ onSubmit, initialAddress = {} }) => {
  const [address, setAddress] = useState(initialAddress);
  const [mapCenter, setMapCenter] = useState(DELIVERY_ZONE_CENTER);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [isDeliverable, setIsDeliverable] = useState(false);
  const [loading, setLoading] = useState(false);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);
  const autocompleteRef = useRef(null);

  useEffect(() => {
    const google = window.google;
    if (!google || !mapRef.current) return;

    // Initialize map
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new google.maps.Map(mapRef.current, {
        zoom: 13,
        center: mapCenter,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
      });

      // Add delivery zone circle
      circleRef.current = new google.maps.Circle({
        strokeColor: '#1976d2',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#1976d2',
        fillOpacity: 0.1,
        map: mapInstanceRef.current,
        center: DELIVERY_ZONE_CENTER,
        radius: DELIVERY_ZONE_RADIUS_METERS,
      });

      // Initialize marker
      markerRef.current = new google.maps.Marker({
        map: mapInstanceRef.current,
        draggable: true,
        position: mapCenter,
      });

      // Handle marker drag
      markerRef.current.addListener('dragend', () => {
        const position = markerRef.current.getPosition();
        handleLocationSelect({
          lat: position.lat(),
          lng: position.lng()
        });
      });

      // Initialize Places Autocomplete
      const input = document.getElementById('address-autocomplete');
      autocompleteRef.current = new google.maps.places.Autocomplete(input, {
        componentRestrictions: { country: 'IN' },
        fields: ['address_components', 'geometry', 'formatted_address'],
      });

      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current.getPlace();
        if (!place.geometry) return;

        handleLocationSelect({
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng()
        }, place);
      });
    }
  }, [mapCenter]);

  const handleLocationSelect = async (coords, placeDetails = null) => {
    setLoading(true);
    try {
      // Update marker position
      markerRef.current.setPosition(coords);
      mapInstanceRef.current.panTo(coords);

      // Check if location is within delivery zone
      const isInZone = google.maps.geometry.spherical.computeDistanceBetween(
        new google.maps.LatLng(coords.lat, coords.lng),
        new google.maps.LatLng(DELIVERY_ZONE_CENTER.lat, DELIVERY_ZONE_CENTER.lng)
      ) <= DELIVERY_ZONE_RADIUS_METERS;

      setIsDeliverable(isInZone);
      setSelectedLocation(coords);

      // If we don't have place details, get address using Geocoding API
      if (!placeDetails) {
        const geocoder = new google.maps.Geocoder();
        const result = await geocoder.geocode({ location: coords });
        if (result.results[0]) {
          placeDetails = result.results[0];
        }
      }

      // Extract address components
      if (placeDetails) {
        const addressComponents = {};
        placeDetails.address_components.forEach(component => {
          const type = component.types[0];
          if (type === 'street_number') addressComponents.streetNumber = component.long_name;
          if (type === 'route') addressComponents.street = component.long_name;
          if (type === 'sublocality_level_1') addressComponents.area = component.long_name;
          if (type === 'locality') addressComponents.city = component.long_name;
          if (type === 'postal_code') addressComponents.pincode = component.long_name;
          if (type === 'administrative_area_level_1') addressComponents.state = component.long_name;
        });

        setAddress(prev => ({
          ...prev,
          street: [addressComponents.streetNumber, addressComponents.street].filter(Boolean).join(' '),
          area: addressComponents.area || '',
          city: addressComponents.city || '',
          state: addressComponents.state || '',
          pincode: addressComponents.pincode || '',
          latitude: coords.lat,
          longitude: coords.lng,
        }));
      }
    } catch (error) {
      console.error('Error handling location selection:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedLocation && isDeliverable) {
      onSubmit({
        ...address,
        latitude: selectedLocation.lat,
        longitude: selectedLocation.lng,
      });
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
      <TextField
        id="address-autocomplete"
        label="Search location"
        fullWidth
        sx={{ mb: 2 }}
        placeholder="Enter your area or landmark"
      />

      <Paper 
        ref={mapRef} 
        elevation={3}
        sx={{ 
          width: '100%', 
          height: 300, 
          mb: 2,
          borderRadius: 2,
          overflow: 'hidden'
        }}
      />

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <CircularProgress size={24} />
        </Box>
      )}

      {selectedLocation && (
        <Typography
          color={isDeliverable ? 'success.main' : 'error.main'}
          sx={{ mb: 2, fontWeight: 500 }}
        >
          {isDeliverable 
            ? 'Delivery available at this location'
            : 'Sorry, we don\'t deliver to this location yet'}
        </Typography>
      )}

      <TextField
        label="Street Address"
        fullWidth
        value={address.street || ''}
        onChange={(e) => setAddress(prev => ({ ...prev, street: e.target.value }))}
        sx={{ mb: 2 }}
        required
      />

      <TextField
        label="Area/Locality"
        fullWidth
        value={address.area || ''}
        onChange={(e) => setAddress(prev => ({ ...prev, area: e.target.value }))}
        sx={{ mb: 2 }}
        required
      />

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField
          label="City"
          fullWidth
          value={address.city || ''}
          onChange={(e) => setAddress(prev => ({ ...prev, city: e.target.value }))}
          required
        />
        <TextField
          label="Pincode"
          fullWidth
          value={address.pincode || ''}
          onChange={(e) => setAddress(prev => ({ ...prev, pincode: e.target.value }))}
          required
        />
      </Box>

      <TextField
        label="State"
        fullWidth
        value={address.state || ''}
        onChange={(e) => setAddress(prev => ({ ...prev, state: e.target.value }))}
        sx={{ mb: 2 }}
        required
      />

      <Button
        type="submit"
        variant="contained"
        fullWidth
        disabled={!isDeliverable || loading}
        sx={{ mt: 2 }}
      >
        Save Address
      </Button>
    </Box>
  );
};

export default AddressMapForm;