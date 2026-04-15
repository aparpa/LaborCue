/**
 * Tests for HomeScreen.tsx (STORY-903: Mini HRV sparkline on home screen)
 *
 * Verifies that the Home screen shows a small inline chart using the
 * last 7 HRV readings without requiring navigation to the Data screen.
 */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import HomeScreen from '../../src/screens/HomeScreen';
import type { HRVAnalysisResult, HRVReading, UserProfile } from '../../src/types';
import { InversionStatus } from '../../src/types';

// ============================================================================
// TEST SETUP: NAVIGATION, CONTEXT, AND CHILD COMPONENTS
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

const mockTrendIndicator = jest.fn();

jest.mock('../../src/components/TrendIndicator', () => {
  const React = require('react');
  return function MockTrendIndicator(props: Record<string, unknown>): JSX.Element {
    mockTrendIndicator(props);
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
 * Creates deterministic HRV readings for sparkline rendering tests.
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
 * Returns a minimal user profile required by HomeScreen.
 */
function makeProfile(): UserProfile {
  return {
    id: 'profile-1',
    name: 'Test User',
    pregnancyStartDate: '2025-06-01T00:00:00.000Z',
    estimatedDueDate: '2026-03-21T00:00:00.000Z',
    currentWeeksPregnant: 36,
    createdAt: '2025-06-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    isFirstLaunch: false,
  };
}

/**
 * Returns a minimal analysis result required by HomeScreen.
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
 * Renders HomeScreen with mocked user context data.
 */
function renderHomeScreen(readings: HRVReading[]) {
  mockUseUser.mockReturnValue({
    profile: makeProfile(),
    hrvReadings: readings,
    analysisResult: makeAnalysisResult(),
    currentGestationalWeek: 36,
    currentGestationalDay: 2,
    latestReading: readings.length > 0 ? readings[readings.length - 1] : null,
    refreshData: jest.fn().mockResolvedValue(undefined),
  });

  return render(React.createElement(HomeScreen, null));
}

// ============================================================================
// STORY-903 TESTS
// ============================================================================

describe('HomeScreen STORY-903', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorageGetItem.mockResolvedValue(
      JSON.stringify({ hasSeenHomeCoachMarks: true })
    );
    mockAsyncStorageSetItem.mockResolvedValue(undefined);
  });

  it('passes the horizontal layout variant to TrendIndicator', () => {
    // Arrange
    renderHomeScreen(makeReadings(7));

    // Assert
    expect(mockTrendIndicator).toHaveBeenCalled();
    expect(mockTrendIndicator.mock.calls[0][0]).toMatchObject({
      layout: 'horizontal',
    });
  });

  it('renders a mini sparkline section alongside trend information', () => {
    // Arrange
    renderHomeScreen(makeReadings(7));

    // Assert
    expect(screen.getByText('HRV Trend')).toBeTruthy();
    expect(screen.getByText('Last 7')).toBeTruthy();
    expect(screen.getByLabelText('Recent HRV sparkline')).toBeTruthy();
  });

  it('renders sparkline points from only the most recent 7 readings', () => {
    // Arrange
    renderHomeScreen(makeReadings(10));
    const { Polyline } = require('react-native-svg');

    // Act
    const sparkline = screen.UNSAFE_getByType(Polyline);
    const renderedPoints = String(sparkline.props.points)
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    // Assert
    expect(renderedPoints).toHaveLength(7);
  });

  it('shows an empty-state message when there are no readings for the sparkline', () => {
    // Arrange
    renderHomeScreen([]);

    // Assert
    expect(screen.getByText('No readings')).toBeTruthy();
  });
});
