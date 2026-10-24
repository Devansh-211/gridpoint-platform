import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PhotonSearch } from './PhotonSearch';
import * as photonService from '../services/photonService';

describe('PhotonSearch', () => {
  it('renders search bar and handles input changes', async () => {
    vi.spyOn(photonService, 'searchPhotonPlaces').mockResolvedValue([
      {
        label: 'Hebbal, Bengaluru, Karnataka',
        name: 'Hebbal',
        lat: 13.0358,
        lng: 77.597,
      },
    ]);

    render(
      <PhotonSearch
        onAddZone={vi.fn()}
        onAddHub={vi.fn()}
        existingZones={[]}
        existingHubs={[]}
        currency="INR"
      />
    );

    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'Hebbal' } });

    await waitFor(() => {
      expect(screen.getByText('Hebbal')).toBeInTheDocument();
    });
  });

  it('opens add to network modal when external place is provided (e.g. from map click)', () => {
    render(
      <PhotonSearch
        onAddZone={vi.fn()}
        onAddHub={vi.fn()}
        existingZones={[]}
        existingHubs={[]}
        currency="INR"
        externalPlace={{
          label: 'Dropped pin (12.9352, 77.6245)',
          name: 'Dropped pin',
          lat: 12.9352,
          lng: 77.6245,
        }}
      />
    );

    expect(screen.getByText('Add Location to Network')).toBeInTheDocument();
    expect(screen.getByText(/12.93520, 77.62450/)).toBeInTheDocument();
  });
});
