/**
 * Labor Cue App - Settings Screen
 * 
 * Allows users to:
 * - Edit profile information
 * - Manage notification preferences
 * - Add test data (for development)
 * - Clear all data
 * - View app information
 * 
 * =============================================================================
 * TODOS FOR THIS FILE:
 * =============================================================================
 * 
 * TODO [STORY-1101]: Add device pairing/management section
 *   - Priority: High (for device integration)
 *   - Points: 8
 *   - Description: Create UI for scanning, pairing, and managing Bluetooth
 *     connection with the wearable device.
 * 
 * TODO [STORY-1102]: Implement notification scheduling
 *   - Priority: High
 *   - Points: 5
 *   - Description: Use expo-notifications to schedule daily reminders
 *     to sync device data. Let user pick reminder time.
 * 
 * TODO [STORY-1103]: Add privacy policy and terms of service links
 *   - Priority: High
 *   - Points: 1
 *   - Description: Add links to privacy policy and terms of service
 *     documents (required for app store submission).
 * 
 * TODO [STORY-1104]: Create healthcare provider management UI
 *   - Priority: Medium
 *   - Points: 3
 *   - Description: Allow adding multiple providers, editing their info,
 *     and setting a primary provider for quick sharing.
 * 
 * TODO [STORY-1105]: Add theme selection (light/dark/system)
 *   - Priority: Low
 *   - Points: 3
 *   - Description: Implement theme switching with system preference detection.
 * 
 * TODO [STORY-1106]: Create data backup/restore functionality
 *   - Priority: Medium
 *   - Points: 5
 *   - Description: Allow manual backup to device storage and restore
 *     from backup file.
 * 
 * TODO [STORY-1107]: Add "Contact Support" option
 *   - Priority: Low
 *   - Points: 2
 *   - Description: Add option to email support with device/app info
 *     automatically attached.
 * 
 * TODO [STORY-1108]: Implement account deletion flow
 *   - Priority: High
 *   - Points: 2
 *   - Description: Per app store requirements, provide clear option to
 *     delete all data with confirmation flow.
 * 
 * TODO [STORY-1109]: Add manual HRV entry form
 *   - Priority: Medium
 *   - Points: 3
 *   - Description: Allow users to manually enter HRV readings (for users
 *     with other devices that don't sync automatically).
 * 
 * =============================================================================
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useUser } from '../context/UserContext';
import {
  clearAllData,
  deleteAllHRVReadings,
  getLastSyncTime,
  loadAppSettings,
  saveAppSettings,
  saveHRVReading,
  saveMultipleHRVReadings,
  saveUserProfile,
} from '../services/storage';
import { formatDate, formatGestationalAge } from '../utils/dateUtils';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants';
import { StorageKeys } from '../types';
import type { AppSettings, HRVReading, UserProfile } from '../types';

type BackupPayload = {
  version: 1;
  exportedAt: string;
  profile: UserProfile | null;
  settings: AppSettings;
  lastSync: string | null;
  readings: HRVReading[];
};

type FileSystemModule = {
  cacheDirectory?: string | null;
  documentDirectory?: string | null;
  writeAsStringAsync: (
    uri: string,
    contents: string,
    options?: { encoding?: string }
  ) => Promise<void>;
  readAsStringAsync: (
    uri: string,
    options?: { encoding?: string }
  ) => Promise<string>;
  EncodingType?: { UTF8?: string };
};

type SharingModule = {
  isAvailableAsync: () => Promise<boolean>;
  shareAsync: (
    uri: string,
    options?: { mimeType?: string; dialogTitle?: string; UTI?: string }
  ) => Promise<void>;
};

type DocumentPickerResult =
  | { canceled: true; assets?: undefined }
  | {
      canceled: false;
      assets: Array<{ uri: string; name?: string }>;
    };

type DocumentPickerModule = {
  getDocumentAsync: (options?: {
    type?: string | string[];
    copyToCacheDirectory?: boolean;
    multiple?: boolean;
  }) => Promise<DocumentPickerResult>;
};

declare const require: (moduleName: string) => unknown;

function getFileSystemModule(): FileSystemModule {
  return require('expo-file-system') as FileSystemModule;
}

function getSharingModule(): SharingModule {
  return require('expo-sharing') as SharingModule;
}

function getDocumentPickerModule(): DocumentPickerModule {
  return require('expo-document-picker') as DocumentPickerModule;
}

function getBackupFileName(uri: string): string {
  const parts = uri.split('/');
  return parts[parts.length - 1] || 'labor-cue-backup.json';
}

export function createManualBackupPayload(
  profile: UserProfile | null,
  settings: AppSettings,
  lastSync: string | null,
  readings: HRVReading[]
): BackupPayload {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    profile,
    settings,
    lastSync,
    readings,
  };
}

function isBackupPayload(value: unknown): value is BackupPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<BackupPayload>;
  return (
    candidate.version === 1 &&
    typeof candidate.exportedAt === 'string' &&
    Array.isArray(candidate.readings) &&
    typeof candidate.settings === 'object' &&
    candidate.settings !== null
  );
}

export default function SettingsScreen(): React.JSX.Element {
  const {
    profile,
    setProfile,
    currentGestationalWeek,
    currentGestationalDay,
    refreshData,
    hrvReadings,
  } = useUser();
  
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(profile?.name || '');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [backupStatusMessage, setBackupStatusMessage] = useState<string | null>(null);
  
  // Handle name edit
  const handleSaveName = async () => {
    if (profile) {
      await setProfile({
        ...profile,
        name: nameInput || undefined,
      });
    }
    setEditingName(false);
  };
  
  // Handle adding test data
  const handleAddTestData = async () => {
    Alert.alert(
      'Add Test Data',
      'This will add 14 sample HRV readings for testing. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add Data',
          onPress: async () => {
            try {
              const baseWeek = Math.max(24, currentGestationalWeek - 4);
              const sampleData = generateSampleHRVData(baseWeek, 14);
              
              for (const reading of sampleData) {
                await saveHRVReading(reading);
              }
              
              await refreshData();
              Alert.alert('Success', 'Test data added successfully!');
            } catch (error) {
              console.error('Failed to add test data:', error);
              Alert.alert('Error', 'Failed to add test data.');
            }
          },
        },
      ]
    );
  };
  
  // Handle data reset
  const handleClearData = () => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all your HRV data and settings. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Data',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllData();
              Alert.alert('Data Cleared', 'All data has been deleted. Please restart the app.');
            } catch (error) {
              console.error('Failed to clear data:', error);
              Alert.alert('Error', 'Failed to clear data.');
            }
          },
        },
      ]
    );
  };

  const handleCreateBackup = async () => {
    setIsBackingUp(true);

    try {
      const [settings, lastSync] = await Promise.all([
        loadAppSettings(),
        getLastSyncTime(),
      ]);
      const payload = createManualBackupPayload(profile ?? null, settings, lastSync, hrvReadings);
      const fileSystem = getFileSystemModule();
      const sharing = getSharingModule();
      const directory = fileSystem.cacheDirectory || fileSystem.documentDirectory;

      if (!directory) {
        throw new Error('Backup directory unavailable.');
      }

      const backupUri = `${directory}labor-cue-backup-${Date.now()}.json`;
      await fileSystem.writeAsStringAsync(backupUri, JSON.stringify(payload, null, 2), {
        encoding: fileSystem.EncodingType?.UTF8,
      });

      const canShare = await sharing.isAvailableAsync();
      if (!canShare) {
        throw new Error('Backup sharing unavailable.');
      }

      await sharing.shareAsync(backupUri, {
        mimeType: 'application/json',
        dialogTitle: 'Save backup file',
        UTI: 'public.json',
      });

      setBackupStatusMessage('Backup file ready to save to Files, iCloud Drive, or Google Drive.');
      Alert.alert('Backup Ready', 'Your backup file is ready to save or share.');
    } catch (error) {
      console.error('Failed to create backup:', error);
      setBackupStatusMessage('Backup failed. Please try again.');
      Alert.alert('Backup Failed', 'Unable to create a backup file.');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreBackup = async () => {
    setIsRestoring(true);

    try {
      const documentPicker = getDocumentPickerModule();
      const fileSystem = getFileSystemModule();
      const selection = await documentPicker.getDocumentAsync({
        type: ['application/json', 'text/json'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (selection.canceled) {
        setBackupStatusMessage('Restore canceled.');
        return;
      }

      const asset = selection.assets[0];
      const raw = await fileSystem.readAsStringAsync(asset.uri, {
        encoding: fileSystem.EncodingType?.UTF8,
      });
      const parsed = JSON.parse(raw) as unknown;

      if (!isBackupPayload(parsed)) {
        throw new Error('Invalid backup file.');
      }

      await deleteAllHRVReadings();

      if (parsed.profile) {
        await saveUserProfile(parsed.profile);
        await setProfile(parsed.profile);
      }

      await saveAppSettings(parsed.settings);

      if (parsed.lastSync) {
        await AsyncStorage.setItem(StorageKeys.LAST_SYNC, parsed.lastSync);
      } else {
        await AsyncStorage.removeItem(StorageKeys.LAST_SYNC);
      }

      if (parsed.readings.length > 0) {
        await saveMultipleHRVReadings(
          parsed.readings.map(({ id: _id, ...reading }) => reading)
        );
      }

      await refreshData();
      setBackupStatusMessage(
        `Restored ${parsed.readings.length} readings from ${asset.name || getBackupFileName(asset.uri)}.`
      );
      Alert.alert('Restore Complete', 'Your backup file has been restored.');
    } catch (error) {
      console.error('Failed to restore backup:', error);
      setBackupStatusMessage('Restore failed. Please choose a valid backup file.');
      Alert.alert('Restore Failed', 'Unable to restore from that backup file.');
    } finally {
      setIsRestoring(false);
    }
  };
  
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile</Text>
        
        {/* Name */}
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Name</Text>
          {editingName ? (
            <View style={styles.editContainer}>
              <TextInput
                style={styles.editInput}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="Enter name"
                autoFocus
              />
              <TouchableOpacity onPress={handleSaveName} style={styles.saveButton}>
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setEditingName(true)}>
              <Text style={styles.settingValue}>
                {profile?.name || 'Not set'} ›
              </Text>
            </TouchableOpacity>
          )}
        </View>
        
        {/* Due Date (read-only) */}
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Due Date</Text>
          <Text style={styles.settingValue}>
            {profile?.estimatedDueDate 
              ? formatDate(profile.estimatedDueDate)
              : 'Not set'}
          </Text>
        </View>
        
        {/* Current Week (read-only) */}
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Current Week</Text>
          <Text style={styles.settingValue}>
            {formatGestationalAge(currentGestationalWeek, currentGestationalDay)}
          </Text>
        </View>
        
        {/* Healthcare Provider */}
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Healthcare Provider</Text>
          <Text style={styles.settingValue}>
            {profile?.healthcareProvider?.name || 'Not set'}
          </Text>
        </View>
        {/* STORY-1104 start: add provider management UI here (list/add/edit). */}
      </View>
      
      {/* STORY-1101 start: add device pairing/management section here. */}

      {/* Notifications Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Sync Reminders</Text>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
            thumbColor={notificationsEnabled ? COLORS.primary : COLORS.neutral}
          />
        </View>
        {/* STORY-1102 start: add reminder time picker and scheduling here. */}
      </View>

      {/* STORY-1105 start: add theme selection controls here. */}
      
      {/* Data Management Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data Management</Text>
        
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Total Readings</Text>
          <Text style={styles.settingValue}>{hrvReadings.length}</Text>
        </View>

        {/* STORY-1109 start: add manual HRV entry form here. */}
        
        {/* Add Test Data (Development) */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleAddTestData}
        >
          <Text style={styles.actionButtonText}>Add Sample Test Data</Text>
          <Text style={styles.actionButtonSubtext}>For testing purposes</Text>
        </TouchableOpacity>
        <View style={styles.backupCard}>
          <Text style={styles.backupTitle}>Manual Backup & Restore</Text>
          <Text style={styles.backupDescription}>
            Create a backup file you can save to your device, iCloud Drive, or Google Drive,
            then restore from that file later.
          </Text>
          <View style={styles.backupActions}>
            <TouchableOpacity
              style={[styles.backupButton, isBackingUp && styles.actionButtonDisabled]}
              onPress={handleCreateBackup}
              disabled={isBackingUp || isRestoring}
            >
              <Text style={styles.backupButtonText}>
                {isBackingUp ? 'Creating Backup...' : 'Create Backup File'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.backupButtonSecondary, isRestoring && styles.actionButtonDisabled]}
              onPress={handleRestoreBackup}
              disabled={isBackingUp || isRestoring}
            >
              <Text style={styles.backupButtonSecondaryText}>
                {isRestoring ? 'Restoring...' : 'Restore Backup'}
              </Text>
            </TouchableOpacity>
          </View>
          {backupStatusMessage ? (
            <Text style={styles.backupStatus}>{backupStatusMessage}</Text>
          ) : null}
        </View>
        
        {/* Clear Data */}
        <TouchableOpacity
          style={[styles.actionButton, styles.dangerButton]}
          onPress={handleClearData}
        >
          <Text style={[styles.actionButtonText, styles.dangerText]}>
            Clear All Data
          </Text>
          <Text style={[styles.actionButtonSubtext, styles.dangerText]}>
            This cannot be undone
          </Text>
        </TouchableOpacity>
        {/* STORY-1108 start: add account deletion flow here (confirmations). */}
      </View>
      
      {/* About Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        
        <View style={styles.aboutCard}>
          <Text style={styles.aboutTitle}>Labor Cue</Text>
          <Text style={styles.aboutVersion}>Version 1.0.0</Text>
          <Text style={styles.aboutDescription}>
            This app uses maternal heart rate variability (HRV) patterns to provide 
            insights about pregnancy progression. Based on research by Jasinski et al. (2024).
          </Text>
          <Text style={styles.aboutDisclaimer}>
            This app is for informational purposes only and does not provide medical 
            advice, diagnosis, or treatment. Always consult with your healthcare provider.
          </Text>
        </View>
        {/* STORY-1103 start: add privacy policy and terms links here. */}
        {/* STORY-1107 start: add "Contact Support" action here. */}
      </View>
    </ScrollView>
  );
}

/**
 * Generate sample HRV data for testing
 * Simulates the typical pattern: decreasing HRV until inflection, then increasing
 */
function generateSampleHRVData(
  startWeek: number,
  count: number
): Omit<HRVReading, 'id'>[] {
  const data: Omit<HRVReading, 'id'>[] = [];
  let currentWeek = startWeek;
  let currentDay = 0;
  let baseHRV = 55 + Math.random() * 10; // Start around 55-65 ms
  
  for (let i = 0; i < count; i++) {
    // Simulate typical HRV trend: decrease until ~33 weeks, then increase
    const inflectionWeek = 33;
    let hrvChange: number;
    
    if (currentWeek < inflectionWeek) {
      // Before inflection: slight decrease
      hrvChange = -1 - Math.random() * 1.5;
    } else {
      // After inflection: slight increase
      hrvChange = 0.5 + Math.random() * 1.5;
    }
    
    baseHRV = Math.max(25, Math.min(80, baseHRV + hrvChange)); // Keep in realistic range
    
    // Add some random variation
    const hrvValue = baseHRV + (Math.random() - 0.5) * 6;
    
    const timestamp = new Date();
    timestamp.setDate(timestamp.getDate() - (count - i) * 2); // Every 2 days
    
    data.push({
      timestamp: timestamp.toISOString(),
      hrvValue: Math.round(hrvValue * 10) / 10,
      gestationalWeek: currentWeek,
      gestationalDay: currentDay,
      source: 'manual',
      metadata: {
        notes: 'Sample test data',
      },
    });
    
    // Advance days/weeks
    currentDay += 2;
    if (currentDay >= 7) {
      currentDay -= 7;
      currentWeek++;
    }
  }
  
  return data;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.lg,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  settingLabel: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textPrimary,
  },
  settingValue: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  editContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  editInput: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    minWidth: 120,
    fontSize: FONT_SIZES.md,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  saveButtonText: {
    color: COLORS.textLight,
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
  },
  backupCard: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    marginTop: SPACING.md,
  },
  backupTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  backupDescription: {
    marginTop: SPACING.xs,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  backupActions: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  backupButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  backupButtonText: {
    color: COLORS.textLight,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  backupButtonSecondary: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  backupButtonSecondaryText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  backupStatus: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  actionButton: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    marginTop: SPACING.md,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  actionButtonSubtext: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  dangerButton: {
    backgroundColor: COLORS.danger + '10',
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  dangerText: {
    color: COLORS.danger,
  },
  aboutCard: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
  },
  aboutTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  aboutVersion: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  aboutDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textPrimary,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  aboutDisclaimer: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    lineHeight: 18,
    fontStyle: 'italic',
  },
});

export const __testables = {
  createManualBackupPayload,
};
