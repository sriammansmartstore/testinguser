import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Box,
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Radio,
  FormControlLabel,
  Grid,
  CircularProgress,
  useMediaQuery,
  useTheme,
  Alert,
  DialogContentText,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
} from "@mui/material";
import { 
  ArrowBack as ArrowBackIcon, 
  Close as CloseIcon, 
  Delete as DeleteIcon,
  LocationOn as LocationOnIcon
} from "@mui/icons-material";
import { onAuthStateChanged, RecaptchaVerifier, signInWithPhoneNumber, PhoneAuthProvider, linkWithCredential } from "firebase/auth";
import { doc, getDoc, setDoc, collection, getDocs, deleteField, deleteDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { DELIVERY_ZONE_CENTER, DELIVERY_ZONE_RADIUS_METERS } from "../config/deliveryZone";
import { useLanguage } from "../context/LanguageContext";

// Helper function for exponential backoff during API calls...
const withExponentialBackoff = async (
  apiCall,
  retries = 3,
  delay = 1000
) => {
  try {
    return await apiCall();
  } catch (error) {
    if (retries > 0) {
      await new Promise((res) => setTimeout(res, delay));
      return withExponentialBackoff(apiCall, retries - 1, delay * 2);
    }
    throw error;
  }
};

// Using initialized Firebase from src/firebase.js

const AddressesPage = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [redirectToCart, setRedirectToCart] = useState(false);
  const [editAddressId, setEditAddressId] = useState(null);
  const [form, setForm] = useState({
    fullName: "",
    fatherOrSpouse: "",
    door: "",
    street: "",
    pincode: "",
    town: "",
    city: "",
    district: "",
    state: "",
    contact: "",
    altContact: "",
    landmark: "",
    latitude: "",
    longitude: "",
  });
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [pincodeError, setPincodeError] = useState("");
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [mapOpen, setMapOpen] = useState(false);
  const [mapInitError, setMapInitError] = useState("");
  const [pickedLatLng, setPickedLatLng] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addressToDelete, setAddressToDelete] = useState(null);
  const [formError, setFormError] = useState(null);
  const [primaryId, setPrimaryId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [mappedUserId, setMappedUserId] = useState(null);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  // Phone verification states (for contact field)
  const [countryCode, setCountryCode] = useState("+91");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [inlineMsg, setInlineMsg] = useState(null);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState(null);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [verificationId, setVerificationId] = useState(null);
  const [verifiedPhoneNumber, setVerifiedPhoneNumber] = useState(null);

  // Set up auth listener using initialized auth instance
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user ? user.uid : null);
    });
    return () => unsubscribe();
  }, []);

  // Resolve custom SASS user doc id from usersByUid mapping
  useEffect(() => {
    (async () => {
      try {
        if (!userId) { setMappedUserId(null); return; }
        const mapSnap = await getDoc(doc(db, 'usersByUid', userId));
        setMappedUserId(mapSnap.exists() ? (mapSnap.data()?.userDocId || userId) : userId);
      } catch (_) {
        setMappedUserId(userId);
      }
    })();
  }, [userId]);

  // Function to fetch addresses
  const fetchAddresses = async () => {
    if (!mappedUserId) return;
    setLoading(true);
    try {
      const addressesCol = collection(db, `users/${mappedUserId}/addresses`);
      const addressSnapshot = await getDocs(addressesCol);
      const addressesList = [];
      
      addressSnapshot.forEach((doc) => {
        addressesList.push({ id: doc.id, ...doc.data() });
      });
      setAddresses(addressesList);

      // Get primary address ID and user verification state
      const userDoc = await getDoc(doc(db, "users", mappedUserId));
      if (userDoc.exists()) {
        const u = userDoc.data() || {};
        setPrimaryId(u.primaryAddressId || null);
        // Normalize stored number to E.164 for comparisons
        const cc = u.countryCode || "+91";
        const profileNum = u.number || null;
        if (profileNum) {
          const full = String(profileNum).startsWith('+') ? profileNum : (cc + String(profileNum));
          setVerifiedPhoneNumber(full);
        }
        if (u.phoneVerified === true) {
          try { setPhoneVerified(true); } catch (_) {}
        }
      }
    } catch (e) {
      console.error("Error fetching addresses:", e);
    } finally {
      setLoading(false);
    }
  };

  // Helper: normalize contact to E.164 with assumed countryCode if missing
  const asFullPhone = (numRaw) => {
    if (!numRaw) return "";
    const cleaned = String(numRaw).trim();
    if (cleaned.startsWith('+')) return cleaned;
    return countryCode + cleaned;
  };

  // Helper: normalize digits-only and return the last 10 digits for reliable comparison
  const significantDigits = (num) => {
    if (!num) return null;
    const digits = String(num).replace(/\D/g, '');
    if (!digits) return null;
    // Use last 10 digits (works for Indian mobile numbers with or without country code/leading 0)
    return digits.length > 10 ? digits.slice(-10) : digits;
  };

  const sameNumber = (a, b) => {
    if (!a || !b) return false;
    const sa = significantDigits(a);
    const sb = significantDigits(b);
    if (!sa || !sb) return false;
    return sa === sb;
  };

  // When dialog opens or contact changes, decide if it's already verified
  useEffect(() => {
    if (!openDialog) return;
    try {
      const full = asFullPhone(form.contact);
      const authPhone = auth && auth.currentUser ? (auth.currentUser.phoneNumber || null) : null;
      // If entered matches any known verified phone, mark verified
      if (full && (sameNumber(full, authPhone) || sameNumber(full, verifiedPhoneNumber))) {
        setPhoneVerified(true);
        setInlineMsg(null);
        setOtp("");
        setOtpSent(false);
      } else {
        setPhoneVerified(false);
      }
    } catch (_) {}
  }, [openDialog, form.contact, verifiedPhoneNumber]);

  const clearRecaptcha = () => {
    if (recaptchaVerifier) {
      try { recaptchaVerifier.clear(); } catch (e) {}
      setRecaptchaVerifier(null);
    }
  };

  // Send OTP for the entered contact if not already verified
  const sendOtp = async () => {
    try {
      const phone = (form.contact || '').replace(/\D/g, '');
      if (!phone || phone.length < 6) {
        setInlineMsg({ type: 'error', text: 'Enter a valid mobile number.' });
        return;
      }
      const fullPhone = asFullPhone(phone);
      // If same as auth linked number, mark verified
      const currentPhone = auth && auth.currentUser ? (auth.currentUser.phoneNumber || null) : null;
      const storedVerified = verifiedPhoneNumber || null;
      if ((currentPhone && sameNumber(currentPhone, fullPhone)) || (storedVerified && sameNumber(storedVerified, fullPhone))) {
        setPhoneVerified(true);
        setInlineMsg({ type: 'success', text: 'Number already verified.' });
        return;
      }
      let verifier = recaptchaVerifier;
      if (!verifier) {
        verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
          callback: () => {},
          'expired-callback': () => {
            setInlineMsg({ type: 'warning', text: 'Security check expired. Try again.' });
          }
        });
        try { await verifier.render(); } catch (_) {}
        setRecaptchaVerifier(verifier);
      }
      setInlineMsg({ type: 'info', text: 'Sending OTP...' });
      const confirmation = await signInWithPhoneNumber(auth, fullPhone, verifier);
      setConfirmationResult(confirmation);
      setVerificationId(confirmation?.verificationId || null);
      setOtpSent(true);
      setInlineMsg({ type: 'info', text: 'OTP sent. Enter the code to verify.' });
    } catch (err) {
      console.error('[Addresses] sendOtp failed', err);
      setInlineMsg({ type: 'error', text: 'Failed to send OTP. Please try again.' });
      clearRecaptcha();
    }
  };

  const verifyOtp = async () => {
    if (!confirmationResult && !verificationId) {
      setInlineMsg({ type: 'error', text: t('noOtpRequest', 'No OTP request found.') });
      return;
    }
    setVerifying(true);
    try {
      const vid = verificationId || confirmationResult?.verificationId;
      if (!vid) throw new Error('Missing verification id');
      const credential = PhoneAuthProvider.credential(vid, otp);
      if (auth && auth.currentUser) {
        try {
          await linkWithCredential(auth.currentUser, credential);
        } catch (linkErr) {
          console.debug('[Addresses] linkWithCredential caught:', linkErr);
          // If the phone number is already linked or credential already in use by another account,
          // the OTP itself was confirmed valid by Firebase servers before this rejection!
          if (
            linkErr?.code === 'auth/credential-already-in-use' ||
            linkErr?.code === 'auth/provider-already-linked' ||
            linkErr?.message?.includes('credential-already-in-use') ||
            linkErr?.message?.includes('provider-already-linked')
          ) {
            console.log('[Addresses] OTP confirmed valid; phone already registered in Firebase auth');
          } else {
            throw linkErr;
          }
        }
        setPhoneVerified(true);
        setVerifiedPhoneNumber(countryCode + (form.contact || '').replace(/\D/g, ''));
        setInlineMsg({ type: 'success', text: t('phoneVerified', 'Phone number verified!') });
        try {
          // Persist verification to the canonical user document. Prefer mappedUserId when available.
          const targetUserId = mappedUserId || userId;
          if (targetUserId) {
            const userDocRef = doc(db, 'users', targetUserId);
            await setDoc(userDocRef, {
              number: (form.contact || '').replace(/\D/g, ''),
              countryCode: countryCode || '+91',
              phoneVerified: true
            }, { merge: true });
          }
        } catch (_) {}
        if (recaptchaVerifier) {
          try { recaptchaVerifier.clear(); } catch (e) { console.debug('Error clearing recaptcha after verify:', e); }
          setRecaptchaVerifier(null);
        }
      } else {
        const res = await confirmationResult.confirm(otp);
        setPhoneVerified(true);
        setVerifiedPhoneNumber(countryCode + (form.contact || '').replace(/\D/g, ''));
        setInlineMsg({ type: 'success', text: t('phoneVerified', 'Phone number verified!') });
        try {
          const targetUserId = mappedUserId || userId;
          if (targetUserId) {
            const userDocRef = doc(db, 'users', targetUserId);
            await setDoc(userDocRef, {
              number: (form.contact || '').replace(/\D/g, ''),
              countryCode: countryCode || '+91',
              phoneVerified: true
            }, { merge: true });
          }
        } catch (_) {}
        if (recaptchaVerifier) {
          try { recaptchaVerifier.clear(); } catch (e) { console.debug('Error clearing recaptcha after verify:', e); }
          setRecaptchaVerifier(null);
        }
      }
    } catch (err) {
      console.debug('[Addresses] verifyOtp error', err);
      if (
        err &&
        (err.code === 'auth/provider-already-linked' ||
          err.code === 'auth/credential-already-in-use' ||
          err?.message?.includes('provider-already-linked') ||
          err?.message?.includes('credential-already-in-use'))
      ) {
        setPhoneVerified(true);
        setVerifiedPhoneNumber(countryCode + (form.contact || '').replace(/\D/g, ''));
        setInlineMsg({ type: 'success', text: t('phoneVerified', 'Phone number verified!') });
      } else if (err && err.code === 'auth/invalid-verification-code') {
        setInlineMsg({ type: 'error', text: t('invalidOtp', 'Invalid OTP. Please check the code and try again.') });
      } else if (err && err.code === 'auth/code-expired') {
        setInlineMsg({ type: 'error', text: t('otpExpired', 'OTP has expired. Please click Resend OTP.') });
      } else {
        setInlineMsg({ type: 'error', text: err?.message || t('verificationFailed', 'Verification failed. Check the OTP and try again.') });
      }
    } finally {
      setVerifying(false);
    }
  };

  // Geolocation helpers with automatic address reverse-geocoding
  const handleUseCurrentLocation = () => {
    setGeoError("");
    if (!('geolocation' in navigator)) {
      setGeoError(t('geoNotSupported', 'Geolocation is not supported by your browser'));
      return;
    }
    setGeoLoading(true);
    try {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords || {};
          if (typeof latitude === 'number' && typeof longitude === 'number') {
            const latStr = String(latitude);
            const lngStr = String(longitude);

            // Persist current location coordinate
            try {
              if (mappedUserId) {
                const locDocRef = doc(collection(db, `users/${mappedUserId}/locations`));
                setDoc(locDocRef, { latitude, longitude, pickedAt: serverTimestamp(), source: 'current_location' });
              }
            } catch (_) {}

            let detectedPincode = "";
            let detectedStreet = "";
            let detectedTown = "";
            let detectedCity = "";
            let detectedDistrict = "";
            let detectedState = "";

            // 1. Try Google Maps Geocoder if loaded
            if (window.google && window.google.maps && window.google.maps.Geocoder) {
              try {
                const geocoder = new window.google.maps.Geocoder();
                const res = await new Promise((resolve) => {
                  geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results, status) => {
                    if (status === 'OK' && results && results[0]) {
                      resolve(results[0]);
                    } else {
                      resolve(null);
                    }
                  });
                });
                if (res && res.address_components) {
                  for (const comp of res.address_components) {
                    const types = comp.types || [];
                    if (types.includes('postal_code')) detectedPincode = comp.long_name;
                    if (types.includes('route') || types.includes('sublocality_level_1') || types.includes('sublocality') || types.includes('neighborhood')) {
                      if (!detectedStreet) detectedStreet = comp.long_name;
                    }
                    if (types.includes('locality')) detectedCity = comp.long_name;
                    if (types.includes('sublocality_level_2') || types.includes('sublocality_level_1')) {
                      if (!detectedTown) detectedTown = comp.long_name;
                    }
                    if (types.includes('administrative_area_level_2')) detectedDistrict = comp.long_name;
                    if (types.includes('administrative_area_level_1')) detectedState = comp.long_name;
                  }
                }
              } catch (e) {
                console.warn('[Addresses] Google geocoder error:', e);
              }
            }

            // 2. Fallback / Complement with OpenStreetMap Nominatim reverse geocode
            if (!detectedPincode || !detectedCity || !detectedStreet) {
              try {
                const nomRes = await fetch(
                  `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`
                );
                if (nomRes.ok) {
                  const data = await nomRes.json();
                  const addr = data.address || {};
                  if (!detectedPincode && addr.postcode) {
                    detectedPincode = addr.postcode.replace(/\D/g, '').slice(0, 6);
                  }
                  if (!detectedStreet) {
                    detectedStreet = [addr.road, addr.suburb || addr.neighbourhood || addr.residential].filter(Boolean).join(', ');
                  }
                  if (!detectedTown) detectedTown = addr.suburb || addr.village || addr.town || addr.city_district || "";
                  if (!detectedCity) detectedCity = addr.city || addr.town || addr.village || addr.municipality || "";
                  if (!detectedDistrict) detectedDistrict = addr.county || addr.state_district || addr.district || detectedCity;
                  if (!detectedState) detectedState = addr.state || "";
                }
              } catch (nomErr) {
                console.warn('[Addresses] Nominatim reverse geocode error:', nomErr);
              }
            }

            // 3. Indian Postal Pincode API if 6-digit pincode detected
            if (detectedPincode && detectedPincode.length === 6) {
              try {
                const pinRes = await fetch(`https://api.postalpincode.in/pincode/${detectedPincode}`);
                const pinData = await pinRes.json();
                if (pinData?.[0]?.Status === "Success" && pinData[0].PostOffice?.[0]) {
                  const po = pinData[0].PostOffice[0];
                  if (!detectedTown) detectedTown = po.Name || "";
                  if (!detectedCity) detectedCity = po.Division || detectedCity;
                  if (!detectedDistrict) detectedDistrict = po.District || detectedDistrict;
                  if (!detectedState) detectedState = po.State || detectedState;
                }
              } catch (_) {}
            }

            // Automatically fill street, pincode, town, city, district, state, leaving door number for manual entry
            setForm((f) => ({
              ...f,
              latitude: latStr,
              longitude: lngStr,
              street: detectedStreet || f.street,
              pincode: detectedPincode || f.pincode,
              town: detectedTown || detectedCity || f.town,
              city: detectedCity || f.city,
              district: detectedDistrict || detectedCity || f.district,
              state: detectedState || f.state,
            }));
            setPincodeError("");
          } else {
            setGeoError('Failed to read your location coordinates');
          }
          setGeoLoading(false);
        },
        (err) => {
          setGeoError(err && err.message ? err.message : 'Unable to get current location');
          setGeoLoading(false);
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      );
    } catch (e) {
      setGeoError('Location request failed');
      setGeoLoading(false);
    }
  };
 
// Map picker using Google Maps
const openMapPicker = async () => {
  console.log('[AddressMap] Opening map picker...');
  setMapInitError("");
  try {
    if (!window.google || !window.google.maps) {
      console.error('[AddressMap] Google Maps not loaded');
      throw new Error('Maps API not loaded');
    }

    setMapOpen(true);
    // Wait for dialog to render
    setTimeout(() => {
      try {
        console.log('[AddressMap] Initializing map...');
        const container = document.getElementById('map-picker-container');
        if (!container) throw new Error('Map container missing');

        // Prefer user's geolocation, fallback to existing form coords, then configured delivery center
        const hasCoords = Number.isFinite(parseFloat(form.latitude)) && Number.isFinite(parseFloat(form.longitude));
        let startLat = hasCoords ? parseFloat(form.latitude) : DELIVERY_ZONE_CENTER.lat;
        let startLng = hasCoords ? parseFloat(form.longitude) : DELIVERY_ZONE_CENTER.lng;

        // Create the map
        const map = new google.maps.Map(container, {
          zoom: 15,
          center: { lat: startLat, lng: startLng },
          mapTypeControl: false,
          fullscreenControl: false,
          streetViewControl: false,
          gestureHandling: 'greedy'
        });

        // Add search box functionality
        const searchInput = document.getElementById('map-search-box');
        const searchBox = new google.maps.places.Autocomplete(searchInput, {
          componentRestrictions: { country: 'IN' }
        });
        
        searchBox.addListener('place_changed', () => {
          const place = searchBox.getPlace();
          console.log('[AddressMap] Place selected:', place);
          
          if (!place.geometry || !place.geometry.location) {
            console.warn('[AddressMap] No geometry for this place');
            return;
          }

          // Update map and marker
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          
          map.setCenter({ lat, lng });
          map.setZoom(17);

          if (marker) {
            marker.setPosition({ lat, lng });
          } else {
            marker = new google.maps.Marker({
              position: { lat, lng },
              map: map,
              draggable: true
            });
          }
          setPickedLatLng({ lat, lng });
        });

        // Create the marker
        let marker = hasCoords ? new google.maps.Marker({
          position: { lat: startLat, lng: startLng },
          map: map,
          draggable: true
        }) : null;

        // Draw delivery zone circle
        const deliveryCircle = new google.maps.Circle({
          strokeColor: '#1976d2',
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: '#1976d2',
          fillOpacity: 0.1,
          map: map,
          center: DELIVERY_ZONE_CENTER,
          radius: DELIVERY_ZONE_RADIUS_METERS,
          clickable: false
        });

        if (hasCoords) {
          setPickedLatLng({ lat: startLat, lng: startLng });
        }

        // Handle map clicks
        map.addListener('click', (e) => {
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          console.log('[AddressMap] Map clicked:', { lat, lng });

          if (marker) {
            marker.setPosition({ lat, lng });
          } else {
            marker = new google.maps.Marker({
              position: { lat, lng },
              map: map,
              draggable: true
            });
          }
          setPickedLatLng({ lat, lng });
        });

        // Handle marker drag
        if (marker) {
          marker.addListener('dragend', () => {
            const position = marker.getPosition();
            const lat = position.lat();
            const lng = position.lng();
            console.log('[AddressMap] Marker dragged to:', { lat, lng });
            setPickedLatLng({ lat, lng });
          });
        }

        // Expose helper for map dialog actions
        window.__map_recenter_to_my_location = () => {
          console.log('[AddressMap] Attempting to center on current location');
          if (!('geolocation' in navigator)) return;
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const { latitude, longitude } = pos.coords || {};
              console.log('[AddressMap] Got current position:', { latitude, longitude });
              if (typeof latitude === 'number' && typeof longitude === 'number') {
                map.setCenter({ lat: latitude, lng: longitude });
                map.setZoom(16);
                if (marker) {
                  marker.setPosition({ lat: latitude, lng: longitude });
                } else {
                  marker = new google.maps.Marker({
                    position: { lat: latitude, lng: longitude },
                    map: map,
                    draggable: true
                  });
                }
                setPickedLatLng({ lat: latitude, lng: longitude });
              }
            },
            (error) => {
              console.error('[AddressMap] Geolocation error:', error);
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
          );
        };

      } catch (e) {
        console.error('[AddressMap] Map initialization error:', e);
        setMapInitError(e.message || 'Failed to initialize map');
      }
    }, 50);
  } catch (e) {
    console.error('[AddressMap] Map loading error:', e);
    setMapInitError(e.message || 'Failed to load map');
    setMapOpen(true);
  }
};

// Ensure Google Places suggestions (pac-container) render above our dialogs
useEffect(() => {
  const styleId = 'google-pac-style';
  if (document.getElementById(styleId)) return;
  const style = document.createElement('style');
  style.id = styleId;
  style.innerHTML = `
    /* Ensure Google Places autocomplete dropdown is visible above dialogs */
    .pac-container { z-index: 2350 !important; }
    .pac-item { font-size: 0.95rem; }
  `;
  document.head.appendChild(style);
  return () => { try { document.getElementById(styleId)?.remove(); } catch(e) {} };
}, []);

const isWithinDelivery = (lat, lng) => {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat - DELIVERY_ZONE_CENTER.lat);
  const dLng = toRad(lng - DELIVERY_ZONE_CENTER.lng);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(DELIVERY_ZONE_CENTER.lat)) * Math.cos(toRad(lat)) * Math.sin(dLng/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c <= DELIVERY_ZONE_RADIUS_METERS;
};

const confirmPickedLocation = async () => {
  if (!pickedLatLng) {
    setGeoError('Please tap on the map to drop a pin.');
    return;
  }
  const { lat, lng } = pickedLatLng;
  if (!isWithinDelivery(lat, lng)) {
    setGeoError('Selected location is outside our delivery area. Please choose a location within range.');
    return;
  }
  const latStr = String(lat);
  const lngStr = String(lng);
  setForm((f) => ({ ...f, latitude: latStr, longitude: lngStr }));
  // Also persist this picked location to Firestore under the current user
  try {
    if (mappedUserId) {
      const locDocRef = doc(collection(db, `users/${mappedUserId}/locations`));
      await setDoc(locDocRef, { latitude: lat, longitude: lng, pickedAt: serverTimestamp() });
    }
  } catch (e) {
    console.warn('Failed to persist picked location:', e);
  }

  // Reverse geocode picked location to automatically fill street, pincode, city, state
  try {
    if (window.google && window.google.maps && window.google.maps.Geocoder) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          let pPin = "", pStreet = "", pTown = "", pCity = "", pDist = "", pState = "";
          for (const comp of results[0].address_components) {
            const types = comp.types || [];
            if (types.includes('postal_code')) pPin = comp.long_name;
            if (types.includes('route') || types.includes('sublocality_level_1') || types.includes('sublocality') || types.includes('neighborhood')) {
              if (!pStreet) pStreet = comp.long_name;
            }
            if (types.includes('locality')) pCity = comp.long_name;
            if (types.includes('sublocality_level_2') || types.includes('sublocality_level_1')) {
              if (!pTown) pTown = comp.long_name;
            }
            if (types.includes('administrative_area_level_2')) pDist = comp.long_name;
            if (types.includes('administrative_area_level_1')) pState = comp.long_name;
          }
          setForm((f) => ({
            ...f,
            street: f.street || pStreet,
            pincode: f.pincode || pPin,
            town: f.town || pTown || pCity,
            city: f.city || pCity,
            district: f.district || pDist,
            state: f.state || pState
          }));
        }
      });
    } else {
      // Fallback with OpenStreetMap
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`)
        .then((res) => res.json())
        .then((data) => {
          const addr = data?.address || {};
          const pPin = addr.postcode ? addr.postcode.replace(/\D/g, '').slice(0, 6) : "";
          const pStreet = [addr.road, addr.suburb || addr.neighbourhood].filter(Boolean).join(', ');
          const pCity = addr.city || addr.town || addr.village || "";
          const pDist = addr.county || addr.district || pCity;
          const pState = addr.state || "";
          setForm((f) => ({
            ...f,
            street: f.street || pStreet,
            pincode: f.pincode || pPin,
            town: f.town || pCity,
            city: f.city || pCity,
            district: f.district || pDist,
            state: f.state || pState
          }));
        })
        .catch(() => {});
    }
  } catch (_) {}

  setGeoError("");
  setMapOpen(false);
};

// Fetch addresses on component mount and when dialog closes
useEffect(() => {
  fetchAddresses();
}, [mappedUserId, openDialog]);

// Open dialog for add/edit
const handleOpenDialog = (address = null) => {
  setFormError(null);
  setPincodeError(null);
  if (address) {
    setEditAddressId(address.id);
    setForm(address);
  } else {
    setEditAddressId(null);
    setForm({
      fullName: "",
      fatherOrSpouse: "",
      door: "",
      street: "",
      pincode: "",
      town: "",
      city: "",
      district: "",
      state: "",
      contact: "",
      altContact: "",
      landmark: "",
      latitude: "",
      longitude: "",
    });
  }
  setOpenDialog(true);
};

const handleCloseDialog = () => {
  setOpenDialog(false);
  setEditAddressId(null);
  setForm({
    fullName: "",
    fatherOrSpouse: "",
    door: "",
    street: "",
    pincode: "",
    town: "",
    city: "",
    district: "",
    state: "",
    contact: "",
    altContact: "",
    landmark: "",
    latitude: "",
    longitude: "",
  });
  setFormError(null);
  setPincodeError(null);
  setGeoError("");
};

// Add or edit address
const handleSave = async () => {
  if (
    !form.fullName ||
    !form.door ||
    !form.street ||
    !form.pincode ||
    !form.town ||
    !form.city ||
    !form.district ||
    !form.state ||
    !form.contact
  ) {
    setFormError("Please fill in all required fields (marked with *)");
    return;
  }
  // Require phone verification before saving address
  try {
    const full = asFullPhone(form.contact);
    const authPhone = auth && auth.currentUser ? (auth.currentUser.phoneNumber || null) : null;
    const alreadyVerified = (full && (full === authPhone || full === verifiedPhoneNumber)) || phoneVerified;
    if (!alreadyVerified) {
      setFormError("Please verify the contact number via OTP before saving the address.");
      return;
    }
  } catch (_) {}
  // Require GPS coordinates
  const lat = parseFloat(form.latitude);
  const lng = parseFloat(form.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    setFormError("Location required: Please use 'Use Current Location' or enter valid Latitude and Longitude.");
    return;
  }
  
  const shouldRedirect = location.state?.fromCart;
  if (!mappedUserId) return;
  const userDocRef = doc(db, "users", mappedUserId);
  const addressesCol = collection(userDocRef, "addresses");

  try {
    // First, save the address
    if (editAddressId) {
      // Update existing address
      const addressDocRef = doc(addressesCol, editAddressId);
      await setDoc(addressDocRef, form, { merge: true });
    } else {
      // Add new address
      const newAddressRef = doc(addressesCol);
      await setDoc(newAddressRef, form);

      // If this is the first address, set it as primary
      if (addresses.length === 0) {
        await setDoc(
          userDocRef,
          { primaryAddressId: newAddressRef.id },
          { merge: true }
        );
      }
    }

    // Also persist a location record tied to this save (if coords are present)
    const latNum = parseFloat(form.latitude);
    const lngNum = parseFloat(form.longitude);
    if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
      try {
        if (mappedUserId) {
          const locDocRef = doc(collection(db, `users/${mappedUserId}/locations`));
          await setDoc(locDocRef, { latitude: latNum, longitude: lngNum, pickedAt: serverTimestamp(), source: 'address_save' });
        }
      } catch (_) { /* non-blocking */ }
    }
    
    // Reset form state
    const resetForm = () => {
      setForm({
        fullName: "",
        fatherOrSpouse: "",
        door: "",
        street: "",
        pincode: "",
        town: "",
        city: "",
        district: "",
        state: "",
        contact: "",
        altContact: "",
        landmark: "",
        latitude: "",
        longitude: "",
      });
      setOpenDialog(false);
      setEditAddressId(null);
      setFormError(null);
      setPincodeError(null);
    };
    
    // Reset form and handle redirection in the same state update
    if (shouldRedirect) {
      resetForm();
      // Use setTimeout to ensure state updates are processed before navigation
      setTimeout(() => {
        navigate('/cart', { replace: true });
      }, 0);
    } else {
      resetForm();
    }
  } catch (e) {
    console.error("Error saving address:", e);
    setFormError("Failed to save address. Please try again.");
  }
};

// Pincode API integration
const handlePincodeBlur = async () => {
  const pin = form.pincode.trim();
  if (pin.length !== 6 || isNaN(pin)) {
    setPincodeError("Pincode must be 6 digits.");
    setForm((f) => ({ ...f, town: "", city: "", district: "", state: "" }));
    return;
  }
  setPincodeLoading(true);
  setPincodeError(null);
  try {
    const apiCall = () =>
      fetch(`https://api.postalpincode.in/pincode/${pin}`);
    const res = await withExponentialBackoff(apiCall);
    const data = await res.json();
    if (
      data &&
      data[0] &&
      data[0].Status === "Success" &&
      data[0].PostOffice &&
      data[0].PostOffice.length > 0
    ) {
      const po = data[0].PostOffice[0];
      setForm((f) => ({
        ...f,
        town: po.Name || "",
        city: po.Division || "",
        district: po.District || "",
        state: po.State || "",
      }));
    } else {
      setPincodeError("Invalid Pincode or no data found.");
      setForm((f) => ({ ...f, town: "", city: "", district: "", state: "" }));
    }
  } catch (e) {
    console.error("Error fetching pincode:", e);
    setPincodeError("Failed to fetch location data.");
    setForm((f) => ({ ...f, town: "", city: "", district: "", state: "" }));
  }
  setPincodeLoading(false);
};

// Set primary address
const handleSetPrimary = async (id) => {
  if (!mappedUserId) return;
  try {
    const userDocRef = doc(db, "users", mappedUserId);
    await setDoc(userDocRef, { primaryAddressId: id }, { merge: true });
    setPrimaryId(id);
  } catch (e) {
    console.error("Error setting primary address:", e);
  }
};

// Handle delete address
const handleDeleteClick = (address) => {
  setAddressToDelete(address);
  setDeleteDialogOpen(true);
};

const handleDeleteConfirm = async () => {
  if (!addressToDelete || !mappedUserId) return;
  
  try {
    const addressDocRef = doc(db, `users/${mappedUserId}/addresses`, addressToDelete.id);
    await deleteDoc(addressDocRef);
    
    // If the deleted address was primary, clear the primary address
    if (primaryId === addressToDelete.id) {
      const userDocRef = doc(db, "users", mappedUserId);
      await setDoc(userDocRef, { primaryAddressId: deleteField() }, { merge: true });
      setPrimaryId(null);
    }
    
    // Refresh and close dialog
    await fetchAddresses();
    setDeleteDialogOpen(false);
    setAddressToDelete(null);
  } catch (e) {
    console.error("Error deleting address:", e);
  }
};

  

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setAddressToDelete(null);
  };
  
  const pageRef = useRef(null);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        width: '100%',
        minHeight: "100vh",
        backgroundColor: "grey.50",
        px: 2,
        pb: 8, // ensure content clears BottomNavbar
        boxSizing: "border-box",
      }}
      ref={pageRef}
    >
      {/* Header with Back Button */}
      <Box
        sx={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 1,
          py: 1,
        }}
      >
        <IconButton
          onClick={() => navigate(-1)}
          sx={{
            color: "text.primary",
            "&:hover": {
              backgroundColor: "rgba(0,0,0,0.04)",
            },
          }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography
          variant="h6"
          component="h1"
          sx={{
            fontWeight: 700,
            flexGrow: 1,
          }}
        >
          {t('myAddressesTitle')}
        </Typography>
      </Box>

      {/* Main Content Area */}
      <Box
        sx={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 2,
          // Ensure the form area can expand fully across the dialog width
          '& .MuiFormControl-root, & .MuiTextField-root': { width: '100%' }
        }}
      >
        {/* Add New Address Button */}
        <Button
          variant="contained"
          color="primary"
          onClick={() => handleOpenDialog()}
          sx={{
            py: 1.5,
            fontWeight: 600,
            borderRadius: 2,
            boxShadow: theme.shadows[3],
          }}
        >
          {t('addNewAddress')}
        </Button>

        {/* Loading and Empty State */}
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : addresses.length === 0 ? (
          <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>
            {t('noAddressesSaved')}
          </Alert>
        ) : (
          addresses.map((addr) => (
            <Box
              key={addr.id}
              sx={{
                p: 3,
                backgroundColor: "white",
                borderRadius: 3,
                boxShadow: theme.shadows[1],
                display: "flex",
                flexDirection: { xs: "column", sm: "row" },
                justifyContent: "space-between",
                gap: 2,
                transition: "box-shadow 0.3s ease",
                "&:hover": {
                  boxShadow: theme.shadows[4],
                },
              }}
            >
              <Box>
                <Typography variant="h6" sx={{ mb: 1, fontWeight: 500 }}>
                  {addr.fullName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {addr.door}, {addr.street}
                  <br />
                  {addr.town}, {addr.city}
                  <br />
                  {addr.district}, {addr.state} - {addr.pincode}
                  <br />
                  Contact: {addr.contact}
                  {addr.altContact && <>, {addr.altContact}</>}
                  {addr.landmark && <br />}
                  {addr.landmark && `Landmark: ${addr.landmark}`}
                </Typography>
              </Box>
              <Box
                sx={{
                  display: "flex",
                  flexDirection: { xs: "row", sm: "column" },
                  alignItems: { xs: "center", sm: "flex-end" },
                  gap: 1.5,
                }}
              >
                <FormControlLabel
                  control={
                    <Radio
                      checked={primaryId === addr.id}
                      onChange={() => handleSetPrimary(addr.id)}
                    />
                  }
                  label={t('defaultTag')}
                  sx={{ mr: { xs: 0, sm: "auto" } }}
                />
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => handleOpenDialog(addr)}
                    sx={{
                      borderRadius: 2,
                      borderColor: theme.palette.grey[300],
                      color: theme.palette.text.primary,
                      minWidth: '80px'
                    }}
                  >
                    {t('editAddress')}
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => handleDeleteClick(addr)}
                    sx={{
                      borderRadius: 2,
                      borderColor: theme.palette.error.light,
                      color: theme.palette.error.main,
                      '&:hover': {
                        backgroundColor: 'rgba(211, 47, 47, 0.04)',
                        borderColor: theme.palette.error.main,
                      },
                      minWidth: '80px'
                    }}
                    startIcon={<DeleteIcon fontSize="small" />}
                  >
                    {t('deleteAddress')}
                  </Button>
                </Box>
              </Box>
            </Box>
          ))
        )}
      </Box>

      {/* Add/Edit Dialog */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        // Keep dialog within page so AppBar and BottomNavbar remain visible
        fullScreen={false}
        maxWidth="sm"
        fullWidth
        scroll="paper"
        container={pageRef.current}
        disablePortal
        PaperProps={{
          sx: {
            borderRadius: { xs: 1.5, sm: 2 },
            my: { xs: 1.5, sm: 2 }, // vertical margins so it sits between bars
            mx: { xs: 1.5, sm: 2 }, // comfortable side margins on mobile
            maxHeight: 'calc(100vh - 160px)', // space for AppBar + BottomNavbar
            display: 'flex',
            flexDirection: 'column'
          },
        }}
      >
        <DialogTitle
          sx={{
            py: 2,
            px: { xs: 2, sm: 4 },
            borderBottom: "1px solid #eee",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            m: 0,
            '& .MuiTypography-root': {
              m: 0,
              flex: 1,
              typography: 'h6',
              component: 'h2'
            }
          }}
          disableTypography
        >
          <Box component="div">
            {editAddressId ? t('editAddress') : t('addNewAddress')}
          </Box>
          <IconButton onClick={handleCloseDialog} aria-label="close">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent
          sx={{
            px: { xs: 2, sm: 3 },
            py: { xs: 2, sm: 3 },
            flexGrow: 1,
            overflowY: 'auto',
            pb: { xs: 3, sm: 3 }, // extra padding to avoid bottom overlap
          }}
        >
          {formError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {formError}
            </Alert>
          )}
          <Grid container spacing={2}>
            {/* Personal Details */}
            <Grid item xs={12}>
              <TextField
                label={`${t('fullName', 'Full Name')} *`}
                value={form.fullName}
                onChange={(e) =>
                  setForm({ ...form, fullName: e.target.value })
                }
                fullWidth
                variant="outlined"
                size="medium"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label={t('fatherOrSpouse', 'Father/Spouse Name')}
                value={form.fatherOrSpouse}
                onChange={(e) =>
                  setForm({ ...form, fatherOrSpouse: e.target.value })
                }
                fullWidth
                variant="outlined"
                size="medium"
              />
            </Grid>

            {/* Address Line 1 */}
            <Grid item xs={12}>
              <TextField
                label={`${t('doorNo', 'Door No.')} *`}
                value={form.door}
                onChange={(e) => setForm({ ...form, door: e.target.value })}
                fullWidth
                variant="outlined"
                size="medium"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label={`${t('streetName', 'Street Name')} *`}
                value={form.street}
                onChange={(e) => setForm({ ...form, street: e.target.value })}
                fullWidth
                variant="outlined"
                size="medium"
              />
            </Grid>

            {/* Location Details */}
            <Grid item xs={12}>
              <TextField
                label={`${t('pincode', 'Pincode')} *`}
                value={form.pincode}
                onChange={(e) => setForm({ ...form, pincode: e.target.value })}
                onBlur={handlePincodeBlur}
                fullWidth
                variant="outlined"
                size="medium"
                error={!!pincodeError}
                helperText={pincodeLoading ? t('fetchingLocation', 'Fetching location...') : pincodeError}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label={`${t('town', 'Town')} *`}
                value={form.town}
                onChange={(e) => setForm({ ...form, town: e.target.value })}
                fullWidth
                variant="outlined"
                size="medium"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label={`${t('city', 'City')} *`}
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                fullWidth
                variant="outlined"
                size="medium"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label={`${t('district', 'District')} *`}
                value={form.district}
                onChange={(e) =>
                  setForm({ ...form, district: e.target.value })
                }
                fullWidth
                variant="outlined"
                size="medium"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label={`${t('state', 'State')} *`}
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                fullWidth
                variant="outlined"
                size="medium"
              />
            </Grid>

            {/* Contact Details */}
            <Grid item xs={12}>
              <TextField
                label={`${t('contactNumber', 'Contact Number')} *`}
                value={form.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value.replace(/\D/g, '') })}
                fullWidth
                variant="outlined"
                size="medium"
                inputProps={{ maxLength: 15 }}
              />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                <Button
                  size="small"
                  variant="contained"
                  onClick={sendOtp}
                  disabled={!form.contact || phoneVerified}
                  sx={{ textTransform: 'none' }}
                >
                  {phoneVerified ? t('verified', 'Verified') : (otpSent ? t('resendOtp', 'Resend OTP') : t('sendOtp', 'Send OTP'))}
                </Button>
                {phoneVerified && (
                  <Typography variant="caption" color="success.main">{t('phoneVerified', 'Phone number verified!')}</Typography>
                )}
              </Box>
              {otpSent && !phoneVerified && (
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 1 }}>
                  <TextField
                    label={t('enterOtp', 'Enter OTP')}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    variant="outlined"
                    size="small"
                    inputProps={{ maxLength: 6 }}
                    sx={{ flex: 1 }}
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={verifyOtp}
                    disabled={!otp || verifying}
                    sx={{ textTransform: 'none' }}
                  >
                    {verifying ? t('verifying', 'Verifying…') : t('verifyOtp', 'Verify OTP')}
                  </Button>
                </Box>
              )}
              {inlineMsg && (
                <Alert severity={inlineMsg.type || 'info'} sx={{ mt: 1 }}>
                  {inlineMsg.text}
                </Alert>
              )}
              {/* Hidden reCAPTCHA container */}
              <Box id="recaptcha-container" sx={{ display: 'none' }} />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label={t('alternativeContact', 'Alternative Contact')}
                value={form.altContact}
                onChange={(e) =>
                  setForm({ ...form, altContact: e.target.value })
                }
                fullWidth
                variant="outlined"
                size="medium"
              />
            </Grid>

            {/* Landmark */}
            <Grid item xs={12}>
              <TextField
                label={t('landmarkPlaceholder', 'Landmark (e.g., Near ABC School)')}
                value={form.landmark}
                onChange={(e) => setForm({ ...form, landmark: e.target.value })}
                fullWidth
                multiline
                rows={2}
                variant="outlined"
                size="medium"
              />
            </Grid>

            {/* GPS Location (Required) */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                {t('locationCoordinatesRequired', 'Location Coordinates (Required)')}
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    label={`${t('latitude', 'Latitude')} *`}
                    value={form.latitude}
                    onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                    fullWidth
                    variant="outlined"
                    size="medium"
                    placeholder="e.g., 11.0168"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label={`${t('longitude', 'Longitude')} *`}
                    value={form.longitude}
                    onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                    fullWidth
                    variant="outlined"
                    size="medium"
                    placeholder="e.g., 76.9558"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button
                    onClick={handleUseCurrentLocation}
                    variant="outlined"
                    disabled={geoLoading}
                    sx={{ fontWeight: 600, borderRadius: 2 }}
                  >
                    {geoLoading ? t('fetchingCurrentLocation', 'Fetching Current Location…') : t('useCurrentLocation', 'Use Current Location')}
                  </Button>
                </Grid>
                <Grid item xs={12}>
                  <Button
                    onClick={openMapPicker}
                    variant="outlined"
                    sx={{ fontWeight: 600, borderRadius: 2 }}
                  >
                    {t('pickOnMap', 'Pick on Map')}
                  </Button>
                </Grid>
              </Grid>
              {geoError && (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  {geoError}
                </Alert>
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions
          sx={{
            py: 2,
            px: { xs: 2, sm: 4 },
            borderTop: "1px solid #eee",
            display: "flex",
            justifyContent: "flex-end",
            gap: 2,
            // Keep actions visible and fixed to the bottom of the dialog content area
            position: 'sticky',
            bottom: 0,
            backgroundColor: 'background.paper',
            zIndex: 1600
          }}
        >
          <Button onClick={handleCloseDialog} color="inherit" variant="text">
            {t('cancel')}
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            color="primary"
            disableElevation
          >
            {t('saveAddress')}
          </Button>
        </DialogActions>
      </Dialog>
      {/* Map Picker Modal */}
      <Dialog
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        maxWidth="md"
        fullWidth
        // Keep dialog inside the page container so it can be positioned between AppBar and BottomNavbar
        container={pageRef.current}
        disablePortal
        PaperProps={{
          sx: {
            zIndex: 1500,
            // Position absolutely within the page container so we can sit below AppBar and above BottomNavbar
            position: 'absolute',
            top: '16px', // below AppBar (approx)
            left: 0,
            right: 0,
            mx: 'auto',
            // Controlled width so the dialog appears centered and not edge-to-edge
            width: { xs: 'calc(100% - 28px)', sm: '640px' },
            maxWidth: '640px',
            // keep room at bottom for bottom nav
            maxHeight: 'calc(100vh - 136px)',
           
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }
        }}
      >
        <DialogTitle sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 1.5, sm: 2 } }}>{t('selectLocationOnMap', 'Select Location on Map')}</DialogTitle>
  <DialogContent sx={{ px: { xs: 1.5, sm: 3 }, pt: 1, pb: 0, display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto' }}>
          {mapInitError && (
            <Alert severity="error" sx={{ mb: 2 }}>{mapInitError}</Alert>
          )}
          <Box sx={{ mb: 1 }}>
            <TextField
              id="map-search-box"
              label={t('searchLocation', 'Search for a location')}
              fullWidth
              variant="outlined"
              size="small"
              placeholder={t('enterAddressOrLandmark', 'Enter an address or landmark')}
              autoComplete="off"
            />
          </Box>
          <Box sx={{ position: 'relative', width: '100%', flex: 1, minHeight: { xs: '40vh', sm: 420 } }}>
            <Box id="map-picker-container" sx={{ position: 'absolute', inset: 0, borderRadius: { xs: 0, sm: 8 }, overflow: 'hidden', boxShadow: 1 }} />
            {/* Floating detect location button over map (top-left) */}
            <Button
              onClick={() => window.__map_recenter_to_my_location && window.__map_recenter_to_my_location()}
              aria-label="detect-location"
              sx={{
                position: 'absolute',
                top: 10,
                left: 10,
                zIndex: 1400,
                minWidth: 40,
                width: 40,
                height: 40,
                borderRadius: '50%',
                bgcolor: 'background.paper',
                boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
                p: 0.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'success.main'
              }}
            >
              <LocationOnIcon />
            </Button>
          </Box>
          <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
            Search for a location, drop a pin on the map, or use your current location. Only locations within our delivery area (blue circle) are allowed.
          </Typography>
          {pickedLatLng && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Selected location: {pickedLatLng.lat.toFixed(6)}, {pickedLatLng.lng.toFixed(6)}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ position: 'sticky', bottom: 0, backgroundColor: 'background.paper', zIndex: 1600, py: 1, px: { xs: 2, sm: 3 }, boxShadow: '0 -6px 18px rgba(0,0,0,0.08)' }}>
          <Button onClick={() => setMapOpen(false)} sx={{ textTransform: 'none', fontSize: '0.85rem' }}>{t('cancel')}</Button>
          <Button 
            variant="contained" 
            onClick={confirmPickedLocation}
            disabled={!pickedLatLng || !isWithinDelivery(pickedLatLng.lat, pickedLatLng.lng)}
            sx={{ textTransform: 'none', fontSize: '0.85rem', minWidth: 140 }}
          >
            {t('selectLocation', 'Select Location')}
          </Button>
        </DialogActions>
      </Dialog>
      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('deleteAddress')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('deleteAddress')}?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} color="primary">
            {t('cancel')}
          </Button>
          <Button 
            onClick={handleDeleteConfirm} 
            color="error"
            variant="contained"
            autoFocus
          >
            {t('deleteAddress')}
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default AddressesPage;