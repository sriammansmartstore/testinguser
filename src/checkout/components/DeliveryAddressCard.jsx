import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  MenuItem, 
  Select, 
  FormControl, 
  InputLabel, 
  Card, 
  CardContent, 
  Alert, 
  CircularProgress,
  Grid,
  Snackbar,
  IconButton
} from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import AddIcon from '@mui/icons-material/Add';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../../components/NotificationProvider';
import DeliveryOptionsCard from './DeliveryOptionsCard';
import { doc, collection, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { useLanguage } from '../../context/LanguageContext';

const DeliveryAddressCard = ({ addresses, selectedAddressId, onAddressChange, onSelectAddress, onAddNewAddress, loading, onAddressAdded, orderTotal }) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { notify } = useNotification() || { notify: () => {} };
  const [locationLoading, setLocationLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAddNewAddress = () => {
    if (typeof onAddNewAddress === 'function') {
      onAddNewAddress();
    } else {
      navigate('/addresses', { state: { fromCart: true } });
      notify('Add a new delivery address to continue', 'info');
    }
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setLocationLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          
          let detectedPincode = "";
          let detectedStreet = "Near your current location";
          let detectedCity = "";
          let detectedDistrict = "";
          let detectedState = "";

          // 1. Google Maps Geocoder if available
          if (window.google?.maps?.Geocoder) {
            try {
              const geocoder = new window.google.maps.Geocoder();
              const res = await new Promise((resolve) => {
                geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results, status) => {
                  resolve(status === 'OK' && results?.[0] ? results[0] : null);
                });
              });
              if (res?.address_components) {
                let subLoc2 = "";
                let subLoc1 = "";
                let route = "";
                for (const comp of res.address_components) {
                  const types = comp.types || [];
                  if (types.includes('postal_code')) detectedPincode = comp.long_name;
                  if (types.includes('route')) route = comp.long_name;
                  if (types.includes('sublocality_level_2')) subLoc2 = comp.long_name;
                  if (types.includes('sublocality_level_1') || types.includes('sublocality') || types.includes('neighborhood')) {
                    subLoc1 = comp.long_name;
                  }
                  if (types.includes('locality')) detectedCity = comp.long_name;
                  if (types.includes('administrative_area_level_2')) detectedDistrict = comp.long_name;
                  if (types.includes('administrative_area_level_1')) detectedState = comp.long_name;
                }
                detectedStreet = [subLoc2, route].filter(Boolean).join(', ') || route || subLoc1 || detectedStreet;
              }
            } catch (_) {}
          }

          // 2. High-zoom Nominatim fallback
          if (!detectedPincode || !detectedCity) {
            try {
              const nomRes = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&addressdetails=1&zoom=18`,
                { headers: { 'Accept-Language': 'en' } }
              );
              if (nomRes.ok) {
                const data = await nomRes.json();
                const addr = data.address || {};
                if (addr.postcode) detectedPincode = addr.postcode.replace(/\D/g, '').slice(0, 6);
                if (addr.road || addr.suburb) {
                  detectedStreet = [addr.road, addr.suburb || addr.neighbourhood].filter(Boolean).join(', ');
                }
                if (!detectedCity) detectedCity = addr.city || addr.town || addr.village || "";
                if (!detectedDistrict) detectedDistrict = addr.county || addr.district || detectedCity;
                if (!detectedState) detectedState = addr.state || "";
              }
            } catch (_) {}
          }

          // Create address object with detected coordinates and resolved address
          const newAddress = {
            fullName: auth.currentUser?.displayName || 'My Location',
            street: detectedStreet,
            city: detectedCity,
            district: detectedDistrict,
            state: detectedState,
            pincode: detectedPincode,
            contact: auth.currentUser?.phoneNumber || '',
            latitude,
            longitude,
            isCurrentLocation: true,
            createdAt: serverTimestamp(),
            lastUsed: serverTimestamp(),
          };

          // Save to Firebase
          const user = auth.currentUser;
          if (!user) throw new Error('User not authenticated');
          
          let userDocId = user.uid;
          try {
            const mapSnap = await getDoc(doc(db, 'usersByUid', user.uid));
            userDocId = mapSnap.exists() ? (mapSnap.data()?.userDocId || user.uid) : user.uid;
          } catch (_) {}
          const addressRef = doc(collection(db, `users/${userDocId}/addresses`));
          await setDoc(addressRef, newAddress);
          
          notify('Location saved as new address!', 'success');
          if (onAddressAdded) onAddressAdded();
          
        } catch (err) {
          console.error('Error getting location:', err);
          setError(err.message || 'Failed to get your location');
        } finally {
          setLocationLoading(false);
        }
      },
      (err) => {
        console.error('Geolocation error:', err);
        setError('Unable to retrieve your location. Please check your browser permissions.');
        setLocationLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };
  
  const handleCloseError = () => {
    setError(null);
  };

  return (
    <>
  <DeliveryOptionsCard orderTotal={orderTotal} />
    <Card sx={{ borderRadius: { xs: 0, sm: 2 }, boxShadow: { xs: 'none', sm: 2 }, mt: 1 }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center">
            <LocationOnIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{t('deliveryAddresses', 'Delivery Addresses')}</Typography>
          </Box>
          <IconButton aria-label="add address" size="small" onClick={handleAddNewAddress} sx={{ bgcolor: 'action.hover' }}>
            <AddIcon fontSize="small" />
          </IconButton>
        </Box>
        
        {loading ? (
          <Box display="flex" justifyContent="center" py={2}><CircularProgress size={24} /></Box>
        ) : addresses.length === 0 ? (
          <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
            {t('noAddressesSaved', 'No addresses found. Tap the plus button above to add one.')}
          </Alert>
        ) : (
          <Box>
            <FormControl fullWidth sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
              <InputLabel id="address-select-label">{t('selectDeliveryAddress', 'Select Delivery Address')}</InputLabel>
              <Select
                labelId="address-select-label"
                value={selectedAddressId}
                label={t('selectDeliveryAddress', 'Select Delivery Address')}
                onChange={(e) => {
                  if (typeof onSelectAddress === 'function') {
                    onSelectAddress(e.target.value);
                  } else if (typeof onAddressChange === 'function') {
                    onAddressChange(e);
                  }
                }}
              >
                {addresses.map((addr) => (
                  <MenuItem key={addr.id} value={addr.id}>
                    <Box>
                      {/* Primary: Full Name */}
                      <Typography variant="body1" sx={{ fontWeight: 700 }}>
                        {addr.fullName || "Unnamed Recipient"}
                      </Typography>
                      {/* Secondary: Father/Spouse Name, if present */}
                      {addr.fatherOrSpouse && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          {addr.fatherOrSpouse}
                        </Typography>
                      )}
                      {/* Address lines */}
                      <Typography variant="body2" color="text.secondary">
                        {(addr.door || "") + (addr.street ? `, ${addr.street}` : "")}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {(addr.town || addr.city || "") + (addr.district ? `, ${addr.district}` : "")}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {(addr.state || "") + (addr.pincode ? ` - ${addr.pincode}` : "")}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {/* Removed bottom action buttons; use the plus icon in the header to add new address */}
          </Box>
        )}
      </CardContent>
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={handleCloseError}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseError} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </Card>
    </>
  );
};

export default DeliveryAddressCard;
