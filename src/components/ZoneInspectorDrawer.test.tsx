import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ZoneInspectorDrawer } from './ZoneInspectorDrawer';
import { EditableZone, EditableHub } from '../lib/networkState';

describe('ZoneInspectorDrawer', () => {
  const sampleZone: EditableZone = {
    id: 'ZN-1',
    name: 'Koramangala',
    lat: 12.9352,
    lng: 77.6245,
    baseOrders: 420,
    multiplier: 1,
    source: 'demo',
  };

  const sampleHub: EditableHub = {
    id: 'HUB-1',
    name: 'Peenya Industrial',
    lat: 13.0292,
    lng: 77.5204,
    capacity: 4000,
    dailyLease: 15000,
    source: 'demo',
  };

  it('renders nothing when not open', () => {
    const { container } = render(
      <ZoneInspectorDrawer
        isOpen={false}
        onClose={vi.fn()}
        item={{ type: 'zone', zone: sampleZone }}
        onUpdateZone={vi.fn()}
        onDeleteZone={vi.fn()}
        onUpdateHub={vi.fn()}
        onDeleteHub={vi.fn()}
        currency="INR"
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders zone details and allows updating zone name', () => {
    const onUpdateZone = vi.fn();
    render(
      <ZoneInspectorDrawer
        isOpen={true}
        onClose={vi.fn()}
        item={{ type: 'zone', zone: sampleZone }}
        onUpdateZone={onUpdateZone}
        onDeleteZone={vi.fn()}
        onUpdateHub={vi.fn()}
        onDeleteHub={vi.fn()}
        currency="INR"
      />
    );

    expect(screen.getByText('Delivery Zone Inspector')).toBeInTheDocument();
    const nameInput = screen.getByLabelText('Location Name');
    expect(nameInput).toHaveValue('Koramangala');

    fireEvent.change(nameInput, { target: { value: 'Koramangala Central' } });
    expect(onUpdateZone).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Koramangala Central' })
    );
  });

  it('renders hub details and allows updating capacity', () => {
    const onUpdateHub = vi.fn();
    render(
      <ZoneInspectorDrawer
        isOpen={true}
        onClose={vi.fn()}
        item={{ type: 'hub', hub: sampleHub }}
        onUpdateZone={vi.fn()}
        onDeleteZone={vi.fn()}
        onUpdateHub={onUpdateHub}
        onDeleteHub={vi.fn()}
        currency="INR"
      />
    );

    expect(screen.getByText('Candidate Hub Inspector')).toBeInTheDocument();
    const capInput = screen.getByLabelText(/Throughput Capacity/);
    expect(capInput).toHaveValue(4000);

    fireEvent.change(capInput, { target: { value: '5500' } });
    expect(onUpdateHub).toHaveBeenCalledWith(
      expect.objectContaining({ capacity: 5500 })
    );
  });

  it('triggers delete callback when delete button clicked', () => {
    const onDeleteZone = vi.fn();
    const onClose = vi.fn();
    render(
      <ZoneInspectorDrawer
        isOpen={true}
        onClose={onClose}
        item={{ type: 'zone', zone: sampleZone }}
        onUpdateZone={vi.fn()}
        onDeleteZone={onDeleteZone}
        onUpdateHub={vi.fn()}
        onDeleteHub={vi.fn()}
        currency="INR"
      />
    );

    const deleteBtn = screen.getByText(/Delete Delivery Zone/);
    fireEvent.click(deleteBtn);
    expect(onDeleteZone).toHaveBeenCalledWith('ZN-1');
    expect(onClose).toHaveBeenCalled();
  });
});
