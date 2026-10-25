/**
 * Basemap Configuration & Providers
 * Provides keyless tile layer endpoints with automatic error failover and attribution.
 * Default: OpenStreetMap (OSM)
 */

export type BasemapType = 'streets' | 'satellite';

export interface BasemapProvider {
  id: string;
  name: string;
  type: BasemapType;
  url: string;
  attribution: string;
  maxZoom: number;
  subdomains?: string[];
}

export const BASEMAP_OVERRIDE_URL =
  typeof import.meta !== 'undefined' && import.meta.env
    ? (import.meta.env.VITE_TILE_URL as string | undefined)
    : undefined;

export const BASEMAP_OVERRIDE_ATTRIBUTION =
  typeof import.meta !== 'undefined' && import.meta.env
    ? (import.meta.env.VITE_TILE_ATTRIBUTION as string | undefined)
    : undefined;

export const BASEMAP_PROVIDERS: BasemapProvider[] = [
  ...(BASEMAP_OVERRIDE_URL
    ? [
        {
          id: 'custom-override',
          name: 'Custom Provider',
          type: 'streets' as const,
          url: BASEMAP_OVERRIDE_URL,
          attribution: BASEMAP_OVERRIDE_ATTRIBUTION || '&copy; Custom Tile Provider',
          maxZoom: 19,
        },
      ]
    : []),
  {
    id: 'osm',
    name: 'OpenStreetMap',
    type: 'streets',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  {
    id: 'esri-streets',
    name: 'Esri World Street Map',
    type: 'streets',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    maxZoom: 19,
  },
  {
    id: 'esri-imagery',
    name: 'Esri Satellite Imagery',
    type: 'satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics and the GIS User Community',
    maxZoom: 19,
  },
];

export const DEFAULT_BASEMAP_ID = BASEMAP_OVERRIDE_URL ? 'custom-override' : 'osm';
