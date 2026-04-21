import React from 'react';
import { configure, render, screen } from '@testing-library/react-native';
import HomeScreen from '../../src/screens/HomeScreen';
import { InversionStatus } from '../../src/types';
import type { HRVAnalysisResult, HRVReading } from '../../src/types';

jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: (props: any) => React.createElement('view', props, props.children),
    Text: (props: any) => React.createElement('text', props, props.children),
    ScrollView: (props: any) => React.createElement('scrollview', props, props.children),
    TouchableOpacity: (props: any) =>
      React.createElement('touchableopacity', props, props.children),
    RefreshControl: (props: any) =>
      React.createElement('refreshcontrol', props, props.children),
    StyleSheet: {
      create: (styles: any) => styles,
      flatten: (styles: any) => styles,
    },
  };
});

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}));

jest.mock('../../src/components/StatusCard', () => {
  const React = require('react');
  return function StatusCard(props: any) {
    return React.createElement('statuscard', props, props.children);
  };
});

jest.mock('../../src/components/TrendIndicator', () => {
  const React = require('react');
  return function TrendIndicator(props: any) {
    return React.createElement('trendindicator', props, props.children);
  };
});

const mockUseUser = jest.fn();
jest.mock('../../src/context/UserContext', () => ({
  useUser: () => mockUseUser(),
}));

const makeReadings = (): HRVReading[] => [
  {
    id: 'r1',
    timestamp: '2024-08-01T00:00:00.000Z',
    hrvValue: 78,
    gestationalWeek: 31,
    gestationalDay: 0,
    source: 'manual',
  },
  {
    id: 'r2',
    timestamp: '2024-08-03T00:00:00.000Z',
    hrvValue: 82,
    gestationalWeek: 31,
    gestationalDay: 2,
    source: 'manual',
  },
];

describe('HomeScreen prediction confidence interval (STORY-402)', () => {
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

  it('renders the 95% confidence interval when prediction data includes it', () => {
    const hrvReadings = makeReadings();
    const analysisResult: HRVAnalysisResult = {
      currentTrend: 'increasing',
      inversionStatus: InversionStatus.POSSIBLE_INVERSION,
      confidence: 'medium',
      predictedDeliveryWindow: {
        earliest: '2024-10-06T00:00:00.000Z',
        mostLikely: '2024-10-13T00:00:00.000Z',
        latest: '2024-10-20T00:00:00.000Z',
        confidenceInterval95: {
          lowerBound: '2024-10-06T00:00:00.000Z',
          upperBound: '2024-10-20T00:00:00.000Z',
          weeksMargin: 1,
        },
      },
      inversionDetectedAt: '2024-08-03T00:00:00.000Z',
      lastAnalyzedAt: '2024-08-03T00:00:00.000Z',
      message: 'Prediction available',
      recommendation: 'Monitor closely',
    };

    mockUseUser.mockReturnValue({
      profile: {
        name: 'Leah',
        estimatedDueDate: '2024-11-24T00:00:00.000Z',
      },
      hrvReadings,
      analysisResult,
      currentGestationalWeek: 31,
      currentGestationalDay: 2,
      latestReading: hrvReadings[1],
      refreshData: jest.fn(),
    });

    render(React.createElement(HomeScreen, null));

    expect(screen.getByText('Predicted Delivery Window')).toBeTruthy();
    expect(screen.getByText(/95% CI:/)).toBeTruthy();
    expect(screen.getByText(/\(1\.0-week margin\)/)).toBeTruthy();
  });
});
