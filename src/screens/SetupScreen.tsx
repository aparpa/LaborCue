/**
 * Labor Cue App - Setup Screen
 * 
 * This screen is shown on first app launch to collect initial user information:
 * - Name (optional)
 * - Current weeks pregnant OR expected due date
 * - Healthcare provider information (optional)
 * 
 * =============================================================================
 * TODOS FOR THIS FILE:
 * =============================================================================
 * 
 * TODO [STORY-801]: Add date picker component for due date
 *   - Priority: High
 *   - Points: 2
 *   - Description: Replace text input with a proper date picker using
 *     @react-native-community/datetimepicker for better UX.
 * 
 * TODO [STORY-802]: Add form validation feedback
 *   - Priority: High
 *   - Points: 2
 *   - Description: Show inline validation errors under each field instead
 *     of alert dialogs. Highlight invalid fields in red.
 * 
 * TODO [STORY-803]: Add progress indicator for multi-step setup
 *   - Priority: Medium
 *   - Points: 3
 *   - Description: Split setup into multiple steps with a progress bar
 *     (Step 1: Basic Info, Step 2: Pregnancy Details, Step 3: Provider)
 * 
 * TODO [STORY-804]: Add "Skip for now" option for optional fields
 *   - Priority: Low
 *   - Points: 1
 *   - Description: Make it clearer that name and provider are optional
 *     with a "Skip" button that advances to the next section.
 * 
 * TODO [STORY-805]: Implement data pre-population from health apps
 *   - Priority: Low
 *   - Points: 5
 *   - Description: Offer to import pregnancy data from Apple Health or
 *     Google Fit if available.
 * 
 * TODO [STORY-806]: Add keyboard avoiding behavior improvements
 *   - Priority: Medium
 *   - Points: 2
 *   - Description: Ensure the form scrolls properly when keyboard opens,
 *     keeping the active input visible.
 * 
 * =============================================================================
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useUser } from '../context/UserContext';
import {
  calculatePregnancyStartDate,
  calculateDueDate,
  calculateStartDateFromDueDate,
  parseFlexibleDate,
} from '../utils/dateUtils';
import { createNewProfile } from '../services/storage';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, MINIMUM_TRACKING_WEEK } from '../constants';

type SetupMethod = 'weeks' | 'dueDate';

type Errors = {
  weeks?: string;
  days?: string;
  dueDate?: string;
};

export default function SetupScreen(): JSX.Element {
  const [name, setName] = useState('');
  const [setupMethod, setSetupMethod] = useState<SetupMethod>('weeks');
  const [weeksPregnant, setWeeksPregnant] = useState('');
  const [daysPregnant, setDaysPregnant] = useState('');
  const [dueDateInput, setDueDateInput] = useState('');
  const [providerName, setProviderName] = useState('');
  const [providerContact, setProviderContact] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { setProfile, completeSetup } = useUser();

  const validate = (): boolean => {
    const nextErrors: Errors = {};

    if (setupMethod === 'weeks') {
      const weeks = parseInt(weeksPregnant, 10);
      const days = daysPregnant ? parseInt(daysPregnant, 10) : 0;

      if (isNaN(weeks) || weeks < 1 || weeks > 42) {
        nextErrors.weeks = 'Weeks must be between 1 and 42';
      }

      if (days < 0 || days > 6) {
        nextErrors.days = 'Days must be between 0 and 6';
      }

      if (!isNaN(weeks) && weeks < MINIMUM_TRACKING_WEEK) {
        // soft warning, no block
      }
    } else {
      const parsedDate = parseFlexibleDate(dueDateInput);
      if (!parsedDate) {
        nextErrors.dueDate = 'Enter a valid date (MM/DD/YYYY)';
      } else if (parsedDate < new Date()) {
        nextErrors.dueDate = 'Due date cannot be in the past';
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  async function handleSubmit(): Promise<void> {
    if (!validate()) return;

    setIsSubmitting(true);

    try {
      let pregnancyStartDate: string;
      let estimatedDueDate: string;

      if (setupMethod === 'weeks') {
        const weeks = parseInt(weeksPregnant, 10);
        const days = daysPregnant ? parseInt(daysPregnant, 10) : 0;
        pregnancyStartDate = calculatePregnancyStartDate(weeks, days);
        estimatedDueDate = calculateDueDate(pregnancyStartDate);
      } else {
        const parsedDate = parseFlexibleDate(dueDateInput)!;
        estimatedDueDate = parsedDate.toISOString();
        pregnancyStartDate = calculateStartDateFromDueDate(estimatedDueDate);
      }

      const profile = createNewProfile(
        pregnancyStartDate,
        estimatedDueDate,
        name || undefined
      );

      if (providerName || providerContact) {
        profile.healthcareProvider = {
          name: providerName,
          contact: providerContact,
        };
      }

      await setProfile(profile);
      completeSetup();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Let's Get Started</Text>
          <Text style={styles.subtitle}>Enter your pregnancy information to begin tracking.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Your Name (optional)</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Enter your name"
            placeholderTextColor={COLORS.textSecondary}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Pregnancy Information</Text>

          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleButton, setupMethod === 'weeks' && styles.toggleButtonActive]}
              onPress={() => {
                setSetupMethod('weeks');
                setErrors({});
              }}
            >
              <Text style={[styles.toggleText, setupMethod === 'weeks' && styles.toggleTextActive]}>
                Weeks Pregnant
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, setupMethod === 'dueDate' && styles.toggleButtonActive]}
              onPress={() => {
                setSetupMethod('dueDate');
                setErrors({});
              }}
            >
              <Text style={[styles.toggleText, setupMethod === 'dueDate' && styles.toggleTextActive]}>
                Due Date
              </Text>
            </TouchableOpacity>
          </View>

          {setupMethod === 'weeks' ? (
            <View style={styles.weeksContainer}>
              <View style={styles.weekInput}>
                <Text style={styles.inputLabel}>Weeks</Text>
                <TextInput
                  style={[styles.input, errors.weeks && styles.inputError]}
                  value={weeksPregnant}
                  onChangeText={(v) => {
                    setWeeksPregnant(v);
                    setErrors((e) => ({ ...e, weeks: undefined }));
                  }}
                  keyboardType="number-pad"
                  maxLength={2}
                />
                {errors.weeks && <Text style={styles.errorText}>{errors.weeks}</Text>}
              </View>

              <View style={styles.dayInput}>
                <Text style={styles.inputLabel}>Days (0–6)</Text>
                <TextInput
                  style={[styles.input, errors.days && styles.inputError]}
                  value={daysPregnant}
                  onChangeText={(v) => {
                    setDaysPregnant(v);
                    setErrors((e) => ({ ...e, days: undefined }));
                  }}
                  keyboardType="number-pad"
                  maxLength={1}
                />
                {errors.days && <Text style={styles.errorText}>{errors.days}</Text>}
              </View>
            </View>
          ) : (
            <View>
              <Text style={styles.inputLabel}>Expected Due Date</Text>
              <TextInput
                style={[styles.input, errors.dueDate && styles.inputError]}
                value={dueDateInput}
                onChangeText={(v) => {
                  setDueDateInput(v);
                  setErrors((e) => ({ ...e, dueDate: undefined }));
                }}
                placeholder="MM/DD/YYYY"
                placeholderTextColor={COLORS.textSecondary}
              />
              {errors.dueDate && <Text style={styles.errorText}>{errors.dueDate}</Text>}
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <Text style={styles.submitButtonText}>{isSubmitting ? 'Setting Up…' : 'Start Tracking'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: SPACING.lg },
  header: { marginBottom: SPACING.xl },
  title: { fontSize: FONT_SIZES.title, fontWeight: 'bold', marginBottom: SPACING.sm },
  subtitle: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary },
  section: { marginBottom: SPACING.xl },
  label: { fontSize: FONT_SIZES.lg, fontWeight: '600', marginBottom: SPACING.sm },
  inputLabel: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginBottom: 4 },
  input: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZES.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputError: { borderColor: COLORS.danger },
  errorText: { color: COLORS.danger, fontSize: FONT_SIZES.xs, marginTop: 4 },
  toggleContainer: { flexDirection: 'row', marginBottom: SPACING.md },
  toggleButton: { flex: 1, padding: SPACING.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  toggleButtonActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  toggleText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  toggleTextActive: { color: COLORS.textLight },
  weeksContainer: { flexDirection: 'row', gap: SPACING.md },
  weekInput: { flex: 2 },
  dayInput: { flex: 1 },
  submitButton: { backgroundColor: COLORS.primary, padding: SPACING.lg, borderRadius: BORDER_RADIUS.md, alignItems: 'center' },
  submitButtonDisabled: { backgroundColor: COLORS.neutral },
  submitButtonText: { color: COLORS.textLight, fontSize: FONT_SIZES.lg, fontWeight: '600' },
});

