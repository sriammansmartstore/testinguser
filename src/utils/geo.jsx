// Geo utilities: Haversine distance and radius checks

// Returns distance in meters between two lat/lng points
export function haversineDistanceMeters(a, b) {
  const R = 6371000; // Earth radius in meters
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

export function isWithinRadius(point, center, radiusMeters) {
  if (!point || !center) return false;
  const d = haversineDistanceMeters(point, center);
  return d <= radiusMeters;
}
