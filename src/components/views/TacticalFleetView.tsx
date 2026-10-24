import React, { useMemo, useState } from 'react';
import { PageHeader } from '../shell/PageHeader';
import {
  Currency,
  OptimizeResponse,
} from '../../types';
import { formatMoney } from '../../lib/currency';
import {
  Download,
  Building2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface TacticalFleetViewProps {
  currency: Currency;
  optimizeData: OptimizeResponse | null;
}

// Documented Assumed Constants for Tactical Fleet Sizing
export const FLEET_ASSUMPTIONS = {
  ORDERS_PER_VEHICLE_CAPACITY: 160, // [Assumed] Nominal daily payload capacity per delivery van
  MAX_DAILY_DRIVE_HOURS: 8, // [Assumed] Single driver shift duration limit
  FIXED_VEHICLE_DAY_COST_INR: 1800, // [Assumed] Daily van lease + driver base wage (₹1,800/day)
  VARIABLE_FUEL_MAINT_PER_KM_INR: 8.5, // [Assumed] Fuel + maintenance burn rate (₹8.5/km)
  RETURN_DETOUR_FACTOR: 1.85, // [Assumed] Multi-stop circuit roundtrip factor vs one-way direct
};

export const TacticalFleetView: React.FC<TacticalFleetViewProps> = ({
  currency,
  optimizeData,
}) => {
  const [selectedHubId, setSelectedHubId] = useState<string>('ALL');

  // Compute Per-Hub Fleet Sizing & Manifests from assignments
  const fleetData = useMemo(() => {
    if (!optimizeData || optimizeData.warehouses.length === 0) {
      return {
        hubs: [],
        totalVehicles: 0,
        totalKm: 0,
        totalDailyFleetCostInr: 0,
        manifests: [],
      };
    }

    const hubAssignmentsMap = new Map<string, typeof optimizeData.assignments>();
    for (const a of optimizeData.assignments) {
      const list = hubAssignmentsMap.get(a.warehouse_id) || [];
      list.push(a);
      hubAssignmentsMap.set(a.warehouse_id, list);
    }

    const hubsSummary = optimizeData.warehouses.map((w) => {
      const assigned = hubAssignmentsMap.get(w.warehouse_id) || [];
      const totalDemand = assigned.reduce((sum, a) => sum + a.daily_orders, 0);
      const totalOneWayKm = assigned.reduce((sum, a) => sum + a.distance_km, 0);
      const estimatedRoundtripKm = Math.round(totalOneWayKm * FLEET_ASSUMPTIONS.RETURN_DETOUR_FACTOR);

      // Vehicles needed = ceil(assigned orders / orders per vehicle)
      const vehiclesNeeded = Math.max(1, Math.ceil(totalDemand / FLEET_ASSUMPTIONS.ORDERS_PER_VEHICLE_CAPACITY));
      const vehicleUtilizationPct = Math.min(
        100,
        Math.round((totalDemand / (vehiclesNeeded * FLEET_ASSUMPTIONS.ORDERS_PER_VEHICLE_CAPACITY)) * 100)
      );

      const fixedCost = vehiclesNeeded * FLEET_ASSUMPTIONS.FIXED_VEHICLE_DAY_COST_INR;
      const varCost = estimatedRoundtripKm * FLEET_ASSUMPTIONS.VARIABLE_FUEL_MAINT_PER_KM_INR;
      const totalFleetCostInr = fixedCost + varCost;

      return {
        hubId: w.warehouse_id,
        hubName: w.name,
        assignedDemand: totalDemand,
        zonesCount: assigned.length,
        vehiclesNeeded,
        vehicleUtilizationPct,
        estimatedRoundtripKm,
        totalFleetCostInr,
        assignments: assigned,
      };
    });

    const totalVehicles = hubsSummary.reduce((sum, h) => sum + h.vehiclesNeeded, 0);
    const totalKm = hubsSummary.reduce((sum, h) => sum + h.estimatedRoundtripKm, 0);
    const totalDailyFleetCostInr = hubsSummary.reduce((sum, h) => sum + h.totalFleetCostInr, 0);

    return {
      hubs: hubsSummary,
      totalVehicles,
      totalKm,
      totalDailyFleetCostInr,
    };
  }, [optimizeData]);

  // Export CSV Dispatch Manifest
  const handleExportManifest = () => {
    if (!optimizeData || fleetData.hubs.length === 0) return;

    const headers = [
      'Depot ID',
      'Depot Name',
      'Delivery Zone ID',
      'Delivery Zone Name',
      'Daily Orders (Assigned)',
      'Direct Distance (km)',
      'Estimated Circuit Distance (km)',
      'Assigned Vehicle Batch',
    ];

    const rows: string[] = [headers.join(',')];

    for (const h of fleetData.hubs) {
      if (selectedHubId !== 'ALL' && h.hubId !== selectedHubId) continue;
      h.assignments.forEach((a, idx) => {
        const vehicleBatch = `Van-${Math.floor(idx / 4) + 1}`;
        rows.push(
          [
            `"${h.hubId}"`,
            `"${h.hubName}"`,
            `"${a.neighborhood_id}"`,
            `"${a.neighborhood_name}"`,
            a.daily_orders,
            a.distance_km.toFixed(1),
            (a.distance_km * FLEET_ASSUMPTIONS.RETURN_DETOUR_FACTOR).toFixed(1),
            `"${vehicleBatch}"`,
          ].join(',')
        );
      });
    }

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `GridPoint_Fleet_Dispatch_Manifest_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const chartData = fleetData.hubs.map((h) => ({
    name: h.hubName.replace(' Distribution Depot', ''),
    vehicles: h.vehiclesNeeded,
    demand: h.assignedDemand,
    utilization: h.vehicleUtilizationPct,
  }));

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <PageHeader
        breadcrumbs={[
          { label: 'GridPoint', href: '#/overview' },
          { label: 'Tactical Fleet' },
        ]}
        title="Tactical Fleet Operations & Sizing"
        description="Per-depot vehicle fleet sizing, multi-stop route road kilometers, delivery van utilization, and dispatch manifest schedules."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportManifest}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition"
            >
              <Download className="h-3.5 w-3.5 text-blue-600" />
              <span>Export Dispatch CSV</span>
            </button>
          </div>
        }
      />

      {/* 2. Fleet Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Fleet Deployed */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Total Vehicles Deployed
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {fleetData.totalVehicles}
            </span>
            <span className="text-xs font-semibold text-slate-500">Vans</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Sized @ {FLEET_ASSUMPTIONS.ORDERS_PER_VEHICLE_CAPACITY} orders/vehicle/day (Assumed)
          </p>
        </div>

        {/* KPI 2: Total Road Distance */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Total Circuit Distance
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {fleetData.totalKm.toLocaleString()}
            </span>
            <span className="text-xs font-semibold text-slate-500">km / day</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Across {optimizeData?.warehouses.length || 0} active distribution centers
          </p>
        </div>

        {/* KPI 3: Daily Fleet Cost */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Estimated Daily Fleet OpEx
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {formatMoney(fleetData.totalDailyFleetCostInr, currency)}
            </span>
            <span className="text-xs font-semibold text-slate-500">/ day</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Fixed Van Lease + Driver Base + Fuel Burn
          </p>
        </div>

        {/* KPI 4: Average Van Utilization */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Average Vehicle Payload
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-blue-700">
              {fleetData.hubs.length > 0
                ? Math.round(
                    fleetData.hubs.reduce((s, h) => s + h.vehicleUtilizationPct, 0) /
                      fleetData.hubs.length
                  )
                : 0}
              %
            </span>
            <span className="text-xs font-semibold text-slate-500">Capacity</span>
          </div>
          <p className="text-[11px] text-slate-500">
            High delivery density across Bengaluru
          </p>
        </div>
      </div>

      {/* 3. Bar Chart: Fleet Allocation by Distribution Depot */}
      {chartData.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Delivery Fleet Deployment by Distribution Center
              </h3>
              <p className="text-xs text-slate-500">
                Vehicle fleet sizing vs. daily customer order volume requirements.
              </p>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              [Assumed Constants Applied]
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={250}>
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis yAxisId="left" orientation="left" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#64748B' }} unit=" ord" />
                <Tooltip
                  formatter={(value: any, name: any) => [
                    name === 'vehicles' ? `${value} Vans` : `${Number(value).toLocaleString()} Orders`,
                    name === 'vehicles' ? 'Vehicles Deployed' : 'Assigned Daily Demand',
                  ]}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="vehicles" name="Vehicles Deployed" fill="#2563EB" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="demand" name="Daily Orders" fill="#93C5FD" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 4. Depot Fleet Sizing Breakdown Table */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Distribution Depot Fleet Allocations & Operating Costs
            </h3>
            <p className="text-xs text-slate-500">
              Computed directly from exact assignment allocations and OSRM distance matrices.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600">Filter Depot:</label>
            <select
              value={selectedHubId}
              onChange={(e) => setSelectedHubId(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
            >
              <option value="ALL">All Active Depots</option>
              {fleetData.hubs.map((h) => (
                <option key={h.hubId} value={h.hubId}>
                  {h.hubName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Distribution Depot</th>
                <th className="py-2.5 px-3 text-right">Zones Served</th>
                <th className="py-2.5 px-3 text-right">Daily Demand</th>
                <th className="py-2.5 px-3 text-right">Vehicles Needed</th>
                <th className="py-2.5 px-3 text-right">Payload Utilization</th>
                <th className="py-2.5 px-3 text-right">Daily Circuit (km)</th>
                <th className="py-2.5 px-3 text-right">Daily Fleet Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fleetData.hubs
                .filter((h) => selectedHubId === 'ALL' || h.hubId === selectedHubId)
                .map((h) => (
                  <tr key={h.hubId} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-blue-600" />
                        <span>{h.hubName}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {h.hubId}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      {h.zonesCount}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      {h.assignedDemand.toLocaleString()} ord
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-700">
                      {h.vehiclesNeeded} Vans
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          h.vehicleUtilizationPct > 85
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {h.vehicleUtilizationPct}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      {h.estimatedRoundtripKm.toLocaleString()} km
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                      {formatMoney(h.totalFleetCostInr, currency)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
