/**
 * Tests for AppNavigator.tsx (STORY-702: Custom drawer with user info)
 *
 * Backlog: Custom drawer with user info.
 * TODO detail: Create custom drawer content showing user avatar, current
 * gestational week, and quick stats at the top.
 */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import AppNavigator from '../../src/navigation/AppNavigator';
import { InversionStatus } from '../../src/types';

// ============================================================================
// TEST SETUP: NAVIGATION, SCREENS, AND CONTEXT
// ============================================================================

jest.mock('@react-navigation/native', () => {
  const React = require('react');

  return {
    NavigationContainer: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

jest.mock('@react-navigation/native-stack', () => {
  const React = require('react');

  return {
    createNativeStackNavigator: () => ({
      Navigator: ({ children }: { children: React.ReactNode }) =>
        React.createElement(React.Fragment, null, children),
      Screen: ({ children, component: Component }: any) => {
        if (children) {
          return children();
        }

        return Component ? React.createElement(Component, null) : null;
      },
    }),
  };
});

jest.mock('@react-navigation/drawer', () => {
  const React = require('react');
  const { ScrollView, Text } = require('react-native');

  const drawerProps = {
    state: {
      index: 0,
      routeNames: ['Home', 'Data', 'Settings'],
      routes: [
        { key: 'home-key', name: 'Home' },
        { key: 'data-key', name: 'Data' },
        { key: 'settings-key', name: 'Settings' },
      ],
    },
    descriptors: {},
    navigation: {},
  };

  return {
    DrawerContentScrollView: ({ children, ...props }: any) =>
      React.createElement(ScrollView, props, children),
    DrawerItemList: () => React.createElement(Text, null, 'Drawer route list'),
    createDrawerNavigator: () => ({
      Navigator: ({ children, drawerContent }: any) =>
        React.createElement(
          React.Fragment,
          null,
          drawerContent ? drawerContent(drawerProps) : null,
          children
        ),
      Screen: ({ component: Component }: any) =>
        Component ? React.createElement(Component, null) : null,
    }),
  };
});

jest.mock('../../src/screens/SetupScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return function MockSetupScreen(): JSX.Element {
    return React.createElement(Text, null, 'Setup Screen');
  };
});

jest.mock('../../src/screens/HomeScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return function MockHomeScreen(): JSX.Element {
    return React.createElement(Text, null, 'Home Screen');
  };
});

jest.mock('../../src/screens/DataScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return function MockDataScreen(): JSX.Element {
    return React.createElement(Text, null, 'Data Screen');
  };
});

jest.mock('../../src/screens/SettingsScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return function MockSettingsScreen(): JSX.Element {
    return React.createElement(Text, null, 'Settings Screen');
  };
});

const mockUseUser = jest.fn();

jest.mock('../../src/context/UserContext', () => ({
  useUser: () => mockUseUser(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Mocks a returning user so AppNavigator renders the main drawer flow.
 * The values here are intentionally human-readable because the assertions
 * verify that the drawer header shows user info, pregnancy context, and stats.
 */
function mockReturningUserWithDrawerStats(): void {
  mockUseUser.mockReturnValue({
    profile: {
      id: 'profile-1',
      name: 'Maya Patel',
      pregnancyStartDate: '2026-01-01T00:00:00.000Z',
      estimatedDueDate: '2026-10-08T00:00:00.000Z',
      currentWeeksPregnant: 28,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      isFirstLaunch: false,
    },
    isLoading: false,
    isFirstLaunch: false,
    hrvReadings: [
      {
        id: 'reading-1',
        timestamp: '2026-04-10T06:00:00.000Z',
        hrvValue: 42,
        gestationalWeek: 27,
        gestationalDay: 5,
        source: 'manual',
      },
      {
        id: 'reading-2',
        timestamp: '2026-04-12T06:00:00.000Z',
        hrvValue: 48.2,
        gestationalWeek: 28,
        gestationalDay: 0,
        source: 'manual',
      },
    ],
    latestReading: {
      id: 'reading-2',
      timestamp: '2026-04-12T06:00:00.000Z',
      hrvValue: 48.2,
      gestationalWeek: 28,
      gestationalDay: 0,
      source: 'manual',
    },
    analysisResult: {
      currentTrend: 'stable',
      inversionStatus: InversionStatus.ON_TRACK,
      confidence: 'medium',
      lastAnalyzedAt: '2026-04-12T06:00:00.000Z',
      message: 'Your HRV patterns are following the expected trajectory.',
    },
    setProfile: jest.fn(),
    addHRVReading: jest.fn(),
    refreshData: jest.fn(),
    completeSetup: jest.fn(),
    currentGestationalWeek: 28,
    currentGestationalDay: 1,
    errorMessage: null,
  });
}

/**
 * Renders AppNavigator in the normal post-setup state where the drawer is shown.
 */
function renderMainDrawer(): ReturnType<typeof render> {
  mockReturningUserWithDrawerStats();
  return render(<AppNavigator />);
}

// ============================================================================
// STORY-702 TESTS
// ============================================================================

describe('AppNavigator STORY-702', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders avatar, gestational week, and quick stats at the top of the drawer', () => {
    // Act
    renderMainDrawer();

    // Assert: custom drawer header appears above the route list.
    expect(screen.getByTestId('custom-drawer-header')).toBeTruthy();
    expect(screen.getByText('Drawer route list')).toBeTruthy();

    // Assert: user avatar and display name are shown.
    expect(screen.getByTestId('drawer-avatar')).toBeTruthy();
    expect(screen.getByText('MP')).toBeTruthy();
    expect(screen.getByText('Maya Patel')).toBeTruthy();

    // Assert: current gestational week is shown in the drawer header.
    expect(screen.getByText('Week 28, Day 1')).toBeTruthy();

    // Assert: quick stats summarize the current HRV data.
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('Readings')).toBeTruthy();
    expect(screen.getByText('48.2 ms')).toBeTruthy();
    expect(screen.getByText('Latest HRV')).toBeTruthy();
    expect(screen.getByText('On Track')).toBeTruthy();
  });
});
