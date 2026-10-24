import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { App } from '../App';

describe('Click-Everything Smoke Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.location.hash = '';

    // Mock fetch for backend API calls
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

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
  });

  it('navigates seamlessly across all six routes via the sidebar nav items', async () => {
    await act(async () => {
      render(<App />);
    });

    // 1. Initial Overview Route
    expect(screen.getByRole('heading', { level: 1, name: /executive network overview/i })).toBeInTheDocument();

    // 2. Click Demand Map in Sidebar
    const mapNav = screen.getAllByRole('link', { name: /demand map/i })[0];
    await act(async () => {
      fireEvent.click(mapNav);
    });
    expect(screen.getByRole('heading', { level: 1, name: /demand map & catchment topology/i })).toBeInTheDocument();

    // 3. Click Network Configuration in Sidebar
    const configNav = screen.getAllByRole('link', { name: /network configuration/i })[0];
    await act(async () => {
      fireEvent.click(configNav);
    });
    expect(screen.getByRole('heading', { level: 1, name: /network configuration & constraints/i })).toBeInTheDocument();

    // 4. Click Optimization & Solvers in Sidebar
    const solversNav = screen.getAllByRole('link', { name: /optimization & solvers/i })[0];
    await act(async () => {
      fireEvent.click(solversNav);
    });
    expect(screen.getByRole('heading', { level: 1, name: /optimization & solvers engine/i })).toBeInTheDocument();

    // 5. Click Scenario Lab in Sidebar
    const scenariosNav = screen.getAllByRole('link', { name: /scenario lab/i })[0];
    await act(async () => {
      fireEvent.click(scenariosNav);
    });
    expect(screen.getByRole('heading', { level: 1, name: /scenario lab & resilience stress-testing/i })).toBeInTheDocument();

    // 6. Click Tactical Fleet in Sidebar
    const fleetNav = screen.getAllByRole('link', { name: /tactical fleet/i })[0];
    await act(async () => {
      fireEvent.click(fleetNav);
    });
    expect(screen.getByRole('heading', { level: 1, name: /tactical fleet operations & sizing/i })).toBeInTheDocument();
  });

  it('tests Demand Map interactive controls: map-click mode, Esc dismiss, and auto-reoptimize toggle', async () => {
    await act(async () => {
      render(<App />);
    });

    // Navigate to Demand Map
    const mapNav = screen.getAllByRole('link', { name: /demand map/i })[0];
    await act(async () => {
      fireEvent.click(mapNav);
    });

    expect(screen.getByRole('heading', { level: 1, name: /demand map & catchment topology/i })).toBeInTheDocument();

    // Map-Click Add Toggle
    const mapClickToggle = screen.getByRole('button', { name: /map-click add/i });
    await act(async () => {
      fireEvent.click(mapClickToggle);
    });
    expect(screen.getByText(/click on the map to drop a new demand node/i)).toBeInTheDocument();

    // Press Escape to exit map click mode
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    });
    expect(screen.queryByText(/click on the map to drop a new demand node/i)).not.toBeInTheDocument();

    // Auto-Reoptimize toggle
    const autoReoptBtn = screen.getByRole('button', { name: /auto-solve on/i });
    await act(async () => {
      fireEvent.click(autoReoptBtn);
    });
    expect(screen.getByText(/auto-solve off/i)).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /auto-solve off/i }));
    });
    expect(screen.getByText(/auto-solve on/i)).toBeInTheDocument();
  });

  it('tests Network Configuration controls: p stepper, segmented mode, and objective cards', async () => {
    await act(async () => {
      render(<App />);
    });

    // Navigate to Network Configuration
    const configNav = screen.getAllByRole('link', { name: /network configuration/i })[0];
    await act(async () => {
      fireEvent.click(configNav);
    });

    expect(screen.getByRole('heading', { level: 1, name: /network configuration & constraints/i })).toBeInTheDocument();

    // Stepper + / -
    const incBtn = screen.getByRole('button', { name: '+' });
    await act(async () => {
      fireEvent.click(incBtn);
    });
    expect(screen.getByText('4')).toBeInTheDocument();

    const decBtn = screen.getByRole('button', { name: '-' });
    await act(async () => {
      fireEvent.click(decBtn);
    });
    expect(screen.getByText('3')).toBeInTheDocument();

    // Segmented Sizing Mode Toggle
    const autoSizeTab = screen.getByRole('button', { name: /auto-size/i });
    await act(async () => {
      fireEvent.click(autoSizeTab);
    });
    expect(autoSizeTab).toHaveClass('bg-white');

    const exactCountTab = screen.getByRole('button', { name: /exact count/i });
    await act(async () => {
      fireEvent.click(exactCountTab);
    });
    expect(exactCountTab).toHaveClass('bg-white');

    // Priority Objectives
    const speedCard = screen.getByRole('button', { name: /speed & proximity/i });
    await act(async () => {
      fireEvent.click(speedCard);
    });

    const costCard = screen.getByRole('button', { name: /cost focus/i });
    await act(async () => {
      fireEvent.click(costCard);
    });

    // Distance Metric Radios
    const straightRadio = screen.getByLabelText(/straight-line haversine/i);
    await act(async () => {
      fireEvent.click(straightRadio);
    });
    expect(straightRadio).toBeChecked();

    const osrmRadio = screen.getByLabelText(/osrm road network/i);
    await act(async () => {
      fireEvent.click(osrmRadio);
    });
    expect(osrmRadio).toBeChecked();

    // Modal trigger: Save Preset
    const savePresetBtn = screen.getByRole('button', { name: /save preset/i });
    await act(async () => {
      fireEvent.click(savePresetBtn);
    });
    expect(screen.getByRole('heading', { level: 3, name: /save parameter preset/i })).toBeInTheDocument();

    const cancelSaveBtn = screen.getByRole('button', { name: /cancel/i });
    await act(async () => {
      fireEvent.click(cancelSaveBtn);
    });
    expect(screen.queryByRole('heading', { level: 3, name: /save parameter preset/i })).not.toBeInTheDocument();
  });

  it('tests Header controls: currency toggle, telemetry popover, and avatar menu', async () => {
    await act(async () => {
      render(<App />);
    });

    // Currency Radio
    const usdRadio = screen.getByRole('radio', { name: '$ USD' });
    await act(async () => {
      fireEvent.click(usdRadio);
    });
    expect(usdRadio).toHaveAttribute('aria-checked', 'true');

    const inrRadio = screen.getByRole('radio', { name: '₹ INR' });
    await act(async () => {
      fireEvent.click(inrRadio);
    });
    expect(inrRadio).toHaveAttribute('aria-checked', 'true');

    // Telemetry Event Log Bell
    const bellBtn = screen.getByRole('button', { name: /operational notifications/i });
    await act(async () => {
      fireEvent.click(bellBtn);
    });
    expect(screen.getByText(/system activity & events/i)).toBeInTheDocument();
    // Click again to close
    await act(async () => {
      fireEvent.click(bellBtn);
    });
    expect(screen.queryByText(/system activity & events/i)).not.toBeInTheDocument();

    // Avatar Menu
    const avatarBtn = screen.getByRole('button', { name: /user workspace menu/i });
    await act(async () => {
      fireEvent.click(avatarBtn);
    });
    expect(screen.getByText(/operations console/i)).toBeInTheDocument();

    // Click About GridPoint to open modal
    const aboutBtn = screen.getByRole('button', { name: /about gridpoint/i });
    await act(async () => {
      fireEvent.click(aboutBtn);
    });
    expect(screen.getByRole('heading', { level: 3, name: /about gridpoint/i })).toBeInTheDocument();

    // Close modal
    const closeAboutBtn = screen.getByRole('button', { name: /^close$/i });
    await act(async () => {
      fireEvent.click(closeAboutBtn);
    });
    expect(screen.queryByRole('heading', { level: 3, name: /about gridpoint/i })).not.toBeInTheDocument();
  });
});
