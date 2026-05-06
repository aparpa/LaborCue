/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires */

import React from 'react';
import renderer from 'react-test-renderer';
import SettingsScreen, { __testables } from '../../src/screens/SettingsScreen';

const mockAlert = jest.fn();
const mockGetItem = jest.fn();
const mockSetItem = jest.fn();
const mockRemoveItem = jest.fn();
const mockWriteAsStringAsync = jest.fn();
const mockReadAsStringAsync = jest.fn();
const mockIsAvailableAsync = jest.fn();
const mockShareAsync = jest.fn();
const mockGetDocumentAsync = jest.fn();

const mockClearAllData = jest.fn();
const mockSaveHRVReading = jest.fn();
const mockDeleteAllHRVReadings = jest.fn();
const mockGetLastSyncTime = jest.fn();
const mockLoadAppSettings = jest.fn();
const mockSaveAppSettings = jest.fn();
const mockSaveMultipleHRVReadings = jest.fn();
const mockSaveUserProfile = jest.fn();

jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: (props: any) => React.createElement('view', props, props.children),
    Text: (props: any) => React.createElement('text', props, props.children),
    ScrollView: (props: any) => React.createElement('scrollview', props, props.children),
    TouchableOpacity: (props: any) =>
      React.createElement('touchableopacity', props, props.children),
    TextInput: (props: any) => React.createElement('textinput', props, props.children),
    Switch: (props: any) => React.createElement('switch', props, props.children),
    Alert: { alert: (...args: unknown[]) => mockAlert(...args) },
    StyleSheet: {
      create: (styles: any) => styles,
      flatten: (styles: any) => styles,
    },
  };
});

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: (...args: unknown[]) => mockGetItem(...args),
    setItem: (...args: unknown[]) => mockSetItem(...args),
    removeItem: (...args: unknown[]) => mockRemoveItem(...args),
  },
}));

jest.mock('expo-file-system', () => ({
  __esModule: true,
  cacheDirectory: 'file:///cache/',
  documentDirectory: 'file:///documents/',
  EncodingType: { UTF8: 'utf8' },
  writeAsStringAsync: (...args: unknown[]) => mockWriteAsStringAsync(...args),
  readAsStringAsync: (...args: unknown[]) => mockReadAsStringAsync(...args),
}));

jest.mock('expo-sharing', () => ({
  __esModule: true,
  isAvailableAsync: (...args: unknown[]) => mockIsAvailableAsync(...args),
  shareAsync: (...args: unknown[]) => mockShareAsync(...args),
}));

jest.mock('expo-document-picker', () => ({
  __esModule: true,
  getDocumentAsync: (...args: unknown[]) => mockGetDocumentAsync(...args),
}));

jest.mock('../../src/services/storage', () => ({
  clearAllData: (...args: unknown[]) => mockClearAllData(...args),
  saveHRVReading: (...args: unknown[]) => mockSaveHRVReading(...args),
  deleteAllHRVReadings: (...args: unknown[]) => mockDeleteAllHRVReadings(...args),
  getLastSyncTime: (...args: unknown[]) => mockGetLastSyncTime(...args),
  loadAppSettings: (...args: unknown[]) => mockLoadAppSettings(...args),
  saveAppSettings: (...args: unknown[]) => mockSaveAppSettings(...args),
  saveMultipleHRVReadings: (...args: unknown[]) => mockSaveMultipleHRVReadings(...args),
  saveUserProfile: (...args: unknown[]) => mockSaveUserProfile(...args),
}));

const mockSetProfile = jest.fn();
const mockRefreshData = jest.fn();
const mockUseUser = jest.fn();

jest.mock('../../src/context/UserContext', () => ({
  useUser: () => mockUseUser(),
}));

describe('SettingsScreen STORY-1106', () => {
  const profile = {
    id: 'profile-1',
    name: 'Casey',
    pregnancyStartDate: '2025-01-01T00:00:00.000Z',
    estimatedDueDate: '2025-10-01T00:00:00.000Z',
    currentWeeksPregnant: 20,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-05-05T00:00:00.000Z',
    isFirstLaunch: false,
  };

  const appSettings = {
    notificationsEnabled: true,
    theme: 'system' as const,
    dataRetentionDays: 365,
    hasSeenOnboardingCarousel: true,
    hasSeenHomeCoachMarks: true,
  };

  const readings = [
    {
      id: 'reading-1',
      timestamp: '2025-05-01T00:00:00.000Z',
      hrvValue: 52,
      gestationalWeek: 28,
      gestationalDay: 2,
      source: 'manual' as const,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseUser.mockReturnValue({
      profile,
      setProfile: mockSetProfile,
      currentGestationalWeek: 28,
      currentGestationalDay: 2,
      refreshData: mockRefreshData,
      hrvReadings: readings,
    });
    mockLoadAppSettings.mockResolvedValue(appSettings);
    mockGetLastSyncTime.mockResolvedValue('2025-05-04T00:00:00.000Z');
    mockIsAvailableAsync.mockResolvedValue(true);
    mockWriteAsStringAsync.mockResolvedValue(undefined);
    mockReadAsStringAsync.mockResolvedValue('');
    mockShareAsync.mockResolvedValue(undefined);
    mockGetDocumentAsync.mockResolvedValue({ canceled: true });
    mockDeleteAllHRVReadings.mockResolvedValue(undefined);
    mockSaveAppSettings.mockResolvedValue(undefined);
    mockSaveMultipleHRVReadings.mockResolvedValue(undefined);
    mockSaveUserProfile.mockResolvedValue(undefined);
    mockRefreshData.mockResolvedValue(undefined);
    mockSetProfile.mockResolvedValue(undefined);
    mockSetItem.mockResolvedValue(undefined);
    mockRemoveItem.mockResolvedValue(undefined);
  });

  function renderSettingsScreen(): renderer.ReactTestRenderer {
    let tree: renderer.ReactTestRenderer;

    renderer.act(() => {
      tree = renderer.create(React.createElement(SettingsScreen, null));
    });

    return tree!;
  }

  function getTextContent(node: renderer.ReactTestInstance): string {
    const { children } = node.props;

    if (Array.isArray(children)) {
      return children.join('');
    }

    return children ?? '';
  }

  function hasText(node: renderer.ReactTestInstance, text: string): boolean {
    return node.type === 'text' && getTextContent(node) === text;
  }

  function findByText(tree: renderer.ReactTestRenderer, text: string): renderer.ReactTestInstance {
    return tree.root.find((node) => hasText(node, text));
  }

  async function pressButton(tree: renderer.ReactTestRenderer, label: string): Promise<void> {
    const button = tree.root.find((node) => {
      if (node.type !== 'touchableopacity' || typeof node.props.onPress !== 'function') {
        return false;
      }

      return node.findAll((child) => hasText(child, label)).length > 0;
    });

    await renderer.act(async () => {
      await button.props.onPress();
    });
  }

  it('renders the manual backup and restore controls', () => {
    const tree = renderSettingsScreen();

    expect(findByText(tree, 'Manual Backup & Restore')).toBeTruthy();
    expect(findByText(tree, 'Create Backup File')).toBeTruthy();
    expect(findByText(tree, 'Restore Backup')).toBeTruthy();
  });

  it('creates a backup file and opens the share sheet', async () => {
    const tree = renderSettingsScreen();

    await pressButton(tree, 'Create Backup File');
    expect(mockWriteAsStringAsync).toHaveBeenCalledTimes(1);
    expect(mockWriteAsStringAsync.mock.calls[0][0]).toContain('file:///cache/labor-cue-backup-');
    expect(mockWriteAsStringAsync.mock.calls[0][1]).toContain('"version": 1');
    expect(mockShareAsync).toHaveBeenCalledWith(
      expect.stringContaining('file:///cache/labor-cue-backup-'),
      expect.objectContaining({
        mimeType: 'application/json',
        dialogTitle: 'Save backup file',
      })
    );
    expect(
      findByText(tree, 'Backup file ready to save to Files, iCloud Drive, or Google Drive.')
    ).toBeTruthy();
    expect(mockAlert).toHaveBeenCalledWith('Backup Ready', 'Your backup file is ready to save or share.');
  });

  it('restores a selected backup file into local storage', async () => {
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///cache/labor-cue-restore.json', name: 'labor-cue-restore.json' }],
    });
    mockReadAsStringAsync.mockResolvedValue(JSON.stringify({
      version: 1,
      exportedAt: '2025-05-05T12:00:00.000Z',
      profile,
      settings: appSettings,
      lastSync: '2025-05-04T00:00:00.000Z',
      readings,
    }));

    const tree = renderSettingsScreen();

    await pressButton(tree, 'Restore Backup');
    expect(mockDeleteAllHRVReadings).toHaveBeenCalledTimes(1);
    expect(mockSaveUserProfile).toHaveBeenCalledWith(profile);
    expect(mockSetProfile).toHaveBeenCalledWith(profile);
    expect(mockSaveAppSettings).toHaveBeenCalledWith(appSettings);
    expect(mockSetItem).toHaveBeenCalledWith('last_sync', '2025-05-04T00:00:00.000Z');
    expect(mockSaveMultipleHRVReadings).toHaveBeenCalledWith([
      {
        timestamp: '2025-05-01T00:00:00.000Z',
        hrvValue: 52,
        gestationalWeek: 28,
        gestationalDay: 2,
        source: 'manual',
      },
    ]);
    expect(mockRefreshData).toHaveBeenCalledTimes(1);
    expect(findByText(tree, 'Restored 1 readings from labor-cue-restore.json.')).toBeTruthy();
    expect(mockAlert).toHaveBeenCalledWith('Restore Complete', 'Your backup file has been restored.');
  });

  it('builds a manual backup payload with profile, settings, sync, and readings', () => {
    const payload = __testables.createManualBackupPayload(
      profile,
      appSettings,
      '2025-05-04T00:00:00.000Z',
      readings
    );

    expect(payload.version).toBe(1);
    expect(payload.profile?.name).toBe('Casey');
    expect(payload.settings.theme).toBe('system');
    expect(payload.lastSync).toBe('2025-05-04T00:00:00.000Z');
    expect(payload.readings).toHaveLength(1);
  });
});
