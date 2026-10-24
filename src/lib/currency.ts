/**
 * GRIDPOINT — Currency System
 * Canonical storage unit is INR (₹). USD ($) is derived for display.
 * FX Rate: 1 USD = 85 INR (Fixed benchmark constant for Indian enterprise logistics context).
 */

/** Fixed foreign exchange rate: 1 USD = 85 INR */
export const FX_INR_PER_USD = 85;

/** Canonical default values stored in INR */
export const DEFAULT_DELIVERY_COST_PER_KM_INR = 35; // ₹35/km (≈ $0.41/km)
export const DEFAULT_FIXED_WAREHOUSE_LEASE_INR = 15000; // ₹15,000/site/day (≈ $176.47/site/day)

export type Currency = 'INR' | 'USD';

export interface FormatMoneyOptions {
  /** Use compact notation (e.g. ₹1.2 Cr / ₹12.4 L for INR, $1.4M for USD) */
  compact?: boolean;
  /** Explicit number of fraction digits */
  decimals?: number;
  /** Whether to prefix with currency symbol */
  showSymbol?: boolean;
  /** Show explicit plus/minus sign */
  signed?: boolean;
}

/**
 * Returns the currency symbol for the given currency code.
 */
export function currencySymbol(currency: Currency): string {
  return currency === 'INR' ? '₹' : '$';
}

/**
 * Converts a canonical INR value into the target display currency amount.
 */
export function convertInrToDisplay(inrValue: number, currency: Currency): number {
  if (!Number.isFinite(inrValue)) return 0;
  return currency === 'INR' ? inrValue : inrValue / FX_INR_PER_USD;
}

/**
 * Converts a user-typed value in current display currency back into canonical INR.
 */
export function convertInput(displayValue: number, currency: Currency): number {
  if (!Number.isFinite(displayValue)) return 0;
  return currency === 'INR' ? displayValue : displayValue * FX_INR_PER_USD;
}

/**
 * Formats a canonical INR value into a currency string.
 *
 * Supports compact notation:
 * - INR: ₹X.X Cr (Crores >= 10M), ₹X.X L (Lakhs >= 100k)
 * - USD: $X.XM (Millions >= 1M), $X.XK (Thousands >= 1k)
 */
export function formatMoney(
  inrValue: number,
  currency: Currency,
  opts: FormatMoneyOptions = {}
): string {
  if (!Number.isFinite(inrValue)) return '—';

  const { compact = false, showSymbol = true, signed = false } = opts;
  const symbol = showSymbol ? currencySymbol(currency) : '';
  const isNegative = inrValue < 0;
  const absInr = Math.abs(inrValue);
  const displayVal = convertInrToDisplay(absInr, currency);

  let formattedValue: string;

  if (compact) {
    if (currency === 'INR') {
      if (absInr >= 10_000_000) {
        // Crores (1 Cr = 10,000,000)
        const cr = absInr / 10_000_000;
        formattedValue = `${cr.toFixed(cr >= 10 ? 1 : 2)} Cr`;
      } else if (absInr >= 100_000) {
        // Lakhs (1 L = 100,000)
        const lk = absInr / 100_000;
        formattedValue = `${lk.toFixed(lk >= 10 ? 1 : 2)} L`;
      } else if (absInr >= 1_000) {
        const k = absInr / 1_000;
        formattedValue = `${k.toFixed(1)}k`;
      } else {
        formattedValue = absInr.toFixed(opts.decimals ?? 0);
      }
    } else {
      // USD Compact (Millions / Thousands)
      if (displayVal >= 1_000_000) {
        const m = displayVal / 1_000_000;
        formattedValue = `${m.toFixed(m >= 10 ? 1 : 2)}M`;
      } else if (displayVal >= 1_000) {
        const k = displayVal / 1_000;
        formattedValue = `${k.toFixed(k >= 10 ? 1 : 2)}k`;
      } else {
        formattedValue = displayVal.toFixed(opts.decimals ?? 0);
      }
    }
  } else {
    // Full formatting using Intl.NumberFormat
    const decimals = opts.decimals !== undefined ? opts.decimals : 2;
    const locale = currency === 'INR' ? 'en-IN' : 'en-US';
    formattedValue = new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(displayVal);
  }

  // Handle Sign
  if (isNegative) {
    return `-${symbol}${formattedValue}`;
  }
  if (signed && inrValue > 0) {
    return `+${symbol}${formattedValue}`;
  }
  return `${symbol}${formattedValue}`;
}

/**
 * Converts an amount between currencies (INR <-> USD)
 */
export function convertCurrency(amount: number, from: Currency, to: Currency): number {
  if (from === to) return amount;
  if (from === 'INR' && to === 'USD') return amount / FX_INR_PER_USD;
  return amount * FX_INR_PER_USD;
}
