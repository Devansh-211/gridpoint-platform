import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TopologyDiffBanner } from './TopologyDiffBanner';
import { TopologyDiff } from '../lib/networkState';

describe('TopologyDiffBanner', () => {
  it('renders nothing when diff is null', () => {
    const { container } = render(<TopologyDiffBanner diff={null} currency="INR" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when no structural changes exist', () => {
    const diff: TopologyDiff = {
      openedHubs: [],
      closedHubs: [],
      reassignedZoneCount: 0,
      spilloverZoneCount: 0,
      costDeltaInr: 0,
      costDeltaPct: 0,
      previousTotalCostInr: 1000,
      currentTotalCostInr: 1000,
      utilizationDeltaPct: 0,
      previousUtilizationPct: 50,
      currentUtilizationPct: 50,
    };
    const { container } = render(<TopologyDiffBanner diff={diff} currency="INR" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders opened/closed hubs, cost delta, and spillover badges', () => {
    const diff: TopologyDiff = {
      openedHubs: ['Bommasandra Industrial'],
      closedHubs: ['Peenya Industrial'],
      reassignedZoneCount: 4,
      spilloverZoneCount: 1,
      costDeltaInr: 1200,
      costDeltaPct: 3.5,
      previousTotalCostInr: 34000,
      currentTotalCostInr: 35200,
      utilizationDeltaPct: 5.2,
      previousUtilizationPct: 70.0,
      currentUtilizationPct: 75.2,
    };

    render(<TopologyDiffBanner diff={diff} currency="INR" />);
    expect(screen.getByText('Network Topology Recomputed')).toBeInTheDocument();
    expect(screen.getByText('Bommasandra Industrial')).toBeInTheDocument();
    expect(screen.getByText('Peenya Industrial')).toBeInTheDocument();
    expect(screen.getByText(/4/)).toBeInTheDocument();
    expect(screen.getByText(/1 spillover split flow/)).toBeInTheDocument();
  });
});
