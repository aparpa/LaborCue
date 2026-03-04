import { buildTrendLineDataset } from '../../src/screens/dataScreenTrend';

describe('DataScreen trend line overlay (Story 1002)', () => {
  it('returns a smoothed point for each input reading', () => {
    const readings = [
      { hrvValue: 48 },
      { hrvValue: 50 },
      { hrvValue: 52 },
      { hrvValue: 49 },
      { hrvValue: 51 },
    ];

    const trend = buildTrendLineDataset(readings);

    expect(trend).toEqual([49, 50, 50.33, 50.67, 50]);
  });

  it('returns an empty trend line when there are fewer than 3 readings', () => {
    const readings = [{ hrvValue: 48 }, { hrvValue: 50 }];

    const trend = buildTrendLineDataset(readings);

    expect(trend).toEqual([]);
  });
});
