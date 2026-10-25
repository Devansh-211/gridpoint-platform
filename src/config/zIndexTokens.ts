/**
 * Z-Index Token Scale
 * Defined strict stacking order:
 * map/overlays (10) < sticky header (30) < drawers (40) < popovers (50) < dialogs (60) < toasts (70)
 */

export const Z_INDEX = {
  mapContainer: 0,
  mapOverlays: 10,
  stickyHeader: 30,
  drawers: 40,
  popovers: 50,
  dialogs: 60,
  toasts: 70,
} as const;

export const Z_CLASSES = {
  mapContainer: 'relative isolate z-0',
  mapOverlays: 'z-[10]',
  stickyHeader: 'z-[30]',
  drawers: 'z-[40]',
  popovers: 'z-[50]',
  dialogs: 'z-[60]',
  toasts: 'z-[70]',
} as const;
