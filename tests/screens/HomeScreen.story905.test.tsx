/**
 * Tests for HomeScreen.tsx (STORY-905: Educational tooltips for first-time users)
 *
 * Verifies that HomeScreen shows coach marks on first visit, advances through
 * each highlighted section, and persists dismissal so the tour does not
 * reappear after it has been completed or skipped.
 */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import HomeScreen from '../../src/screens/HomeScreen';
import type { HRVAnalysisResult, HRVReading, UserProfile } from '../../src/types';
import { InversionStatus, StorageKeys } from '../../src/types';

// ============================================================================
// TEST SETUP: NAVIGATION, CONTEXT, CHILD COMPONENTS, AND STORAGE
// ============================================================================

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
  }),
}));

jest.mock('../../src/components/StatusCard', () => {
  const React = require('react');
  return function MockStatusCard(): JSX.Element {
    return React.createElement('text', null, 'Status Card');
  };
});

jest.mock('../../src/components/TrendIndicator', () => {
  const React = require('react');
  return function MockTrendIndicator(): JSX.Element {
    return React.createElement('text', null, 'Trend Indicator');
  };
});

jest.mock('react-native-svg', () => {
  const React = require('react');
  const mock = (name: string) => (props: any) =>
    React.createElement(name, props, props.children);

  return {
    __esModule: true,
    default: mock('Svg'),
    Circle: mock('Circle'),
    Polyline: mock('Polyline'),
  };
});

const mockAsyncStorageGetItem = jest.fn();
const mockAsyncStorageSetItem = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: (...args: unknown[]) => mockAsyncStorageGetItem(...args),
    setItem: (...args: unknown[]) => mockAsyncStorageSetItem(...args),
  },
}));

const mockUseUser = jest.fn();

jest.mock('../../src/context/UserContext', () => ({
  useUser: () => mockUseUser(),
}));

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Creates deterministic readings so HomeScreen renders all major sections.
 */
function makeReadings(count: number): HRVReading[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `reading-${index + 1}`,
    timestamp: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
    hrvValue: 45 + index,
    gestationalWeek: 32 + Math.floor(index / 2),
    gestationalDay: index % 7,
    source: 'manual',
  }));
}

/**
 * Returns a minimal user profile for rendering HomeScreen in tests.
 */
function makeProfile(): UserProfile {
  return {
    id: 'profile-905',
    name: 'Coach Mark User',
    pregnancyStartDate: '2025-06-01T00:00:00.000Z',
    estimatedDueDate: '2026-03-21T00:00:00.000Z',
    currentWeeksPregnant: 36,
    createdAt: '2025-06-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    isFirstLaunch: false,
  };
}

/**
 * Returns a minimal analysis result so the status and trend sections render.
 */
function makeAnalysisResult(): HRVAnalysisResult {
  return {
    currentTrend: 'decreasing',
    inversionStatus: InversionStatus.ON_TRACK,
    confidence: 'medium',
    lastAnalyzedAt: '2026-03-01T00:00:00.000Z',
    message: 'Tracking normally.',
    recommendation: 'Continue monitoring.',
  };
}

/**
 * Renders HomeScreen with a full mocked user context.
 */
function renderHomeScreen(): ReturnType<typeof render> {
  const readings = makeReadings(7);

  mockUseUser.mockReturnValue({
    profile: makeProfile(),
    hrvReadings: readings,
    analysisResult: makeAnalysisResult(),
    currentGestationalWeek: 36,
    currentGestationalDay: 2,
    latestReading: readings[readings.length - 1],
    refreshData: jest.fn().mockResolvedValue(undefined),
  });

  return render(React.createElement(HomeScreen, null));
}

// ============================================================================
// STORY-905 TESTS
// ============================================================================

describe('HomeScreen STORY-905', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorageSetItem.mockResolvedValue(undefined);
  });

  it('shows the first coach mark on the first home visit', async () => {
    // Arrange
    mockAsyncStorageGetItem.mockResolvedValue(null);

    // Act
    renderHomeScreen();

    // Assert
    expect(await screen.findByText('Start with your status')).toBeTruthy();
    expect(screen.getByText('Tip 1 of 4')).toBeTruthy();
    expect(screen.getByTestId('coach-mark-status')).toBeTruthy();
  });

  it('advances through the guided coach-mark sequence', async () => {
    // Arrange
    mockAsyncStorageGetItem.mockResolvedValue(null);
    renderHomeScreen();

    // Act
    fireEvent.press(await screen.findByText('Next'));

    // Assert
    expect(await screen.findByText('Review the trend')).toBeTruthy();
    expect(screen.getByText('Tip 2 of 4')).toBeTruthy();
    expect(screen.getByTestId('coach-mark-trend')).toBeTruthy();

    // Act
    fireEvent.press(screen.getByText('Next'));

    // Assert
    expect(await screen.findByText('Check your quick summary')).toBeTruthy();
    expect(screen.getByText('Tip 3 of 4')).toBeTruthy();
    expect(screen.getByTestId('coach-mark-summary')).toBeTruthy();

    // Act
    fireEvent.press(screen.getByText('Next'));

    // Assert
    expect(await screen.findByText('Open your full data')).toBeTruthy();
    expect(screen.getByText('Tip 4 of 4')).toBeTruthy();
    expect(screen.getByTestId('coach-mark-cta')).toBeTruthy();
    expect(screen.getByText('Done')).toBeTruthy();
  });

  it('persists the dismissal state when the user skips the coach marks', async () => {
    // Arrange
    mockAsyncStorageGetItem.mockResolvedValue(null);
    renderHomeScreen();

    // Act
    fireEvent.press(await screen.findByText('Skip tour'));

    // Assert
    await waitFor(() => {
      expect(mockAsyncStorageSetItem).toHaveBeenCalledWith(
        StorageKeys.APP_SETTINGS,
        JSON.stringify({ hasSeenHomeCoachMarks: true })
      );
    });
    await waitFor(() => {
      expect(screen.queryByText('Start with your status')).toBeNull();
    });
  });

  it('preserves existing app settings when the coach marks are completed', async () => {
    // Arrange
    mockAsyncStorageGetItem.mockResolvedValue(
      JSON.stringify({
        notificationsEnabled: false,
        theme: 'dark',
        dataRetentionDays: 30,
      })
    );
    renderHomeScreen();

    // Act
    fireEvent.press(await screen.findByText('Skip tour'));

    // Assert
    await waitFor(() => {
      expect(mockAsyncStorageSetItem).toHaveBeenCalledWith(
        StorageKeys.APP_SETTINGS,
        JSON.stringify({
          notificationsEnabled: false,
          theme: 'dark',
          dataRetentionDays: 30,
          hasSeenHomeCoachMarks: true,
        })
      );
    });
  });

  it('persists completion after the final coach mark is finished', async () => {
    // Arrange
    mockAsyncStorageGetItem.mockResolvedValue(null);
    renderHomeScreen();

    // Act
    fireEvent.press(await screen.findByText('Next'));
    fireEvent.press(await screen.findByText('Next'));
    fireEvent.press(await screen.findByText('Next'));
    fireEvent.press(await screen.findByText('Done'));

    // Assert
    await waitFor(() => {
      expect(mockAsyncStorageSetItem).toHaveBeenCalledWith(
        StorageKeys.APP_SETTINGS,
        JSON.stringify({ hasSeenHomeCoachMarks: true })
      );
    });
    await waitFor(() => {
      expect(screen.queryByText('Open your full data')).toBeNull();
    });
  });

  it('does not show coach marks when the first-visit tutorial was already seen', async () => {
    // Arrange
    mockAsyncStorageGetItem.mockResolvedValue(JSON.stringify({ hasSeenHomeCoachMarks: true }));

    // Act
    renderHomeScreen();

    // Assert
    await waitFor(() => {
      expect(screen.queryByText('Start with your status')).toBeNull();
    });
    expect(screen.queryByText('Skip tour')).toBeNull();
  });
});
