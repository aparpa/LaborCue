/**
 * Labor Cue App - Navigation Configuration
 * 
 * Sets up the navigation structure using React Navigation.
 * 
 * Navigation Flow:
 * 1. On first launch → Setup Screen
 * 2. After setup → Onboarding Carousel
 * 3. After onboarding → Main Drawer Navigation
 *    - Home (Dashboard)
 *    - Data (HRV Chart)
 *    - Settings
 * 
 * =============================================================================
 * TODOS FOR THIS FILE:
 * =============================================================================
 * 
 * TODO [STORY-701]: Add deep linking support
 *   - Priority: Low
 *   - Points: 3
 *   - Description: Enable deep links so external apps/notifications can
 *     open specific screens (e.g., laborcue://data)
 * 
 * TODO [STORY-702]: Implement custom drawer content
 *   - Priority: Medium
 *   - Points: 3
 *   - Description: Create a custom drawer component showing user avatar,
 *     current gestational week, and quick stats at the top.
 * 
 * TODO [STORY-703]: Add screen transition animations
 *   - Priority: Low
 *   - Points: 2
 *   - Description: Customize screen transition animations to feel more
 *     polished (fade, slide, etc.)
 * 
 * =============================================================================
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItemList,
} from '@react-navigation/drawer';
import { ActivityIndicator, View, StyleSheet, Text, TouchableOpacity } from 'react-native';

import { useUser } from '../context/UserContext';
import { BORDER_RADIUS, COLORS, FONT_SIZES, SPACING, STATUS_MESSAGES } from '../constants';

// Import screens (we'll create these next)
import SetupScreen from '../screens/SetupScreen';
import HomeScreen from '../screens/HomeScreen';
import DataScreen from '../screens/DataScreen';
import SettingsScreen from '../screens/SettingsScreen';

import { StorageKeys } from '../types';
import type { AppSettings, RootStackParamList, DrawerParamList } from '../types';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';

// ============================================================================
// NAVIGATOR INSTANCES
// ============================================================================

const Stack = createNativeStackNavigator<RootStackParamList>();
const Drawer = createDrawerNavigator<DrawerParamList>();

const ONBOARDING_SLIDES = [
  {
    eyebrow: 'Step 1',
    title: 'Wear your device overnight',
    body: 'Labor Cue works best with regular HRV readings. Aim to sync data every couple of nights.',
  },
  {
    eyebrow: 'Step 2',
    title: 'Watch your trend',
    body: 'Your dashboard highlights changes in HRV patterns and explains what the current signal means.',
  },
  {
    eyebrow: 'Step 3',
    title: 'Share concerns early',
    body: 'Use the data view for details, and contact your healthcare provider about anything that worries you.',
  },
] as const;

async function saveOnboardingSeen(): Promise<void> {
  const rawSettings = await AsyncStorage.getItem(StorageKeys.APP_SETTINGS);
  const currentSettings = rawSettings ? JSON.parse(rawSettings) as Partial<AppSettings> : {};

  await AsyncStorage.setItem(
    StorageKeys.APP_SETTINGS,
    JSON.stringify({
      ...currentSettings,
      hasSeenOnboardingCarousel: true,
    })
  );
}

function getAvatarInitials(name?: string): string {
  if (!name?.trim()) {
    return 'LC';
  }

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function formatDrawerStatusTitle(status?: string): string {
  if (!status) {
    return STATUS_MESSAGES.insufficient_data.title;
  }

  return STATUS_MESSAGES[status as keyof typeof STATUS_MESSAGES]?.title ??
    status.replace('_', ' ');
}

// ============================================================================
// DRAWER NAVIGATOR (Main App Navigation)
// ============================================================================

/**
 * Custom drawer content with a compact pregnancy and HRV summary.
 */
function CustomDrawerContent(props: DrawerContentComponentProps): JSX.Element {
  const {
    profile,
    currentGestationalWeek,
    currentGestationalDay,
    hrvReadings,
    latestReading,
    analysisResult,
  } = useUser();
  const displayName = profile?.name?.trim() || 'Labor Cue';
  const gestationalLabel = currentGestationalWeek > 0
    ? `Week ${currentGestationalWeek}, Day ${currentGestationalDay}`
    : 'Pregnancy timeline';
  const latestHrvLabel = latestReading ? `${latestReading.hrvValue.toFixed(1)} ms` : '--';
  const statusLabel = formatDrawerStatusTitle(analysisResult?.inversionStatus);

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={styles.drawerContentContainer}
    >
      <View style={styles.drawerHeader} testID="custom-drawer-header">
        <View style={styles.drawerProfileRow}>
          <View
            style={styles.drawerAvatar}
            accessibilityLabel={`${displayName} avatar`}
            testID="drawer-avatar"
          >
            <Text style={styles.drawerAvatarText}>
              {getAvatarInitials(profile?.name)}
            </Text>
          </View>

          <View style={styles.drawerProfileText}>
            <Text style={styles.drawerName} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.drawerGestationalWeek}>
              {gestationalLabel}
            </Text>
          </View>
        </View>

        <View style={styles.drawerStatsGrid}>
          <View style={styles.drawerStat}>
            <Text style={styles.drawerStatValue}>{hrvReadings.length}</Text>
            <Text style={styles.drawerStatLabel}>Readings</Text>
          </View>
          <View style={styles.drawerStat}>
            <Text style={styles.drawerStatValue}>{latestHrvLabel}</Text>
            <Text style={styles.drawerStatLabel}>Latest HRV</Text>
          </View>
        </View>

        <View style={styles.drawerStatusPill}>
          <Text style={styles.drawerStatusLabel}>Current status</Text>
          <Text style={styles.drawerStatusValue} numberOfLines={1}>
            {statusLabel}
          </Text>
        </View>
      </View>

      <View style={styles.drawerItems}>
        <DrawerItemList {...props} />
      </View>
    </DrawerContentScrollView>
  );
}

/**
 * Main drawer navigation with Home, Data, and Settings screens
 */
function MainDrawerNavigator(): JSX.Element {
  return (
    <Drawer.Navigator
      initialRouteName="Home"
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.primary,
        },
        headerTintColor: COLORS.textLight,
        headerTitleStyle: {
          fontWeight: '600',
        },
        drawerActiveBackgroundColor: COLORS.primaryLight,
        drawerActiveTintColor: COLORS.textLight,
        drawerInactiveTintColor: COLORS.textPrimary,
        drawerStyle: {
          backgroundColor: COLORS.background,
        },
      }}
    >
      <Drawer.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Labor Cue',
          drawerLabel: 'Home',
        }}
      />
      <Drawer.Screen
        name="Data"
        component={DataScreen}
        options={{
          title: 'HRV Data',
          drawerLabel: 'View Data',
        }}
      />
      <Drawer.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          drawerLabel: 'Settings',
        }}
      />
    </Drawer.Navigator>
  );
}

// ============================================================================
// ONBOARDING CAROUSEL
// ============================================================================

interface OnboardingCarouselProps {
  onComplete: () => void;
}

function OnboardingCarousel({ onComplete }: OnboardingCarouselProps): JSX.Element {
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const activeSlide = ONBOARDING_SLIDES[activeSlideIndex];
  const isLastSlide = activeSlideIndex === ONBOARDING_SLIDES.length - 1;

  async function finishOnboarding(): Promise<void> {
    setIsSaving(true);

    try {
      await saveOnboardingSeen();
    } catch (error) {
      console.error('Failed to save onboarding state:', error);
    } finally {
      setIsSaving(false);
      onComplete();
    }
  }

  function goToNextSlide(): void {
    if (isLastSlide) {
      void finishOnboarding();
      return;
    }

    setActiveSlideIndex((previousIndex) => previousIndex + 1);
  }

  return (
    <View style={styles.onboardingContainer} testID="onboarding-carousel">
      <View style={styles.onboardingContent}>
        <Text style={styles.onboardingEyebrow}>{activeSlide.eyebrow}</Text>
        <Text style={styles.onboardingTitle}>{activeSlide.title}</Text>
        <Text style={styles.onboardingBody}>{activeSlide.body}</Text>
      </View>

      <View style={styles.onboardingFooter}>
        <View
          style={styles.onboardingDots}
          accessibilityLabel={`Onboarding slide ${activeSlideIndex + 1} of ${ONBOARDING_SLIDES.length}`}
        >
          {ONBOARDING_SLIDES.map((slide, index) => (
            <View
              key={slide.title}
              style={[
                styles.onboardingDot,
                index === activeSlideIndex && styles.onboardingDotActive,
              ]}
              testID={`onboarding-dot-${index + 1}`}
            />
          ))}
        </View>

        <Text style={styles.onboardingDisclaimer}>
          Labor Cue is informational and does not replace medical care.
        </Text>

        <View style={styles.onboardingActions}>
          {!isLastSlide ? (
            <TouchableOpacity
              style={styles.onboardingSecondaryButton}
              onPress={finishOnboarding}
              disabled={isSaving}
            >
              <Text style={styles.onboardingSecondaryButtonText}>Skip</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.onboardingButtonSpacer} />
          )}

          <TouchableOpacity
            style={[styles.onboardingPrimaryButton, isSaving && styles.onboardingButtonDisabled]}
            onPress={goToNextSlide}
            disabled={isSaving}
          >
            <Text style={styles.onboardingPrimaryButtonText}>
              {isLastSlide ? 'Start Using Labor Cue' : 'Next'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ============================================================================
// ROOT NAVIGATOR
// ============================================================================

/**
 * Loading screen shown during app initialization
 */
function LoadingScreen(): JSX.Element {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );
}

/**
 * Root navigator that handles first launch vs returning user
 */
function RootNavigator(): JSX.Element {
  const { isLoading, isFirstLaunch } = useUser();
  const [shouldShowOnboarding, setShouldShowOnboarding] = useState(false);
  const wasFirstLaunchRef = useRef(isFirstLaunch);
  const hasCompletedInitialLoadRef = useRef(false);

  useEffect(() => {
    if (isLoading) {
      wasFirstLaunchRef.current = isFirstLaunch;
      return;
    }

    if (!hasCompletedInitialLoadRef.current) {
      hasCompletedInitialLoadRef.current = true;
      wasFirstLaunchRef.current = isFirstLaunch;
      return;
    }

    const setupJustCompleted = wasFirstLaunchRef.current && !isFirstLaunch;
    wasFirstLaunchRef.current = isFirstLaunch;

    if (!setupJustCompleted) {
      return;
    }

    async function prepareOnboarding(): Promise<void> {
      try {
        const rawSettings = await AsyncStorage.getItem(StorageKeys.APP_SETTINGS);
        const settings = rawSettings ? JSON.parse(rawSettings) as Partial<AppSettings> : {};
        setShouldShowOnboarding(settings.hasSeenOnboardingCarousel !== true);
      } catch (error) {
        console.error('Failed to load onboarding state:', error);
        setShouldShowOnboarding(true);
      }
    }

    void prepareOnboarding();
  }, [isFirstLaunch, isLoading]);
  
  // Show loading screen while checking initial state
  if (isLoading) {
    return <LoadingScreen />;
  }
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {isFirstLaunch ? (
        // First launch: show setup screen
        <Stack.Screen
          name="Setup"
          component={SetupScreen}
          options={{
            headerShown: true,
            title: 'Welcome to Labor Cue',
            headerStyle: {
              backgroundColor: COLORS.primary,
            },
            headerTintColor: COLORS.textLight,
          }}
        />
      ) : shouldShowOnboarding ? (
        // New user after setup: show a brief tutorial before the main app
        <Stack.Screen name="Onboarding">
          {() => (
            <OnboardingCarousel
              onComplete={() => setShouldShowOnboarding(false)}
            />
          )}
        </Stack.Screen>
      ) : (
        // Returning user or completed onboarding: show main app
        <Stack.Screen
          name="Main"
          component={MainDrawerNavigator}
        />
      )}
    </Stack.Navigator>
  );
}

// ============================================================================
// MAIN APP NAVIGATOR
// ============================================================================

/**
 * Main navigation component to be used in App.tsx
 * Wraps everything in NavigationContainer
 */
export default function AppNavigator(): JSX.Element {
  return (
    <NavigationContainer>
      <RootNavigator />
    </NavigationContainer>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  onboardingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.lg,
  },
  onboardingContent: {
    flex: 1,
    justifyContent: 'center',
  },
  onboardingEyebrow: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  onboardingTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    marginBottom: SPACING.md,
  },
  onboardingBody: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.lg,
    lineHeight: 26,
  },
  onboardingFooter: {
    gap: SPACING.md,
  },
  onboardingDots: {
    flexDirection: 'row',
    gap: SPACING.sm,
    justifyContent: 'center',
  },
  onboardingDot: {
    width: 10,
    height: 10,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: COLORS.border,
  },
  onboardingDotActive: {
    width: 28,
    backgroundColor: COLORS.primary,
  },
  onboardingDisclaimer: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
    lineHeight: 18,
    textAlign: 'center',
  },
  onboardingActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  onboardingButtonSpacer: {
    flex: 1,
  },
  onboardingPrimaryButton: {
    flex: 2,
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
  },
  onboardingSecondaryButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    padding: SPACING.lg,
  },
  onboardingButtonDisabled: {
    backgroundColor: COLORS.neutral,
  },
  onboardingPrimaryButtonText: {
    color: COLORS.textLight,
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    textAlign: 'center',
  },
  onboardingSecondaryButtonText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
  },
  drawerContentContainer: {
    flexGrow: 1,
    backgroundColor: COLORS.background,
    paddingTop: 0,
  },
  drawerHeader: {
    backgroundColor: COLORS.primary,
    padding: SPACING.lg,
    paddingTop: SPACING.xl,
  },
  drawerProfileRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  drawerAvatar: {
    alignItems: 'center',
    backgroundColor: COLORS.textLight,
    borderRadius: BORDER_RADIUS.round,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  drawerAvatarText: {
    color: COLORS.primaryDark,
    fontSize: FONT_SIZES.lg,
    fontWeight: '800',
  },
  drawerProfileText: {
    flex: 1,
  },
  drawerName: {
    color: COLORS.textLight,
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
  },
  drawerGestationalWeek: {
    color: COLORS.textLight,
    fontSize: FONT_SIZES.sm,
    marginTop: SPACING.xs,
    opacity: 0.9,
  },
  drawerStatsGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  drawerStat: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: BORDER_RADIUS.md,
    flex: 1,
    padding: SPACING.md,
  },
  drawerStatValue: {
    color: COLORS.textLight,
    fontSize: FONT_SIZES.lg,
    fontWeight: '800',
  },
  drawerStatLabel: {
    color: COLORS.textLight,
    fontSize: FONT_SIZES.xs,
    marginTop: SPACING.xs,
    opacity: 0.85,
  },
  drawerStatusPill: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  drawerStatusLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  drawerStatusValue: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    marginTop: SPACING.xs,
  },
  drawerItems: {
    paddingTop: SPACING.sm,
  },
});
