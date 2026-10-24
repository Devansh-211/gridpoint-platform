import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CandidatesTable } from './CandidatesTable';
import { SiteScoreItem } from '../types';

const MOCK_CANDIDATES: SiteScoreItem[] = [
  {
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
    reason: 'Part of globally optimal CFLP configuration',
  },
  {
    plot_id: 'BLR-PL-02',
    locality: 'Yeshwanthpur Industrial Suburb',
    lat: 13.0238,
    lng: 77.5401,
    area_sq_ft: 40000,
    zoning_type: 'Commercial / Logistics',
    capacity_orders_per_day: 3200,
    daily_lease_inr: 16000,
    gravity_score: 88.5,
    avg_distance_top_20pct_km: 8.5,
    effective_daily_lease_inr: 16000,
    regret_inr: 1820,
    regret_estimated: false,
    status: 'RUNNER_UP',
    reason: 'Selected in Rank #2 configuration (+1.8% daily network cost)',
  },
  {
    plot_id: 'BLR-PL-03',
    locality: 'Whitefield Export Promotion Industrial Park',
    lat: 12.9698,
    lng: 77.7500,
    area_sq_ft: 55000,
    zoning_type: 'Industrial / Tech Logistics',
    capacity_orders_per_day: 4400,
    daily_lease_inr: 17416,
    gravity_score: 72.1,
    avg_distance_top_20pct_km: 18.2,
    effective_daily_lease_inr: 17416,
    regret_inr: 9400,
    regret_estimated: false,
    status: 'REJECTED',
    reason: 'Screened out due to excessive peripheral transit regret',
  },
];

describe('CandidatesTable Component', () => {
  it('renders all candidates with locality, plot ID, and status badges', () => {
    render(
      <CandidatesTable
        candidates={MOCK_CANDIDATES}
        currency="INR"
      />
    );

    expect(screen.getByText('Peenya Industrial Area')).toBeDefined();
    expect(screen.getByText('BLR-PL-01')).toBeDefined();
    expect(screen.getByText('Yeshwanthpur Industrial Suburb')).toBeDefined();
    expect(screen.getByText('BLR-PL-02')).toBeDefined();
    expect(screen.getByText('Whitefield Export Promotion Industrial Park')).toBeDefined();
  });

  it('renders table headers with proper aria-sort attributes', () => {
    render(
      <CandidatesTable
        candidates={MOCK_CANDIDATES}
        currency="INR"
      />
    );

    const headers = screen.getAllByRole('columnheader');
    expect(headers.length).toBeGreaterThan(0);
    // Initial sort is regret_inr ascending
    const regretHeader = headers.find((h) => h.textContent?.includes('Regret'));
    expect(regretHeader?.getAttribute('aria-sort')).toBe('ascending');
  });

  it('sorts rows when column headers are clicked', () => {
    render(
      <CandidatesTable
        candidates={MOCK_CANDIDATES}
        currency="INR"
      />
    );

    const localityTh = screen.getByRole('columnheader', { name: /locality/i });
    fireEvent.click(localityTh);

    expect(localityTh.getAttribute('aria-sort')).toBe('ascending');
  });

  it('filters candidates by status (Selected, Runner-up, Rejected)', () => {
    render(
      <CandidatesTable
        candidates={MOCK_CANDIDATES}
        currency="INR"
      />
    );

    const statusFilter = screen.getByLabelText('Filter candidates by status');
    fireEvent.change(statusFilter, { target: { value: 'SELECTED' } });

    expect(screen.getByText('Peenya Industrial Area')).toBeDefined();
    expect(screen.queryByText('Whitefield Export Promotion Industrial Park')).toBeNull();
  });

  it('fires onSelectSite callback when a row is clicked', () => {
    let selected: string | null = null;
    render(
      <CandidatesTable
        candidates={MOCK_CANDIDATES}
        currency="INR"
        onSelectSite={(id) => {
          selected = id;
        }}
      />
    );

    const row = screen.getByText('Peenya Industrial Area').closest('tr');
    if (row) {
      fireEvent.click(row);
      expect(selected).toBe('BLR-PL-01');
    }
  });
});
