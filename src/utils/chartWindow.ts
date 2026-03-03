import type { HRVReading } from '../types';

export const BASE_WINDOW = 14;
export const MIN_WINDOW = 5;

/**
 * Clamp a numeric value between a minimum and maximum.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Calculate the number of points to display based on total readings and zoom level.
 */
export function getWindowSize(total: number, zoomLevel: number): number {
  if (total === 0) return 0;
  const baseWindow = Math.min(BASE_WINDOW, total);
  const minWindow = Math.min(MIN_WINDOW, total);
  const size = Math.round(baseWindow / zoomLevel);
  return clamp(size, minWindow, total);
}

/**
 * Keep the pan offset within valid bounds for the current window size.
 */
export function clampPanOffset(panOffset: number, total: number, windowSize: number): number {
  const maxPan = Math.max(0, total - windowSize);
  return clamp(panOffset, 0, maxPan);
}

/**
 * Return the subset of readings visible in the current zoom/pan window.
 */
export function getVisibleReadings(
  readings: HRVReading[],
  windowSize: number,
  panOffset: number
): HRVReading[] {
  const total = readings.length;
  if (total === 0 || windowSize === 0) return [];
  if (total <= windowSize) return readings;
  const clampedOffset = clampPanOffset(panOffset, total, windowSize);
  const startIndex = total - windowSize - clampedOffset;
  return readings.slice(startIndex, startIndex + windowSize);
}

/**
 * Convert a horizontal pan translation into a new pan offset.
 */
export function getPanOffsetFromTranslation(
  translationX: number,
  chartWidth: number,
  windowSize: number,
  currentPan: number,
  total: number
): number {
  if (chartWidth <= 0 || total <= windowSize) return 0;
  const shift = Math.round((translationX / chartWidth) * windowSize);
  return clampPanOffset(currentPan + shift, total, windowSize);
}
