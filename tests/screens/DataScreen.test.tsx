/**
 * Tests for DataScreen.tsx (STORY-1003: Highlight inflection point on chart)
 *
 * Verifies that the inflection/inversion marker is rendered on the chart
 * when an inversion is present, and omitted when no inversion is provided.
 */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires */

import React from 'react';
import { render, screen, configure, fireEvent, waitFor } from '@testing-library/react-native';
import DataScreen from '../../src/screens/DataScreen';
import type { HRVAnalysisResult, HRVReading } from '../../src/types';
import { InversionStatus } from '../../src/types';

jest.mock('../../src/services/storage', () => ({
  exportDataAsCSV: jest.fn(),
  exportDataAsJSON: jest.fn(),
  exportDataAsPDF: jest.fn(),
}));

const mockShare = jest.fn();
const mockAlert = jest.fn();
const mockShareAsync = jest.fn();
const mockIsAvailableAsync = jest.fn();

// Lightweight React Native mock to avoid ESM parsing issues in RN entrypoint.
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
    Alert: { alert: (...args: unknown[]) => mockAlert(...args) },
    Share: { share: (...args: unknown[]) => mockShare(...args) },
  };
});

jest.mock('expo-sharing', () => ({
  __esModule: true,
  isAvailableAsync: (...args: unknown[]) => mockIsAvailableAsync(...args),
  shareAsync: (...args: unknown[]) => mockShareAsync(...args),
}));

// Mock react-native-svg primitives used by the chart decorator.
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

// Mock gesture-handler components for non-native Jest environment.
jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const passthrough = (props: any) => React.createElement('view', props, props.children);
  return {
    PanGestureHandler: passthrough,
    PinchGestureHandler: passthrough,
    State: { END: 'END' },
  };
});

// Mock expo-sqlite which is ESM-only and not needed for this screen test.
jest.mock('expo-sqlite', () => ({}));

// Capture what the chart decorator renders so we can assert on the SVG label.
jest.mock('react-native-chart-kit', () => {
  return {
    LineChart: ({ decorator }: any) => {
      const x = (index: number) => index * 10;
      const y = (value: number) => value * 2;
      const element = decorator?.({ x, y, width: 320, height: 200 });
      return element || null;
    },
  };
});

// Mock user context to inject readings and analysis result
const mockUseUser = jest.fn();
jest.mock('../../src/context/UserContext', () => ({
  useUser: () => mockUseUser(),
}));

const makeReadings = (count: number, startWeek: number): HRVReading[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `r${i}`,
    timestamp: new Date(2024, 0, 1 + i).toISOString(),
    hrvValue: 60 + i,
    gestationalWeek: startWeek + i,
    gestationalDay: i % 7,
    source: 'manual',
  }));

describe('DataScreen inflection marker (STORY-1003)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAvailableAsync.mockResolvedValue(true);
    mockShareAsync.mockResolvedValue(undefined);
    mockShare.mockResolvedValue(undefined);
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

  it('renders the inflection marker when inversion is within the displayed readings', () => {
    const readings = makeReadings(16, 30); // last 14 will be used by the chart
    const inversionReading = readings[12]; // inside the displayed slice
    const { Text: SvgText } = require('react-native-svg');

    const analysisResult: HRVAnalysisResult = {
      currentTrend: 'increasing',
      inversionStatus: InversionStatus.POSSIBLE_INVERSION,
      confidence: 'medium',
      inversionDetectedAt: inversionReading.timestamp,
      predictedDeliveryWindow: undefined,
      lastAnalyzedAt: new Date().toISOString(),
      message: 'Test message',
      recommendation: 'Test',
    };

    mockUseUser.mockReturnValue({
      hrvReadings: readings,
      analysisResult,
      currentGestationalWeek: readings[readings.length - 1].gestationalWeek,
    });

    render(React.createElement(DataScreen, null));

    const markerLabels = screen.UNSAFE_getAllByType(SvgText);
    const textContent = markerLabels
      .map((n) =>
        Array.isArray(n.props.children)
          ? n.props.children.join('')
          : n.props.children ?? ''
      )
      .join(' ');
    expect(textContent).toContain('Inflection');
    expect(textContent).toContain(`W${inversionReading.gestationalWeek}`);
  });

  it('does not render the inflection marker when no inversionDetectedAt is provided', () => {
    const readings = makeReadings(10, 25);

    mockUseUser.mockReturnValue({
      hrvReadings: readings,
      analysisResult: {
        currentTrend: 'stable',
        inversionStatus: InversionStatus.ON_TRACK,
        confidence: 'low',
        lastAnalyzedAt: new Date().toISOString(),
        message: 'No inversion',
      },
      currentGestationalWeek: readings[readings.length - 1].gestationalWeek,
    });

    render(React.createElement(DataScreen, null));

    expect(screen.queryByText('Inflection')).toBeNull();
  });

  it('exports a PDF report with the visible readings and shares the generated file', async () => {
    const readings = makeReadings(6, 28);
    const analysisResult: HRVAnalysisResult = {
      currentTrend: 'stable',
      inversionStatus: InversionStatus.ON_TRACK,
      confidence: 'medium',
      lastAnalyzedAt: new Date().toISOString(),
      message: 'Stable trend',
    };
    const { exportDataAsPDF } = require('../../src/services/storage');
    exportDataAsPDF.mockResolvedValue('file:///cache/labor-cue-report.pdf');

    mockUseUser.mockReturnValue({
      hrvReadings: readings,
      analysisResult,
      currentGestationalWeek: readings[readings.length - 1].gestationalWeek,
    });

    render(React.createElement(DataScreen, null));
    fireEvent.press(screen.getByText('Export PDF Report'));

    await waitFor(() => {
      expect(exportDataAsPDF).toHaveBeenCalledWith(readings, analysisResult);
    });
    expect(mockShareAsync).toHaveBeenCalledWith(
      'file:///cache/labor-cue-report.pdf',
      expect.objectContaining({
        mimeType: 'application/pdf',
        dialogTitle: 'Share PDF Report',
      })
    );
  });

  it('falls back to the default share sheet when native PDF sharing is unavailable', async () => {
    const readings = makeReadings(4, 30);
    const { exportDataAsPDF } = require('../../src/services/storage');
    exportDataAsPDF.mockResolvedValue('file:///cache/labor-cue-report.pdf');
    mockIsAvailableAsync.mockResolvedValue(false);

    mockUseUser.mockReturnValue({
      hrvReadings: readings,
      analysisResult: null,
      currentGestationalWeek: readings[readings.length - 1].gestationalWeek,
    });

    render(React.createElement(DataScreen, null));
    fireEvent.press(screen.getByText('Export PDF Report'));

    await waitFor(() => {
      expect(exportDataAsPDF).toHaveBeenCalledWith(readings, null);
    });
    expect(mockShareAsync).not.toHaveBeenCalled();
    expect(mockShare).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Labor Cue PDF Report',
        message: expect.stringContaining('file:///cache/labor-cue-report.pdf'),
        url: 'file:///cache/labor-cue-report.pdf',
      })
    );
  });
});
