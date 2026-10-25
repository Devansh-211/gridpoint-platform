import { describe, it, expect } from 'vitest';
import {
  haversineDistanceKm,
  calculateMedianCenter,
  calculateRobustBounds,
  checkIsOutlier,
  radiusKmToMeters,
} from '../lib/geoBounds';

describe('GeoBounds & Spatial Utilities', () => {
  // Sample Bengaluru coordinates clustered around ~12.97, ~77.59
  const bngCluster: [number, number][] = [
    [12.9716, 77.5946], // MG Road
    [12.9352, 77.6245], // Koramangala
    [12.9784, 77.6408], // Indiranagar
    [12.9698, 77.7500], // Whitefield
    [13.0358, 77.5970], // Hebbal
    [12.9063, 77.5857], // Jayanagar
  ];

  it('calculates great-circle distance accurately via haversine', () => {
    // MG Road to Koramangala is approx 5.0 - 5.5 km
    const dist = haversineDistanceKm(12.9716, 77.5946, 12.9352, 77.6245);
    expect(dist).toBeGreaterThan(4.5);
    expect(dist).toBeLessThan(6.0);
  });

  it('calculates median center accurately', () => {
    const center = calculateMedianCenter(
      bngCluster.map(([lat, lng]) => ({ lat, lng }))
    );
    expect(center).not.toBeNull();
    expect(center!.lat).toBeGreaterThan(12.9);
    expect(center!.lat).toBeLessThan(13.1);
    expect(center!.lng).toBeGreaterThan(77.5);
    expect(center!.lng).toBeLessThan(77.8);
  });

  it('excludes distant outliers (> 3x median distance) from robust bounds', () => {
    // Add Chennai (~13.08, 80.27, ~290 km away) as an extreme outlier
    const pointsWithOutlier: [number, number][] = [
      ...bngCluster,
      [13.0827, 80.2707], // Chennai
    ];

    const robust = calculateRobustBounds(pointsWithOutlier);
    expect(robust.length).toBe(bngCluster.length);

    // Chennai should not be in robust bounds
    const hasChennai = robust.some(
      ([lat, lng]) => Math.abs(lat - 13.0827) < 0.01 && Math.abs(lng - 80.2707) < 0.01
    );
    expect(hasChennai).toBe(false);
  });

  it('detects outlier locations beyond 100 km from network median center', () => {
    const networkPoints = bngCluster.map(([lat, lng]) => ({ lat, lng }));

    // Peenya (local, ~15 km away)
    const localPoint = { lat: 13.0329, lng: 77.5273 };
    const localCheck = checkIsOutlier(localPoint, networkPoints, 100);
    expect(localCheck.isOutlier).toBe(false);
    expect(localCheck.distanceKm).toBeLessThan(30);

    // Mysuru (~130 km away)
    const distantPoint = { lat: 12.2958, lng: 76.6394 };
    const distantCheck = checkIsOutlier(distantPoint, networkPoints, 100);
    expect(distantCheck.isOutlier).toBe(true);
    expect(distantCheck.distanceKm).toBeGreaterThan(100);
  });

  it('converts R_max (km) to meters for L.Circle and handles disabled state (null/<=0)', () => {
    expect(radiusKmToMeters(25)).toBe(25000);
    expect(radiusKmToMeters(10.5)).toBe(10500);
    expect(radiusKmToMeters(null)).toBeNull();
    expect(radiusKmToMeters(undefined)).toBeNull();
    expect(radiusKmToMeters(0)).toBeNull();
    expect(radiusKmToMeters(-5)).toBeNull();
  });
});
