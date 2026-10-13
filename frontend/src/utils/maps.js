/**
 * Google Maps + geolocation helpers. Uses REACT_APP_GOOGLE_MAPS_API_KEY.
 * Lazily loads the JS API once and caches the promise so the script is not injected twice.
 */

const API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
let _loaderPromise = null;

export function loadGoogleMaps() {
  if (!API_KEY) return Promise.reject(new Error('Google Maps API key not configured'));
  if (window.google?.maps?.places) return Promise.resolve(window.google);
  if (_loaderPromise) return _loaderPromise;

  _loaderPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById('gmaps-sdk');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google));
      existing.addEventListener('error', reject);
      return;
    }
    const s = document.createElement('script');
    s.id = 'gmaps-sdk';
    s.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places,geocoding&loading=async`;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve(window.google);
    s.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(s);
  });
  return _loaderPromise;
}

/** Ask browser for GPS coordinates. */
export function getCurrentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000, ...options }
    );
  });
}

/** Reverse geocode lat/lng to a friendly locality/city name using Google Geocoder. */
export async function reverseGeocode({ lat, lng }) {
  await loadGoogleMaps();
  const geocoder = new window.google.maps.Geocoder();
  return new Promise((resolve, reject) => {
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status !== 'OK' || !results?.length) {
        reject(new Error('Reverse geocoding failed'));
        return;
      }
      // Prefer the shortest human-friendly locality
      const findComp = (types) => {
        for (const r of results) {
          const c = r.address_components?.find(ac => types.some(t => ac.types.includes(t)));
          if (c) return c.long_name;
        }
        return null;
      };
      const locality = findComp(['sublocality_level_1', 'sublocality', 'locality', 'neighborhood']);
      const city = findComp(['locality', 'administrative_area_level_2']);
      const state = findComp(['administrative_area_level_1']);
      const formatted = results[0]?.formatted_address;
      resolve({ locality: locality || city || formatted, city: city || locality, state, lat, lng, formatted });
    });
  });
}

/** Haversine distance in kilometres between two lat/lng pairs. */
export function haversineKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Wire Google Places Autocomplete on an <input> element. */
export async function attachAutocomplete(inputEl, onPlace) {
  await loadGoogleMaps();
  const ac = new window.google.maps.places.Autocomplete(inputEl, {
    fields: ['geometry', 'formatted_address', 'address_components', 'name'],
    componentRestrictions: { country: ['in'] },
  });
  ac.addListener('place_changed', () => {
    const place = ac.getPlace();
    if (!place?.geometry) { onPlace(null); return; }
    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();
    const findComp = (types) => {
      const c = place.address_components?.find(ac => types.some(t => ac.types.includes(t)));
      return c ? c.long_name : null;
    };
    onPlace({
      lat, lng,
      locality: findComp(['sublocality_level_1', 'sublocality', 'locality']) || place.name,
      city: findComp(['locality', 'administrative_area_level_2']),
      state: findComp(['administrative_area_level_1']),
      formatted: place.formatted_address,
    });
  });
  return ac;
}
