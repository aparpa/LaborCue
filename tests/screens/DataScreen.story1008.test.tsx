/**
 * Tests for DataScreen.tsx (STORY-1008: Improved tooltip positioning)
 *
 * Verifies that the chart tooltip:
 * - opens near the tapped data point,
 * - stays above the point when there is room,
 * - flips/clamps when the point is near the top edge,
 * - remains inside the chart bounds near the left/right edges.
 */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires */

import React from 'react';
import { render, fireEvent, screen, configure } from '@testing-library/react-native';
import DataScreen from '../../src/screens/DataScreen';
import type { HRVReading } from '../../src/types';

// ============================================================================
// TEST SETUP
// ============================================================================

jest.mock('../../src/services/storage', () => ({
  exportDataAsCSV: jest.fn(),
  exportDataAsJSON: jest.fn(),
}));

// Lightweight React Native mock so the screen can render in Jest without the
// native runtime.
jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: (props: any) => React.createElement('view', props, props.children),
    Text: (props: any) => React.createElement('text', props, props.children),
    ScrollView: (props: any) => React.createElement('scrollview', props, props.children),
    TouchableOpacity: (props: any) =>
      React.createElement('touchableopacity', props, props.children),
    Dimensions: { get: () => ({ width: 400, height: 800 }) },
    StyleSheet: {
      create: (styles: any) => styles,
      flatten: (styles: any) => styles,
    },
    Alert: { alert: jest.fn() },
    Share: { share: jest.fn() },
  };
});

// Mock SVG primitives used by the chart decorator.
jest.mock('react-native-svg', () => {
  const React = require('react');
  const mock = (name: string) => (props: any) =>
    React.createElement(name, props, props.children);
  return {
    Circle: mock('Circle'),
    G: mock('G'),
    Line: mock('Line'),
    Text: mock('Text'),
  };
});

// Mock gesture-handler wrappers for the Jest environment.
jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const passthrough = (props: any) => React.createElement('view', props, props.children);
  return {
    PanGestureHandler: passthrough,
    PinchGestureHandler: passthrough,
    State: { END: 'END' },
  };
});

// Mock expo-sqlite because it is not needed for this screen test.
jest.mock('expo-sqlite', () => ({}));

// Provide explicit tap points so the test can verify the tooltip position math.
jest.mock('react-native-chart-kit', () => {
  const React = require('react');
  const { View, Text, TouchableOpacity } = require('react-native');

  return {
    LineChart: ({ onDataPointClick, decorator }: any) => (
      React.createElement(
        View,
        null,
        decorator?.({
          x: (index: number) => index * 10,
          y: (value: number) => value * 2,
          width: 352,
          height: 220,
        }),
        React.createElement(
          TouchableOpacity,
          { onPress: () => onDataPointClick?.({ index: 0, x: 176, y: 200 }) },
          React.createElement(Text, null, 'Tap Center Point')
        ),
        React.createElement(
          TouchableOpacity,
          { onPress: () => onDataPointClick?.({ index: 0, x: 10, y: 40 }) },
          React.createElement(Text, null, 'Tap Top Left Point')
        ),
        React.createElement(
          TouchableOpacity,
          { onPress: () => onDataPointClick?.({ index: 0, x: 340, y: 210 }) },
          React.createElement(Text, null, 'Tap Bottom Right Point')
        )
      )
    ),
  };
});

const mockUseUser = jest.fn();
jest.mock('../../src/context/UserContext', () => ({
  useUser: () => mockUseUser(),
}));

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Builds a small reading set for tooltip interaction tests.
 */
function makeReadings(): HRVReading[] {
  return [
    {
      id: 'reading-1',
      timestamp: '2024-01-01T00:00:00.000Z',
      hrvValue: 52.4,
      gestationalWeek: 31,
      gestationalDay: 2,
      source: 'manual',
    },
    {
      id: 'reading-2',
      timestamp: '2024-01-03T00:00:00.000Z',
      hrvValue: 54.1,
      gestationalWeek: 31,
      gestationalDay: 4,
      source: 'manual',
    },
  ];
}

/**
 * Flattens a style prop that may be a single object or an array of objects.
 */
function flattenStyle(styleProp: any): Record<string, unknown> {
  if (Array.isArray(styleProp)) {
    return styleProp.reduce(
      (merged, next) => ({ ...merged, ...flattenStyle(next) }),
      {}
    );
  }

  return (styleProp ?? {}) as Record<string, unknown>;
}

/**
 * Renders DataScreen with basic reading data for tooltip positioning tests.
 */
function renderScreen() {
  const readings = makeReadings();

  mockUseUser.mockReturnValue({
    hrvReadings: readings,
    analysisResult: null,
    currentGestationalWeek: readings[readings.length - 1].gestationalWeek,
  });

  return render(React.createElement(DataScreen, null));
}

/**
 * Returns the floating tooltip card node so the test can inspect its position.
 */
function getTooltipCard() {
  const tooltipCard = screen.UNSAFE_getAllByType('view').find((node: any) => {
    const style = flattenStyle(node.props.style);
    return style.position === 'absolute' && style.borderLeftWidth === 4;
  });

  expect(tooltipCard).toBeTruthy();
  return tooltipCard!;
}

// ============================================================================
// STORY-1008 TESTS
// ============================================================================

describe('DataScreen STORY-1008', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    configure({
      hostComponentNames: {
        text: 'text',
        textInput: 'textinput',
        image: 'image',
        switch: 'switch',
        scrollView: 'scrollview',
        modal: 'modal',
      },
    });
  });

  it('positions the tooltip near a centered tap and keeps it above the point when space is available', () => {
    renderScreen();

    fireEvent.press(screen.getByText('Tap Center Point'));

    const style = flattenStyle(getTooltipCard().props.style);

    expect(screen.getByText('Reading Details')).toBeTruthy();
    expect(style.width).toBe(260);
    expect(style.left).toBe(46);
    expect(style.top).toBe(20);
  });

  it('clamps the tooltip away from the left edge and flips it below a near-top tap', () => {
    renderScreen();

    fireEvent.press(screen.getByText('Tap Top Left Point'));

    const style = flattenStyle(getTooltipCard().props.style);

    expect(style.left).toBe(8);
    expect(style.top).toBe(44);
  });

  it('clamps the tooltip away from the right edge for taps near the screen boundary', () => {
    renderScreen();

    fireEvent.press(screen.getByText('Tap Bottom Right Point'));

    const style = flattenStyle(getTooltipCard().props.style);

    expect(style.left).toBe(84);
    expect(style.top).toBe(30);
  });
});
