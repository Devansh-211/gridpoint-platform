import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LogisticsAssistant } from './LogisticsAssistant';

describe('LogisticsAssistant Component', () => {
  const mockOnClose = vi.fn();
  const mockOnApplyParams = vi.fn();
  const mockPageContext = {
    screen: 'Network Topology',
    total_demand: 25000,
    active_warehouses: ['Peenya', 'Whitefield'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when isOpen is false', () => {
    render(
      <LogisticsAssistant
        isOpen={false}
        onClose={mockOnClose}
        onApplyParams={mockOnApplyParams}
        pageContext={mockPageContext}
        currency="INR"
      />
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders correctly when isOpen is true', () => {
    render(
      <LogisticsAssistant
        isOpen={true}
        onClose={mockOnClose}
        onApplyParams={mockOnApplyParams}
        pageContext={mockPageContext}
        currency="INR"
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Logistics AI Assistant')).toBeInTheDocument();
    expect(screen.getByText('1. Network Setup')).toBeInTheDocument();
    expect(screen.getByText('2. Explain Results')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(
      <LogisticsAssistant
        isOpen={true}
        onClose={mockOnClose}
        onApplyParams={mockOnApplyParams}
        pageContext={mockPageContext}
        currency="INR"
      />
    );

    const closeBtn = screen.getByTitle('Close Assistant');
    fireEvent.click(closeBtn);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('handles Escape key to close', () => {
    render(
      <LogisticsAssistant
        isOpen={true}
        onClose={mockOnClose}
        onApplyParams={mockOnApplyParams}
        pageContext={mockPageContext}
        currency="INR"
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('handles parameter extraction and applies optimization parameters', async () => {
    // Mock successful /api/agent/extract response
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url === '/api/agent/extract') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              status: 'confirm',
              reply: 'Optimizing for 3 facilities with 4000 capacity.',
              extracted_params: {
                warehouse_count: 3,
                warehouse_capacity: 4000,
                max_service_radius_km: 20,
                priority_preset: 'speed',
                fixed_cost_per_warehouse: 15000,
              },
              ready_to_optimize: true,
            }),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    render(
      <LogisticsAssistant
        isOpen={true}
        onClose={mockOnClose}
        onApplyParams={mockOnApplyParams}
        pageContext={mockPageContext}
        currency="INR"
      />
    );

    const input = screen.getByPlaceholderText(/Set up 3 warehouses with 4000 capacity/i);
    fireEvent.change(input, { target: { value: 'Optimize 3 warehouses with 4000 capacity and 20km radius' } });

    const sendBtn = screen.getByTitle('Send message');
    fireEvent.click(sendBtn);

    // Wait for assistant reply and confirmation card
    await waitFor(() => {
      expect(screen.getByText('Extracted Parameters')).toBeInTheDocument();
    });

    // Apply optimization
    const applyBtn = screen.getByRole('button', { name: /Apply & Run Optimization/i });
    fireEvent.click(applyBtn);

    expect(mockOnApplyParams).toHaveBeenCalledWith(
      expect.objectContaining({
        p: 3,
        warehouseCapacity: 4000,
        radiusMaxKm: 20,
        priorityPreset: 'speed',
      })
    );
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('displays friendly error banner on network failure without crashing', async () => {
    // Mock failing /api/agent/extract
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error connecting to Gemini API'));

    render(
      <LogisticsAssistant
        isOpen={true}
        onClose={mockOnClose}
        onApplyParams={mockOnApplyParams}
        pageContext={mockPageContext}
        currency="INR"
      />
    );

    const input = screen.getByPlaceholderText(/Set up 3 warehouses with 4000 capacity/i);
    fireEvent.change(input, { target: { value: 'Optimize network' } });

    const sendBtn = screen.getByTitle('Send message');
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Network error connecting to Gemini API/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
    });
  });
});
