import { calculateWeeklyAverages } from '../../src/services/hrvAnalysis';
import type { HRVReading } from '../../src/types';

describe('calculateWeeklyAverages', () => {
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
