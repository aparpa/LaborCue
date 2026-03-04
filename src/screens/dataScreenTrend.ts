import type { HRVReading } from '../types';

/**
 * Builds a smoothed trend line using a centered moving average.
 */
export function buildTrendLineDataset(
  readings: Pick<HRVReading, 'hrvValue'>[],
  windowSize = 3
): number[] {
  if (readings.length < 3) {
    return [];
  }

  const values = readings.map((r) => r.hrvValue);
  const halfWindow = Math.floor(windowSize / 2);

  return values.map((_, index) => {
    const start = Math.max(0, index - halfWindow);
    const end = Math.min(values.length - 1, index + halfWindow);
    const slice = values.slice(start, end + 1);
    const sum = slice.reduce((total, value) => total + value, 0);
    return Number((sum / slice.length).toFixed(2));
  });
}
