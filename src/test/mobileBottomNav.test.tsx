import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MobileBottomNav } from '../components/shell/MobileBottomNav';

describe('MobileBottomNav Component for Phone Screen Usability', () => {
  it('renders all primary tabs and More trigger', () => {
    const handleRouteChange = vi.fn();
    const handleOpenSidebar = vi.fn();

    render(
      <MobileBottomNav
        currentRoute="overview"
        onRouteChange={handleRouteChange}
        onOpenMobileSidebar={handleOpenSidebar}
      />
    );

    expect(screen.getByText('Overview')).toBeDefined();
    expect(screen.getByText('Map')).toBeDefined();
    expect(screen.getByText('Network')).toBeDefined();
    expect(screen.getByText('Solvers')).toBeDefined();
    expect(screen.getByText('Scenarios')).toBeDefined();
    expect(screen.getByText('More')).toBeDefined();
  });

  it('calls onRouteChange when tapping a tab', () => {
    const handleRouteChange = vi.fn();
    const handleOpenSidebar = vi.fn();

    render(
      <MobileBottomNav
        currentRoute="overview"
        onRouteChange={handleRouteChange}
        onOpenMobileSidebar={handleOpenSidebar}
      />
    );

    const mapBtn = screen.getByText('Map');
    fireEvent.click(mapBtn);
    expect(handleRouteChange).toHaveBeenCalledWith('map');

    const networkBtn = screen.getByText('Network');
    fireEvent.click(networkBtn);
    expect(handleRouteChange).toHaveBeenCalledWith('config');
  });

  it('triggers onOpenMobileSidebar when tapping More', () => {
    const handleRouteChange = vi.fn();
    const handleOpenSidebar = vi.fn();

    render(
      <MobileBottomNav
        currentRoute="overview"
        onRouteChange={handleRouteChange}
        onOpenMobileSidebar={handleOpenSidebar}
      />
    );

    const moreBtn = screen.getByText('More');
    fireEvent.click(moreBtn);
    expect(handleOpenSidebar).toHaveBeenCalledTimes(1);
  });
});
