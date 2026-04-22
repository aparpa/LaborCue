/* eslint-disable @typescript-eslint/no-var-requires */

const mockGetItem = jest.fn();
const mockSetItem = jest.fn();
const mockMultiRemove = jest.fn();
const mockWriteAsStringAsync = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: (...args: unknown[]) => mockGetItem(...args),
    setItem: (...args: unknown[]) => mockSetItem(...args),
    multiRemove: (...args: unknown[]) => mockMultiRemove(...args),
  },
}));

jest.mock('expo-sqlite', () => ({
  __esModule: true,
  openDatabaseAsync: jest.fn(),
}));

jest.mock('expo-file-system', () => ({
  __esModule: true,
  cacheDirectory: 'file:///cache/',
  EncodingType: { UTF8: 'utf8' },
  writeAsStringAsync: (...args: unknown[]) => mockWriteAsStringAsync(...args),
}));

describe('storage STORY-506 PDF export', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWriteAsStringAsync.mockResolvedValue(undefined);
    mockGetItem.mockResolvedValue(
      JSON.stringify({
        id: 'profile-1',
        pregnancyStartDate: '2026-01-01T00:00:00.000Z',
        estimatedDueDate: '2026-10-08T00:00:00.000Z',
        currentWeeksPregnant: 28,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        isFirstLaunch: false,
      })
    );
  });

  it('builds a one-page PDF report with chart and recommendation content', () => {
    const { __testables } = require('../../src/services/storage');
    const readings = [
      {
        id: 'r1',
        timestamp: '2026-04-10T00:00:00.000Z',
        hrvValue: 45,
        gestationalWeek: 28,
        gestationalDay: 0,
        source: 'manual',
      },
      {
        id: 'r2',
        timestamp: '2026-04-12T00:00:00.000Z',
        hrvValue: 51,
        gestationalWeek: 29,
        gestationalDay: 2,
        source: 'manual',
      },
    ];
    const analysis = {
      currentTrend: 'increasing',
      inversionStatus: 'possible',
      confidence: 'medium',
      inversionDetectedAt: '2026-04-12T00:00:00.000Z',
      lastAnalyzedAt: '2026-04-12T00:00:00.000Z',
      message: 'Trend is increasing',
      recommendation: 'Contact your provider if symptoms change.',
    };

    const pdf = __testables.buildPdfReportDocument(readings, analysis, {
      id: 'profile-1',
      pregnancyStartDate: '2026-01-01T00:00:00.000Z',
      estimatedDueDate: '2026-10-08T00:00:00.000Z',
      currentWeeksPregnant: 28,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      isFirstLaunch: false,
    });

    expect(pdf).toContain('%PDF-1.4');
    expect(pdf).toContain('Labor Cue HRV Report');
    expect(pdf).toContain('Clinical Summary');
    expect(pdf).toContain('Contact your provider if symptoms change.');
  });

  it('writes the generated PDF report to the cache directory and returns its URI', async () => {
    const { exportDataAsPDF } = require('../../src/services/storage');
    const readings = [
      {
        id: 'r1',
        timestamp: '2026-04-10T00:00:00.000Z',
        hrvValue: 45,
        gestationalWeek: 28,
        gestationalDay: 0,
        source: 'manual',
      },
    ];

    const uri = await exportDataAsPDF(readings, null);

    expect(uri).toContain('file:///cache/labor-cue-report-');
    expect(uri).toContain('.pdf');
    expect(mockWriteAsStringAsync).toHaveBeenCalledWith(
      expect.stringContaining('file:///cache/labor-cue-report-'),
      expect.stringContaining('%PDF-1.4'),
      expect.objectContaining({ encoding: 'utf8' })
    );
  });
});
