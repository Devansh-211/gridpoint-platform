import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Z_INDEX, Z_CLASSES } from '../config/zIndexTokens';
import { PhotonSearch } from '../components/PhotonSearch';
import { ZoneInspectorDrawer } from '../components/ZoneInspectorDrawer';
import { EditableZone } from '../lib/networkState';

describe('BUG 3: Stacking Context & Z-Index Tokens', () => {
  const originalOverflow = document.body.style.overflow;

  afterEach(() => {
    document.body.style.overflow = originalOverflow;
  });

  it('enforces strict z-index hierarchy token order', () => {
    expect(Z_INDEX.mapContainer).toBeLessThan(Z_INDEX.mapOverlays);
    expect(Z_INDEX.mapOverlays).toBeLessThan(Z_INDEX.stickyHeader);
    expect(Z_INDEX.stickyHeader).toBeLessThan(Z_INDEX.drawers);
    expect(Z_INDEX.drawers).toBeLessThan(Z_INDEX.popovers);
    expect(Z_INDEX.popovers).toBeLessThan(Z_INDEX.dialogs);
    expect(Z_INDEX.dialogs).toBeLessThan(Z_INDEX.toasts);

    expect(Z_CLASSES.mapContainer).toContain('isolate');
    expect(Z_CLASSES.dialogs).toBe('z-[60]');
    expect(Z_CLASSES.drawers).toBe('z-[40]');
    expect(Z_CLASSES.mapOverlays).toBe('z-[10]');
  });

  it('renders Add Location modal into document.body via Portal with dialog z-index token', () => {
    const mockPlace = {
      lat: 12.9716,
      lng: 77.5946,
      name: 'MG Road',
      label: 'MG Road, Bengaluru',
      country: 'India',
    };

    const handleClearExternal = vi.fn();

    render(
      <PhotonSearch
        onAddZone={vi.fn()}
        onAddHub={vi.fn()}
        existingZones={[]}
        existingHubs={[]}
        currency="INR"
        externalPlace={mockPlace}
        onClearExternalPlace={handleClearExternal}
      />
    );

    // Dialog is rendered via portal directly under document.body
    const dialogElement = screen.getByRole('dialog');
    expect(dialogElement.parentElement).toBe(document.body);
    expect(dialogElement.className).toContain('z-[60]');
    expect(document.body.style.overflow).toBe('hidden');

    // Press Escape to dismiss
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handleClearExternal).toHaveBeenCalled();
  });

  it('restores body scroll and exits map click when modal closes via Cancel', () => {
    const mockPlace = {
      lat: 12.9716,
      lng: 77.5946,
      name: 'Indiranagar',
      label: 'Indiranagar 100ft Road',
      country: 'India',
    };

    const handleClearExternal = vi.fn();

    const { rerender } = render(
      <PhotonSearch
        onAddZone={vi.fn()}
        onAddHub={vi.fn()}
        existingZones={[]}
        existingHubs={[]}
        currency="INR"
        externalPlace={mockPlace}
        onClearExternalPlace={handleClearExternal}
      />
    );

    expect(document.body.style.overflow).toBe('hidden');

    // Click Cancel button
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(handleClearExternal).toHaveBeenCalled();

    rerender(
      <PhotonSearch
        onAddZone={vi.fn()}
        onAddHub={vi.fn()}
        existingZones={[]}
        existingHubs={[]}
        currency="INR"
        externalPlace={null}
        onClearExternalPlace={handleClearExternal}
      />
    );

    expect(document.body.style.overflow).toBe('');
  });

  it('renders ZoneInspectorDrawer via Portal to document.body with drawers z-index token', () => {
    const sampleZone: EditableZone = {
      id: 'ZN-BLR-01',
      name: 'Koramangala 4th Block',
      lat: 12.9352,
      lng: 77.6245,
      baseOrders: 420,
      multiplier: 1.0,
      source: 'demo',
    };

    render(
      <ZoneInspectorDrawer
        isOpen={true}
        onClose={vi.fn()}
        item={{ type: 'zone', zone: sampleZone }}
        onUpdateZone={vi.fn()}
        onDeleteZone={vi.fn()}
        onUpdateHub={vi.fn()}
        onDeleteHub={vi.fn()}
        currency="INR"
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.parentElement).toBe(document.body);
    expect(dialog.className).toContain('z-[40]');
  });
});
