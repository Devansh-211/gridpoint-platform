import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  haversineKm,
  haversineDetourFallback,
  computeRoadMatrix,
  clearMatrixCache,
  LocationPoint,
} from './osrmMatrixService';

describe('osrmMatrixService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMatrixCache();
  });

  const mockSources: LocationPoint[] = [
    { id: 'HUB-1', lat: 13.0292, lng: 77.5204, name: 'Peenya' },
    { id: 'HUB-2', lat: 12.9698, lng: 77.75, name: 'Whitefield' },
  ];

  const mockDests: LocationPoint[] = [
    { id: 'ZN-1', lat: 12.9352, lng: 77.6245, name: 'Koramangala' },
    { id: 'ZN-2', lat: 12.9784, lng: 77.6408, name: 'Indiranagar' },
  ];

  it('calculates great-circle Haversine distance accurately', () => {
    // Distance between Peenya (13.0292, 77.5204) and Koramangala (12.9352, 77.6245) is ~15.4 km
    const dist = haversineKm(13.0292, 77.5204, 12.9352, 77.6245);
    expect(dist).toBeGreaterThan(14.5);
    expect(dist).toBeLessThan(16.5);
  });

  it('calculates deterministic Haversine detour fallback with 1.34x factor', () => {
    const rawDist = haversineKm(13.0292, 77.5204, 12.9352, 77.6245);
    const fallback = haversineDetourFallback(13.0292, 77.5204, 12.9352, 77.6245);

    expect(fallback.distanceKm).toBeCloseTo(rawDist * 1.34, 1);
    expect(fallback.durationMin).toBeGreaterThan(0);
  });

  it('falls back seamlessly to Haversine detour when OSRM fetch fails', async () => {
    // Mock fetch to simulate network error
    global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

    const result = await computeRoadMatrix(mockSources, mockDests);

    expect(result.status).toBe('all_haversine');
    expect(result.estimatedCount).toBe(4);
    expect(result.osrmCount).toBe(0);
    expect(result.distancesKm['HUB-1']['ZN-1']).toBeGreaterThan(0);
    expect(result.pairSource['HUB-1:ZN-1']).toBe('haversine');
  });

  it('parses OSRM table response and caches pairs in memory', async () => {
    // Mock successful OSRM response
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          code: 'Ok',
          distances: [
            [20500, 18200], // HUB-1 to ZN-1, ZN-2 (meters)
            [16400, 14100], // HUB-2 to ZN-1, ZN-2 (meters)
          ],
          durations: [
            [2400, 2100], // seconds
            [1900, 1600],
          ],
        }),
    });

    const result = await computeRoadMatrix(mockSources, mockDests);

    expect(result.status).toBe('all_road');
    expect(result.osrmCount).toBe(4);
    expect(result.estimatedCount).toBe(0);
    expect(result.distancesKm['HUB-1']['ZN-1']).toBe(20.5);
    expect(result.durationsMin['HUB-1']['ZN-1']).toBe(40.0);
    expect(result.pairSource['HUB-1:ZN-1']).toBe('osrm');

    // Second call should hit the cache immediately without calling fetch
    const secondFetch = vi.fn();
    global.fetch = secondFetch;

    const tStart = performance.now();
    const cachedResult = await computeRoadMatrix(mockSources, mockDests);
    const elapsed = performance.now() - tStart;

    expect(secondFetch).not.toHaveBeenCalled();
    expect(cachedResult.distancesKm['HUB-1']['ZN-1']).toBe(20.5);
    expect(elapsed).toBeLessThan(50); // fast in-memory resolution
  });

  it('handles mixed responses when some OSRM entries return null', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          code: 'Ok',
          distances: [
            [20500, null], // Second pair unroutable in OSRM
            [null, 14100],
          ],
          durations: [
            [2400, null],
            [null, 1600],
          ],
        }),
    });

    const uniqueSources: LocationPoint[] = [
      { id: 'SRC-A', lat: 13.01, lng: 77.51, name: 'A' },
      { id: 'SRC-B', lat: 13.02, lng: 77.52, name: 'B' },
    ];
    const uniqueDests: LocationPoint[] = [
      { id: 'DST-A', lat: 12.91, lng: 77.61, name: 'X' },
      { id: 'DST-B', lat: 12.92, lng: 77.62, name: 'Y' },
    ];

    const result = await computeRoadMatrix(uniqueSources, uniqueDests);

    expect(result.status).toBe('mixed');
    expect(result.osrmCount).toBe(2);
    expect(result.estimatedCount).toBe(2);
    expect(result.pairSource['SRC-A:DST-A']).toBe('osrm');
    expect(result.pairSource['SRC-A:DST-B']).toBe('haversine');
  });
});
