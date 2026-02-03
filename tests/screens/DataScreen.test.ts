import {
  clamp,
  getWindowSize,
  getVisibleReadings,
  getPanOffsetFromTranslation,
} from '../../src/utils/chartWindow';
import type { HRVReading } from '../../src/types';

const makeReading = (week: number, value: number, id: string): HRVReading => ({
  id,
  timestamp: '2024-01-01T00:00:00.000Z',
  hrvValue: value,
  gestationalWeek: week,
  gestationalDay: 0,
  source: 'manual',
});

describe('DataScreen chart window helpers', () => {
  it('clamps values within range', () => {
    expect(clamp(5, 0, 4)).toBe(4);
    expect(clamp(-1, 0, 4)).toBe(0);
    expect(clamp(2, 0, 4)).toBe(2);
  });

  it('calculates window size based on zoom', () => {
    expect(getWindowSize(20, 1)).toBe(14);
    expect(getWindowSize(20, 2)).toBe(7);
    expect(getWindowSize(20, 0.5)).toBe(20);
  });

  it('returns visible readings based on window and pan', () => {
    const readings = [
      makeReading(24, 50, 'r1'),
      makeReading(25, 51, 'r2'),
      makeReading(26, 52, 'r3'),
      makeReading(27, 53, 'r4'),
      makeReading(28, 54, 'r5'),
    ];

    const visible = getVisibleReadings(readings, 3, 0);
    expect(visible.map((r) => r.id)).toEqual(['r3', 'r4', 'r5']);

    const panned = getVisibleReadings(readings, 3, 2);
    expect(panned.map((r) => r.id)).toEqual(['r1', 'r2', 'r3']);
  });

  it('adjusts pan offset based on translation', () => {
    const windowSize = 4;
    const total = 10;
    const chartWidth = 200;

    const panRight = getPanOffsetFromTranslation(100, chartWidth, windowSize, 0, total);
    expect(panRight).toBeGreaterThan(0);

    const panLeft = getPanOffsetFromTranslation(-100, chartWidth, windowSize, 2, total);
    expect(panLeft).toBeLessThan(2);
  });
});
