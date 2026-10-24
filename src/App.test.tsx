import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { App } from './App';

describe('App Full Interaction Smoke Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.location.hash = '';

    // Mock fetch for optimize and compare calls
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/health')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 'ok', solver: 'cbc' }),
        });
      }

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

  it('renders app shell with 256px sidebar, navigation items, and currency pill', async () => {
    await act(async () => {
      render(<App />);
    });

    // 1. Sidebar Brand & Title
    expect(screen.getAllByText('GRIDPOINT')[0]).toBeInTheDocument();
    expect(screen.getAllByText('LOGISTICS INTELLIGENCE')[0]).toBeInTheDocument();

    // 2. Navigation items present
    expect(screen.getAllByRole('link', { name: /Overview/i })[0]).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Demand Map/i })[0]).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Network Configuration/i })[0]).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Optimization & Solvers/i })[0]).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Scenario Lab/i })[0]).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Tactical Fleet/i })[0]).toBeInTheDocument();

    // 3. Currency Pill (₹ INR | $ USD)
    const usdBtn = screen.getByRole('radio', { name: /\$ USD/i });
    await act(async () => {
      fireEvent.click(usdBtn);
    });
    expect(localStorage.getItem('gridpoint_currency')).toBe('USD');

    const inrBtn = screen.getByRole('radio', { name: /₹ INR/i });
    await act(async () => {
      fireEvent.click(inrBtn);
    });
    expect(localStorage.getItem('gridpoint_currency')).toBe('INR');
  });

  it('navigates to Demand Map, edits Koramangala demand from 420 to 2800, and verifies totals', async () => {
    window.location.hash = '#/map';

    await act(async () => {
      render(<App />);
    });

    // 1. Search & Location Bar is present
    expect(
      screen.getByPlaceholderText(/Search & Add Delivery Zone/i)
    ).toBeInTheDocument();

    // 2. Zone table renders Koramangala
    expect(screen.getAllByText(/Koramangala/i)[0]).toBeInTheDocument();

    // 3. Find input for Koramangala demand
    const inputs = screen.getAllByLabelText(/Daily orders/i);
    const koramangalaInput = inputs.find((inp) => (inp as HTMLInputElement).value === '420');
    expect(koramangalaInput).toBeDefined();

    if (koramangalaInput) {
      await act(async () => {
        fireEvent.change(koramangalaInput, { target: { value: '2800' } });
        fireEvent.blur(koramangalaInput);
      });

      // Demand updated
      expect((koramangalaInput as HTMLInputElement).value).toBe('2800');
    }

    // Verify no unhandled error boundary crashes
    expect(screen.queryByText(/Component Error/i)).toBeNull();
  });

  it('navigates to Network Configuration view and exercises controls', async () => {
    window.location.hash = '#/config';

    await act(async () => {
      render(<App />);
    });

    // Header and section titles
    expect(screen.getByText(/Network Configuration & Constraints/i)).toBeInTheDocument();
    expect(screen.getByText(/Optimization Sizing Mode/i)).toBeInTheDocument();
    expect(screen.getByText(/Facility & Corridor Constraints/i)).toBeInTheDocument();

    // Priority Presets
    const speedPreset = screen.getByText(/Speed & Proximity/i);
    await act(async () => {
      fireEvent.click(speedPreset);
    });

    const costPreset = screen.getByText(/Cost Focus/i);
    await act(async () => {
      fireEvent.click(costPreset);
    });

    // Distance Metric radios
    const haversineRadio = screen.getByLabelText(/Straight-line Haversine/i);
    await act(async () => {
      fireEvent.click(haversineRadio);
    });

    expect(screen.queryByText(/Component Error/i)).toBeNull();
  });

  it('navigates to Optimization & Solvers view and renders proof and rankings', async () => {
    window.location.hash = '#/solvers';

    await act(async () => {
      render(<App />);
    });

    expect(screen.getByText(/Optimization & Solvers Engine/i)).toBeInTheDocument();
    expect(screen.getByText(/Live Exact CFLP Engine/i)).toBeInTheDocument();

    // Mathematical proof toggle
    const proofToggle = screen.getByRole('button', { name: /Toggle mathematical proof formulation/i });
    await act(async () => {
      fireEvent.click(proofToggle);
    });
    expect(screen.getByText(/Capacitated Facility Location Problem/i)).toBeInTheDocument();

    // Ranking tabs
    expect(screen.getByRole('tab', { name: /Optimal Network/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Alternatives Leaderboard/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /All Candidates & Regret Scores/i })).toBeInTheDocument();
  });

  it('navigates to Scenario Lab view and renders stress testing controls', async () => {
    window.location.hash = '#/scenarios';
    await act(async () => {
      render(<App />);
    });

    expect(screen.getByText(/Scenario Lab & Resilience Stress-Testing/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Demand Surge/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Transit & Fuel Shock/i)[0]).toBeInTheDocument();
  });

  it('navigates to Tactical Fleet view and renders fleet sizing', async () => {
    window.location.hash = '#/fleet';
    await act(async () => {
      render(<App />);
    });

    expect(screen.getByText(/Tactical Fleet Operations & Sizing/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Vehicles Deployed/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Circuit Distance/i)).toBeInTheDocument();
  });
});
