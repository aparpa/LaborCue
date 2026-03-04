import React from 'react';
const TestRenderer = require('react-test-renderer');
const { act } = TestRenderer;

import HomeScreen from '../../src/screens/HomeScreen';

const mockNavigate = jest.fn();
const mockRefreshData = jest.fn();
const mockUseUser = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}));

jest.mock('../../src/context/UserContext', () => ({
  useUser: () => mockUseUser(),
}));

jest.mock('../../src/components/StatusCard', () => {
  const ReactLib = require('react');
  return function MockStatusCard(props: {
    message: string;
    confidence: string;
  }): JSX.Element {
    return ReactLib.createElement(
      'Text',
      null,
      `StatusCard:${props.message}:${props.confidence}`
    );
  };
});

jest.mock('../../src/components/TrendIndicator', () => {
  const ReactLib = require('react');
  return function MockTrendIndicator(props: { trend: string }): JSX.Element {
    return ReactLib.createElement('Text', null, `Trend:${props.trend}`);
  };
});

jest.mock('../../src/utils/dateUtils', () => ({
  formatGestationalAge: (week: number, day: number) => `${week}w ${day}d`,
  formatDate: (date: string, format = 'MMM d, yyyy') =>
    `formatted(${date}|${format})`,
  getTimeUntil: (date: string) => `until(${date})`,
}));

jest.mock('react-native', () => {
  const ReactLib = require('react');

  const createHost =
    (name: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactLib.createElement(name, props, children);

  return {
    View: createHost('View'),
    Text: createHost('Text'),
    ScrollView: createHost('ScrollView'),
    TouchableOpacity: createHost('TouchableOpacity'),
    RefreshControl: createHost('RefreshControl'),
    StyleSheet: {
      create: (styles: unknown) => styles,
    },
  };
});

/**
 * Builds a complete mock context value for HomeScreen and allows per-test overrides.
 */
function buildUserContext(overrides: Record<string, unknown> = {}) {
  return {
    profile: {
      id: 'u1',
      name: 'Leah',
      pregnancyStartDate: '2025-08-01T00:00:00.000Z',
      estimatedDueDate: '2026-05-08T00:00:00.000Z',
      currentWeeksPregnant: 24,
      createdAt: '2025-08-01T00:00:00.000Z',
      updatedAt: '2025-08-01T00:00:00.000Z',
      isFirstLaunch: false,
    },
    hrvReadings: [
      {
        id: 'r1',
        timestamp: '2026-02-09T00:00:00.000Z',
        hrvValue: 50,
        gestationalWeek: 24,
        gestationalDay: 1,
        source: 'manual',
      },
      {
        id: 'r2',
        timestamp: '2026-02-10T00:00:00.000Z',
        hrvValue: 55,
        gestationalWeek: 24,
        gestationalDay: 2,
        source: 'manual',
      },
    ],
    analysisResult: {
      currentTrend: 'stable',
      inversionStatus: 'on_track',
      confidence: 'medium',
      lastAnalyzedAt: '2026-02-10T00:00:00.000Z',
      message: 'All good',
      recommendation: 'Keep tracking',
      predictedDeliveryWindow: {
        earliest: '2026-05-01T00:00:00.000Z',
        latest: '2026-05-12T00:00:00.000Z',
        mostLikely: '2026-05-08T00:00:00.000Z',
      },
    },
    currentGestationalWeek: 24,
    currentGestationalDay: 3,
    latestReading: {
      id: 'r2',
      timestamp: '2026-02-10T00:00:00.000Z',
      hrvValue: 55,
      gestationalWeek: 24,
      gestationalDay: 2,
      source: 'manual',
    },
    refreshData: mockRefreshData,
    ...overrides,
  };
}

/**
 * Utility to collect all string text from the rendered test tree.
 */
function getRenderedText(tree: any): string[] {
  return tree.root
    .findAllByType('Text')
    .map((node: any) => node.children.join(''));
}

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRefreshData.mockResolvedValue(undefined);
  });

  it('renders main sections with populated user and analysis data', () => {
    mockUseUser.mockReturnValue(buildUserContext());

    const tree = TestRenderer.create(React.createElement(HomeScreen));
    const text = getRenderedText(tree);

    expect(text).toContain('Welcome, Leah!');
    expect(text).toContain('You are 24w 3d pregnant');
    expect(text).toContain(
      'Due date: formatted(2026-05-08T00:00:00.000Z|MMM d, yyyy) (until(2026-05-08T00:00:00.000Z))'
    );
    expect(text).toContain('HRV Trend');
    expect(text).toContain('Trend:stable');
    expect(text).toContain('55.0 ms');
    expect(text).toContain('Latest reading');
    expect(text).toContain('formatted(2026-02-10T00:00:00.000Z|MMM d)');
    expect(text).toContain('Summary');
    expect(text).toContain('2');
    expect(text).toContain('52.5');
    expect(text).toContain('Predicted Delivery Window');
    expect(text).toContain(
      'formatted(2026-05-08T00:00:00.000Z|MMMM d, yyyy)'
    );
    expect(text.join(' ')).toContain(
      'Range: formatted(2026-05-01T00:00:00.000Z|MMM d)'
    );
    expect(text.join(' ')).toContain(
      'formatted(2026-05-12T00:00:00.000Z|MMM d)'
    );
    expect(text).toContain('View Compiled Data');
  });

  it('renders fallback values when optional data is missing', () => {
    mockUseUser.mockReturnValue(
      buildUserContext({
        profile: {
          estimatedDueDate: '',
        },
        hrvReadings: [],
        latestReading: null,
        analysisResult: null,
      })
    );

    const tree = TestRenderer.create(React.createElement(HomeScreen));
    const text = getRenderedText(tree);

    expect(text).toContain('Welcome, there!');
    expect(text).toContain('StatusCard:Collecting data...:none');
    expect(text).toContain('Trend:insufficient_data');
    expect(text).toContain('--');
    expect(text).not.toContain('Predicted Delivery Window');
    expect(text).not.toContain('Latest reading');
  });

  it('navigates to Data screen when View Compiled Data is pressed', () => {
    mockUseUser.mockReturnValue(buildUserContext());
    const tree = TestRenderer.create(React.createElement(HomeScreen));

    const button = tree.root.findByType('TouchableOpacity');
    act(() => {
      button.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('Data');
  });

  it('calls refreshData when pull-to-refresh is triggered', async () => {
    mockUseUser.mockReturnValue(buildUserContext());
    const tree = TestRenderer.create(React.createElement(HomeScreen));

    const scrollView = tree.root.findByType('ScrollView');
    const refreshControl = scrollView.props.refreshControl;

    await act(async () => {
      await refreshControl.props.onRefresh();
    });

    expect(mockRefreshData).toHaveBeenCalledTimes(1);
  });
});
