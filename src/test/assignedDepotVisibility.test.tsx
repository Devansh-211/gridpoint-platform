import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ZoneDemandTable } from '../components/ZoneDemandTable';
import { DemandMapView } from '../components/views/DemandMapView';
import { EditableZone, EditableHub } from '../lib/networkState';
import { OptimizeResponse } from '../types';
import demoResult from '../data/demoResult.json';

describe('Assigned Depot Visibility in Demand Map', () => {
  const sampleZones: EditableZone[] = [
    { id: 'BLR_01', name: 'Koramangala', lat: 12.9352, lng: 77.6245, baseOrders: 420, multiplier: 1, source: 'demo' },
    { id: 'BLR_02', name: 'Indiranagar', lat: 12.9784, lng: 77.6408, baseOrders: 380, multiplier: 1, source: 'demo' },
  ];

  const sampleHubs: EditableHub[] = [
    { id: 'BLR_07', name: 'BTM Layout Depot', lat: 12.9166, lng: 77.6101, capacity: 4000, dailyLease: 15000, source: 'demo' },
    { id: 'BLR_18', name: 'Marathahalli Hub', lat: 12.9591, lng: 77.6974, capacity: 4000, dailyLease: 15000, source: 'demo' },
  ];

  it('renders assigned depot names in ZoneDemandTable when passed optimizeData.assignments (AssignmentItem[])', () => {
    const assignmentsFromOptimizeData = [
      {
        neighborhood_id: 'BLR_01',
        neighborhood_name: 'Koramangala',
        latitude: 12.9352,
        longitude: 77.6245,
        warehouse_id: 'BLR_07',
        warehouse_name: 'BTM Layout Depot',
        warehouse_latitude: 12.9166,
        warehouse_longitude: 77.6101,
        distance_km: 2.59,
        daily_orders: 420.0,
      },
      {
        neighborhood_id: 'BLR_02',
        neighborhood_name: 'Indiranagar',
        latitude: 12.9784,
        longitude: 77.6408,
        warehouse_id: 'BLR_18',
        warehouse_name: 'Marathahalli Hub',
        warehouse_latitude: 12.9591,
        warehouse_longitude: 77.6974,
        distance_km: 6.5,
        daily_orders: 380.0,
      },
    ];

    render(
      <ZoneDemandTable
        zones={sampleZones}
        assignments={assignmentsFromOptimizeData as any}
        hubs={sampleHubs}
        onUpdateZoneDemand={vi.fn()}
        onSelectZone={vi.fn()}
        onDeleteZone={vi.fn()}
      />
    );

    // Should NOT show "Pending solve..." for these zones
    expect(screen.queryByText('Pending solve...')).not.toBeInTheDocument();

    // Must show the actual depot names in the table
    expect(screen.getByText('BTM Layout Depot')).toBeInTheDocument();
    expect(screen.getByText('Marathahalli Hub')).toBeInTheDocument();
  });

  it('renders Assigned Depot in Zone Inspector and table within DemandMapView', () => {
    const mockOptimizeData = demoResult as unknown as OptimizeResponse;

    render(
      <DemandMapView
        currency="INR"
        zones={sampleZones}
        hubs={sampleHubs}
        optimizeData={mockOptimizeData}
        matrixResult={null}
        selectedZoneId="BLR_01"
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

    // Inspector must display "Assigned Depot:" label
    expect(screen.getByText(/Assigned Depot:/i)).toBeInTheDocument();

    // In demoResult.json, BLR_01 is assigned to "BTM Layout"
    expect(screen.getAllByText('BTM Layout').length).toBeGreaterThanOrEqual(1);
  });
});
