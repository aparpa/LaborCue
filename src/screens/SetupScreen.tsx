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

import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  Keyboard,
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
type SetupStep = 0 | 1 | 2;
type FieldErrors = {
  weeksPregnant?: string;
  daysPregnant?: string;
  dueDateInput?: string;
};
type FocusableField =
  | 'name'
  | 'weeksPregnant'
  | 'daysPregnant'
  | 'dueDateInput'
  | 'providerName'
  | 'providerContact';

const KEYBOARD_VERTICAL_OFFSET = Platform.OS === 'ios' ? SPACING.lg : 0;
const KEYBOARD_SCROLL_PADDING = SPACING.xl;

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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [earlyPregnancyNotice, setEarlyPregnancyNotice] = useState<string | null>(null);
  // STORY-805 start: load health app data here and prefill relevant fields.
  const scrollViewRef = useRef<ScrollView | null>(null);
  const fieldPositions = useRef<Partial<Record<FocusableField, number>>>({});
  const activeFieldRef = useRef<FocusableField | null>(null);

  const { setProfile, completeSetup } = useUser();
  const isLastStep = currentStep === SETUP_STEPS.length - 1;
  const progressPercentage = ((currentStep + 1) / SETUP_STEPS.length) * 100;
  const currentStepConfig = SETUP_STEPS[currentStep];

  const scrollToField = useCallback((field: FocusableField) => {
    const y = fieldPositions.current[field];
    if (typeof y !== 'number') {
      return;
    }

    scrollViewRef.current?.scrollTo({
      y: Math.max(0, y - KEYBOARD_SCROLL_PADDING),
      animated: true,
    });
  }, []);

  useEffect(() => {
    const handleKeyboardShown = (): void => {
      if (activeFieldRef.current) {
        scrollToField(activeFieldRef.current);
      }
    };

    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      handleKeyboardShown
    );

    return () => {
      showSubscription.remove();
    };
  }, [scrollToField]);

  function registerFieldPosition(field: FocusableField, y: number): void {
    fieldPositions.current[field] = y;
  }

  function handleFieldFocus(field: FocusableField): void {
    activeFieldRef.current = field;
    scrollToField(field);
  }

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
    if (!validateInputs()) {
      setCurrentStep(1);
      return;
    }

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

      // Load storage lazily so tests that render unrelated screens do not pull it in at module load.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { createNewProfile } = require('../services/storage') as typeof import('../services/storage');

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
      keyboardVerticalOffset={KEYBOARD_VERTICAL_OFFSET}
    >
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
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
          <View
            style={styles.progressBarTrack}
            accessibilityRole="progressbar"
            testID="setup-progress-track"
          >
            <View
              style={[styles.progressBarFill, { width: `${progressPercentage}%` }]}
              testID="setup-progress-fill"
            />
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
              <View
                onLayout={({ nativeEvent }) => registerFieldPosition('name', nativeEvent.layout.y)}
              >
                <Text style={styles.inputLabel}>Your Name (optional)</Text>
                {/* STORY-804 start: add a "Skip" action for optional fields here. */}
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  onFocus={() => handleFieldFocus('name')}
                  placeholder="Enter your name"
                  placeholderTextColor={COLORS.textSecondary}
                  returnKeyType="next"
                />
                {/* STORY-802 start: show inline validation feedback below this input. */}
              </View>
            </View>
          )}

          {currentStep === 1 && (
            <View>
              <Text style={styles.label}>Pregnancy Information</Text>

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

              {setupMethod === 'weeks' ? (
                <View style={styles.weeksContainer}>
                <View style={styles.weekInput}>
                    <View
                      onLayout={({ nativeEvent }) =>
                        registerFieldPosition('weeksPregnant', nativeEvent.layout.y)
                      }
                    >
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
                        onFocus={() => handleFieldFocus('weeksPregnant')}
                        placeholder="24"
                        placeholderTextColor={COLORS.textSecondary}
                        keyboardType="number-pad"
                        maxLength={2}
                        returnKeyType="next"
                      />
                      {fieldErrors.weeksPregnant ? (
                        <Text style={styles.errorText}>{fieldErrors.weeksPregnant}</Text>
                      ) : null}
                      {earlyPregnancyNotice ? (
                        <Text style={styles.noticeText}>{earlyPregnancyNotice}</Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.dayInput}>
                    <View
                      onLayout={({ nativeEvent }) =>
                        registerFieldPosition('daysPregnant', nativeEvent.layout.y)
                      }
                    >
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
                        onFocus={() => handleFieldFocus('daysPregnant')}
                        placeholder="0"
                        placeholderTextColor={COLORS.textSecondary}
                        keyboardType="number-pad"
                        maxLength={1}
                        returnKeyType="done"
                      />
                      {fieldErrors.daysPregnant ? (
                        <Text style={styles.errorText}>{fieldErrors.daysPregnant}</Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              ) : (
                <View
                  onLayout={({ nativeEvent }) =>
                    registerFieldPosition('dueDateInput', nativeEvent.layout.y)
                  }
                >
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
                    onFocus={() => handleFieldFocus('dueDateInput')}
                    placeholder="MM/DD/YYYY"
                    placeholderTextColor={COLORS.textSecondary}
                    returnKeyType="done"
                  />
                  {fieldErrors.dueDateInput ? (
                    <Text style={styles.errorText}>{fieldErrors.dueDateInput}</Text>
                  ) : null}
                </View>
              )}
            </View>
          )}

          {currentStep === 2 && (
            <View>
              <View
                onLayout={({ nativeEvent }) =>
                  registerFieldPosition('providerName', nativeEvent.layout.y)
                }
              >
                <Text style={styles.inputLabel}>Healthcare Provider (optional)</Text>
                {/* STORY-804 start: add a "Skip" action for provider info here. */}
                <TextInput
                  style={styles.input}
                  value={providerName}
                  onChangeText={setProviderName}
                  onFocus={() => handleFieldFocus('providerName')}
                  placeholder="Provider name"
                  placeholderTextColor={COLORS.textSecondary}
                  returnKeyType="next"
                />
              </View>
              <View
                onLayout={({ nativeEvent }) =>
                  registerFieldPosition('providerContact', nativeEvent.layout.y)
                }
              >
                <TextInput
                  style={[styles.input, styles.inputMarginTop]}
                  value={providerContact}
                  onChangeText={setProviderContact}
                  onFocus={() => handleFieldFocus('providerContact')}
                  placeholder="Phone or email"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="email-address"
                  returnKeyType="done"
                />
              </View>
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
    flexGrow: 1,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
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
