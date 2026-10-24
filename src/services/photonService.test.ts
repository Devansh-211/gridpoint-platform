import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildPhotonLabel,
  searchPhotonPlaces,
  reverseGeocodePhoton,
  clearPhotonCache,
} from './photonService';

describe('photonService', () => {
  beforeEach(() => {
    clearPhotonCache();
    vi.restoreAllMocks();
  });

  it('correctly builds human readable labels without synthetic data', () => {
    const props = {
      name: 'MG Road',
      district: 'Bengaluru Urban',
      state: 'Karnataka',
    };
    const res = buildPhotonLabel(props, 12.975, 77.608);
    expect(res.name).toBe('MG Road');
    expect(res.suburbOrDistrict).toBe('Bengaluru Urban');
    expect(res.label).toBe('MG Road, Bengaluru Urban, Karnataka');
  });

  it('correctly extracts coordinates in [lat, lng] format from GeoJSON [lon, lat]', async () => {
    const mockGeoJson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [77.6408, 12.9784], // [lon, lat]
          },
          properties: {
            name: 'Indiranagar Metro',
            city: 'Bengaluru',
            state: 'Karnataka',
          },
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockGeoJson,
    } as any);

    const results = await searchPhotonPlaces('Indiranagar');
    expect(results.length).toBe(1);
    expect(results[0].lat).toBe(12.9784);
    expect(results[0].lng).toBe(77.6408);
    expect(results[0].name).toBe('Indiranagar Metro');
  });

  it('falls back to dropped pin label if reverse geocode fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

    const result = await reverseGeocodePhoton(12.9123, 77.6456);
    expect(result.label).toContain('Dropped pin (12.9123, 77.6456)');
    expect(result.lat).toBe(12.9123);
    expect(result.lng).toBe(77.6456);
  });
});
