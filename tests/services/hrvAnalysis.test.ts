import {
  analyzeHRV,
  calculateWeeklyAverages,
  calculateRollingAverage,
  getStatusSummary,
} from '../../src/services/hrvAnalysis';
import type { HRVReading } from '../../src/types';
import { InversionStatus } from '../../src/types';

/**
 * @brief Build sequential HRV readings for deterministic analysis tests.
 * @param values HRV values in time order.
 * @param startWeek Starting gestational week for generated readings.
 * @param startDate Base ISO timestamp for the first reading.
 * @returns Array of HRVReading values spaced two days apart.
 */
const buildReadings = (
  values: number[],
  startWeek = 24,
  startDate = '2024-01-01T00:00:00.000Z'
): HRVReading[] =>
  values.map((value, index) => {
    const timestamp = new Date(startDate);
    timestamp.setDate(timestamp.getDate() + index * 2);

    return {
      id: `r${index + 1}`,
      timestamp: timestamp.toISOString(),
      hrvValue: value,
      gestationalWeek: startWeek + index,
      gestationalDay: (index * 2) % 7,
      source: 'manual',
    };
  });

/**
 * @brief Tests for weekly aggregation behavior.
 */
describe('calculateWeeklyAverages', () => {
  /**
   * @brief Verifies readings are grouped by week and averaged correctly.
   */
  it('groups readings by gestational week and averages values', () => {
    const readings: HRVReading[] = [
      {
        id: 'r1',
        timestamp: '2024-01-01T00:00:00.000Z',
        hrvValue: 50,
        gestationalWeek: 24,
        gestationalDay: 1,
        source: 'manual',
      },
      {
        id: 'r2',
        timestamp: '2024-01-03T00:00:00.000Z',
        hrvValue: 60,
        gestationalWeek: 24,
        gestationalDay: 3,
        source: 'manual',
      },
      {
        id: 'r3',
        timestamp: '2024-01-08T00:00:00.000Z',
        hrvValue: 55,
        gestationalWeek: 25,
        gestationalDay: 1,
        source: 'manual',
      },
    ];

    const weekly = calculateWeeklyAverages(readings);

    expect(weekly).toHaveLength(2);
    expect(weekly[0]).toMatchObject({
      gestationalWeek: 24,
      averageHRV: 55,
      readingCount: 2,
    });
    expect(weekly[1]).toMatchObject({
      gestationalWeek: 25,
      averageHRV: 55,
      readingCount: 1,
    });
  });
});

/**
 * @brief Tests for rolling average smoothing behavior.
 */
describe('calculateRollingAverage', () => {
  /**
   * @brief Window larger than dataset should return original values.
   */
  it('returns raw values when fewer readings than window', () => {
    const readings = buildReadings([50, 60], 20);
    expect(calculateRollingAverage(readings, 3)).toEqual([50, 60]);
  });

  /**
   * @brief Windowed averages should be computed with trailing windows.
   */
  it('computes rolling averages for larger datasets', () => {
    const readings = buildReadings([10, 20, 30, 40], 20);
    expect(calculateRollingAverage(readings, 2)).toEqual([10, 15, 25, 35]);
  });
});

/**
 * @brief Tests for top-level HRV analysis outcomes.
 */
describe('analyzeHRV', () => {
  /**
   * @brief Too few readings should return insufficient data status.
   */
  it('returns insufficient data when below minimum threshold', () => {
    const result = analyzeHRV(buildReadings([60, 58, 57]), '2024-12-01T00:00:00.000Z');

    expect(result.inversionStatus).toBe(InversionStatus.INSUFFICIENT_DATA);
    expect(result.currentTrend).toBe('insufficient_data');
    expect(result.confidence).toBe('none');
  });

  /**
   * @brief Clear decline-then-rise pattern should detect inversion.
   */
  it('detects a clear inversion and provides a prediction window', () => {
    const declining = [140, 130, 120, 110, 100, 90, 80, 70, 60, 50];
    const rising = [52, 56, 62, 68, 74, 80, 86, 92, 98, 104, 110, 116];

    const result = analyzeHRV(
      buildReadings([...declining, ...rising], 20),
      '2024-12-01T00:00:00.000Z'
    );

    expect(result.currentTrend).toBe('increasing');
    expect(result.inversionStatus).not.toBe(InversionStatus.ON_TRACK);
    expect(result.predictedDeliveryWindow).toBeDefined();
    expect(result.inversionDetectedAt).toBeDefined();
  });
});

/**
 * @brief Tests for summary string formatting.
 */
describe('getStatusSummary', () => {
  /**
   * @brief Human-readable summary should include trend + message.
   */
  it('formats a human-readable summary', () => {
    const summary = getStatusSummary({
      currentTrend: 'stable',
      inversionStatus: InversionStatus.ON_TRACK,
      confidence: 'medium',
      lastAnalyzedAt: '2024-01-01T00:00:00.000Z',
      message: 'Test message.',
      recommendation: 'None',
    });

    expect(summary).toBe('Your HRV is stable. Test message.');
  });
});
