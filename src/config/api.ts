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

/**
 * Vehicle batch consolidation factor: average customer orders delivered per delivery vehicle trip.
 * Used to convert vehicle transit cost (cost_per_km, e.g. ₹35/km) to per-order-km transit cost:
 * cost_per_order_km = cost_per_km / ORDERS_PER_DELIVERY_TRIP (e.g. ₹35 / 50 = ₹0.70 / ord·km).
 */
export const ORDERS_PER_DELIVERY_TRIP = 50.0;
