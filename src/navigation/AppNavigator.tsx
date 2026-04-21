/**
 * Labor Cue App - Navigation Configuration
 * 
 * Sets up the navigation structure using React Navigation.
 * 
 * Navigation Flow:
 * 1. On first launch → Setup Screen
 * 2. After setup → Main Drawer Navigation
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
 * TODO [STORY-704]: Add onboarding carousel after setup
 *   - Priority: Medium
 *   - Points: 3
 *   - Description: Show a brief tutorial carousel explaining how to use
 *     the app after initial setup completes.
 * 
 * =============================================================================
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

import { useUser } from '../context/UserContext';
import { COLORS } from '../constants';

// Import screens (we'll create these next)
import SetupScreen from '../screens/SetupScreen';
import HomeScreen from '../screens/HomeScreen';
import DataScreen from '../screens/DataScreen';
import SettingsScreen from '../screens/SettingsScreen';

import type { RootStackParamList, DrawerParamList } from '../types';

// ============================================================================
// NAVIGATOR INSTANCES
// ============================================================================

const Stack = createNativeStackNavigator<RootStackParamList>();
const Drawer = createDrawerNavigator<DrawerParamList>();

// ============================================================================
// DRAWER NAVIGATOR (Main App Navigation)
// ============================================================================

/**
 * Main drawer navigation with Home, Data, and Settings screens
 */
function MainDrawerNavigator(): JSX.Element {
  return (
    <Drawer.Navigator
      initialRouteName="Home"
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
      ) : (
        // Returning user: show main app
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
});
