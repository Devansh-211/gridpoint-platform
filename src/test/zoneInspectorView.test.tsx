import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DemandMapView } from '../components/views/DemandMapView';
import { EditableZone, EditableHub } from '../lib/networkState';
import { OptimizeResponse } from '../types';
import { OsrmMatrixResult } from '../services/osrmMatrixService';

describe('BUG 5: Zone Inspector Layout & Distance Source Rows', () => {
  const mockZones: EditableZone[] = [
    {
      id: 'ZN-BLR-01',
      name: 'Koramangala Commercial Catchment Area',
      lat: 12.9352,
      lng: 77.6245,
      baseOrders: 420,
      multiplier: 1.0,
      source: 'demo',
    },
  ];

  const mockHubs: EditableHub[] = [
    {
      id: 'HUB-BLR-01',
      name: 'Central Bangalore Depot',
      lat: 12.9716,
      lng: 77.5946,
      capacity: 5000,
      dailyLease: 15000,
      source: 'demo',
    },
  ];

  const mockOptimizeData: OptimizeResponse = {
    selected_warehouses: ['HUB-BLR-01'],
    total_cost: 25000,
    transit_cost: 10000,
    fixed_cost: 15000,
    average_distance_km: 6.2,
    service_level: 0.98,
    assignments: [
      {
        neighborhood_id: 'ZN-BLR-01',
        warehouse_id: 'HUB-BLR-01',
        warehouse_name: 'Central Bangalore Depot',
        distance_km: 7.4,
        orders: 420,
      },
    ],
    summary: {
      total_zones: 1,
      served_zones: 1,
      total_orders: 420,
      served_orders: 420,
      hub_utilization: { 'HUB-BLR-01': 0.084 },
    },
  } as any;

  it('renders "Road distance (OSRM)" and "Road factor" when OSRM data is used', () => {
    const mockMatrixResult: OsrmMatrixResult = {
      distancesKm: {
        'HUB-BLR-01': { 'ZN-BLR-01': 7.4 },
      },
      durationsMin: {
        'HUB-BLR-01': { 'ZN-BLR-01': 16 },
      },
      pairSource: {
        'HUB-BLR-01:ZN-BLR-01': 'osrm',
      },
      status: 'all_road',
      osrmCount: 1,
      estimatedCount: 0,
      totalPairs: 1,
      avgDetourRatio: 1.34,
    };

    render(
      <DemandMapView
        currency="INR"
        zones={mockZones}
        hubs={mockHubs}
        optimizeData={mockOptimizeData}
        matrixResult={mockMatrixResult}
        selectedZoneId="ZN-BLR-01"
        onSelectZone={vi.fn()}
        onUpdateZoneDemand={vi.fn()}
        onDeleteZone={vi.fn()}
        onAddZone={vi.fn()}
        onAddHub={vi.fn()}
        canUndo={false}
        canRedo={false}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        autoReoptimize={true}
        onToggleAutoReoptimize={vi.fn()}
        pinnedAssignments={{}}
        onPinAssignment={vi.fn()}
        onUnpinAssignment={vi.fn()}
        onSelectSite={vi.fn()}
        selectedPlotId={null}
      />
    );

    // Verify OSRM rows are rendered
    expect(screen.getByText(/Road distance \(OSRM\):/i)).toBeDefined();
    expect(screen.getByText(/Road factor:/i)).toBeDefined();
    expect(screen.getByText(/16 min ETA/i)).toBeDefined();

    // Verify Haversine rows are NOT rendered
    expect(screen.queryByText(/^Haversine distance:$/i)).toBeNull();
    expect(screen.queryByText(/Detour factor \(estimated\):/i)).toBeNull();
  });

  it('renders "Haversine distance" and "Detour factor (estimated)" when fallback is used', () => {
    const mockFallbackMatrixResult: OsrmMatrixResult = {
      distancesKm: {
        'HUB-BLR-01': { 'ZN-BLR-01': 7.4 },
      },
      durationsMin: {
        'HUB-BLR-01': { 'ZN-BLR-01': 16 },
      },
      pairSource: {
        'HUB-BLR-01:ZN-BLR-01': 'haversine',
      },
      status: 'all_haversine',
      osrmCount: 0,
      estimatedCount: 1,
      totalPairs: 1,
      avgDetourRatio: 1.34,
    };

    render(
      <DemandMapView
        currency="INR"
        zones={mockZones}
        hubs={mockHubs}
        optimizeData={mockOptimizeData}
        matrixResult={mockFallbackMatrixResult}
        selectedZoneId="ZN-BLR-01"
        onSelectZone={vi.fn()}
        onUpdateZoneDemand={vi.fn()}
        onDeleteZone={vi.fn()}
        onAddZone={vi.fn()}
        onAddHub={vi.fn()}
        canUndo={false}
        canRedo={false}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        autoReoptimize={true}
        onToggleAutoReoptimize={vi.fn()}
        pinnedAssignments={{}}
        onPinAssignment={vi.fn()}
        onUnpinAssignment={vi.fn()}
        onSelectSite={vi.fn()}
        selectedPlotId={null}
      />
    );

    // Verify Fallback rows are rendered
    expect(screen.getByText(/Haversine distance:/i)).toBeDefined();
    expect(screen.getByText(/Detour factor \(estimated\):/i)).toBeDefined();

    // Verify OSRM specific row is NOT rendered
    expect(screen.queryByText(/Road distance \(OSRM\):/i)).toBeNull();
  });

  it('ensures Zone Inspector values are right-aligned and protected against flex/grid clipping', () => {
    const mockMatrixResult: OsrmMatrixResult = {
      distancesKm: { 'HUB-BLR-01': { 'ZN-BLR-01': 7.4 } },
      durationsMin: { 'HUB-BLR-01': { 'ZN-BLR-01': 16 } },
      pairSource: { 'HUB-BLR-01:ZN-BLR-01': 'osrm' },
      status: 'all_road',
      osrmCount: 1,
      estimatedCount: 0,
      totalPairs: 1,
      avgDetourRatio: 1.34,
    };

    const { container } = render(
      <DemandMapView
        currency="INR"
        zones={mockZones}
        hubs={mockHubs}
        optimizeData={mockOptimizeData}
        matrixResult={mockMatrixResult}
        selectedZoneId="ZN-BLR-01"
        onSelectZone={vi.fn()}
        onUpdateZoneDemand={vi.fn()}
        onDeleteZone={vi.fn()}
        onAddZone={vi.fn()}
        onAddHub={vi.fn()}
        canUndo={false}
        canRedo={false}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        autoReoptimize={true}
        onToggleAutoReoptimize={vi.fn()}
        pinnedAssignments={{}}
        onPinAssignment={vi.fn()}
        onUnpinAssignment={vi.fn()}
        onSelectSite={vi.fn()}
        selectedPlotId={null}
      />
    );

    // Assigned hub element is visible and right-aligned
    const hubElement = screen.getByText('Central Bangalore Depot');
    expect(hubElement.className).toContain('text-right');

    // Values are right-aligned
    const roadDistElement = screen.getByText(/7.4 km/);
    expect(roadDistElement.className).toContain('text-right');

    // Grid container and card have min-w-0
    const card = container.querySelector('.lg\\:grid-cols-3');
    expect(card?.className).toContain('min-w-0');
  });
});
