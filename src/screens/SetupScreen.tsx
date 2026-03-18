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
import { createNewProfile } from '../services/storage';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, MINIMUM_TRACKING_WEEK } from '../constants';

type SetupMethod = 'weeks' | 'dueDate';
type SetupStep = 0 | 1 | 2;

const SETUP_STEPS = [
  {
    title: 'Basic Info',
    description: 'Add your name so the app can personalize your experience.',
  },
  {
    title: 'Pregnancy Details',
    description: 'Tell us where you are in your pregnancy so tracking starts accurately.',
  },
  {
    title: 'Provider',
    description: 'Optionally add provider details for sharing data later.',
  },
] as const;

export default function SetupScreen(): JSX.Element {
  const [currentStep, setCurrentStep] = useState<SetupStep>(0);
  const [name, setName] = useState('');
  const [setupMethod, setSetupMethod] = useState<SetupMethod>('weeks');
  const [weeksPregnant, setWeeksPregnant] = useState('');
  const [daysPregnant, setDaysPregnant] = useState('');
  const [dueDateInput, setDueDateInput] = useState('');
  const [providerName, setProviderName] = useState('');
  const [providerContact, setProviderContact] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // STORY-805 start: load health app data here and prefill relevant fields.
  
  const { setProfile, completeSetup } = useUser();
  const isLastStep = currentStep === SETUP_STEPS.length - 1;
  const progressPercentage = ((currentStep + 1) / SETUP_STEPS.length) * 100;
  const currentStepConfig = SETUP_STEPS[currentStep];
  
  function validateInputs(): boolean {
    // STORY-802 start: replace Alert-based validation with inline field errors.
    if (setupMethod === 'weeks') {
      const weeks = parseInt(weeksPregnant, 10);
      if (isNaN(weeks) || weeks < 1 || weeks > 42) {
        Alert.alert('Invalid Input', 'Please enter weeks between 1 and 42.');
        return false;
      }
      
      const days = daysPregnant ? parseInt(daysPregnant, 10) : 0;
      if (days < 0 || days > 6) {
        Alert.alert('Invalid Input', 'Days should be between 0 and 6.');
        return false;
      }
      
      if (weeks < MINIMUM_TRACKING_WEEK) {
        Alert.alert(
          'Early Pregnancy',
          `This app is designed for tracking from week ${MINIMUM_TRACKING_WEEK} onwards. ` +
          `You can still set up now, but HRV tracking will begin at week ${MINIMUM_TRACKING_WEEK}.`
        );
      }
    } else {
      const parsedDate = parseFlexibleDate(dueDateInput);
      if (!parsedDate) {
        Alert.alert('Invalid Date', 'Please enter a valid due date (MM/DD/YYYY).');
        return false;
      }
      
      if (parsedDate < new Date()) {
        Alert.alert('Invalid Date', 'Due date cannot be in the past.');
        return false;
      }
    }
    
    return true;
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

  function goToNextStep(): void {
    setCurrentStep((previousStep) =>
      previousStep < SETUP_STEPS.length - 1 ? (previousStep + 1) as SetupStep : previousStep
    );
  }

  function goToPreviousStep(): void {
    setCurrentStep((previousStep) =>
      previousStep > 0 ? (previousStep - 1) as SetupStep : previousStep
    );
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

        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>
              Step {currentStep + 1} of {SETUP_STEPS.length}
            </Text>
            <Text style={styles.progressPercent}>{Math.round(progressPercentage)}%</Text>
          </View>
          <View style={styles.progressBarTrack} accessibilityRole="progressbar">
            <View style={[styles.progressBarFill, { width: `${progressPercentage}%` }]} />
          </View>
          <View style={styles.stepDots}>
            {SETUP_STEPS.map((step, index) => {
              const isActive = index === currentStep;
              const isComplete = index < currentStep;

              return (
                <View key={step.title} style={styles.stepDotWrapper}>
                  <View
                    style={[
                      styles.stepDot,
                      (isActive || isComplete) && styles.stepDotActive,
                      isComplete && styles.stepDotComplete,
                    ]}
                  />
                  <Text
                    style={[
                      styles.stepDotLabel,
                      (isActive || isComplete) && styles.stepDotLabelActive,
                    ]}
                  >
                    {step.title}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>{currentStepConfig.title}</Text>
          <Text style={styles.helperText}>{currentStepConfig.description}</Text>

          {currentStep === 0 && (
            <View>
              <Text style={styles.inputLabel}>Your Name (optional)</Text>
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
          )}

          {currentStep === 1 && (
            <View>
              <Text style={styles.label}>Pregnancy Information</Text>

              {/* Toggle between weeks and due date */}
              <View style={styles.toggleContainer}>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    setupMethod === 'weeks' && styles.toggleButtonActive,
                  ]}
                  onPress={() => setSetupMethod('weeks')}
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
                  onPress={() => setSetupMethod('dueDate')}
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
                      style={styles.input}
                      value={weeksPregnant}
                      onChangeText={setWeeksPregnant}
                      placeholder="24"
                      placeholderTextColor={COLORS.textSecondary}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                    {/* STORY-802 start: show weeks validation error here. */}
                  </View>
                  <View style={styles.dayInput}>
                    <Text style={styles.inputLabel}>Days (0-6)</Text>
                    <TextInput
                      style={styles.input}
                      value={daysPregnant}
                      onChangeText={setDaysPregnant}
                      placeholder="0"
                      placeholderTextColor={COLORS.textSecondary}
                      keyboardType="number-pad"
                      maxLength={1}
                    />
                    {/* STORY-802 start: show days validation error here. */}
                  </View>
                </View>
              ) : (
                <View>
                  <Text style={styles.inputLabel}>Expected Due Date</Text>
                  {/* STORY-801 start: replace this TextInput with a date picker. */}
                  <TextInput
                    style={styles.input}
                    value={dueDateInput}
                    onChangeText={setDueDateInput}
                    placeholder="MM/DD/YYYY"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                  {/* STORY-802 start: show due date validation error here. */}
                </View>
              )}
            </View>
          )}

          {currentStep === 2 && (
            <View>
              <Text style={styles.inputLabel}>Healthcare Provider (optional)</Text>
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
          )}
        </View>

        <View style={styles.navigationButtons}>
          {currentStep > 0 ? (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={goToPreviousStep}
              disabled={isSubmitting}
            >
              <Text style={styles.secondaryButtonText}>Previous</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.navigationSpacer} />
          )}

          {isLastStep ? (
            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              <Text style={styles.submitButtonText}>
                {isSubmitting ? 'Setting Up...' : 'Start Tracking'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.submitButton}
              onPress={goToNextStep}
              disabled={isSubmitting}
            >
              <Text style={styles.submitButtonText}>Next</Text>
            </TouchableOpacity>
          )}
        </View>
        
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
  progressSection: {
    marginBottom: SPACING.xl,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  progressLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  progressPercent: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: '700',
  },
  progressBarTrack: {
    height: 8,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: COLORS.borderLight,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.round,
  },
  stepDots: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  stepDotWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.xs,
  },
  stepDotActive: {
    backgroundColor: COLORS.primaryLight,
  },
  stepDotComplete: {
    backgroundColor: COLORS.primary,
  },
  stepDotLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  stepDotLabelActive: {
    color: COLORS.textPrimary,
    fontWeight: '600',
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
    flex: 1,
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.neutral,
  },
  navigationButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  navigationSpacer: {
    flex: 1,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.backgroundSecondary,
  },
  secondaryButtonText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
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
