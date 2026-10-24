import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ZoneDemandTable } from './ZoneDemandTable';
import { EditableZone } from '../lib/networkState';

describe('ZoneDemandTable', () => {
  const sampleZones: EditableZone[] = [
    { id: 'ZN-1', name: 'Koramangala', lat: 12.9352, lng: 77.6245, baseOrders: 420, multiplier: 1, source: 'demo' },
    { id: 'ZN-2', name: 'Indiranagar', lat: 12.9784, lng: 77.6408, baseOrders: 380, multiplier: 1.5, source: 'demo' },
  ];

  it('renders zone names, coordinates, and total orders', () => {
    render(
      <ZoneDemandTable
        zones={sampleZones}
        onUpdateZoneDemand={vi.fn()}
        onSelectZone={vi.fn()}
        onDeleteZone={vi.fn()}
      />
    );

    expect(screen.getByText('Koramangala')).toBeInTheDocument();
    expect(screen.getByText('Indiranagar')).toBeInTheDocument();
    expect(screen.getByText('2 Zones')).toBeInTheDocument();
    // 420*1 + 380*1.5 = 420 + 570 = 990
    expect(screen.getByText('990')).toBeInTheDocument();
  });

  it('filters zones using search input', () => {
    render(
      <ZoneDemandTable
        zones={sampleZones}
        onUpdateZoneDemand={vi.fn()}
        onSelectZone={vi.fn()}
        onDeleteZone={vi.fn()}
      />
    );

    const searchInput = screen.getByPlaceholderText('Filter zones by name or ID...');
    fireEvent.change(searchInput, { target: { value: 'Kora' } });

    expect(screen.getByText('Koramangala')).toBeInTheDocument();
    expect(screen.queryByText('Indiranagar')).not.toBeInTheDocument();
  });

  it('triggers delete zone callback', () => {
    const onDelete = vi.fn();
    render(
      <ZoneDemandTable
        zones={sampleZones}
        onUpdateZoneDemand={vi.fn()}
        onSelectZone={vi.fn()}
        onDeleteZone={onDelete}
      />
    );

    const deleteButtons = screen.getAllByTitle('Delete Zone');
    fireEvent.click(deleteButtons[0]);
    expect(onDelete).toHaveBeenCalledWith('ZN-1');
  });
});
