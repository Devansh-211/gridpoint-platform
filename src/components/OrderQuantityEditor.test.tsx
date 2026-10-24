import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OrderQuantityEditor } from './OrderQuantityEditor';

describe('OrderQuantityEditor Component', () => {
  it('renders base orders and allows steppers click', () => {
    const mockChangeBase = vi.fn();
    const mockChangeMult = vi.fn();

    render(
      <OrderQuantityEditor
        baseOrders={420}
        multiplier={1.0}
        onChangeBaseOrders={mockChangeBase}
        onChangeMultiplier={mockChangeMult}
      />
    );

    expect(screen.getByDisplayValue('420')).toBeInTheDocument();

    // Click +50 stepper
    const addBtn = screen.getByTitle('Add 50 orders');
    fireEvent.click(addBtn);
    expect(mockChangeBase).toHaveBeenCalledWith(470);

    // Click -50 stepper
    const subBtn = screen.getByTitle('Subtract 50 orders');
    fireEvent.click(subBtn);
    expect(mockChangeBase).toHaveBeenCalledWith(370);
  });

  it('commits typed input on Enter and reverts on Escape', () => {
    const mockChangeBase = vi.fn();
    const mockChangeMult = vi.fn();

    render(
      <OrderQuantityEditor
        baseOrders={420}
        multiplier={1.0}
        onChangeBaseOrders={mockChangeBase}
        onChangeMultiplier={mockChangeMult}
      />
    );

    const input = screen.getByDisplayValue('420');

    // Type 2800 and hit Enter
    fireEvent.change(input, { target: { value: '2800' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockChangeBase).toHaveBeenCalledWith(2800);

    // Type 9999 and hit Escape -> should revert to 420
    fireEvent.change(input, { target: { value: '9999' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.getByDisplayValue('420')).toBeInTheDocument();
  });

  it('activates surge multipliers', () => {
    const mockChangeBase = vi.fn();
    const mockChangeMult = vi.fn();

    render(
      <OrderQuantityEditor
        baseOrders={400}
        multiplier={1.5}
        onChangeBaseOrders={mockChangeBase}
        onChangeMultiplier={mockChangeMult}
      />
    );

    // Should show surge indicator = 600
    expect(screen.getByText('= 600')).toBeInTheDocument();

    const mult2xBtn = screen.getByText('2x');
    fireEvent.click(mult2xBtn);
    expect(mockChangeMult).toHaveBeenCalledWith(2.0);
  });
});
