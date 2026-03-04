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
  Alert,
} from 'react-native';
import { useUser } from '../context/UserContext';
import {
  calculatePregnancyStartDate,
  calculateDueDate,
  calculateStartDateFromDueDate,
  parseFlexibleDate,
} from '../utils/dateUtils';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, MINIMUM_TRACKING_WEEK } from '../constants';

type SetupMethod = 'weeks' | 'dueDate';
type FieldErrors = {
  weeksPregnant?: string;
  daysPregnant?: string;
  dueDateInput?: string;
};

export default function SetupScreen(): JSX.Element {
  const [name, setName] = useState('');
  const [setupMethod, setSetupMethod] = useState<SetupMethod>('weeks');
  const [weeksPregnant, setWeeksPregnant] = useState('');
  const [daysPregnant, setDaysPregnant] = useState('');
  const [dueDateInput, setDueDateInput] = useState('');
  const [providerName, setProviderName] = useState('');
  const [providerContact, setProviderContact] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [earlyPregnancyNotice, setEarlyPregnancyNotice] = useState<string | null>(null);
  // STORY-805 start: load health app data here and prefill relevant fields.
  
  const { setProfile, completeSetup } = useUser();
  
  function validateInputs(): boolean {
    const nextErrors: FieldErrors = {};
    setEarlyPregnancyNotice(null);

    if (setupMethod === 'weeks') {
      const weeks = parseInt(weeksPregnant, 10);
      if (isNaN(weeks) || weeks < 1 || weeks > 42) {
        nextErrors.weeksPregnant = 'Please enter weeks between 1 and 42.';
      }
      
      const days = daysPregnant ? parseInt(daysPregnant, 10) : 0;
      if (isNaN(days) || days < 0 || days > 6) {
        nextErrors.daysPregnant = 'Days should be between 0 and 6.';
      }
      
      if (
        !nextErrors.weeksPregnant &&
        typeof weeks === 'number' &&
        !isNaN(weeks) &&
        weeks < MINIMUM_TRACKING_WEEK
      ) {
        setEarlyPregnancyNotice(
          `This app is designed for tracking from week ${MINIMUM_TRACKING_WEEK} onwards. ` +
            `You can still set up now, but HRV tracking will begin at week ${MINIMUM_TRACKING_WEEK}.`
        );
      }
    } else {
      const parsedDate = parseFlexibleDate(dueDateInput);
      if (!parsedDate) {
        nextErrors.dueDateInput = 'Please enter a valid due date (MM/DD/YYYY).';
      }
      
      if (parsedDate) {
        const dueDate = new Date(parsedDate);
        const today = new Date();
        dueDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);

        if (dueDate < today) {
          nextErrors.dueDateInput = 'Due date cannot be in the past.';
        }
      }
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }
  
  async function handleSubmit(): Promise<void> {
    if (!validateInputs()) return;
    
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

      const { createNewProfile } = await import('../services/storage');
      
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
    } catch (error) {
      console.error('Setup failed:', error);
      Alert.alert('Error', 'Failed to save your information. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }
  
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* STORY-806 start: improve keyboard handling (scroll to focused input,
          adjust offsets per platform). */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* STORY-803 start: insert multi-step progress UI here. */}
        <View style={styles.header}>
          <Text style={styles.title}>Let's Get Started</Text>
          <Text style={styles.subtitle}>
            Enter your pregnancy information to begin tracking your HRV patterns.
          </Text>
        </View>
        
        {/* Name Input (Optional) */}
        <View style={styles.section}>
          <Text style={styles.label}>Your Name (optional)</Text>
          {/* STORY-804 start: add a "Skip" action for optional fields here. */}
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Enter your name"
            placeholderTextColor={COLORS.textSecondary}
          />
          {/* STORY-802 start: show inline validation feedback below this input. */}
        </View>
        
        {/* Pregnancy Timing Section */}
        <View style={styles.section}>
          <Text style={styles.label}>Pregnancy Information</Text>
          
          {/* Toggle between weeks and due date */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                setupMethod === 'weeks' && styles.toggleButtonActive,
              ]}
              onPress={() => {
                setSetupMethod('weeks');
                setFieldErrors({});
                setEarlyPregnancyNotice(null);
              }}
            >
              <Text
                style={[
                  styles.toggleText,
                  setupMethod === 'weeks' && styles.toggleTextActive,
                ]}
              >
                Weeks Pregnant
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                setupMethod === 'dueDate' && styles.toggleButtonActive,
              ]}
              onPress={() => {
                setSetupMethod('dueDate');
                setFieldErrors({});
                setEarlyPregnancyNotice(null);
              }}
            >
              <Text
                style={[
                  styles.toggleText,
                  setupMethod === 'dueDate' && styles.toggleTextActive,
                ]}
              >
                Due Date
              </Text>
            </TouchableOpacity>
          </View>
          
          {/* Conditional inputs based on method */}
          {setupMethod === 'weeks' ? (
            <View style={styles.weeksContainer}>
              <View style={styles.weekInput}>
                <Text style={styles.inputLabel}>Weeks</Text>
                <TextInput
                  style={[
                    styles.input,
                    fieldErrors.weeksPregnant ? styles.inputError : null,
                  ]}
                  value={weeksPregnant}
                  onChangeText={(value) => {
                    setWeeksPregnant(value);
                    if (fieldErrors.weeksPregnant) {
                      setFieldErrors((prev) => ({ ...prev, weeksPregnant: undefined }));
                    }
                  }}
                  placeholder="24"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="number-pad"
                  maxLength={2}
                />
                {fieldErrors.weeksPregnant ? (
                  <Text style={styles.errorText}>{fieldErrors.weeksPregnant}</Text>
                ) : null}
                {earlyPregnancyNotice ? (
                  <Text style={styles.noticeText}>{earlyPregnancyNotice}</Text>
                ) : null}
              </View>
              <View style={styles.dayInput}>
                <Text style={styles.inputLabel}>Days (0-6)</Text>
                <TextInput
                  style={[
                    styles.input,
                    fieldErrors.daysPregnant ? styles.inputError : null,
                  ]}
                  value={daysPregnant}
                  onChangeText={(value) => {
                    setDaysPregnant(value);
                    if (fieldErrors.daysPregnant) {
                      setFieldErrors((prev) => ({ ...prev, daysPregnant: undefined }));
                    }
                  }}
                  placeholder="0"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="number-pad"
                  maxLength={1}
                />
                {fieldErrors.daysPregnant ? (
                  <Text style={styles.errorText}>{fieldErrors.daysPregnant}</Text>
                ) : null}
              </View>
            </View>
          ) : (
            <View>
              <Text style={styles.inputLabel}>Expected Due Date</Text>
              {/* STORY-801 start: replace this TextInput with a date picker. */}
              <TextInput
                style={[
                  styles.input,
                  fieldErrors.dueDateInput ? styles.inputError : null,
                ]}
                value={dueDateInput}
                onChangeText={(value) => {
                  setDueDateInput(value);
                  if (fieldErrors.dueDateInput) {
                    setFieldErrors((prev) => ({ ...prev, dueDateInput: undefined }));
                  }
                }}
                placeholder="MM/DD/YYYY"
                placeholderTextColor={COLORS.textSecondary}
              />
              {fieldErrors.dueDateInput ? (
                <Text style={styles.errorText}>{fieldErrors.dueDateInput}</Text>
              ) : null}
            </View>
          )}
        </View>
        
        {/* Healthcare Provider (Optional) */}
        <View style={styles.section}>
          <Text style={styles.label}>Healthcare Provider (optional)</Text>
          <Text style={styles.helperText}>
            Add your provider's info to easily share data later.
          </Text>
          {/* STORY-804 start: add a "Skip" action for provider info here. */}
          <TextInput
            style={styles.input}
            value={providerName}
            onChangeText={setProviderName}
            placeholder="Provider name"
            placeholderTextColor={COLORS.textSecondary}
          />
          <TextInput
            style={[styles.input, styles.inputMarginTop]}
            value={providerContact}
            onChangeText={setProviderContact}
            placeholder="Phone or email"
            placeholderTextColor={COLORS.textSecondary}
            keyboardType="email-address"
          />
        </View>
        
        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <Text style={styles.submitButtonText}>
            {isSubmitting ? 'Setting Up...' : 'Start Tracking'}
          </Text>
        </TouchableOpacity>
        
        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          This app is for informational purposes only and does not provide medical advice. 
          Always consult with your healthcare provider.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  header: {
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: FONT_SIZES.title,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  label: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  inputLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  helperText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  input: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputMarginTop: {
    marginTop: SPACING.md,
  },
  inputError: {
    borderColor: COLORS.danger,
  },
  errorText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.danger,
    marginTop: SPACING.xs,
  },
  noticeText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.warning,
    marginTop: SPACING.xs,
  },
  toggleContainer: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
  },
  toggleButton: {
    flex: 1,
    padding: SPACING.md,
    alignItems: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  toggleButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  toggleText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  toggleTextActive: {
    color: COLORS.textLight,
  },
  weeksContainer: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  weekInput: {
    flex: 2,
  },
  dayInput: {
    flex: 1,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.neutral,
  },
  submitButtonText: {
    color: COLORS.textLight,
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
  },
  disclaimer: {
    marginTop: SPACING.xl,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
