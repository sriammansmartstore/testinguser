import React, { useState, useEffect } from "react";
import { Typography, CircularProgress, Box, IconButton } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useLanguage } from "../context/LanguageContext";

const LocationDetectionWidget = ({ onLocationDetected, deliverableState = null }) => {
  const { t } = useLanguage();
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [coords, setCoords] = useState(null);
  const [acc, setAcc] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    console.log('[LocationDetection] Starting location detection (effect)');
    setLoading(true);
    setError("");

    let watchId = null;
    let overallTimer = null;
    const watchdog = setTimeout(() => {
      console.warn('[LocationDetection] Watchdog timeout - location detection took too long');
      setError("Unable to get your location. Please enable precise location and try again.");
      setLoading(false);
    }, 25000);

    const isMapsReady = () => {
      return Boolean(window.google && window.google.maps && typeof window.google.maps.Geocoder === 'function');
    };

    const waitForMaps = () => {
      if (isMapsReady()) {
        console.log('[LocationDetection] Google Maps API already loaded');
        return Promise.resolve(true);
      }
      console.log('[LocationDetection] Waiting for Google Maps to load...');
      return new Promise((resolve) => {
        let attempts = 0;
        const checkLoaded = () => {
          if (isMapsReady()) {
            console.log('[LocationDetection] Google Maps API loaded successfully');
            resolve(true);
          } else if (attempts > 50) {
            console.warn('[LocationDetection] Google Maps load timed out, proceeding with fallback geocoding');
            resolve(false);
          } else {
            attempts++;
            setTimeout(checkLoaded, 100);
          }
        };
        checkLoaded();
      });
    };

    const pickBestArea = (data, rawSource = 'bigdatacloud') => {
      // If we got Nominatim-like address, prefer road + village/suburb/town + postcode
      if (data && data.address) {
        const addr = data.address;
        const parts = [];
        if (addr.road) parts.push(addr.road);
        // prefer village -> hamlet -> suburb -> town -> city
        const locality = addr.village || addr.hamlet || addr.suburb || addr.town || addr.city || addr.neighbourhood;
        if (locality) parts.push(locality);
        const base = parts.join(', ');
        const postcode = addr.postcode ? ` - ${addr.postcode}` : '';
        const display = base || addr.county || addr.state || addr.country || 'Unknown area';
        return { display: `${display}${postcode}`, address: addr, source: 'nominatim' };
      }

      // Fallback to BigDataCloud-style response
      const localityFromInfo = data?.localityInfo?.locality?.name; // sublocality/neighborhood when available
      const adminLevels = data?.localityInfo?.administrative || [];
      const mostLocalAdmin = adminLevels.length ? adminLevels[adminLevels.length - 1]?.name : undefined;
      const baseName = localityFromInfo || data?.locality || mostLocalAdmin || data?.city || data?.principalSubdivision || data?.countryName;
      const postcode = data?.postcode ? ` - ${data.postcode}` : '';
      return { display: `${baseName || 'Unknown area'}${postcode}`, address: { postcode: data?.postcode, city: data?.city }, source: rawSource };
    };

    const handlePosition = async (pos) => {
      console.log('[LocationDetection] Received position:', pos);
      const { latitude, longitude, accuracy } = pos.coords;
      console.log(`[LocationDetection] Coordinates: ${latitude}, ${longitude} (accuracy: ${accuracy}m)`);

      if (typeof accuracy === 'number' && accuracy > 30) {
        console.log('[LocationDetection] Poor accuracy, waiting for better fix');
      }

      try {
        const nominatimFetch = async (lat, lon) => {
          const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&addressdetails=1&zoom=18`;
          const resp = await fetch(url, { headers: { 'Accept-Language': 'en' } });
          if (!resp.ok) throw new Error('Nominatim failed');
          return await resp.json();
        };

        let areaInfo = null;
        if (typeof window.google?.maps?.Geocoder === 'function') {
          try {
            console.log('[LocationDetection] Attempting Google Geocoding...');
            const geocoder = new window.google.maps.Geocoder();
          const result = await new Promise((resolve, reject) => {
            geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results, status) => {
              console.log('[LocationDetection] Geocoding status:', status);
              if (status === 'OK' && results && results.length > 0) resolve(results[0]);
              else reject(new Error(`Geocoding failed with status: ${status}`));
            });
          });

          const addr = {};
          for (const comp of result.address_components || []) {
            const types = comp.types || [];
            if (types.includes('street_number')) addr.house_number = comp.long_name;
            if (types.includes('route')) addr.road = comp.long_name;
            if (types.includes('sublocality') || types.includes('sublocality_level_1')) addr.suburb = comp.long_name;
            if (types.includes('neighborhood')) addr.neighbourhood = comp.long_name;
            if (types.includes('locality')) addr.city = comp.long_name;
            if (types.includes('postal_town')) addr.town = comp.long_name;
            if (types.includes('postal_code')) addr.postcode = comp.long_name;
            if (types.includes('administrative_area_level_2')) addr.county = comp.long_name;
            if (types.includes('administrative_area_level_1')) addr.state = comp.long_name;
            if (types.includes('country')) addr.country = comp.long_name;
          }

          const displayParts = [];
          if (addr.road) displayParts.push(addr.road + (addr.house_number ? ` ${addr.house_number}` : ''));
          const locality = addr.suburb || addr.neighbourhood || addr.town || addr.city;
          if (locality) displayParts.push(locality);
          const display = displayParts.join(', ') || result.formatted_address || 'Unknown area';
          const displayWithPost = addr.postcode ? `${display} - ${addr.postcode}` : display;

          areaInfo = { display: displayWithPost, address: addr, source: 'google', formatted_address: result.formatted_address };
        } catch (e) {
            console.warn('[LocationDetectionWidget] Google Geocoding failed:', e);
            areaInfo = null;
          }
        }

        if (!areaInfo) {
          try {
            const nomData = await nominatimFetch(latitude, longitude);
            areaInfo = pickBestArea(nomData, 'nominatim');
            const addr = nomData?.address || {};
            const hasRoadLike = addr.road || addr.pedestrian || addr.cycleway || addr.footway || addr.house_number;
            const hasLocality = addr.village || addr.town || addr.city || addr.suburb || addr.hamlet || addr.neighbourhood;
            if (!hasRoadLike && !hasLocality) {
              console.log('[LocationDetectionWidget] No road/locality in nominatim result, attempting nearby retries');
              const offsets = [[0.0001,0],[-0.0001,0],[0,0.0001],[0,-0.0001],[0.00012,0.00008]];
              for (let i=0;i<offsets.length && (!hasRoadLike && !hasLocality); i++){
                const [dLat,dLon] = offsets[i];
                try {
                  const nearby = await nominatimFetch(latitude + dLat, longitude + dLon);
                  const nearbyAddr = nearby?.address || {};
                  if (nearbyAddr.road || nearbyAddr.village || nearbyAddr.town || nearbyAddr.city || nearbyAddr.suburb || nearbyAddr.hamlet) {
                    areaInfo = pickBestArea(nearby, 'nominatim');
                    console.log('[LocationDetectionWidget] Found nearby address on retry', i, areaInfo.display);
                    break;
                  }
                } catch (e) { /* ignore */ }
              }
            }
          } catch (e) {
            console.warn('[LocationDetectionWidget] Nominatim lookup failed, falling back', e);
            areaInfo = null;
          }
        }

        if (!areaInfo) {
          const resp = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
          if (!resp.ok) throw new Error('Reverse geocode failed');
          const data = await resp.json();
          areaInfo = pickBestArea(data, 'bigdatacloud');
        }

        const areaStr = areaInfo?.display || 'Unknown area';
        console.log(`Detected: ${areaStr} (lat: ${latitude}, lng: ${longitude}, accuracy: ${accuracy ?? 'unknown'} m)`);
        setLocation(areaStr);
        setCoords({ lat: latitude, lng: longitude });
        setAcc(accuracy ?? null);
        onLocationDetected?.({ area: areaStr, address: areaInfo?.address || null, coords: { lat: latitude, lng: longitude }, source: areaInfo?.source });
      } catch (e) {
        setError("Failed to fetch area name. Please try again.");
        setCoords({ lat: latitude, lng: longitude });
        setAcc(accuracy ?? null);
        onLocationDetected?.({ area: 'Unknown area', address: null, coords: { lat: latitude, lng: longitude } });
      } finally {
        setLoading(false);
      }
    };

    const startGeolocation = () => {
      setLoading(true);
      setError("");
      let bestPos = null;
      const DESIRED_ACCURACY = 1000; // meters
      const OVERALL_TIMEOUT = 25000; // ms

      const onPosition = (p) => {
        console.log('[LocationDetection] Position update received:', p);
        if (!p || !p.coords) return;
        const acc = typeof p.coords.accuracy === 'number' ? p.coords.accuracy : Infinity;
        if (!bestPos || acc < (bestPos.coords.accuracy ?? Infinity)) {
          console.log('[LocationDetection] New best position found with accuracy:', acc);
          bestPos = p;
        }
        if (acc <= DESIRED_ACCURACY) {
          console.log('[LocationDetection] Desired accuracy achieved:', acc);
          finalize(p);
        } else {
          console.log('[LocationDetection] Waiting for better accuracy. Current:', acc, 'Desired:', DESIRED_ACCURACY);
        }
      };

      const onError = (err) => {
        console.warn('[LocationDetectionWidget] geolocation error during watch/get:', err);
        if (err && err.code === 1) { // PERMISSION_DENIED
          if (watchId) { navigator.geolocation.clearWatch(watchId); watchId = null; }
          if (overallTimer) { clearTimeout(overallTimer); overallTimer = null; }
          setError('Location permission denied.');
          setLoading(false);
          onLocationDetected?.({ area: '', coords: null });
        }
      };

      const finalize = async (pos) => {
        console.log('[LocationDetection] Finalizing with position:', pos);
        try {
          if (watchId) { navigator.geolocation.clearWatch(watchId); watchId = null; }
          if (overallTimer) { clearTimeout(overallTimer); overallTimer = null; }
          const final = pos || bestPos;
          if (final) await handlePosition(final);
          else { setError('Unable to determine location.'); setLoading(false); }
        } catch (e) { console.error('[LocationDetectionWidget] finalize error:', e); }
      };

      try {
        watchId = navigator.geolocation.watchPosition(onPosition, onError, { enableHighAccuracy: true, timeout: OVERALL_TIMEOUT, maximumAge: 0 });
        console.log('[LocationDetection] Started watchPosition with id:', watchId);
      } catch (e) {
        console.warn('[LocationDetection] watchPosition threw an error:', e);
      }

      try {
        navigator.geolocation.getCurrentPosition(
          (p) => { console.log('[LocationDetection] Quick getCurrentPosition received:', p); onPosition(p); },
          (err) => {
            console.warn('[LocationDetection] quick getCurrentPosition failed', err);
            if (err && err.code === 1) {
              onError(err);
            }
          },
          { enableHighAccuracy: true, timeout: 7000, maximumAge: 0 }
        );
      } catch (e) { console.warn('[LocationDetection] quick getCurrentPosition exception', e); }

      overallTimer = setTimeout(async () => {
        console.log('[LocationDetectionWidget] Overall geolocation timeout, using best observed position');
        if (watchId) { navigator.geolocation.clearWatch(watchId); watchId = null; }
        if (bestPos) await handlePosition(bestPos);
        else { setError('Unable to determine location.'); setLoading(false); }
      }, OVERALL_TIMEOUT);
    };

    // Start sequence: wait for maps, then geolocate
    waitForMaps().then(() => {
      if (!navigator.geolocation) {
        console.error('[LocationDetection] Geolocation not supported');
        setError('Geolocation not supported.');
        setLoading(false);
        return;
      }
      startGeolocation();
    }).catch((e) => {
      console.error('[LocationDetection] Failed to load Google Maps:', e);
      setError('Maps API failed to load. Please refresh the page.');
      setLoading(false);
    });

    return () => {
      console.log('[LocationDetection] Cleanup running');
      clearTimeout(watchdog);
      if (overallTimer) { clearTimeout(overallTimer); overallTimer = null; }
      if (watchId) { try { navigator.geolocation.clearWatch(watchId); } catch (e) {} }
    };
  }, [onLocationDetected, refreshKey]);

  // No manual retry button — widget now automatically attempts extra high-accuracy fixes when needed

  return (
    <div>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Typography
          variant="caption"
          sx={{ display: "block", mt: 0, mb: 0.25, color: error ? "error.main" : "#388e3c", fontWeight: 500, fontSize: "0.85em" }}
        >
          {loading ? (
            <>
              <CircularProgress size={14} sx={{ verticalAlign: "middle", mr: 1 }} /> {t('detectingArea', 'Detecting your area...')}
            </>
          ) : error ? (
            error
          ) : (
            location
          )}
        </Typography>
        <IconButton
          aria-label="Refresh location"
          size="small"
          onClick={() => {
            // Trigger an explicit geolocation request via user gesture
            setRefreshKey((k) => k + 1);
          }}
          sx={{ ml: 1 }}
        >
          <RefreshIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Automatic retry logic in effect when a coarse initial fix is detected (no UI prompt) */}

      {deliverableState !== null && (
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            color: deliverableState ? '#388e3c' : 'red',
            fontWeight: 500,
            mb: 0.5
          }}
        >
          {deliverableState ? t('deliveryAvailable', 'Delivery available in your area') : t('deliveryNotAvailable', 'Sorry, delivery not available in your area')}
        </Typography>
      )}
    </div>
  );
};

export default LocationDetectionWidget;