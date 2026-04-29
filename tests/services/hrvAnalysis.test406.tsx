import {
  analyzeHRV,
  calculateWeeklyAverages,
  __testables,
} from '../../src/services/hrvAnalysis';
import type { HRVReading } from '../../src/types';
import { InversionStatus } from '../../src/types';

/**
 * @brief Build sequential HRV readings for STORY-406 spline model tests.
 * @param values HRV values in chronological order.
 * @param startWeek Starting gestational week for generated readings.
 * @param startDate Base ISO timestamp for the first reading.
 * @returns Array of HRVReading values spaced two days apart.
 */
const buildReadings = (
  values: number[],
  startWeek = 20,
  startDate = '2024-01-01T00:00:00.000Z'
): HRVReading[] =>
  values.map((value, index) => {
    const timestamp = new Date(startDate);
    timestamp.setDate(timestamp.getDate() + index * 2);

    return {
      id: `story406-r${index + 1}`,
      timestamp: timestamp.toISOString(),
      hrvValue: value,
      gestationalWeek: startWeek + index,
      gestationalDay: (index * 2) % 7,
      source: 'manual',
    };
  });

/**
 * @brief Tests for STORY-406 spline model behavior.
 */
describe('Story 406 - spline model implementation', () => {
  /**
   * @brief The broken-stick spline should place its knot near the observed turnaround week.
   */
  it('finds a spline knot near the HRV inflection point', () => {
    const readings = buildReadings(
      [140, 132, 124, 116, 108, 100, 92, 84, 76, 68, 60, 62, 68, 76, 86, 98]
    );

    const weeklyPoints = calculateWeeklyAverages(readings).map((aggregate) => ({
      gestationalWeek: aggregate.gestationalWeek,
      averageHRV: aggregate.averageHRV,
      readingCount: aggregate.readingCount,
    }));
    const splineFit = __testables.findBestSplineFit(weeklyPoints);

    expect(splineFit).not.toBeNull();
    expect(splineFit?.slope).toBeLessThan(0);
    expect(splineFit?.postKnotSlope).toBeGreaterThan(0);
    expect(splineFit?.knotWeek).toBeGreaterThanOrEqual(30);
    expect(splineFit?.knotWeek).toBeLessThanOrEqual(32);
  });

  /**
   * @brief A clear decline-then-rise pattern should be classified as an inversion.
   */
  it('detects inversion from the spline model when HRV turns upward early', () => {
    const readings = buildReadings(
      [140, 132, 124, 116, 108, 100, 92, 84, 76, 68, 60, 62, 68, 76, 86, 98]
    );

    const inversion = __testables.detectInversion(readings);
    const result = analyzeHRV(readings, '2024-12-01T00:00:00.000Z');

    expect(inversion.inversionDetected).toBe(true);
    expect(inversion.inversionWeek).toBeGreaterThanOrEqual(30);
    expect(inversion.inversionWeek).toBeLessThanOrEqual(32);
    expect(inversion.trendBeforeInversion).toBe('decreasing');
    expect(inversion.trendAfterInversion).toBe('increasing');
    expect(result.inversionStatus).toBe(InversionStatus.POSSIBLE_INVERSION);
  });

  /**
   * @brief A monotonic decline should not be forced into an inversion classification.
   */
  it('does not report inversion when the spline never turns upward', () => {
    const readings = buildReadings(
      [140, 136, 132, 128, 124, 120, 116, 112, 108, 104, 100, 96, 92, 88, 84, 80]
    );

    const inversion = __testables.detectInversion(readings);
    const result = analyzeHRV(readings, '2024-12-01T00:00:00.000Z');

    expect(inversion.inversionDetected).toBe(false);
    expect(inversion.inversionWeek).toBeNull();
    expect(result.predictedDeliveryWindow).toBeUndefined();
    expect(result.inversionStatus).toBe(InversionStatus.ON_TRACK);
  });
});
