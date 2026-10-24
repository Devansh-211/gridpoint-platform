/**
 * Keyless, Free GIS and Routing API Configuration
 * Defaulting to official public instances with override support via Vite env vars.
 */

export const OSRM_BASE_URL: string =
  ((import.meta as any).env?.VITE_OSRM_BASE_URL as string) || 'https://router.project-osrm.org';

export const PHOTON_BASE_URL: string =
  ((import.meta as any).env?.VITE_PHOTON_BASE_URL as string) || 'https://photon.komoot.io';

// Average free-flow speed assumption for Bangalore metropolitan deliveries
export const DEFAULT_AVG_SPEED_KMH = 24.0;
// Empirical road-to-Euclidean detour ratio
export const DEFAULT_ROAD_DETOUR_FACTOR = 1.34;
