import { describe, it, expect } from 'vitest';
import {
  FX_INR_PER_USD,
  DEFAULT_DELIVERY_COST_PER_KM_INR,
  DEFAULT_FIXED_WAREHOUSE_LEASE_INR,
  currencySymbol,
  convertInrToDisplay,
  convertInput,
  formatMoney,
} from './currency';

describe('Currency System (INR canonical, USD derived)', () => {
  it('exports FX_INR_PER_USD as 85', () => {
    expect(FX_INR_PER_USD).toBe(85);
  });

  it('exports canonical INR demo defaults', () => {
    expect(DEFAULT_DELIVERY_COST_PER_KM_INR).toBe(35);
    expect(DEFAULT_FIXED_WAREHOUSE_LEASE_INR).toBe(15000);
  });

  it('returns proper currency symbols', () => {
    expect(currencySymbol('INR')).toBe('₹');
    expect(currencySymbol('USD')).toBe('$');
  });

  describe('convertInrToDisplay & convertInput round-trip', () => {
    it('converts INR directly (1:1)', () => {
      expect(convertInrToDisplay(1000, 'INR')).toBe(1000);
      expect(convertInput(1000, 'INR')).toBe(1000);
    });

    it('converts USD accurately using FX rate 85', () => {
      expect(convertInrToDisplay(85, 'USD')).toBe(1);
      expect(convertInput(1, 'USD')).toBe(85);
      expect(convertInrToDisplay(8500, 'USD')).toBe(100);
      expect(convertInput(100, 'USD')).toBe(8500);
    });

    it('maintains round-trip consistency within 1% rounding tolerance', () => {
      const testValuesUSD = [0.41, 10, 176.47, 500, 25000, 1000000];
      for (const val of testValuesUSD) {
        const inr = convertInput(val, 'USD');
        const backToUsd = convertInrToDisplay(inr, 'USD');
        expect(Math.abs(backToUsd - val)).toBeLessThan(0.0001);
      }
    });

    it('handles zero cleanly', () => {
      expect(convertInrToDisplay(0, 'INR')).toBe(0);
      expect(convertInrToDisplay(0, 'USD')).toBe(0);
      expect(convertInput(0, 'INR')).toBe(0);
      expect(convertInput(0, 'USD')).toBe(0);
    });

    it('handles negative values cleanly', () => {
      expect(convertInrToDisplay(-850, 'USD')).toBe(-10);
      expect(convertInput(-10, 'USD')).toBe(-850);
    });
  });

  describe('formatMoney', () => {
    it('formats zero correctly', () => {
      expect(formatMoney(0, 'INR')).toBe('₹0.00');
      expect(formatMoney(0, 'USD')).toBe('$0.00');
      expect(formatMoney(0, 'INR', { compact: true })).toBe('₹0');
      expect(formatMoney(0, 'USD', { compact: true })).toBe('$0');
    });

    it('formats full money in Indian numbering (lakhs & crores grouping)', () => {
      // 1,50,000 INR
      const formatted = formatMoney(150000, 'INR');
      expect(formatted).toContain('₹');
      expect(formatted).toContain('1,50,000.00');
    });

    it('formats full money in US numbering for USD', () => {
      // 85,000 INR = 1,000 USD
      const formatted = formatMoney(85000, 'USD');
      expect(formatted).toBe('$1,000.00');
    });

    it('formats compact numbers for large INR values (Crores & Lakhs)', () => {
      // 1.2 Crore = 12,000,000 INR
      expect(formatMoney(12000000, 'INR', { compact: true })).toBe('₹1.20 Cr');
      // 12.4 Lakh = 1,240,000 INR
      expect(formatMoney(1240000, 'INR', { compact: true })).toBe('₹12.4 L');
    });

    it('formats compact numbers for large USD values (M and k)', () => {
      // $1.4M in INR = 1.4M * 85 = 119,000,000 INR
      expect(formatMoney(1400000 * 85, 'USD', { compact: true })).toBe('$1.40M');
      // $50k in INR = 50,000 * 85 = 4,250,000 INR
      expect(formatMoney(50000 * 85, 'USD', { compact: true })).toBe('$50.0k');
    });

    it('formats negative numbers with correct sign placement', () => {
      expect(formatMoney(-5000, 'INR')).toBe('-₹5,000.00');
      expect(formatMoney(-8500, 'USD')).toBe('-$100.00');
      expect(formatMoney(-1240000, 'INR', { compact: true })).toBe('-₹12.4 L');
      expect(formatMoney(-1400000 * 85, 'USD', { compact: true })).toBe('-$1.40M');
    });

    it('supports signed formatting (+ sign for positive values)', () => {
      expect(formatMoney(5000, 'INR', { signed: true })).toBe('+₹5,000.00');
      expect(formatMoney(-5000, 'INR', { signed: true })).toBe('-₹5,000.00');
    });

    it('handles non-finite or invalid inputs gracefully', () => {
      expect(formatMoney(NaN, 'INR')).toBe('—');
      expect(formatMoney(Infinity, 'USD')).toBe('—');
    });
  });
});
