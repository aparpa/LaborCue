/* eslint-disable @typescript-eslint/no-var-requires */

import type { UserProfile } from '../../src/types';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  multiRemove: jest.fn(),
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock('expo-file-system', () => ({
  readAsStringAsync: jest.fn(),
  EncodingType: {
    UTF8: 'utf8',
  },
}));

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

const mockDb = {
  execAsync: jest.fn(),
  runAsync: jest.fn(),
  getAllAsync: jest.fn(),
  getFirstAsync: jest.fn(),
};

const sampleProfile: UserProfile = {
  id: 'profile-1',
  pregnancyStartDate: '2024-01-01T00:00:00.000Z',
  estimatedDueDate: '2024-10-07T00:00:00.000Z',
  currentWeeksPregnant: 24,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  isFirstLaunch: false,
};

describe('storage import helpers (STORY-504)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const asyncStorage = require('@react-native-async-storage/async-storage');
    const sqlite = require('expo-sqlite');
    sqlite.openDatabaseAsync.mockResolvedValue(mockDb);
    asyncStorage.getItem.mockResolvedValue(null);
    mockDb.getAllAsync.mockResolvedValue([]);
    mockDb.getFirstAsync.mockResolvedValue({ count: 0 });
    mockDb.runAsync.mockResolvedValue(undefined);
    mockDb.execAsync.mockResolvedValue(undefined);
  });

  it('parses CSV rows using friendly headers and metadata aliases', () => {
    const { __testables } = require('../../src/services/storage') as typeof import('../../src/services/storage');

    const parsed = __testables.parseImportedHRVData(
      [
        'Date,HRV (ms),Gestational Week,Gestational Day,Notes,Device ID',
        '2024-03-01T00:00:00.000Z,48,24,4,"Felt rested",ring-1',
      ].join('\n'),
      'csv',
      sampleProfile
    );

    expect(parsed.errors).toEqual([]);
    expect(parsed.validReadings).toEqual([
      expect.objectContaining({
        timestamp: '2024-03-01T00:00:00.000Z',
        hrvValue: 48,
        gestationalWeek: 24,
        gestationalDay: 4,
        source: 'imported',
        metadata: {
          notes: 'Felt rested',
          deviceId: 'ring-1',
        },
      }),
    ]);
  });

  it('calculates gestational age from the saved profile when import data omits it', () => {
    const { __testables } = require('../../src/services/storage') as typeof import('../../src/services/storage');

    const parsed = __testables.parseImportedHRVData(
      JSON.stringify([
        {
          timestamp: '2024-03-11T00:00:00.000Z',
          hrvValue: 52,
        },
      ]),
      'json',
      sampleProfile
    );

    expect(parsed.errors).toEqual([]);
    expect(parsed.validReadings[0]).toMatchObject({
      hrvValue: 52,
      gestationalWeek: 10,
      gestationalDay: 0,
      source: 'imported',
    });
  });

  it('reports invalid readings instead of importing them', () => {
    const { __testables } = require('../../src/services/storage') as typeof import('../../src/services/storage');

    const parsed = __testables.parseImportedHRVData(
      JSON.stringify([
        {
          timestamp: 'not-a-date',
          hrvValue: 999,
          gestationalWeek: 24,
          gestationalDay: 1,
        },
      ]),
      'json',
      sampleProfile
    );

    expect(parsed.validReadings).toEqual([]);
    expect(parsed.errors[0]).toContain('Invalid timestamp');
  });

  it('skips duplicates already in storage and within the same import batch', async () => {
    const storage = require('../../src/services/storage') as typeof import('../../src/services/storage');
    const asyncStorage = require('@react-native-async-storage/async-storage');
    asyncStorage.getItem.mockResolvedValue(JSON.stringify(sampleProfile));

    mockDb.getAllAsync.mockResolvedValue([
      {
        id: 'existing-1',
        timestamp: '2024-03-01T00:00:00.000Z',
        hrv_value: 50,
        gestational_week: 8,
        gestational_day: 4,
        source: 'imported',
        metadata: null,
      },
    ]);

    const result = await storage.importHRVData(
      JSON.stringify([
        {
          timestamp: '2024-03-01T00:00:00.000Z',
          hrvValue: 50,
          gestationalWeek: 8,
          gestationalDay: 4,
        },
        {
          timestamp: '2024-03-02T00:00:00.000Z',
          hrvValue: 51,
          gestationalWeek: 8,
          gestationalDay: 5,
        },
        {
          timestamp: '2024-03-02T00:00:00.000Z',
          hrvValue: 51,
          gestationalWeek: 8,
          gestationalDay: 5,
        },
      ]),
      'json'
    );

    expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
    expect(mockDb.runAsync.mock.calls[0][1]).toEqual(
      expect.arrayContaining([
        '2024-03-02T00:00:00.000Z',
        51,
        8,
        5,
        'imported',
      ])
    );
    expect(result.importedCount).toBe(1);
    expect(result.skippedCount).toBe(2);
    expect(result.errors.join(' ')).toContain('Skipped duplicate reading');
  });
});
