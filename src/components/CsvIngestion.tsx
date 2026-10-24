import React, { useState } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { DeliveryZone } from '../types';

interface CsvIngestionProps {
  onZonesLoaded: (zones: DeliveryZone[]) => void;
  uploadInputRef: React.RefObject<HTMLInputElement>;
}

export const CsvIngestion: React.FC<CsvIngestionProps> = ({ onZonesLoaded, uploadInputRef }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const parseCsvText = (text: string) => {
    try {
      const lines = text.trim().split(/\r?\n/);
      if (lines.length < 2) {
        throw new Error('CSV file must contain a header and at least one delivery zone.');
      }

      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const idIdx = headers.indexOf('neighborhood_id');
      const nameIdx = headers.indexOf('name');
      const latIdx = headers.indexOf('latitude');
      const lonIdx = headers.indexOf('longitude');
      const demIdx = headers.indexOf('daily_orders');

      if (idIdx === -1 || nameIdx === -1 || latIdx === -1 || lonIdx === -1 || demIdx === -1) {
        throw new Error('CSV must include: neighborhood_id, name, latitude, longitude, daily_orders');
      }

      const zones: DeliveryZone[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(',').map((c) => c.trim());
        const id = cols[idIdx];
        const name = cols[nameIdx];
        const lat = parseFloat(cols[latIdx]);
        const lon = parseFloat(cols[lonIdx]);
        const orders = parseFloat(cols[demIdx]);

        if (!id || !name || isNaN(lat) || isNaN(lon) || isNaN(orders)) {
          throw new Error(`Invalid row ${i}: check coordinate and order numbers.`);
        }

        zones.push({
          neighborhood_id: id,
          name,
          latitude: lat,
          longitude: lon,
          daily_orders: orders,
        });
      }

      if (zones.length === 0) {
        throw new Error('No valid delivery zones found in CSV.');
      }

      setStatusMsg({
        type: 'success',
        text: `Successfully ingested ${zones.length} custom delivery zones! Solving network...`,
      });
      onZonesLoaded(zones);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to parse CSV file.' });
    }
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) parseCsvText(content);
    };
    reader.readAsText(file);
  };

  return (
    <div id="ingestionDropzone" className="rounded-xl border border-gp-border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between border-b border-gp-border pb-3">
        <div>
          <h3 className="text-sm font-bold text-gp-text-primary">Demand Data Ingestion (Custom CSV)</h3>
          <p className="text-xs text-gp-text-secondary">
            Upload custom enterprise delivery zones with coordinates and daily order volume
          </p>
        </div>
        <div className="text-xs text-gp-text-tertiary">Schema: id, name, lat, lon, daily_orders</div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
          }
        }}
        className={`mt-4 flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition ${
          isDragging ? 'border-gp-primary-500 bg-blue-50/50' : 'border-gp-border hover:bg-slate-50'
        }`}
      >
        <Upload className="h-8 w-8 text-gp-primary-500" />
        <div className="mt-2 text-xs font-semibold text-gp-text-primary">
          Drag & Drop custom delivery zones CSV here, or
        </div>
        <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gp-border bg-white px-3 py-1.5 text-xs font-bold text-gp-primary-600 shadow-sm hover:bg-gp-sunken">
          <FileText className="h-3.5 w-3.5" />
          <span>Browse File</span>
          <input
            ref={uploadInputRef}
            type="file"
            accept=".csv"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFile(e.target.files[0]);
              }
            }}
            className="sr-only"
          />
        </label>
      </div>

      {statusMsg && (
        <div
          className={`mt-3 flex items-center gap-2 rounded-lg border p-2.5 text-xs font-medium ${
            statusMsg.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}
    </div>
  );
};
