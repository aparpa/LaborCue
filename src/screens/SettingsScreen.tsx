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
import { clearAllData, saveHRVReading } from '../services/storage';
import { formatDate, formatGestationalAge } from '../utils/dateUtils';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants';
import type { HealthcareProvider, HRVReading, UserProfile } from '../types';

function createProviderId(): string {
  return `provider-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeProviders(profile: UserProfile | null): HealthcareProvider[] {
  if (!profile) {
    return [];
  }

  const sourceProviders = profile.healthcareProviders?.length
    ? profile.healthcareProviders
    : profile.healthcareProvider
      ? [profile.healthcareProvider]
      : [];

  return sourceProviders.map((provider, index) => ({
    ...provider,
    id: provider.id ?? `provider-${index + 1}-${provider.name.toLowerCase().replace(/\s+/g, '-')}`,
  }));
}

function getPrimaryProviderId(
  profile: UserProfile | null,
  providers: HealthcareProvider[]
): string | undefined {
  if (providers.length === 0) {
    return undefined;
  }

  if (
    profile?.primaryHealthcareProviderId &&
    providers.some((provider) => provider.id === profile.primaryHealthcareProviderId)
  ) {
    return profile.primaryHealthcareProviderId;
  }

  if (profile?.healthcareProvider) {
    const matchingProvider = providers.find(
      (provider) =>
        provider.name === profile.healthcareProvider?.name &&
        provider.contact === profile.healthcareProvider?.contact
    );

    if (matchingProvider?.id) {
      return matchingProvider.id;
    }
  }

  return providers[0].id;
}

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
  const [providerFormVisible, setProviderFormVisible] = useState(false);
  const [providerNameInput, setProviderNameInput] = useState('');
  const [providerContactInput, setProviderContactInput] = useState('');
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [providers, setProviders] = useState<HealthcareProvider[]>(() => normalizeProviders(profile));
  const [primaryProviderId, setPrimaryProviderId] = useState<string | undefined>(() =>
    getPrimaryProviderId(profile, normalizeProviders(profile))
  );

  useEffect(() => {
    const nextProviders = normalizeProviders(profile);
    setProviders(nextProviders);
    setPrimaryProviderId(getPrimaryProviderId(profile, nextProviders));
    setNameInput(profile?.name || '');
  }, [profile]);
  
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

  const resetProviderForm = () => {
    setProviderFormVisible(false);
    setProviderNameInput('');
    setProviderContactInput('');
    setEditingProviderId(null);
  };

  const persistProviders = async (
    nextProviders: HealthcareProvider[],
    nextPrimaryProviderId?: string
  ) => {
    if (!profile) {
      return;
    }

    const primaryProvider = nextProviders.find(
      (provider) => provider.id === nextPrimaryProviderId
    );

    const updatedProfile: UserProfile = {
      ...profile,
      healthcareProviders: nextProviders,
      primaryHealthcareProviderId: primaryProvider?.id,
      healthcareProvider: primaryProvider
        ? {
            id: primaryProvider.id,
            name: primaryProvider.name,
            contact: primaryProvider.contact,
          }
        : undefined,
    };

    await setProfile(updatedProfile);
    setProviders(nextProviders);
    setPrimaryProviderId(primaryProvider?.id);
  };

  const handleSaveProvider = async () => {
    if (!profile) {
      return;
    }

    const trimmedName = providerNameInput.trim();
    const trimmedContact = providerContactInput.trim();

    if (!trimmedName || !trimmedContact) {
      Alert.alert('Missing information', 'Please enter both a provider name and contact.');
      return;
    }

    const nextProviders = editingProviderId
      ? providers.map((provider) =>
          provider.id === editingProviderId
            ? {
                ...provider,
                name: trimmedName,
                contact: trimmedContact,
              }
            : provider
        )
      : [
          ...providers,
          {
            id: createProviderId(),
            name: trimmedName,
            contact: trimmedContact,
          },
        ];

    const nextPrimary = primaryProviderId ?? nextProviders[0]?.id;

    try {
      await persistProviders(nextProviders, nextPrimary);
      resetProviderForm();
    } catch (error) {
      console.error('Failed to save healthcare provider:', error);
      Alert.alert('Error', 'Failed to save healthcare provider.');
    }
  };

  const handleEditProvider = (provider: HealthcareProvider) => {
    setEditingProviderId(provider.id ?? null);
    setProviderNameInput(provider.name);
    setProviderContactInput(provider.contact);
    setProviderFormVisible(true);
  };

  const handleDeleteProvider = (providerId: string | undefined) => {
    if (!providerId) {
      return;
    }

    Alert.alert(
      'Remove Provider',
      'Remove this provider from your saved list?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const nextProviders = providers.filter((provider) => provider.id !== providerId);
            const nextPrimary = primaryProviderId === providerId
              ? nextProviders[0]?.id
              : primaryProviderId;

            try {
              await persistProviders(nextProviders, nextPrimary);
              if (editingProviderId === providerId) {
                resetProviderForm();
              }
            } catch (error) {
              console.error('Failed to remove healthcare provider:', error);
              Alert.alert('Error', 'Failed to remove healthcare provider.');
            }
          },
        },
      ]
    );
  };

  const handleSetPrimaryProvider = async (providerId: string | undefined) => {
    if (!providerId) {
      return;
    }

    try {
      await persistProviders(providers, providerId);
    } catch (error) {
      console.error('Failed to update primary healthcare provider:', error);
      Alert.alert('Error', 'Failed to update the primary provider.');
    }
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
            {providers.find((provider) => provider.id === primaryProviderId)?.name || 'Not set'}
          </Text>
        </View>

        <View style={styles.providerSection}>
          <View style={styles.providerSectionHeader}>
            <View>
              <Text style={styles.providerSectionTitle}>Provider Management</Text>
              <Text style={styles.providerSectionSubtitle}>
                Add care contacts and choose a primary provider for sharing.
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setEditingProviderId(null);
                setProviderNameInput('');
                setProviderContactInput('');
                setProviderFormVisible(true);
              }}
              style={styles.providerAddButton}
              testID="provider-add-button"
            >
              <Text style={styles.providerAddButtonText}>Add Provider</Text>
            </TouchableOpacity>
          </View>

          {providers.length === 0 ? (
            <View style={styles.emptyProviderCard}>
              <Text style={styles.emptyProviderTitle}>No providers saved yet</Text>
              <Text style={styles.emptyProviderText}>
                Add your OB, midwife, doula, or clinic contact details here.
              </Text>
            </View>
          ) : (
            providers.map((provider) => {
              const isPrimary = provider.id === primaryProviderId;

              return (
                <View key={provider.id} style={styles.providerCard}>
                  <View style={styles.providerCardHeader}>
                    <View style={styles.providerTextBlock}>
                      <Text style={styles.providerName}>{provider.name}</Text>
                      <Text style={styles.providerContact}>{provider.contact}</Text>
                    </View>
                    {isPrimary ? (
                      <View style={styles.primaryBadge}>
                        <Text style={styles.primaryBadgeText}>Primary</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.providerActions}>
                    {!isPrimary ? (
                      <TouchableOpacity
                        onPress={() => handleSetPrimaryProvider(provider.id)}
                        style={styles.providerActionButton}
                        testID={`provider-primary-${provider.id}`}
                      >
                        <Text style={styles.providerActionText}>Set Primary</Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                      onPress={() => handleEditProvider(provider)}
                      style={styles.providerActionButton}
                      testID={`provider-edit-${provider.id}`}
                    >
                      <Text style={styles.providerActionText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteProvider(provider.id)}
                      style={[styles.providerActionButton, styles.providerDeleteButton]}
                      testID={`provider-delete-${provider.id}`}
                    >
                      <Text style={[styles.providerActionText, styles.providerDeleteText]}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}

          {providerFormVisible ? (
            <View style={styles.providerFormCard}>
              <Text style={styles.providerFormTitle}>
                {editingProviderId ? 'Edit Provider' : 'Add Provider'}
              </Text>
              <TextInput
                style={styles.providerInput}
                value={providerNameInput}
                onChangeText={setProviderNameInput}
                placeholder="Provider name"
                testID="provider-name-input"
              />
              <TextInput
                style={styles.providerInput}
                value={providerContactInput}
                onChangeText={setProviderContactInput}
                placeholder="Phone or email"
                testID="provider-contact-input"
              />
              <View style={styles.providerFormActions}>
                <TouchableOpacity
                  onPress={resetProviderForm}
                  style={[styles.providerFormButton, styles.providerSecondaryButton]}
                >
                  <Text style={styles.providerSecondaryButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveProvider}
                  style={styles.providerFormButton}
                  testID="provider-save-button"
                >
                  <Text style={styles.providerFormButtonText}>
                    {editingProviderId ? 'Save Changes' : 'Save Provider'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>
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
  providerSection: {
    marginTop: SPACING.md,
    gap: SPACING.md,
  },
  providerSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACING.md,
  },
  providerSectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  providerSectionSubtitle: {
    marginTop: SPACING.xs,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    maxWidth: 220,
    lineHeight: 18,
  },
  providerAddButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  providerAddButtonText: {
    color: COLORS.textLight,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  emptyProviderCard: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  emptyProviderTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  emptyProviderText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  providerCard: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.md,
  },
  providerCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACING.md,
  },
  providerTextBlock: {
    flex: 1,
    gap: SPACING.xs,
  },
  providerName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  providerContact: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  primaryBadge: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  primaryBadgeText: {
    color: COLORS.textLight,
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
  providerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  providerActionButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  providerActionText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
  },
  providerDeleteButton: {
    borderColor: COLORS.danger,
    backgroundColor: COLORS.danger + '10',
  },
  providerDeleteText: {
    color: COLORS.danger,
  },
  providerFormCard: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  providerFormTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  providerInput: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZES.md,
    color: COLORS.textPrimary,
  },
  providerFormActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  providerFormButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  providerFormButtonText: {
    color: COLORS.textLight,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  providerSecondaryButton: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  providerSecondaryButtonText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
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
