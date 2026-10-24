import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOptimizationPipeline } from '../hooks/useOptimizationPipeline';
import { formatMoney, convertInput, currencySymbol, FX_INR_PER_USD } from '../lib/currency';

describe('Pipeline Resilience & Dead-Control Prevention', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('edit -> solve flow does not loop: applies synchronous arithmetic and debounces solve', async () => {
    const { result } = renderHook(() => useOptimizationPipeline());

    // Flush initial mount solve
    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    const targetZoneId = result.current.zones[0].id;

    // Perform 3 rapid zone edits within 150ms debounce window
    act(() => {
      result.current.handleUpdateZoneDemand(targetZoneId, 500, 1);
      result.current.handleUpdateZoneDemand(targetZoneId, 600, 1);
      result.current.handleUpdateZoneDemand(targetZoneId, 700, 1);
    });

    // Synchronous arithmetic update applies immediately
    expect(result.current.zones.find((z) => z.id === targetZoneId)?.baseOrders).toBe(700);

    // Advance by 100ms (still debounced)
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Advance past debounce window (150ms)
    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    // Zone orders remain stable at 700 without infinite re-solve looping
    expect(result.current.zones.find((z) => z.id === targetZoneId)?.baseOrders).toBe(700);
  });

  it('busy flag isSolving resets unconditionally via 5-second watchdog timer', async () => {
    const { result } = renderHook(() => useOptimizationPipeline());

    // Flush initial mount
    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    // Manually trigger solve
    act(() => {
      result.current.runManualSolve();
    });

    expect(result.current.isSolving).toBe(true);

    // If solver hung, advancing 5.5s must trigger the 5000ms watchdog
    act(() => {
      vi.advanceTimersByTime(5500);
    });

    // Watchdog resets busy state unconditionally so UI controls never stay stuck
    expect(result.current.isSolving).toBe(false);
  });

  it('handles corrupted localStorage without crashing and provides fallback defaults', () => {
    localStorage.setItem('gridpoint_saved_network', '{corrupt json invalid!!');
    localStorage.setItem('gridpoint_user_presets', 'null-and-not-an-object');
    localStorage.setItem('gridpoint_currency', 'INVALID_CURRENCY');

    const { result } = renderHook(() => useOptimizationPipeline());

    expect(result.current.currency).toBe('INR');
    expect(result.current.zones.length).toBeGreaterThan(0);
    expect(result.current.hubs.length).toBeGreaterThan(0);
  });

  it('currency never shows a stray mismatch between symbol and formatted value', () => {
    const testAmounts = [0, 420, 12500, 999999];

    for (const amt of testAmounts) {
      const formattedInr = formatMoney(amt, 'INR');
      const formattedUsd = formatMoney(amt, 'USD');

      // INR must contain ₹ and not $
      expect(formattedInr).toContain('₹');
      expect(formattedInr).not.toContain('$');

      // USD must contain $ and not ₹
      expect(formattedUsd).toContain('$');
      expect(formattedUsd).not.toContain('₹');

      // Verify symbol helper
      expect(currencySymbol('INR')).toBe('₹');
      expect(currencySymbol('USD')).toBe('$');

      // Verify FX rate constant and convertInput roundtrips
      expect(FX_INR_PER_USD).toBe(85);
      const convertedInr = convertInput(100, 'INR');
      const convertedUsd = convertInput(100, 'USD');
      expect(convertedInr).toBe(100);
      expect(convertedUsd).toBe(8500);
    }
  });
});
