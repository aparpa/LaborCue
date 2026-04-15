const mockGetItem = jest.fn();
const mockSetItem = jest.fn();
const mockMultiRemove = jest.fn();
const mockPrintToFileAsync = jest.fn();
const mockExecAsync = jest.fn();
const mockGetAllAsync = jest.fn();
const asyncStorageMock = {
  getItem: mockGetItem,
  setItem: mockSetItem,
  multiRemove: mockMultiRemove,
};

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: asyncStorageMock,
  ...asyncStorageMock,
}));

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(async () => ({
    execAsync: mockExecAsync,
    getAllAsync: mockGetAllAsync,
  })),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid'),
}));

jest.mock('expo-print', () => ({
  printToFileAsync: mockPrintToFileAsync,
}), { virtual: true });

import { __testables, exportDataAsPDF } from '../../src/services/storage';
import type { HRVAnalysisResult, HRVReading, UserProfile } from '../../src/types';
import { InversionStatus } from '../../src/types';

describe('storage PDF export', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

  const profile: UserProfile = {
    id: 'profile-1',
    name: 'Casey Rivera',
    pregnancyStartDate: '2024-01-01T00:00:00.000Z',
    estimatedDueDate: '2024-10-07T00:00:00.000Z',
    currentWeeksPregnant: 30,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-05-01T00:00:00.000Z',
    isFirstLaunch: false,
  };

  const readings: HRVReading[] = [
    {
      id: 'r1',
      timestamp: '2024-07-01T00:00:00.000Z',
      hrvValue: 46,
      gestationalWeek: 28,
      gestationalDay: 0,
      source: 'manual',
    },
    {
      id: 'r2',
      timestamp: '2024-07-03T00:00:00.000Z',
      hrvValue: 51,
      gestationalWeek: 28,
      gestationalDay: 2,
      source: 'device',
    },
    {
      id: 'r3',
      timestamp: '2024-07-05T00:00:00.000Z',
      hrvValue: 49,
      gestationalWeek: 28,
      gestationalDay: 4,
      source: 'manual',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockExecAsync.mockResolvedValue(undefined);
    mockGetAllAsync.mockResolvedValue([]);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it('builds report HTML with patient, chart, summary, and recent readings', () => {
    const analysis: HRVAnalysisResult = {
      currentTrend: 'stable',
      inversionStatus: InversionStatus.ON_TRACK,
      confidence: 'medium',
      lastAnalyzedAt: '2024-07-05T00:00:00.000Z',
      message: 'Trend remains stable this week.',
      recommendation: 'Continue routine monitoring.',
    };

    const html = __testables.buildPDFReportHtml({
      profile,
      readings,
      analysis,
      exportedAt: '2024-07-06T00:00:00.000Z',
    });

    expect(html).toContain('Labor Cue HRV Report');
    expect(html).toContain('Casey Rivera');
    expect(html).toContain('HRV Chart');
    expect(html).toContain('Analysis Summary');
    expect(html).toContain('Continue routine monitoring.');
    expect(html).toContain('Trend remains stable this week.');
    expect(html).toContain('<svg');
    expect(html).toContain('Jul 5, 2024');
  });

  it('exports a PDF file using generated HTML', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify(profile));
    mockGetAllAsync.mockResolvedValue([
      {
        id: 'r1',
        timestamp: '2024-07-01T00:00:00.000Z',
        hrv_value: 46,
        gestational_week: 28,
        gestational_day: 0,
        source: 'manual',
        metadata: null,
      },
      {
        id: 'r2',
        timestamp: '2024-07-03T00:00:00.000Z',
        hrv_value: 51,
        gestational_week: 28,
        gestational_day: 2,
        source: 'device',
        metadata: null,
      },
      {
        id: 'r3',
        timestamp: '2024-07-05T00:00:00.000Z',
        hrv_value: 49,
        gestational_week: 28,
        gestational_day: 4,
        source: 'manual',
        metadata: null,
      },
    ]);
    mockPrintToFileAsync.mockResolvedValue({ uri: 'file:///tmp/labor-cue-report.pdf' });

    const uri = await exportDataAsPDF();

    expect(uri).toBe('file:///tmp/labor-cue-report.pdf');
    expect(mockPrintToFileAsync).toHaveBeenCalledTimes(1);
    expect(mockPrintToFileAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        base64: false,
        width: 612,
        height: 792,
        html: expect.stringContaining('Labor Cue HRV Report'),
      })
    );
    expect(mockPrintToFileAsync.mock.calls[0][0].html).toContain('HRV Chart');
    expect(mockPrintToFileAsync.mock.calls[0][0].html).toContain('Recent Readings');
    expect(mockPrintToFileAsync.mock.calls[0][0].html).toContain('Patient');
  });

  it('estimates a fallback due date when no profile exists', () => {
    const fallbackDueDate = __testables.getFallbackDueDate([
      {
        id: 'r1',
        timestamp: '2024-07-01T00:00:00.000Z',
        hrvValue: 55,
        gestationalWeek: 30,
        gestationalDay: 1,
        source: 'manual',
      },
    ]);

    expect(fallbackDueDate).toBe('2024-09-09T00:00:00.000Z');
  });
});
