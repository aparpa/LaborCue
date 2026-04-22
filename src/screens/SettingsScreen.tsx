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

import React, { useEffect, useState } from 'react';
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

import { useUser } from '../context/UserContext';
import { clearAllData, loadAppSettings, saveAppSettings, saveHRVReading } from '../services/storage';
import {
  cancelDailySyncReminder,
  DEFAULT_REMINDER_TIME,
  formatReminderTime,
  getReminderTimeParts,
  scheduleDailySyncReminder,
  shiftReminderTime,
  toggleReminderPeriod,
} from '../services/notifications';
import { formatDate, formatGestationalAge } from '../utils/dateUtils';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants';
import type { HRVReading } from '../types';

export default function SettingsScreen(): JSX.Element {
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
  const [reminderTime, setReminderTime] = useState(DEFAULT_REMINDER_TIME);
  const [isUpdatingReminder, setIsUpdatingReminder] = useState(false);

  useEffect(() => {
    setNameInput(profile?.name || '');
  }, [profile?.name]);

  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      try {
        const settings = await loadAppSettings();
        if (!isMounted) {
          return;
        }

        setNotificationsEnabled(settings.notificationsEnabled);
        setReminderTime(settings.reminderTime || DEFAULT_REMINDER_TIME);
      } catch (error) {
        console.error('Failed to load notification settings:', error);
      }
    };

    void loadSettings();

    return () => {
      isMounted = false;
    };
  }, []);
  
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

  const persistReminderSettings = async (
    nextNotificationsEnabled: boolean,
    nextReminderTime: string
  ): Promise<boolean> => {
    setIsUpdatingReminder(true);

    try {
      if (nextNotificationsEnabled) {
        const didScheduleReminder = await scheduleDailySyncReminder(nextReminderTime);
        if (!didScheduleReminder) {
          const existingSettings = await loadAppSettings();
          await saveAppSettings({
            ...existingSettings,
            notificationsEnabled: false,
            reminderTime: nextReminderTime,
          });
          setNotificationsEnabled(false);
          setReminderTime(nextReminderTime);
          Alert.alert(
            'Notifications Off',
            'Notification permission is required before daily sync reminders can be scheduled.'
          );
          return false;
        }
      } else {
        await cancelDailySyncReminder();
      }

      const existingSettings = await loadAppSettings();
      await saveAppSettings({
        ...existingSettings,
        notificationsEnabled: nextNotificationsEnabled,
        reminderTime: nextReminderTime,
      });
      setNotificationsEnabled(nextNotificationsEnabled);
      setReminderTime(nextReminderTime);
      return true;
    } catch (error) {
      console.error('Failed to update reminder settings:', error);
      Alert.alert('Error', 'Failed to update reminder settings.');
      return false;
    } finally {
      setIsUpdatingReminder(false);
    }
  };

  const handleToggleNotifications = async (value: boolean) => {
    if (isUpdatingReminder) {
      return;
    }

    await persistReminderSettings(value, reminderTime);
  };

  const handleReminderTimeChange = async (nextReminderTime: string) => {
    if (isUpdatingReminder || nextReminderTime === reminderTime) {
      return;
    }

    await persistReminderSettings(notificationsEnabled, nextReminderTime);
  };

  const reminderTimeParts = getReminderTimeParts(reminderTime);
  
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
            testID="sync-reminder-switch"
            value={notificationsEnabled}
            onValueChange={(value) => {
              void handleToggleNotifications(value);
            }}
            trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
            thumbColor={notificationsEnabled ? COLORS.primary : COLORS.neutral}
          />
        </View>
        <View style={styles.reminderCard}>
          <View style={styles.reminderSummaryRow}>
            <Text style={styles.reminderSummaryLabel}>Reminder time</Text>
            <Text testID="reminder-time-value" style={styles.reminderSummaryValue}>
              {formatReminderTime(reminderTime)}
            </Text>
          </View>
          <Text style={styles.reminderHelperText}>
            We will remind you once a day to sync your wearable data with Labor Cue.
          </Text>

          <View style={styles.timeControlsRow}>
            <View style={styles.timeControlCard}>
              <Text style={styles.timeControlLabel}>Hour</Text>
              <TouchableOpacity
                accessibilityLabel="Increase reminder hour"
                disabled={isUpdatingReminder}
                onPress={() => {
                  void handleReminderTimeChange(shiftReminderTime(reminderTime, 60));
                }}
                style={styles.timeAdjustButton}
              >
                <Text style={styles.timeAdjustButtonText}>+</Text>
              </TouchableOpacity>
              <Text style={styles.timeControlValue}>{reminderTimeParts.hourLabel}</Text>
              <TouchableOpacity
                accessibilityLabel="Decrease reminder hour"
                disabled={isUpdatingReminder}
                onPress={() => {
                  void handleReminderTimeChange(shiftReminderTime(reminderTime, -60));
                }}
                style={styles.timeAdjustButton}
              >
                <Text style={styles.timeAdjustButtonText}>-</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.timeControlCard}>
              <Text style={styles.timeControlLabel}>Minute</Text>
              <TouchableOpacity
                accessibilityLabel="Increase reminder minute"
                disabled={isUpdatingReminder}
                onPress={() => {
                  void handleReminderTimeChange(shiftReminderTime(reminderTime, 15));
                }}
                style={styles.timeAdjustButton}
              >
                <Text style={styles.timeAdjustButtonText}>+</Text>
              </TouchableOpacity>
              <Text style={styles.timeControlValue}>{reminderTimeParts.minuteLabel}</Text>
              <TouchableOpacity
                accessibilityLabel="Decrease reminder minute"
                disabled={isUpdatingReminder}
                onPress={() => {
                  void handleReminderTimeChange(shiftReminderTime(reminderTime, -15));
                }}
                style={styles.timeAdjustButton}
              >
                <Text style={styles.timeAdjustButtonText}>-</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.timeControlCard}>
              <Text style={styles.timeControlLabel}>AM/PM</Text>
              <TouchableOpacity
                accessibilityLabel="Toggle reminder period"
                disabled={isUpdatingReminder}
                onPress={() => {
                  void handleReminderTimeChange(toggleReminderPeriod(reminderTime));
                }}
                style={[styles.periodButton, isUpdatingReminder && styles.disabledButton]}
              >
                <Text style={styles.periodButtonText}>{reminderTimeParts.periodLabel}</Text>
              </TouchableOpacity>
              <Text style={styles.timeControlHint}>15 min steps</Text>
            </View>
          </View>
        </View>
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
        {/* STORY-1106 start: add backup/restore controls here. */}
        
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
  reminderCard: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  reminderSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reminderSummaryLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  reminderSummaryValue: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: '600',
  },
  reminderHelperText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  timeControlsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  timeControlCard: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  timeControlLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  timeAdjustButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeAdjustButtonText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.primary,
  },
  timeControlValue: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.textPrimary,
    minWidth: 36,
    textAlign: 'center',
  },
  periodButton: {
    minWidth: 64,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  periodButtonText: {
    color: COLORS.textLight,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  timeControlHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  disabledButton: {
    opacity: 0.6,
  },
  actionButton: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    marginTop: SPACING.md,
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
