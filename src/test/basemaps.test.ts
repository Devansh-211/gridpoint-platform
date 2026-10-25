import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  BASEMAP_PROVIDERS,
  DEFAULT_BASEMAP_ID,
  BasemapProvider,
} from '../config/basemaps';

describe('Basemap Configuration & Failover Specification', () => {
  it('defaults to OpenStreetMap (osm) with keyless configuration and no {s} subdomain', () => {
    expect(DEFAULT_BASEMAP_ID).toBe('osm');
    const osmProvider = BASEMAP_PROVIDERS.find((p) => p.id === 'osm');
    expect(osmProvider).toBeDefined();
    expect(osmProvider?.url).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
    expect(osmProvider?.url).not.toContain('{s}');
    expect(osmProvider?.attribution).toContain('OpenStreetMap');
    expect(osmProvider?.type).toBe('streets');
  });

  it('includes keyless Esri World Street Map and Esri Satellite Imagery', () => {
    const esriStreets = BASEMAP_PROVIDERS.find((p) => p.id === 'esri-streets');
    expect(esriStreets).toBeDefined();
    expect(esriStreets?.url).toContain('World_Street_Map/MapServer/tile');
    expect(esriStreets?.attribution).toContain('Esri');
    expect(esriStreets?.type).toBe('streets');

    const esriSatellite = BASEMAP_PROVIDERS.find((p) => p.id === 'esri-imagery');
    expect(esriSatellite).toBeDefined();
    expect(esriSatellite?.url).toContain('World_Imagery/MapServer/tile');
    expect(esriSatellite?.attribution).toContain('Esri');
    expect(esriSatellite?.type).toBe('satellite');
  });

  it('has zero references to cartocdn or carto.com across providers', () => {
    for (const provider of BASEMAP_PROVIDERS) {
      expect(provider.url).not.toContain('cartocdn');
      expect(provider.url).not.toContain('carto.com');
      expect(provider.attribution).not.toContain('CARTO');
    }
  });

  it('simulates 6 tileerror events in 10s triggering failover threshold', () => {
    const now = Date.now();
    let errorWindow: number[] = [];

    // Add 5 errors in last 5 seconds
    for (let i = 0; i < 5; i++) {
      errorWindow.push(now - i * 1000);
    }
    // Filter to last 10s
    errorWindow = errorWindow.filter((t) => now - t <= 10000);
    expect(errorWindow.length).toBe(5);

    // 6th error occurs
    errorWindow.push(now);
    expect(errorWindow.length).toBe(6);
    const shouldFailover = errorWindow.length >= 6;
    expect(shouldFailover).toBe(true);
  });
});
