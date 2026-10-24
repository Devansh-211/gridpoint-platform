import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RegistryDrawer } from './RegistryDrawer';
import { SiteScoreItem } from '../types';

const MOCK_SITE: SiteScoreItem = {
  plot_id: 'BLR-PL-01',
  locality: 'Peenya Industrial Area',
  lat: 13.0292,
  lng: 77.5204,
  area_sq_ft: 45000,
  zoning_type: 'Industrial (Hi-Tech / Manufacturing)',
  capacity_orders_per_day: 3600,
  daily_lease_inr: 15000,
  gravity_score: 94.2,
  avg_distance_top_20pct_km: 7.8,
  effective_daily_lease_inr: 15000,
  regret_inr: 0,
  regret_estimated: false,
  status: 'SELECTED',
  reason: 'Optimal depot site',
};

describe('RegistryDrawer Component', () => {
  it('renders nothing when isDemoMode is false', () => {
    const { container } = render(
      <RegistryDrawer
        site={MOCK_SITE}
        isOpen={true}
        onClose={() => {}}
        currency="INR"
        isDemoMode={false}
      />
    );

    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when site is null', () => {
    const { container } = render(
      <RegistryDrawer
        site={null}
        isOpen={true}
        onClose={() => {}}
        currency="INR"
        isDemoMode={true}
      />
    );

    expect(container.innerHTML).toBe('');
  });

  it('renders drawer header, demo badge, and official portals when open in demo mode', () => {
    render(
      <RegistryDrawer
        site={MOCK_SITE}
        isOpen={true}
        onClose={() => {}}
        currency="INR"
        isDemoMode={true}
      />
    );

    expect(screen.getAllByText('BLR-PL-01').length).toBeGreaterThan(0);
    expect(screen.getByText('Demo template')).toBeDefined();
    expect(screen.getByText('Official Government Portals')).toBeDefined();
    expect(screen.getByText('Bhoomi RTC Portal')).toBeDefined();
    expect(screen.getByText('Karnataka GIS (KGIS)')).toBeDefined();
  });

  it('maintains data honesty: all official record fields start empty with input placeholders', () => {
    render(
      <RegistryDrawer
        site={MOCK_SITE}
        isOpen={true}
        onClose={() => {}}
        currency="INR"
        isDemoMode={true}
      />
    );

    const inputs = screen.getAllByPlaceholderText('Not available, enter from the official record');
    expect(inputs.length).toBe(4);
    inputs.forEach((input) => {
      expect((input as HTMLInputElement).value).toBe('');
    });
  });
});
