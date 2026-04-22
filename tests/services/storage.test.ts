import type { HRVReading } from '../../src/types';

const mockRunAsync = jest.fn();
const mockGetFirstAsync = jest.fn();
const mockGetAllAsync = jest.fn();
const mockExecAsync = jest.fn();
const mockDatabase = {
  runAsync: mockRunAsync,
  getFirstAsync: mockGetFirstAsync,
  getAllAsync: mockGetAllAsync,
  execAsync: mockExecAsync,
};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  multiRemove: jest.fn(),
}));

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(async () => mockDatabase),
}));

jest.mock('uuid', () => ({
  v4: jest
    .fn()
    .mockReturnValueOnce('reading-1')
    .mockReturnValueOnce('reading-2')
    .mockReturnValue('reading-next'),
}));

import {
  importDataFromCSV,
  importDataFromJSON,
} from '../../src/services/storage';

describe('storage import helpers (STORY-504)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFirstAsync.mockResolvedValue({ count: 0 });
  });

  it('imports readings from exported JSON payloads', async () => {
    const payload = JSON.stringify({
      readings: [
        {
          timestamp: '2024-02-01T00:00:00.000Z',
          hrvValue: 61.5,
          gestationalWeek: 28,
          gestationalDay: 2,
          source: 'device',
        },
        {
          date: '2024-02-03T00:00:00.000Z',
          hrv: '59.2',
          gestationalWeek: '28',
          gestationalDay: '4',
        },
      ],
    });

    const imported = await importDataFromJSON(payload);

    expect(imported).toHaveLength(2);
    expect(imported[0]).toMatchObject({
      id: 'reading-1',
      timestamp: '2024-02-01T00:00:00.000Z',
      hrvValue: 61.5,
      gestationalWeek: 28,
      gestationalDay: 2,
      source: 'device',
    });
    expect(imported[1]).toMatchObject({
      id: 'reading-2',
      timestamp: '2024-02-03T00:00:00.000Z',
      hrvValue: 59.2,
      gestationalWeek: 28,
      gestationalDay: 4,
      source: 'imported',
    });
    expect(mockRunAsync).toHaveBeenCalledTimes(2);
  });

  it('imports readings from CSV payloads using export-style headers', async () => {
    const payload = [
      'Date,HRV (ms),Gestational Week,Gestational Day,Source',
      '2024-02-01T00:00:00.000Z,64.1,29,1,manual',
      '2024-02-03T00:00:00.000Z,63.4,29,3,',
    ].join('\n');

    const imported = await importDataFromCSV(payload);

    expect(imported).toHaveLength(2);
    expect(imported[0]).toMatchObject<Partial<HRVReading>>({
      hrvValue: 64.1,
      gestationalWeek: 29,
      gestationalDay: 1,
      source: 'manual',
    });
    expect(imported[1]).toMatchObject<Partial<HRVReading>>({
      hrvValue: 63.4,
      gestationalWeek: 29,
      gestationalDay: 3,
      source: 'imported',
    });
    expect(mockRunAsync).toHaveBeenCalledTimes(2);
  });

  it('rejects invalid JSON payloads', async () => {
    await expect(importDataFromJSON('{oops')).rejects.toThrow('Invalid JSON import payload.');
    expect(mockRunAsync).not.toHaveBeenCalled();
  });

  it('rejects invalid gestational day values from CSV', async () => {
    const payload = [
      'Date,HRV (ms),Gestational Week,Gestational Day,Source',
      '2024-02-01T00:00:00.000Z,64.1,29,7,manual',
    ].join('\n');

    await expect(importDataFromCSV(payload)).rejects.toThrow(
      'Reading 1: gestational day must be an integer between 0 and 6.'
    );
    expect(mockRunAsync).not.toHaveBeenCalled();
  });
});
