/**
 * Official Government Land Record & GIS Portal Link-Out Configurations.
 * DATA HONESTY: Never scrape or simulate land registry credentials.
 * Link-out only with explicit copyable query fields.
 * "Verify URLs are current before release."
 */

export interface PortalLink {
  id: string;
  name: string;
  authority: string;
  description: string;
  url: string;
  fieldsToLookup: string[];
}

export const OFFICIAL_PORTALS: PortalLink[] = [
  {
    id: 'bhoomi',
    name: 'Bhoomi RTC Portal',
    authority: 'Revenue Department, Government of Karnataka',
    description: 'Land Records Management System for Record of Rights, Tenancy and Crops (RTC) and mutation status.',
    url: 'https://landrecords.karnataka.gov.in/service2/',
    fieldsToLookup: ['District: Bengaluru Urban', 'Taluk / Hobli', 'Village', 'Survey Number / Hissa']
  },
  {
    id: 'kgis',
    name: 'Karnataka GIS (KGIS)',
    authority: 'KSRSAC, Government of Karnataka',
    description: 'State spatial data infrastructure displaying cadastral village boundaries and survey parcel maps.',
    url: 'https://kgis.ksrsac.in/',
    fieldsToLookup: ['Spatial Coordinates (Lat / Lng)', 'Cadastral Boundary Map Layer', 'Industrial Zonal Overlays']
  },
  {
    id: 'bengaluru-urban',
    name: 'Bengaluru Urban Property Portal',
    authority: 'District Administration, Bengaluru Urban',
    description: 'Official portal for verifying government encumbrance, taluk boundaries, and property revenue records.',
    url: 'https://bengaluruurban.nic.in/',
    fieldsToLookup: ['Survey No.', 'Khata Certificate / Extract', 'Registered Document Deeds']
  }
];
