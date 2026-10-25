import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { getNextZoneId, getNextHubId, isDemoRegion, EditableZone, EditableHub } from '../lib/networkState';
import { pickSpecificLabel, buildFullAddress, PhotonPlaceResult } from '../services/photonService';
import { checkIsOutlier } from '../lib/geoBounds';
import { PhotonSearch } from '../components/PhotonSearch';

describe('BUG 4: Add Location Dialog Polish & Data Handling', () => {
  const existingDemoZones: EditableZone[] = [
    { id: 'ZN-BLR-01', name: 'Koramangala', lat: 12.9352, lng: 77.6245, baseOrders: 400, multiplier: 1, source: 'demo' },
    { id: 'ZN-BLR-36', name: 'Whitefield', lat: 12.9698, lng: 77.7500, baseOrders: 350, multiplier: 1, source: 'demo' },
  ];

  const existingDemoHubs: EditableHub[] = [
    { id: 'HUB-BLR-01', name: 'Central Depot', lat: 12.9716, lng: 77.5946, capacity: 5000, dailyLease: 15000, source: 'demo' },
    { id: 'HUB-BLR-06', name: 'Peenya Depot', lat: 13.0285, lng: 77.5197, capacity: 4000, dailyLease: 12000, source: 'demo' },
  ];

  describe('Auto ID Generation (Demo Region vs Non-Demo)', () => {
    it('generates ZN-BLR-### / HUB-BLR-### for points in the Bengaluru demo region', () => {
      // Point in Bengaluru (Indiranagar: 12.9719, 77.6412)
      const blrPoint = { lat: 12.9719, lng: 77.6412 };
      expect(isDemoRegion(blrPoint.lat, blrPoint.lng)).toBe(true);

      const nextZoneId = getNextZoneId(existingDemoZones, blrPoint);
      expect(nextZoneId).toBe('ZN-BLR-37');

      const nextHubId = getNextHubId(existingDemoHubs, blrPoint);
      expect(nextHubId).toBe('HUB-BLR-7');
    });

    it('generates ZN-### / HUB-### (without BLR prefix) for points outside the demo region (e.g. Chennai)', () => {
      // Chennai coordinates (~290 km from Bengaluru)
      const chennaiPoint = { lat: 13.0827, lng: 80.2707 };
      expect(isDemoRegion(chennaiPoint.lat, chennaiPoint.lng)).toBe(false);

      const nextZoneId = getNextZoneId(existingDemoZones, chennaiPoint);
      expect(nextZoneId).toBe('ZN-037');
      expect(nextZoneId).not.toContain('BLR');

      const nextHubId = getNextHubId(existingDemoHubs, chennaiPoint);
      expect(nextHubId).toBe('HUB-007');
      expect(nextHubId).not.toContain('BLR');
    });

    it('guarantees unique IDs by incrementing when collisions exist', () => {
      const zonesWithCollision: EditableZone[] = [
        ...existingDemoZones,
        { id: 'ZN-037', name: 'Chennai Central', lat: 13.0827, lng: 80.2707, baseOrders: 300, multiplier: 1, source: 'search' },
      ];

      const chennaiPoint = { lat: 13.0827, lng: 80.2707 };
      const nextZoneId = getNextZoneId(zonesWithCollision, chennaiPoint);
      expect(nextZoneId).toBe('ZN-038');
    });
  });

  describe('Label Specificity Order (name → street → suburb/locality → district → city)', () => {
    it('prefers name when available', () => {
      const props = { name: 'Forum Mall', street: 'Hosur Road', suburb: 'Koramangala', city: 'Bengaluru' };
      expect(pickSpecificLabel(props)).toBe('Forum Mall');
    });

    it('falls back to street when name is missing', () => {
      const props = { street: '100 Feet Road', suburb: 'Indiranagar', district: 'Bengaluru Urban', city: 'Bengaluru' };
      expect(pickSpecificLabel(props)).toBe('100 Feet Road');
    });

    it('falls back to suburb/locality instead of just city name', () => {
      const props = { suburb: 'Koramangala', city: 'Bengaluru', district: 'Bengaluru Urban' };
      expect(pickSpecificLabel(props)).toBe('Koramangala');

      const localityProps = { locality: 'HSR Layout', city: 'Bengaluru' };
      expect(pickSpecificLabel(localityProps)).toBe('HSR Layout');
    });

    it('builds full address helper text with all available context', () => {
      const place: PhotonPlaceResult = {
        label: '',
        name: 'Koramangala',
        lat: 12.9352,
        lng: 77.6245,
        rawProperties: {
          suburb: 'Koramangala',
          district: 'Bengaluru Urban',
          city: 'Bengaluru',
          state: 'Karnataka',
          country: 'India',
        },
      };

      const fullAddr = buildFullAddress(place);
      expect(fullAddr).toContain('Koramangala');
      expect(fullAddr).toContain('Bengaluru');
      expect(fullAddr).toContain('Karnataka');
    });
  });

  describe('Outlier Notice Threshold (>100 km from network median center)', () => {
    it('detects points farther than 100 km and flags them as outliers', () => {
      const network = [
        { lat: 12.9352, lng: 77.6245 },
        { lat: 12.9716, lng: 77.5946 },
        { lat: 13.0285, lng: 77.5197 },
      ];

      // Chennai is ~290 km away
      const chennai = { lat: 13.0827, lng: 80.2707 };
      const outlier = checkIsOutlier(chennai, network, 100);
      expect(outlier.isOutlier).toBe(true);
      expect(outlier.distanceKm).toBeGreaterThan(250);

      // Electronic City (~15 km away) is NOT an outlier
      const electronicCity = { lat: 12.8452, lng: 77.6602 };
      const nonOutlier = checkIsOutlier(electronicCity, network, 100);
      expect(nonOutlier.isOutlier).toBe(false);
      expect(nonOutlier.distanceKm).toBeLessThan(30);
    });
  });

  describe('UI Component Polish & Synced Inputs', () => {
    it('renders node-type buttons without emoji icons', () => {
      const mockPlace: PhotonPlaceResult = {
        lat: 12.9716,
        lng: 77.5946,
        name: 'MG Road',
        label: 'MG Road, Bengaluru',
      };

      render(
        <PhotonSearch
          onAddZone={vi.fn()}
          onAddHub={vi.fn()}
          existingZones={existingDemoZones}
          existingHubs={existingDemoHubs}
          currency="INR"
          externalPlace={mockPlace}
          onClearExternalPlace={vi.fn()}
        />
      );

      // Node type buttons have clean text without 📦 or 🏭
      expect(screen.getByText('Delivery Zone')).toBeDefined();
      expect(screen.getByText('Candidate Hub')).toBeDefined();
      expect(screen.queryByText(/📦/)).toBeNull();
      expect(screen.queryByText(/🏭/)).toBeNull();
    });

    it('shows inline amber warning notice for outlier locations (>100 km)', () => {
      const chennaiPlace: PhotonPlaceResult = {
        lat: 13.0827,
        lng: 80.2707,
        name: 'Chennai Port',
        label: 'Chennai Port, Tamil Nadu',
      };

      render(
        <PhotonSearch
          onAddZone={vi.fn()}
          onAddHub={vi.fn()}
          existingZones={existingDemoZones}
          existingHubs={existingDemoHubs}
          currency="INR"
          externalPlace={chennaiPlace}
          onClearExternalPlace={vi.fn()}
        />
      );

      expect(screen.getByText(/Distant Location Warning/i)).toBeDefined();
      expect(screen.getByText(/distances and costs will be large/i)).toBeDefined();
    });

    it('keeps range slider and number input in sync with validation up to global max', () => {
      const mockPlace: PhotonPlaceResult = {
        lat: 12.9716,
        lng: 77.5946,
        name: 'MG Road',
        label: 'MG Road, Bengaluru',
      };

      render(
        <PhotonSearch
          onAddZone={vi.fn()}
          onAddHub={vi.fn()}
          existingZones={existingDemoZones}
          existingHubs={existingDemoHubs}
          currency="INR"
          externalPlace={mockPlace}
          onClearExternalPlace={vi.fn()}
        />
      );

      const numberInput = screen.getByLabelText(/^Daily Delivery Orders$/i) as HTMLInputElement;
      const slider = screen.getByLabelText(/Daily Delivery Orders Slider/i) as HTMLInputElement;

      // Initial value
      expect(numberInput.value).toBe('350');
      expect(slider.value).toBe('350');

      // Change number input to 1200
      fireEvent.change(numberInput, { target: { value: '1200' } });
      expect(numberInput.value).toBe('1200');
      expect(slider.value).toBe('1200');

      // Change number input to typed high value (e.g. 8000 > slider 5000 max)
      fireEvent.change(numberInput, { target: { value: '8000' } });
      expect(numberInput.value).toBe('8000');
      // Slider stays capped at its max 5000
      expect(slider.value).toBe('5000');
    });
  });
});
