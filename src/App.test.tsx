import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { App } from './App';

describe('App Full Interaction Smoke Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Mock fetch for optimize and compare calls
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/optimize')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              status: 'Optimal',
              solver_message: 'Optimal solution found',
              is_optimal: true,
              p: 3,
              auto_size: false,
              total_weighted_distance_km: 1250.5,
              average_distance_km: 7.2,
              total_delivery_cost: 43750,
              total_infrastructure_cost: 45000,
              combined_total_cost: 88750,
              total_system_capacity: 12000,
              total_system_demand: 10450,
              capacity_headroom: 1550,
              capacity_headroom_pct: 12.9,
              coverage_percentage: 100,
              fast_delivery_coverage_pct: 88.5,
              unserved_demand: 0,
              estimated_co2_kg_per_day: 312.5,
              co2_baseline_kg_per_day: 485.0,
              co2_reduction_pct: 35.6,
              estimated_monthly_savings: 420000,
              assumptions: { radius_max_km: 25 },
              warehouses: [
                {
                  warehouse_id: 'W1',
                  name: 'Peenya Industrial Area',
                  latitude: 13.0285,
                  longitude: 77.5197,
                  capacity: 4000,
                  assigned_demand: 3800,
                  capacity_required: 3800,
                  capacity_ceiling: 4000,
                  capacity_utilization_pct: 95.0,
                  neighborhoods_count: 12,
                },
              ],
              assignments: [],
              solve_ms: 124.5,
              mip_gap: 0.0,
            }),
        });
      }

      if (url.includes('/api/compare')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              baseline: {
                label: 'Single-Warehouse Centroid Baseline',
                warehouses_count: 1,
                warehouses_open: ['Centroid Hub'],
                total_delivery_cost: 95000,
                total_infrastructure_cost: 15000,
                combined_total_cost: 110000,
                total_distance_km: 2714.2,
                weighted_distance_km: 2714.2,
                avg_capacity_utilization_pct: 100,
                estimated_co2_kg_per_day: 485.0,
              },
              optimized: {
                label: 'Optimal 3-Warehouse CFLP Network',
                warehouses_count: 3,
                warehouses_open: ['Peenya', 'Whitefield', 'Electronic City'],
                total_delivery_cost: 43750,
                total_infrastructure_cost: 45000,
                combined_total_cost: 88750,
                total_distance_km: 1250.5,
                weighted_distance_km: 1250.5,
                avg_capacity_utilization_pct: 87.1,
                estimated_co2_kg_per_day: 312.5,
              },
              cost_delta: -21250,
              cost_pct_change: -19.3,
              distance_delta_km: -1463.7,
              distance_pct_change: -53.9,
              weighted_distance_delta: -1463.7,
              weighted_distance_pct_change: -53.9,
              estimated_monthly_savings: 637500,
              co2_delta_kg: -172.5,
              co2_pct_change: -35.6,
              assumptions: {},
            }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
  });

  it('renders without crashing and supports complete user interaction workflow', async () => {
    await act(async () => {
      render(<App />);
    });

    // 1. Initial Render Check
    expect(screen.getByText('GRIDPOINT')).toBeInTheDocument();
    expect(screen.getByText(/B2B Network Optimizer/i)).toBeInTheDocument();

    // 2. Currency Toggle (INR -> USD -> INR)
    const usdRadio = screen.getByRole('radio', { name: /\$ USD/i });
    await act(async () => {
      fireEvent.click(usdRadio);
    });
    expect(localStorage.getItem('gridpoint_currency')).toBe('USD');

    const inrRadio = screen.getByRole('radio', { name: /₹ INR/i });
    await act(async () => {
      fireEvent.click(inrRadio);
    });
    expect(localStorage.getItem('gridpoint_currency')).toBe('INR');

    // 3. Header Logistics Assistant button opens drawer
    const assistantBtn = screen.getByRole('button', { name: /Logistics Assistant/i });
    await act(async () => {
      fireEvent.click(assistantBtn);
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Close assistant
    const closeAssistantBtn = screen.getByTitle('Close Assistant');
    await act(async () => {
      fireEvent.click(closeAssistantBtn);
    });
    expect(screen.queryByRole('dialog')).toBeNull();

    // 4. Floating Action Button opens assistant
    const fabBtn = screen.getByTitle('Open Logistics AI Assistant (Quick Action)');
    await act(async () => {
      fireEvent.click(fabBtn);
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(screen.queryByRole('dialog')).toBeNull();

    // 5. Why GridPoint collapsible toggle
    const whyBtn = screen.getByTitle('Open why GridPoint comparison');
    await act(async () => {
      fireEvent.click(whyBtn);
    });
    expect(screen.getAllByText(/Algorithmic Transparency/i)[0]).toBeInTheDocument();

    // 6. Mathematical Proof collapsible toggle
    const proofToggle = screen.getByRole('button', { name: /Toggle mathematical proof formulation/i });
    await act(async () => {
      fireEvent.click(proofToggle);
    });
    expect(screen.getByText(/Capacitated Facility Location Problem/i)).toBeInTheDocument();

    // 7. Tabs in Ranking Section are rendered
    expect(screen.getByRole('tab', { name: /Optimal Network/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Alternatives Leaderboard/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /All Candidates & Regret Scores/i })).toBeInTheDocument();

    // 8. Control Panel Presets
    const speedPresetBtn = screen.getByRole('button', { name: /Speed \/ Quick Commerce/i });
    await act(async () => {
      fireEvent.click(speedPresetBtn);
    });

    const costPresetBtn = screen.getByRole('button', { name: /Cost Focus/i });
    await act(async () => {
      fireEvent.click(costPresetBtn);
    });

    // 9. Solve Button trigger
    const solveBtn = screen.getByRole('button', { name: /Solve Network Topology/i });
    await act(async () => {
      fireEvent.click(solveBtn);
    });

    // Verify no unhandled error boundary crashes
    expect(screen.queryByText(/Component Error/i)).toBeNull();
  });
});
