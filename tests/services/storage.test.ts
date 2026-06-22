/* eslint-disable @typescript-eslint/no-var-requires */

const mockGetItem = jest.fn();
const mockSetItem = jest.fn();
const mockMultiRemove = jest.fn();
const mockRemoveItem = jest.fn();
const mockExecAsync = jest.fn();
const mockGetAllAsync = jest.fn();
const mockGetFirstAsync = jest.fn();
const mockRunAsync = jest.fn();
const mockWriteAsStringAsync = jest.fn();
const mockReadAsStringAsync = jest.fn();
const mockIsAvailableAsync = jest.fn();
const mockShareAsync = jest.fn();
const mockGetDocumentAsync = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  getItem: mockGetItem,
  setItem: mockSetItem,
  multiRemove: mockMultiRemove,
  removeItem: mockRemoveItem,
  default: {
    getItem: mockGetItem,
    setItem: mockSetItem,
    multiRemove: mockMultiRemove,
    removeItem: mockRemoveItem,
  },
}));

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(async () => ({
    execAsync: mockExecAsync,
    getAllAsync: mockGetAllAsync,
    getFirstAsync: mockGetFirstAsync,
    runAsync: mockRunAsync,
  })),
}));

jest.mock('uuid', () => ({
  v4: jest
    .fn()
    .mockReturnValueOnce('uuid-1')
    .mockReturnValueOnce('uuid-2')
    .mockReturnValueOnce('uuid-3')
    .mockReturnValue('uuid-next'),
}));

jest.mock('expo-file-system', () => ({
  writeAsStringAsync: mockWriteAsStringAsync,
  readAsStringAsync: mockReadAsStringAsync,
  cacheDirectory: 'file:///cache/',
  EncodingType: { UTF8: 'utf8' },
}), { virtual: true });

jest.mock('expo-sharing', () => ({
  isAvailableAsync: mockIsAvailableAsync,
  shareAsync: mockShareAsync,
}), { virtual: true });

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: mockGetDocumentAsync,
}), { virtual: true });

import {
  backupDataToCloud,
  createCloudBackupPayload,
  restoreDataFromCloud,
  serializeCloudBackup,
} from '../../src/services/storage';
import type { AppSettings, HRVReading, UserProfile } from '../../src/types';

describe('storage cloud backup', () => {
  const profile: UserProfile = {
    id: 'profile-1',
    name: 'Casey',
    pregnancyStartDate: '2025-01-01T00:00:00.000Z',
    estimatedDueDate: '2025-10-08T00:00:00.000Z',
    currentWeeksPregnant: 20,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-04-28T00:00:00.000Z',
    isFirstLaunch: false,
  };

  const settings: AppSettings = {
    notificationsEnabled: true,
    theme: 'system',
    dataRetentionDays: 365,
    hasSeenOnboardingCarousel: true,
    hasSeenHomeCoachMarks: false,
  };

  const readingRows = [
    {
      id: 'reading-1',
      timestamp: '2025-04-01T00:00:00.000Z',
      hrv_value: 44,
      gestational_week: 24,
      gestational_day: 2,
      source: 'device',
      metadata: null,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockExecAsync.mockResolvedValue(undefined);
    mockGetAllAsync.mockResolvedValue(readingRows);
    mockGetFirstAsync.mockResolvedValue({ count: 1 });
    mockRunAsync.mockResolvedValue(undefined);
    mockWriteAsStringAsync.mockResolvedValue(undefined);
    mockReadAsStringAsync.mockResolvedValue('');
    mockIsAvailableAsync.mockResolvedValue(true);
    mockShareAsync.mockResolvedValue(undefined);
    mockGetDocumentAsync.mockResolvedValue({ canceled: true });

    mockGetItem.mockImplementation(async (key: string) => {
      if (key === 'user_profile') return JSON.stringify(profile);
      if (key === 'app_settings') return JSON.stringify(settings);
      if (key === 'last_sync') return '2025-04-27T00:00:00.000Z';
      return null;
    });
  });

  it('creates a full backup payload from local storage', async () => {
    const payload = await createCloudBackupPayload();

    expect(payload.version).toBe(1);
    expect(payload.profile?.name).toBe('Casey');
    expect(payload.settings.theme).toBe('system');
    expect(payload.lastSync).toBe('2025-04-27T00:00:00.000Z');
    expect(payload.readings).toHaveLength(1);
    expect(payload.readings[0]).toMatchObject({
      id: 'reading-1',
      hrvValue: 44,
      source: 'device',
    });
    expect(serializeCloudBackup(payload)).toContain('"version": 1');
  });

  it('writes a backup file and opens the share sheet when privacy is acknowledged', async () => {
    const result = await backupDataToCloud({
      privacyAcknowledged: true,
      fileName: 'backup.json',
    });

    expect(mockWriteAsStringAsync).toHaveBeenCalledWith(
      'file:///cache/backup.json',
      expect.stringContaining('"readings"'),
      expect.objectContaining({ encoding: 'utf8' })
    );
    expect(mockShareAsync).toHaveBeenCalledWith(
      'file:///cache/backup.json',
      expect.objectContaining({
        mimeType: 'application/json',
        dialogTitle: 'Save backup to iCloud Drive or Google Drive',
      })
    );
    expect(result).toMatchObject({
      fileUri: 'file:///cache/backup.json',
      fileName: 'backup.json',
      deliveryMethod: 'share_sheet',
    });
  });

  it('restores local data from a picked backup file', async () => {
    const backup = {
      version: 1,
      exportedAt: '2025-04-28T00:00:00.000Z',
      profile,
      settings,
      lastSync: '2025-04-27T00:00:00.000Z',
      readings: [
        {
          id: 'remote-1',
          timestamp: '2025-04-03T00:00:00.000Z',
          hrvValue: 50,
          gestationalWeek: 25,
          gestationalDay: 1,
          source: 'manual',
        } satisfies HRVReading,
      ],
    };

    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///cache/selected-backup.json', name: 'selected-backup.json' }],
    });
    mockReadAsStringAsync.mockResolvedValue(JSON.stringify(backup));

    const result = await restoreDataFromCloud();

    expect(mockReadAsStringAsync).toHaveBeenCalledWith(
      'file:///cache/selected-backup.json',
      expect.objectContaining({ encoding: 'utf8' })
    );
    expect(mockRunAsync).toHaveBeenCalledWith('DELETE FROM hrv_readings');
    expect(mockSetItem).toHaveBeenCalledWith('user_profile', expect.any(String));
    expect(mockSetItem).toHaveBeenCalledWith('app_settings', expect.any(String));
    expect(mockSetItem).toHaveBeenCalledWith('last_sync', '2025-04-27T00:00:00.000Z');
    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO hrv_readings'),
      expect.arrayContaining(['uuid-1', '2025-04-03T00:00:00.000Z', 50, 25, 1, 'manual'])
    );
    expect(result).toMatchObject({
      restored: true,
      fileName: 'selected-backup.json',
      readingCount: 1,
    });
  });
});
