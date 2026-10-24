/**
 * Documented Intraday Hourly Demand Distribution Profile (Assumption)
 * Normalized fractions representing typical urban quick-commerce and e-commerce delivery curves in Bengaluru.
 * Peak delivery traffic occurs during evening window (19:00 - 20:30).
 */

export interface HourlyBucket {
  hourLabel: string;
  fraction: number; // Sums to 1.0
  isPeak: boolean;
}

export const HOURLY_SHAPE_PROFILE: HourlyBucket[] = [
  { hourLabel: '08:00', fraction: 0.035, isPeak: false },
  { hourLabel: '09:00', fraction: 0.045, isPeak: false },
  { hourLabel: '10:00', fraction: 0.055, isPeak: false },
  { hourLabel: '11:00', fraction: 0.060, isPeak: false },
  { hourLabel: '12:00', fraction: 0.065, isPeak: false },
  { hourLabel: '13:00', fraction: 0.055, isPeak: false },
  { hourLabel: '14:00', fraction: 0.050, isPeak: false },
  { hourLabel: '15:00', fraction: 0.055, isPeak: false },
  { hourLabel: '16:00', fraction: 0.065, isPeak: false },
  { hourLabel: '17:00', fraction: 0.080, isPeak: false },
  { hourLabel: '18:00', fraction: 0.095, isPeak: false },
  { hourLabel: '19:00', fraction: 0.130, isPeak: true },  // Peak 19:30 window
  { hourLabel: '20:00', fraction: 0.110, isPeak: false },
  { hourLabel: '21:00', fraction: 0.065, isPeak: false },
  { hourLabel: '22:00', fraction: 0.045, isPeak: false },
  { hourLabel: '23:00', fraction: 0.020, isPeak: false },
];

export const PEAK_HOUR_LABEL = '19:30';

/**
 * Calculates hourly order volume for a given total daily demand
 */
export function calculateHourlyOrders(dailyDemand: number): { label: string; orders: number; isPeak: boolean }[] {
  return HOURLY_SHAPE_PROFILE.map((bucket) => ({
    label: bucket.hourLabel,
    orders: Math.round(dailyDemand * bucket.fraction),
    isPeak: bucket.isPeak,
  }));
}
