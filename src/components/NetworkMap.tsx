import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { OptimizeResponse } from '../types';
import { Layers } from 'lucide-react';

interface NetworkMapProps {
  optimizeData: OptimizeResponse | null;
}

const CLUSTER_COLORS = [
  '#2563EB', // Royal Blue
  '#0D9488', // Teal
  '#D97706', // Amber
  '#7C3AED', // Purple
  '#DB2777', // Rose
  '#0284C7', // Sky
];

export const NetworkMap: React.FC<NetworkMapProps> = ({ optimizeData }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersRef = useRef<{
    warehouses: L.LayerGroup;
    zones: L.LayerGroup;
    lines: L.LayerGroup;
    radii: L.LayerGroup;
  }>({
    warehouses: L.layerGroup(),
    zones: L.layerGroup(),
    lines: L.layerGroup(),
    radii: L.layerGroup(),
  });

  const [showRadius, setShowRadius] = React.useState(true);
  const [showLines, setShowLines] = React.useState(true);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [12.9716, 77.5946], // Bengaluru center
      zoom: 11,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);

    layersRef.current.radii.addTo(map);
    layersRef.current.lines.addTo(map);
    layersRef.current.zones.addTo(map);
    layersRef.current.warehouses.addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update map contents when optimizeData changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !optimizeData) return;

    layersRef.current.warehouses.clearLayers();
    layersRef.current.zones.clearLayers();
    layersRef.current.lines.clearLayers();
    layersRef.current.radii.clearLayers();

    const wColorMap: Record<string, string> = {};
    optimizeData.warehouses.forEach((w, idx) => {
      wColorMap[w.warehouse_id] = CLUSTER_COLORS[idx % CLUSTER_COLORS.length];
    });

    const bounds: [number, number][] = [];

    // Render open warehouses
    optimizeData.warehouses.forEach((w) => {
      const color = wColorMap[w.warehouse_id] || '#3B76ED';
      bounds.push([w.latitude, w.longitude]);

      // Service Radius Ring
      const radiusKm = optimizeData.assumptions?.radius_max_km ?? 25;
      const radiusCircle = L.circle([w.latitude, w.longitude], {
        radius: radiusKm * 1000,
        color: color,
        weight: 1.5,
        dashArray: '4, 6',
        fillColor: color,
        fillOpacity: 0.04,
      });
      layersRef.current.radii.addLayer(radiusCircle);

      // Warehouse Marker
      const wMarker = L.circleMarker([w.latitude, w.longitude], {
        radius: 10,
        fillColor: color,
        color: '#FFFFFF',
        weight: 2.5,
        fillOpacity: 1,
      });

      wMarker.bindPopup(`
        <div style="font-family:sans-serif; font-size:12px; line-height:1.4;">
          <strong style="font-size:13px; color:#14181D;">${w.name}</strong> (Open Warehouse)<br>
          Assigned Demand: <strong>${w.assigned_demand.toLocaleString()}</strong> orders/day<br>
          Throughput Capacity: <strong>${w.capacity.toLocaleString()}</strong> orders/day<br>
          Utilization: <strong>${w.capacity_utilization_pct.toFixed(1)}%</strong><br>
          Zones Served: <strong>${w.neighborhoods_count}</strong>
        </div>
      `);

      layersRef.current.warehouses.addLayer(wMarker);
    });

    // Render Delivery Zones & Assignment Lines
    optimizeData.assignments.forEach((a) => {
      bounds.push([a.latitude, a.longitude]);
      const color = wColorMap[a.warehouse_id] || '#3B76ED';

      // Assignment Line
      const polyline = L.polyline(
        [
          [a.warehouse_latitude, a.warehouse_longitude],
          [a.latitude, a.longitude],
        ],
        {
          color: color,
          weight: 1.5,
          opacity: 0.6,
          dashArray: '3, 4',
        }
      );
      layersRef.current.lines.addLayer(polyline);

      // Zone Circle Marker
      const zMarker = L.circleMarker([a.latitude, a.longitude], {
        radius: Math.min(8, Math.max(4, Math.sqrt(a.daily_orders) / 2)),
        fillColor: color,
        color: '#FFFFFF',
        weight: 1.5,
        fillOpacity: 0.85,
      });

      zMarker.bindPopup(`
        <div style="font-family:sans-serif; font-size:12px; line-height:1.4;">
          <strong style="color:#14181D;">${a.neighborhood_name}</strong> (Delivery Zone)<br>
          Daily Demand: <strong>${a.daily_orders}</strong> orders/day<br>
          Assigned Depot: <strong>${a.warehouse_name}</strong><br>
          Distance to Depot: <strong>${a.distance_km} km</strong>
        </div>
      `);

      layersRef.current.zones.addLayer(zMarker);
    });

    // Layer visibility
    if (showRadius) {
      if (!map.hasLayer(layersRef.current.radii)) map.addLayer(layersRef.current.radii);
    } else {
      if (map.hasLayer(layersRef.current.radii)) map.removeLayer(layersRef.current.radii);
    }

    if (showLines) {
      if (!map.hasLayer(layersRef.current.lines)) map.addLayer(layersRef.current.lines);
    } else {
      if (map.hasLayer(layersRef.current.lines)) map.removeLayer(layersRef.current.lines);
    }

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [optimizeData, showRadius, showLines]);

  return (
    <div className="relative h-[440px] w-full overflow-hidden rounded-xl border border-gp-border bg-slate-100 shadow-sm">
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* Map Controls Overlay */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-1.5 rounded-lg border border-gp-border bg-white/95 p-2.5 text-xs shadow-md backdrop-blur">
        <div className="flex items-center gap-1.5 font-bold text-gp-text-primary border-b border-gp-border pb-1 mb-1">
          <Layers className="h-3.5 w-3.5 text-gp-primary-500" />
          <span>Map Layers</span>
        </div>
        <label className="flex items-center gap-2 cursor-pointer text-gp-text-secondary hover:text-gp-text-primary">
          <input
            type="checkbox"
            checked={showRadius}
            onChange={(e) => setShowRadius(e.target.checked)}
            className="rounded text-gp-primary-500 accent-gp-primary-500"
          />
          <span>Service Radii ({optimizeData?.assumptions?.radius_max_km ?? 25} km)</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-gp-text-secondary hover:text-gp-text-primary">
          <input
            type="checkbox"
            checked={showLines}
            onChange={(e) => setShowLines(e.target.checked)}
            className="rounded text-gp-primary-500 accent-gp-primary-500"
          />
          <span>Assignment Flow Lines</span>
        </label>
      </div>

      {/* Legend Overlay */}
      <div className="absolute bottom-3 left-3 z-[1000] flex items-center gap-3 rounded-lg border border-gp-border bg-white/95 px-3 py-1.5 text-[11px] shadow-md backdrop-blur text-gp-text-secondary">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full bg-blue-600 border border-white shadow" />
          <span className="font-semibold text-gp-text-primary">Warehouse Depot</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-slate-500 border border-white" />
          <span>Delivery Zone (Demand)</span>
        </div>
      </div>
    </div>
  );
};
