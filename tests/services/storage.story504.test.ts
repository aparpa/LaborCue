/**
 * Tests for storage.ts (STORY-504: Import data from CSV/JSON)
 *
 * Verifies that storage import flows accept CSV and JSON payloads, normalize
 * imported readings, calculate missing gestational age from the saved profile,
 * and skip invalid or duplicate records during persistence.
 */
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

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Returns a stable profile for imports that need gestational age calculation.
 */
function makeProfile(): UserProfile {
  return {
    id: 'profile-504',
    pregnancyStartDate: '2024-01-01T00:00:00.000Z',
    estimatedDueDate: '2024-10-07T00:00:00.000Z',
    currentWeeksPregnant: 24,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    isFirstLaunch: false,
  };
}

/**
 * Loads the storage module after mocks are in place.
 */
function loadStorageModule(): typeof import('../../src/services/storage') {
  return require('../../src/services/storage') as typeof import('../../src/services/storage');
}

/**
 * Seeds AsyncStorage with the given user profile for import calculations.
 */
function seedStoredProfile(profile: UserProfile): void {
  const asyncStorage = require('@react-native-async-storage/async-storage');
  asyncStorage.getItem.mockResolvedValue(JSON.stringify(profile));
}

// ============================================================================
// STORY-504 TESTS
// ============================================================================

describe('storage STORY-504', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    const asyncStorage = require('@react-native-async-storage/async-storage');
    const sqlite = require('expo-sqlite');

    sqlite.openDatabaseAsync.mockResolvedValue(mockDb);
    asyncStorage.getItem.mockResolvedValue(null);

    mockDb.execAsync.mockResolvedValue(undefined);
    mockDb.runAsync.mockResolvedValue(undefined);
    mockDb.getAllAsync.mockResolvedValue([]);
    mockDb.getFirstAsync.mockResolvedValue({ count: 0 });
  });

  it('imports CSV content selected from the document picker', async () => {
    // Arrange
    const storage = loadStorageModule();
    const documentPicker = require('expo-document-picker');
    const fileSystem = require('expo-file-system');
    seedStoredProfile(makeProfile());

    documentPicker.getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [
        {
          name: 'readings.csv',
          mimeType: 'text/csv',
          uri: 'file:///tmp/readings.csv',
        },
      ],
    });
    fileSystem.readAsStringAsync.mockResolvedValue(
      [
        'Date,HRV (ms),Gestational Week,Gestational Day,Notes,Device ID',
        '2024-03-01T00:00:00.000Z,48,8,4,"Felt rested",ring-1',
      ].join('\n')
    );

    // Act
    const result = await storage.importHRVDataFromFile();

    // Assert
    expect(documentPicker.getDocumentAsync).toHaveBeenCalledWith({
      type: ['text/csv', 'text/plain', 'application/json', 'text/json'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    expect(fileSystem.readAsStringAsync).toHaveBeenCalledWith('file:///tmp/readings.csv', {
      encoding: 'utf8',
    });
    expect(result).toMatchObject({
      format: 'csv',
      fileName: 'readings.csv',
      importedCount: 1,
      skippedCount: 0,
    });
    expect(result.readings[0]).toMatchObject({
      timestamp: '2024-03-01T00:00:00.000Z',
      hrvValue: 48,
      gestationalWeek: 8,
      gestationalDay: 4,
      source: 'imported',
      metadata: {
        notes: 'Felt rested',
        deviceId: 'ring-1',
      },
    });
  });

  it('imports JSON readings and calculates gestational age from the saved profile', async () => {
    // Arrange
    const storage = loadStorageModule();
    seedStoredProfile(makeProfile());

    // Act
    const result = await storage.importHRVData(
      JSON.stringify([
        {
          timestamp: '2024-03-11T00:00:00.000Z',
          hrvValue: 52,
          metadata: {
            sleepDuration: 7.5,
          },
        },
      ]),
      'json'
    );

    // Assert
    expect(result.importedCount).toBe(1);
    expect(result.skippedCount).toBe(0);
    expect(result.readings[0]).toMatchObject({
      timestamp: '2024-03-11T00:00:00.000Z',
      hrvValue: 52,
      gestationalWeek: 10,
      gestationalDay: 0,
      source: 'imported',
      metadata: {
        sleepDuration: 7.5,
      },
    });
  });

  it('skips invalid rows and duplicate readings while importing the remaining valid data', async () => {
    // Arrange
    const storage = loadStorageModule();
    seedStoredProfile(makeProfile());
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

    // Act
    const result = await storage.importHRVData(
      JSON.stringify([
        {
          timestamp: '2024-03-01T00:00:00.000Z',
          hrvValue: 50,
          gestationalWeek: 8,
          gestationalDay: 4,
        },
        {
          timestamp: 'not-a-date',
          hrvValue: 49,
          gestationalWeek: 8,
          gestationalDay: 5,
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

    // Assert
    expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
    expect(result.importedCount).toBe(1);
    expect(result.skippedCount).toBe(3);
    expect(result.errors.join(' ')).toContain('Invalid timestamp');
    expect(result.errors.join(' ')).toContain('Skipped duplicate reading');
    expect(result.readings[0]).toMatchObject({
      timestamp: '2024-03-02T00:00:00.000Z',
      hrvValue: 51,
      gestationalWeek: 8,
      gestationalDay: 5,
      source: 'imported',
    });
  });
});
