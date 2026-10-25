/**
 * Geo Bounds & Spatial Calculation Utilities
 * Calculates robust network bounds excluding outliers, median centers, and distance thresholds.
 */

export interface LatLngPoint {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371.0;

/**
 * Great-circle distance between two geographic coordinates in kilometers.
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
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
 * Calculates median center (median latitude, median longitude) of a collection of points.
 */
export function calculateMedianCenter(points: LatLngPoint[]): LatLngPoint | null {
  if (points.length === 0) return null;
  const sortedLats = points.map((p) => p.lat).sort((a, b) => a - b);
  const sortedLngs = points.map((p) => p.lng).sort((a, b) => a - b);

  const mid = Math.floor(points.length / 2);
  const medianLat =
    points.length % 2 === 1
      ? sortedLats[mid]
      : (sortedLats[mid - 1] + sortedLats[mid]) / 2;
  const medianLng =
    points.length % 2 === 1
      ? sortedLngs[mid]
      : (sortedLngs[mid - 1] + sortedLngs[mid]) / 2;

  return { lat: medianLat, lng: medianLng };
}

/**
 * Filters out points farther than 3x the median distance from the median center.
 * If fewer than 2 points remain or no outliers exist, returns all points.
 */
export function calculateRobustBounds(
  points: [number, number][]
): [number, number][] {
  if (points.length <= 2) return points;

  const latLngPoints: LatLngPoint[] = points.map(([lat, lng]) => ({ lat, lng }));
  const center = calculateMedianCenter(latLngPoints);
  if (!center) return points;

  const distances = points.map(([lat, lng]) =>
    haversineDistanceKm(center.lat, center.lng, lat, lng)
  );

  const sortedDists = [...distances].sort((a, b) => a - b);
  const mid = Math.floor(sortedDists.length / 2);
  const medianDist =
    sortedDists.length % 2 === 1
      ? sortedDists[mid]
      : (sortedDists[mid - 1] + sortedDists[mid]) / 2;

  // 3x median distance threshold (safeguarded by minimum 2.0 km)
  const threshold = Math.max(medianDist * 3, 2.0);

  const inliers = points.filter((_, idx) => distances[idx] <= threshold);
  return inliers.length >= 2 ? inliers : points;
}

/**
 * Checks whether a location is more than 100 km from the median center of the network.
 */
export function checkIsOutlier(
  point: LatLngPoint,
  networkPoints: LatLngPoint[],
  thresholdKm = 100
): { isOutlier: boolean; distanceKm: number } {
  const center = calculateMedianCenter(networkPoints);
  if (!center) return { isOutlier: false, distanceKm: 0 };

  const dist = haversineDistanceKm(center.lat, center.lng, point.lat, point.lng);
  return {
    isOutlier: dist > thresholdKm,
    distanceKm: dist,
  };
}

/**
 * Converts R_max in kilometers to meters for L.Circle.
 * Returns null if disabled (null, undefined, or <= 0).
 */
export function radiusKmToMeters(radiusKm: number | null | undefined): number | null {
  if (radiusKm === null || radiusKm === undefined || radiusKm <= 0) {
    return null;
  }
  return radiusKm * 1000;
}
