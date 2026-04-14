/**
 * Tests for AppNavigator.tsx (STORY-704: onboarding carousel after setup)
 *
 * Verifies that the tutorial appears only after initial setup completes and
 * persists dismissal before the main app is shown.
 */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import AppNavigator from '../../src/navigation/AppNavigator';
import { StorageKeys } from '../../src/types';

// ============================================================================
// TEST SETUP: NAVIGATION, SCREENS, CONTEXT, AND STORAGE
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

  return {
    createDrawerNavigator: () => ({
      Navigator: ({ children }: { children: React.ReactNode }) =>
        React.createElement(React.Fragment, null, children),
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

const mockAsyncStorageGetItem = jest.fn();
const mockAsyncStorageSetItem = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: (...args: unknown[]) => mockAsyncStorageGetItem(...args),
    setItem: (...args: unknown[]) => mockAsyncStorageSetItem(...args),
  },
}));

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Mocks the subset of UserContext state AppNavigator needs to choose between
 * setup, onboarding, and the main drawer flow.
 */
function mockUserContext(isFirstLaunch: boolean, isLoading = false) {
  mockUseUser.mockReturnValue({
    isLoading,
    isFirstLaunch,
  });
}

/**
 * Renders AppNavigator with the user still in first-launch setup.
 */
function renderDuringSetup(): ReturnType<typeof render> {
  mockUserContext(true);
  return render(<AppNavigator />);
}

/**
 * Simulates SetupScreen completing by changing UserContext from first launch to
 * the normal signed-in app state.
 */
function completeSetup(rendered: ReturnType<typeof render>): void {
  mockUserContext(false);
  rendered.rerender(<AppNavigator />);
}

// ============================================================================
// STORY-704 TESTS
// ============================================================================

describe('AppNavigator STORY-704', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorageGetItem.mockResolvedValue(null);
    mockAsyncStorageSetItem.mockResolvedValue(undefined);
  });

  it('shows onboarding after setup completes and then persists dismissal', async () => {
    // Arrange
    const rendered = renderDuringSetup();

    expect(screen.getByText('Setup Screen')).toBeTruthy();

    // Act
    completeSetup(rendered);

    // Assert
    expect(await screen.findByText('Wear your device overnight')).toBeTruthy();
    expect(screen.getByText('Step 1')).toBeTruthy();

    fireEvent.press(screen.getByText('Next'));
    expect(await screen.findByText('Watch your trend')).toBeTruthy();

    fireEvent.press(screen.getByText('Next'));
    expect(await screen.findByText('Share concerns early')).toBeTruthy();

    fireEvent.press(screen.getByText('Start Using Labor Cue'));

    await waitFor(() => {
      expect(mockAsyncStorageSetItem).toHaveBeenCalledWith(
        StorageKeys.APP_SETTINGS,
        JSON.stringify({ hasSeenOnboardingCarousel: true })
      );
    });
    await waitFor(() => {
      expect(screen.queryByTestId('onboarding-carousel')).toBeNull();
    });
    expect(screen.getByText('Home Screen')).toBeTruthy();
  });

  it('allows the user to skip the onboarding carousel after setup', async () => {
    // Arrange
    const rendered = renderDuringSetup();

    // Act
    completeSetup(rendered);
    fireEvent.press(await screen.findByText('Skip'));

    // Assert
    await waitFor(() => {
      expect(mockAsyncStorageSetItem).toHaveBeenCalledWith(
        StorageKeys.APP_SETTINGS,
        JSON.stringify({ hasSeenOnboardingCarousel: true })
      );
    });
    expect(screen.getByText('Home Screen')).toBeTruthy();
  });

  it('does not show onboarding during a normal returning-user launch', async () => {
    // Arrange
    mockUserContext(true, true);
    const rendered = render(<AppNavigator />);

    // Act
    mockUserContext(false);
    rendered.rerender(<AppNavigator />);

    // Assert
    await waitFor(() => {
      expect(screen.queryByTestId('onboarding-carousel')).toBeNull();
    });
    expect(screen.getByText('Home Screen')).toBeTruthy();
    expect(mockAsyncStorageGetItem).not.toHaveBeenCalled();
  });
});
