/**
 * Photon Keyless Geocoding Service (Komoot)
 * Free OpenStreetMap-based forward and reverse geocoding with defensive parsing,
 * in-memory LRU caching, and error resilience.
 */

import { PHOTON_BASE_URL } from '../config/api';

export interface PhotonPlaceResult {
  label: string;
  name: string;
  suburbOrDistrict?: string;
  state?: string;
  lat: number;
  lng: number;
  rawProperties?: Record<string, any>;
}

// Simple in-memory LRU cache
const SEARCH_CACHE = new Map<string, PhotonPlaceResult[]>();
const REVERSE_CACHE = new Map<string, PhotonPlaceResult>();
const MAX_CACHE_SIZE = 100;

function setLru<K, V>(map: Map<K, V>, key: K, value: V) {
  if (map.size >= MAX_CACHE_SIZE) {
    const firstKey = map.keys().next().value;
    if (firstKey !== undefined) map.delete(firstKey);
  }
  map.set(key, value);
}

/**
 * Specificity order: name → street → suburb/locality → district → city
 */
export function pickSpecificLabel(
  props: Record<string, any> | undefined,
  lat?: number,
  lng?: number
): string {
  if (!props) {
    return lat !== undefined && lng !== undefined
      ? `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`
      : 'New Location';
  }

  const candidate =
    props.name ||
    props.street ||
    props.suburb ||
    props.locality ||
    props.district ||
    props.city;

  if (candidate && typeof candidate === 'string' && candidate.trim().length > 0) {
    return candidate.trim();
  }

  return lat !== undefined && lng !== undefined
    ? `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`
    : 'New Location';
}

/**
 * Builds formatted full address for helper text display.
 */
export function buildFullAddress(place: PhotonPlaceResult): string {
  const p = place.rawProperties || {};
  const parts = [
    p.name,
    p.street,
    p.suburb || p.locality,
    p.district,
    p.city,
    p.state,
    p.postcode,
    p.country,
  ].filter(Boolean);

  if (parts.length > 0) {
    const deduped: string[] = [];
    for (const part of parts) {
      if (typeof part === 'string' && part.trim() && !deduped.includes(part.trim())) {
        deduped.push(part.trim());
      }
    }
    return deduped.join(', ');
  }

  return place.label || `${place.lat.toFixed(4)}, ${place.lng.toFixed(4)}`;
}

/**
 * Defensively extracts a human-readable display label from Photon GeoJSON properties.
 * Never invents fake information.
 */
export function buildPhotonLabel(props: Record<string, any>, lat: number, lng: number): {
  label: string;
  name: string;
  suburbOrDistrict?: string;
  state?: string;
} {
  const name = pickSpecificLabel(props, lat, lng);
  const suburb = props.suburb || props.locality || props.district || props.city || props.county;
  const state = props.state;

  const parts = [name];
  if (suburb && suburb !== name) parts.push(suburb);
  if (state && state !== suburb && state !== name) parts.push(state);

  return {
    label: parts.join(', '),
    name,
    suburbOrDistrict: suburb,
    state,
  };
}

/**
 * Live forward geocoding search via Photon API
 */
export async function searchPhotonPlaces(
  query: string,
  signal?: AbortSignal
): Promise<PhotonPlaceResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  const cacheKey = q.toLowerCase();
  if (SEARCH_CACHE.has(cacheKey)) {
    return SEARCH_CACHE.get(cacheKey)!;
  }

  // Centered on Bangalore metro (12.9716, 77.5946)
  const url = `${PHOTON_BASE_URL}/api/?q=${encodeURIComponent(q)}&lat=12.9716&lon=77.5946&limit=5`;

  try {
    const res = await fetch(url, { signal });
    if (!res.ok) {
      if (res.status === 429) {
        console.warn('Photon rate limit hit (429)');
      }
      return [];
    }

    const data = await res.json();
    if (!data || !Array.isArray(data.features)) return [];

    const results: PhotonPlaceResult[] = [];
    for (const feat of data.features) {
      if (!feat.geometry || !Array.isArray(feat.geometry.coordinates)) continue;
      // GeoJSON standard: [lon, lat]
      const [lon, lat] = feat.geometry.coordinates;
      if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
        continue;
      }

      const props = feat.properties || {};
      const { label, name, suburbOrDistrict, state } = buildPhotonLabel(props, lat, lon);

      results.push({
        label,
        name,
        suburbOrDistrict,
        state,
        lat,
        lng: lon,
        rawProperties: props,
      });
    }

    setLru(SEARCH_CACHE, cacheKey, results);
    return results;
  } catch (err: any) {
    if (err.name === 'AbortError') throw err;
    console.warn('Photon search error:', err);
    return [];
  }
}

/**
 * Reverse geocoding via Photon API
 */
export async function reverseGeocodePhoton(
  lat: number,
  lng: number,
  signal?: AbortSignal
): Promise<PhotonPlaceResult> {
  const roundLat = Math.round(lat * 10000) / 10000;
  const roundLng = Math.round(lng * 10000) / 10000;
  const cacheKey = `${roundLat}:${roundLng}`;

  if (REVERSE_CACHE.has(cacheKey)) {
    return REVERSE_CACHE.get(cacheKey)!;
  }

  const fallback: PhotonPlaceResult = {
    label: `Dropped pin (${roundLat}, ${roundLng})`,
    name: `Dropped pin`,
    lat,
    lng,
  };

  const url = `${PHOTON_BASE_URL}/reverse?lat=${lat}&lon=${lng}`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return fallback;

    const data = await res.json();
    if (!data || !Array.isArray(data.features) || data.features.length === 0) {
      return fallback;
    }

    const feat = data.features[0];
    const props = feat.properties || {};
    const { label, name, suburbOrDistrict, state } = buildPhotonLabel(props, lat, lng);

    const result: PhotonPlaceResult = {
      label,
      name,
      suburbOrDistrict,
      state,
      lat,
      lng,
      rawProperties: props,
    };

    setLru(REVERSE_CACHE, cacheKey, result);
    return result;
  } catch (err: any) {
    if (err.name === 'AbortError') throw err;
    console.warn('Photon reverse geocode error:', err);
    return fallback;
  }
}

/**
 * Clears geocoding cache (useful in tests)
 */
export function clearPhotonCache() {
  SEARCH_CACHE.clear();
  REVERSE_CACHE.clear();
}
