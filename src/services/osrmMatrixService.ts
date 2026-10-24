/**
 * OSRM Road Matrix Service
 * Fetches real road-network driving distances and free-flow durations from OSRM Table API.
 * Includes coordinate chunking, concurrency control, retries, multi-tier caching (memory + localStorage),
 * and deterministic Haversine x 1.34 road detour fallback.
 */

import { OSRM_BASE_URL, DEFAULT_AVG_SPEED_KMH, DEFAULT_ROAD_DETOUR_FACTOR } from '../config/api';

export interface LocationPoint {
  id: string;
  lat: number;
  lng: number;
  name?: string;
}

export type PairSource = 'osrm' | 'haversine';

export interface MatrixEntry {
  distanceKm: number;
  durationMin: number;
  source: PairSource;
}

export interface OsrmMatrixResult {
  distancesKm: Record<string, Record<string, number>>; // [sourceId][destId] = km
  durationsMin: Record<string, Record<string, number>>; // [sourceId][destId] = minutes
  pairSource: Record<string, PairSource>; // `${sourceId}:${destId}` -> 'osrm' | 'haversine'
  status: 'all_road' | 'mixed' | 'all_haversine';
  osrmCount: number;
  estimatedCount: number;
  totalPairs: number;
  avgDetourRatio: number;
}

// Earth radius in kilometers for Haversine
const EARTH_RADIUS_KM = 6371.0;

/**
 * Great-circle geographic distance between two points in kilometers.
 */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = (lat1 * Math.PI) / 180.0;
  const phi2 = (lat2 * Math.PI) / 180.0;
  const dphi = ((lat2 - lat1) * Math.PI) / 180.0;
  const dlambda = ((lon2 - lon1) * Math.PI) / 180.0;

  const a =
    Math.sin(dphi / 2.0) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlambda / 2.0) ** 2;
  const c = 2.0 * Math.atan2(Math.sqrt(a), Math.sqrt(1.0 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Deterministic fallback distance and duration:
 * Haversine distance multiplied by empirical Bangalore road-detour factor (1.34x).
 */
export function haversineDetourFallback(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): { distanceKm: number; durationMin: number } {
  const rawDist = haversineKm(lat1, lon1, lat2, lon2);
  const roadKm = Math.round(rawDist * DEFAULT_ROAD_DETOUR_FACTOR * 1000) / 1000;
  const durMin = Math.round(((roadKm / DEFAULT_AVG_SPEED_KMH) * 60.0) * 10) / 10;
  return { distanceKm: roadKm, durationMin: durMin };
}

// In-memory cache keyed by rounded coordinates: "lon1,lat1:lon2,lat2" (5 decimal precision ~1 meter)
const MEMORY_CACHE = new Map<string, { distanceKm: number; durationMin: number; source: PairSource }>();
const CACHE_STORAGE_KEY = 'gridpoint_osrm_cache_v1';

export function clearMatrixCache(): void {
  MEMORY_CACHE.clear();
  try {
    localStorage.removeItem(CACHE_STORAGE_KEY);
  } catch {
    // Ignore storage issues
  }
}

function getCoordKey(lon: number, lat: number): string {
  return `${lon.toFixed(5)},${lat.toFixed(5)}`;
}

function getPairKey(src: LocationPoint, dst: LocationPoint): string {
  return `${getCoordKey(src.lng, src.lat)}:${getCoordKey(dst.lng, dst.lat)}`;
}

// Hydrate from localStorage once on load
try {
  const stored = localStorage.getItem(CACHE_STORAGE_KEY);
  if (stored) {
    const parsed = JSON.parse(stored);
    for (const [key, val] of Object.entries(parsed)) {
      MEMORY_CACHE.set(key, val as any);
    }
  }
} catch {
  // Safe storage access
}

function saveCacheToStorage(): void {
  try {
    // Persist up to 2000 entries to avoid localStorage quota issues
    const obj: Record<string, any> = {};
    let count = 0;
    for (const [key, val] of MEMORY_CACHE.entries()) {
      if (val.source === 'osrm') {
        obj[key] = val;
        count++;
        if (count >= 2000) break;
      }
    }
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // Ignore storage quota warnings
  }
}

/**
 * Fetch table chunk from OSRM Table Service with retries and timeout.
 */
async function fetchOsrmTableChunk(
  sources: LocationPoint[],
  destinations: LocationPoint[],
  baseUrl: string = OSRM_BASE_URL,
  signal?: AbortSignal
): Promise<{ distances: number[][]; durations: number[][] } | null> {
  // Combine all coordinates: sources first, then destinations
  const allPoints = [...sources, ...destinations];
  const coordString = allPoints.map((p) => `${p.lng},${p.lat}`).join(';');
  const sourceIndices = sources.map((_, i) => i).join(';');
  const destIndices = destinations.map((_, i) => sources.length + i).join(';');

  const url = `${baseUrl}/table/v1/driving/${coordString}?sources=${sourceIndices}&destinations=${destIndices}&annotations=distance,duration`;

  let lastError: any = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const combinedSignal = signal;

      // Handle aborted signal
      if (combinedSignal?.aborted) return null;

      const res = await fetch(url, { signal: combinedSignal || controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`OSRM HTTP error: ${res.status}`);
      }

      const data = await res.json();
      if (data.code === 'Ok' && Array.isArray(data.distances) && Array.isArray(data.durations)) {
        return {
          distances: data.distances,
          durations: data.durations,
        };
      }
    } catch (err: any) {
      lastError = err;
      if (err.name === 'AbortError') break;
      // Exponential backoff before retry
      await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
    }
  }

  console.warn('OSRM Table request failed, will use Haversine detour fallback', lastError);
  return null;
}

/**
 * Compute road matrix for M candidate hubs and N zones.
 * Chunked automatically to keep coordinate URLs under safe size limits.
 */
export async function computeRoadMatrix(
  sources: LocationPoint[],
  destinations: LocationPoint[],
  options?: {
    baseUrl?: string;
    signal?: AbortSignal;
    onProgress?: (progress: number) => void;
  }
): Promise<OsrmMatrixResult> {
  const distancesKm: Record<string, Record<string, number>> = {};
  const durationsMin: Record<string, Record<string, number>> = {};
  const pairSource: Record<string, PairSource> = {};

  // Initialize output tables
  for (const src of sources) {
    distancesKm[src.id] = {};
    durationsMin[src.id] = {};
  }

  let osrmCount = 0;
  let estimatedCount = 0;
  let totalPairs = sources.length * destinations.length;
  let totalDetourRatioSum = 0;
  let detourSampleCount = 0;

  // 1. Check Cache first for all pairs
  const uncachedPairs: { src: LocationPoint; dst: LocationPoint }[] = [];

  for (const src of sources) {
    for (const dst of destinations) {
      const cacheKey = getPairKey(src, dst);
      const cached = MEMORY_CACHE.get(cacheKey);

      if (cached) {
        distancesKm[src.id][dst.id] = cached.distanceKm;
        durationsMin[src.id][dst.id] = cached.durationMin;
        pairSource[`${src.id}:${dst.id}`] = cached.source;

        if (cached.source === 'osrm') {
          osrmCount++;
          const straight = haversineKm(src.lat, src.lng, dst.lat, dst.lng);
          if (straight > 0.1) {
            totalDetourRatioSum += cached.distanceKm / straight;
            detourSampleCount++;
          }
        } else {
          estimatedCount++;
        }
      } else {
        uncachedPairs.push({ src, dst });
      }
    }
  }

  // 2. If all pairs cached, return immediately (<15 ms)
  if (uncachedPairs.length === 0) {
    const avgDetour = detourSampleCount > 0 ? totalDetourRatioSum / detourSampleCount : DEFAULT_ROAD_DETOUR_FACTOR;
    const status =
      estimatedCount === 0 ? 'all_road' : osrmCount === 0 ? 'all_haversine' : 'mixed';

    return {
      distancesKm,
      durationsMin,
      pairSource,
      status,
      osrmCount,
      estimatedCount,
      totalPairs,
      avgDetourRatio: Math.round(avgDetour * 100) / 100,
    };
  }

  // 3. For uncached pairs, group into chunks of at most 20 sources and 30 destinations
  // (Total coordinates per chunk <= 50, well within OSRM URI length limits)
  const CHUNK_SRC_SIZE = 15;
  const CHUNK_DST_SIZE = 25;

  // Distinct sources and destinations that need lookup
  const neededSrcMap = new Map<string, LocationPoint>();
  const neededDstMap = new Map<string, LocationPoint>();

  for (const pair of uncachedPairs) {
    neededSrcMap.set(pair.src.id, pair.src);
    neededDstMap.set(pair.dst.id, pair.dst);
  }

  const neededSources = Array.from(neededSrcMap.values());
  const neededDests = Array.from(neededDstMap.values());

  let hasNewOsrmData = false;

  for (let sIdx = 0; sIdx < neededSources.length; sIdx += CHUNK_SRC_SIZE) {
    const srcChunk = neededSources.slice(sIdx, sIdx + CHUNK_SRC_SIZE);

    for (let dIdx = 0; dIdx < neededDests.length; dIdx += CHUNK_DST_SIZE) {
      if (options?.signal?.aborted) break;

      const dstChunk = neededDests.slice(dIdx, dIdx + CHUNK_DST_SIZE);
      const chunkResult = await fetchOsrmTableChunk(srcChunk, dstChunk, options?.baseUrl, options?.signal);

      for (let i = 0; i < srcChunk.length; i++) {
        const src = srcChunk[i];
        for (let j = 0; j < dstChunk.length; j++) {
          const dst = dstChunk[j];
          const pairId = `${src.id}:${dst.id}`;
          const cacheKey = getPairKey(src, dst);

          // If already resolved in this pass, skip
          if (distancesKm[src.id][dst.id] !== undefined) continue;

          let distKm: number;
          let durMin: number;
          let source: PairSource;

          const rawDistM = chunkResult?.distances?.[i]?.[j];
          const rawDurS = chunkResult?.durations?.[i]?.[j];

          if (rawDistM !== null && rawDistM !== undefined && !isNaN(rawDistM) && rawDistM >= 0) {
            distKm = Math.round((rawDistM / 1000.0) * 1000) / 1000;
            durMin = Math.round(((rawDurS || (distKm / DEFAULT_AVG_SPEED_KMH) * 3600) / 60.0) * 10) / 10;
            source = 'osrm';
            osrmCount++;
            hasNewOsrmData = true;

            const straight = haversineKm(src.lat, src.lng, dst.lat, dst.lng);
            if (straight > 0.1) {
              totalDetourRatioSum += distKm / straight;
              detourSampleCount++;
            }
          } else {
            // Deterministic Haversine Detour fallback
            const fallback = haversineDetourFallback(src.lat, src.lng, dst.lat, dst.lng);
            distKm = fallback.distanceKm;
            durMin = fallback.durationMin;
            source = 'haversine';
            estimatedCount++;
          }

          distancesKm[src.id][dst.id] = distKm;
          durationsMin[src.id][dst.id] = durMin;
          pairSource[pairId] = source;

          // Save to memory cache
          MEMORY_CACHE.set(cacheKey, { distanceKm: distKm, durationMin: durMin, source });
        }
      }
    }
  }

  // Ensure any lingering unassigned pairs have fallback
  for (const src of sources) {
    for (const dst of destinations) {
      if (distancesKm[src.id][dst.id] === undefined) {
        const fallback = haversineDetourFallback(src.lat, src.lng, dst.lat, dst.lng);
        distancesKm[src.id][dst.id] = fallback.distanceKm;
        durationsMin[src.id][dst.id] = fallback.durationMin;
        pairSource[`${src.id}:${dst.id}`] = 'haversine';
        estimatedCount++;
      }
    }
  }

  if (hasNewOsrmData) {
    saveCacheToStorage();
  }

  const avgDetour = detourSampleCount > 0 ? totalDetourRatioSum / detourSampleCount : DEFAULT_ROAD_DETOUR_FACTOR;
  const status =
    estimatedCount === 0 ? 'all_road' : osrmCount === 0 ? 'all_haversine' : 'mixed';

  return {
    distancesKm,
    durationsMin,
    pairSource,
    status,
    osrmCount,
    estimatedCount,
    totalPairs,
    avgDetourRatio: Math.round(avgDetour * 100) / 100,
  };
}

export const fetchRoadDistanceMatrix = computeRoadMatrix;
