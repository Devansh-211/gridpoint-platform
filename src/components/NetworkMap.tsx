import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { OptimizeResponse, SiteScoreItem, Currency } from '../types';
import { formatMoney } from '../lib/currency';
import { Layers, Loader2 } from 'lucide-react';

interface NetworkMapProps {
  optimizeData: OptimizeResponse | null;
  candidates?: SiteScoreItem[];
  selectedPlotId?: string | null;
  onSelectSite?: (plotId: string) => void;
  currency?: Currency;
}

const CLUSTER_COLORS = [
  '#2563EB', // Royal Blue
  '#0D9488', // Teal
  '#D97706', // Amber
  '#7C3AED', // Purple
  '#DB2777', // Rose
  '#0284C7', // Sky
];

/**
 * Generate an illustrative footprint polygon given center lat/lng and area in sq ft.
 * Converted to square meters, creates a bounding rectangle with deterministic aspect ratio and rotation.
 */
function generateFootprintPolygon(
  lat: number,
  lng: number,
  areaSqFt: number,
  plotId: string
): [number, number][] {
  const areaM2 = (areaSqFt || 40000) * 0.092903;
  // Side lengths for rectangle (approx 1.5:1 ratio)
  const sideA = Math.sqrt(areaM2 * 1.5);
  const sideB = areaM2 / sideA;

  // Convert meters to delta lat/lng (at ~13° N latitude)
  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * Math.cos((lat * Math.PI) / 180);

  const dLat = (sideA / 2) / metersPerDegLat;
  const dLng = (sideB / 2) / metersPerDegLng;

  // Deterministic slight angle rotation based on plotId hash
  let hash = 0;
  for (let i = 0; i < plotId.length; i++) {
    hash = (hash << 5) - hash + plotId.charCodeAt(i);
  }
  const angleRad = ((hash % 45) * Math.PI) / 180;
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);

  const corners: [number, number][] = [
    [-dLat, -dLng],
    [dLat, -dLng],
    [dLat, dLng],
    [-dLat, dLng],
  ];

  return corners.map(([dy, dx]) => {
    const rotY = dy * cosA - dx * sinA;
    const rotX = dy * sinA + dx * cosA;
    return [lat + rotY, lng + rotX];
  });
}

export const NetworkMap: React.FC<NetworkMapProps> = ({
  optimizeData,
  candidates = [],
  selectedPlotId = null,
  onSelectSite,
  currency = 'INR',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersRef = useRef<{
    warehouses: L.LayerGroup;
    candidates: L.LayerGroup;
    osmLanduse: L.LayerGroup;
    zones: L.LayerGroup;
    lines: L.LayerGroup;
    radii: L.LayerGroup;
  }>({
    warehouses: L.layerGroup(),
    candidates: L.layerGroup(),
    osmLanduse: L.layerGroup(),
    zones: L.layerGroup(),
    lines: L.layerGroup(),
    radii: L.layerGroup(),
  });

  const [showRadius, setShowRadius] = useState<boolean>(true);
  const [showLines, setShowLines] = useState<boolean>(true);
  const [showFootprints, setShowFootprints] = useState<boolean>(true);
  const [showOsmContext, setShowOsmContext] = useState<boolean>(false);
  const [osmLoading, setOsmLoading] = useState<boolean>(false);
  const [osmStatusMsg, setOsmStatusMsg] = useState<string | null>(null);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [12.9716, 77.5946], // Bengaluru center
      zoom: 11,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    layersRef.current.osmLanduse.addTo(map);
    layersRef.current.radii.addTo(map);
    layersRef.current.lines.addTo(map);
    layersRef.current.candidates.addTo(map);
    layersRef.current.zones.addTo(map);
    layersRef.current.warehouses.addTo(map);

    mapInstanceRef.current = map;

    // Invalidate size once container renders
    const invalidateTimer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    const handleResize = () => {
      map.invalidateSize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(invalidateTimer);
      window.removeEventListener('resize', handleResize);
      try {
        layersRef.current.warehouses.clearLayers();
        layersRef.current.candidates.clearLayers();
        layersRef.current.zones.clearLayers();
        layersRef.current.lines.clearLayers();
        layersRef.current.radii.clearLayers();
        layersRef.current.osmLanduse.clearLayers();
        map.remove();
      } catch {
        // Safe disposal
      }
      mapInstanceRef.current = null;
    };
  }, []);

  // Update map contents when optimizeData or candidates changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !optimizeData) return;

    try {
      layersRef.current.warehouses.clearLayers();
      layersRef.current.candidates.clearLayers();
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
      const color = wColorMap[w.warehouse_id] || '#10B981';
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
        radius: 11,
        fillColor: '#10B981', // Emerald for active optimal depot
        color: '#FFFFFF',
        weight: 3,
        fillOpacity: 1,
      });

      wMarker.bindPopup(`
        <div style="font-family:sans-serif; font-size:12px; line-height:1.4;">
          <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
            <span style="background:#DCFCE7; color:#15803D; font-weight:700; font-size:10px; padding:1px 5px; border-radius:4px;">OPTIMAL DEPOT</span>
            <strong style="font-size:13px; color:#14181D;">${w.name}</strong>
          </div>
          Assigned Demand: <strong>${w.assigned_demand.toLocaleString()}</strong> orders/day<br>
          Throughput Capacity: <strong>${w.capacity.toLocaleString()}</strong> orders/day<br>
          Capacity Utilization: <strong>${w.capacity_utilization_pct.toFixed(1)}%</strong><br>
          Zones Served: <strong>${w.neighborhoods_count}</strong>
        </div>
      `);

      layersRef.current.warehouses.addLayer(wMarker);
    });

    // Render Candidates & Footprint Polygons
    if (candidates && candidates.length > 0) {
      candidates.forEach((cand) => {
        const isOptimal = cand.status === 'SELECTED';
        const isRunnerUp = cand.status === 'RUNNER_UP';
        const isSelected = selectedPlotId === cand.plot_id;

        const fillColor = isOptimal
          ? '#10B981' // Emerald
          : isRunnerUp
          ? '#F59E0B' // Amber
          : '#64748B'; // Slate

        // Footprint Polygon
        if (showFootprints) {
          const polyCoords = generateFootprintPolygon(cand.lat, cand.lng, cand.area_sq_ft, cand.plot_id);
          const footprint = L.polygon(polyCoords, {
            color: isSelected ? '#1E293B' : fillColor,
            weight: isSelected ? 2.5 : 1.2,
            dashArray: isOptimal ? undefined : '2, 3',
            fillColor: fillColor,
            fillOpacity: isOptimal ? 0.35 : isRunnerUp ? 0.2 : 0.1,
          });

          footprint.on('click', () => {
            if (onSelectSite) onSelectSite(cand.plot_id);
          });

          layersRef.current.candidates.addLayer(footprint);
        }

        // Marker for candidate
        const candMarker = L.circleMarker([cand.lat, cand.lng], {
          radius: isOptimal ? 9 : isRunnerUp ? 7 : 5,
          fillColor: fillColor,
          color: isSelected ? '#0F172A' : '#FFFFFF',
          weight: isSelected ? 3 : 1.5,
          fillOpacity: 0.95,
        });

        candMarker.bindPopup(`
          <div style="font-family:sans-serif; font-size:12px; line-height:1.45; min-width:180px;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
              <span style="font-family:monospace; font-weight:700; color:#3B82F6;">${cand.plot_id}</span>
              <span style="text-transform:uppercase; font-size:9px; font-weight:700; padding:2px 5px; border-radius:3px; background:${
                isOptimal ? '#DCFCE7; color:#15803D;' : isRunnerUp ? '#FEF3C7; color:#B45309;' : '#F1F5F9; color:#475569;'
              }">${cand.status.replace('_', ' ')}</span>
            </div>
            <strong style="color:#0F172A; font-size:13px;">${cand.locality}</strong><br>
            <span style="color:#64748B; font-size:11px;">${cand.zoning_type}</span>
            <hr style="margin:6px 0; border:0; border-top:1px solid #E2E8F0;" />
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px; font-size:11px;">
              <div>Area: <strong>${cand.area_sq_ft.toLocaleString()}</strong> sq ft</div>
              <div>Gravity: <strong>${cand.gravity_score}</strong>/100</div>
              <div>Daily Lease: <strong>${formatMoney(cand.effective_daily_lease_inr, currency)}</strong></div>
              <div>Regret: <strong>${formatMoney(cand.regret_inr, currency)}</strong>/d</div>
            </div>
            <div style="margin-top:8px;">
              <button 
                id="popup-btn-${cand.plot_id}"
                style="width:100%; padding:4px 8px; font-size:11px; font-weight:600; color:#2563EB; background:#EFF6FF; border:1px solid #BFDBFE; border-radius:4px; cursor:pointer;"
              >
                Inspect Land Registry &rarr;
              </button>
            </div>
          </div>
        `);

        candMarker.on('popupopen', () => {
          const btn = document.getElementById(`popup-btn-${cand.plot_id}`);
          if (btn) {
            btn.onclick = () => {
              if (onSelectSite) onSelectSite(cand.plot_id);
            };
          }
        });

        candMarker.on('click', () => {
          if (onSelectSite) onSelectSite(cand.plot_id);
        });

        layersRef.current.candidates.addLayer(candMarker);
      });
    }

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
    } catch (err) {
      console.warn('NetworkMap layer update notice:', err);
    }
  }, [optimizeData, candidates, selectedPlotId, showRadius, showLines, showFootprints, onSelectSite]);

  // Overpass OSM context query handler
  const fetchOsmLanduse = useCallback(async () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const zoom = map.getZoom();
    if (zoom < 12) {
      setOsmStatusMsg('Zoom in to level 12+ to load OSM zoning context');
      return;
    }

    const bounds = map.getBounds();
    const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;
    const query = `[out:json][timeout:15];(way["landuse"~"industrial|commercial|retail"](${bbox});relation["landuse"~"industrial|commercial|retail"](${bbox}););out geom;`;

    const cacheKey = `gridpoint_osm_${bbox}`;
    const cached = localStorage.getItem(cacheKey);

    setOsmLoading(true);
    setOsmStatusMsg(null);

    const renderElements = (elements: any[]) => {
      layersRef.current.osmLanduse.clearLayers();
      let count = 0;
      elements.forEach((el) => {
        if (el.geometry && el.geometry.length > 2) {
          const coords: [number, number][] = el.geometry.map((pt: any) => [pt.lat, pt.lon]);
          const landuse = el.tags?.landuse || 'industrial';
          const isInd = landuse === 'industrial';
          const color = isInd ? '#6366F1' : '#F59E0B';

          const poly = L.polygon(coords, {
            color: color,
            weight: 1,
            fillColor: color,
            fillOpacity: 0.12,
          });

          poly.bindPopup(`
            <div style="font-family:sans-serif; font-size:11px;">
              <strong>OSM Landuse: ${landuse}</strong><br/>
              ${el.tags?.name ? `<span>${el.tags.name}</span><br/>` : ''}
              <span style="color:#64748B; font-size:10px;">&copy; OpenStreetMap contributors</span>
            </div>
          `);
          layersRef.current.osmLanduse.addLayer(poly);
          count++;
        }
      });
      setOsmStatusMsg(`Loaded ${count} OSM zoning polygons`);
    };

    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        renderElements(parsed);
        setOsmLoading(false);
        return;
      } catch {
        // re-fetch
      }
    }

    try {
      const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (!res.ok) {
        throw new Error(`OSM status ${res.status}`);
      }

      const data = await res.json();
      if (data && data.elements) {
        renderElements(data.elements);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(data.elements.slice(0, 100)));
        } catch {
          // ignore cache quota
        }
      }
    } catch (err) {
      setOsmStatusMsg('Overpass API offline or busy; skipped');
      layersRef.current.osmLanduse.clearLayers();
    } finally {
      setOsmLoading(false);
    }
  }, []);

  // Handle OSM context toggle
  useEffect(() => {
    if (showOsmContext) {
      const timer = setTimeout(() => {
        fetchOsmLanduse();
      }, 800);
      return () => clearTimeout(timer);
    } else {
      layersRef.current.osmLanduse.clearLayers();
      setOsmStatusMsg(null);
    }
  }, [showOsmContext, fetchOsmLanduse]);

  return (
    <div className="relative h-[480px] w-full overflow-hidden rounded-xl border border-gp-border bg-slate-100 shadow-sm">
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* Map Controls Overlay */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-1.5 rounded-lg border border-gp-border bg-white/95 p-2.5 text-xs shadow-md backdrop-blur max-w-[210px]">
        <div className="flex items-center gap-1.5 font-bold text-gp-text-primary border-b border-gp-border pb-1 mb-1">
          <Layers className="h-3.5 w-3.5 text-gp-primary-500" />
          <span>Network & Site Layers</span>
        </div>
        <label className="flex items-center gap-2 cursor-pointer text-gp-text-secondary hover:text-gp-text-primary">
          <input
            type="checkbox"
            checked={showFootprints}
            onChange={(e) => setShowFootprints(e.target.checked)}
            className="rounded text-gp-primary-500 accent-gp-primary-500"
          />
          <span>Site Footprints</span>
        </label>
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

        <div className="border-t border-gp-border pt-1 mt-0.5">
          <label className="flex items-center gap-2 cursor-pointer text-gp-text-secondary hover:text-gp-text-primary">
            <input
              type="checkbox"
              checked={showOsmContext}
              onChange={(e) => setShowOsmContext(e.target.checked)}
              className="rounded text-indigo-500 accent-indigo-500"
            />
            <span className="flex items-center gap-1">
              <span>OSM Zoning Context</span>
              {osmLoading && <Loader2 className="h-3 w-3 animate-spin text-indigo-600" />}
            </span>
          </label>
          {osmStatusMsg && (
            <p className="text-[10px] text-gp-text-tertiary mt-0.5 italic leading-tight">
              {osmStatusMsg}
            </p>
          )}
        </div>
      </div>

      {/* Legend Overlay with Footprint Disclaimer */}
      <div className="absolute bottom-3 left-3 z-[1000] flex flex-col gap-1 rounded-lg border border-gp-border bg-white/95 px-3 py-2 text-[11px] shadow-md backdrop-blur text-gp-text-secondary">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-emerald-500 border border-white shadow" />
            <span className="font-semibold text-gp-text-primary">Optimal Selected (Rank #1)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-amber-500 border border-white shadow" />
            <span>Runner-up Candidate</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-slate-400 border border-white" />
            <span>Screened / Rejected</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-blue-600 border border-white" />
            <span>Delivery Demand Zone</span>
          </div>
        </div>
        <div className="border-t border-gp-border/60 pt-1 text-[10px] text-gp-text-tertiary italic">
          * Illustrative footprint, not a surveyed boundary. Click any site to view Land Registry Verification.
        </div>
      </div>
    </div>
  );
};

export default NetworkMap;
