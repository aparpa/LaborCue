/**
 * Tests for DataScreen.tsx export and chart behavior.
 */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires */

import React from 'react';
import { render, screen, configure, fireEvent, waitFor } from '@testing-library/react-native';
import DataScreen, { __testables } from '../../src/screens/DataScreen';
import type { HRVAnalysisResult, HRVReading } from '../../src/types';
import { InversionStatus } from '../../src/types';

jest.mock('../../src/services/storage', () => ({
  exportDataAsCSV: jest.fn(),
  exportDataAsJSON: jest.fn(),
  exportDataAsPDF: jest.fn(),
}));

const mockWriteAsStringAsync = jest.fn();
const mockIsAvailableAsync = jest.fn();
const mockShareAsync = jest.fn();
const mockShare = jest.fn();
const mockAlert = jest.fn();

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

jest.mock('expo-file-system', () => ({
  __esModule: true,
  cacheDirectory: 'file:///cache/',
  EncodingType: { UTF8: 'utf8' },
  writeAsStringAsync: (...args: unknown[]) => mockWriteAsStringAsync(...args),
}));

jest.mock('expo-sharing', () => ({
  __esModule: true,
  isAvailableAsync: (...args: unknown[]) => mockIsAvailableAsync(...args),
  shareAsync: (...args: unknown[]) => mockShareAsync(...args),
}));

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

jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const passthrough = (props: any) => React.createElement('view', props, props.children);
  return {
    PanGestureHandler: passthrough,
    PinchGestureHandler: passthrough,
    State: { END: 'END' },
  };
});

jest.mock('expo-sqlite', () => ({}));

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

describe('DataScreen exports and chart markers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAvailableAsync.mockResolvedValue(true);
    mockWriteAsStringAsync.mockResolvedValue(undefined);
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
    const readings = makeReadings(16, 30);
    const inversionReading = readings[12];
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
      .map((node) =>
        Array.isArray(node.props.children)
          ? node.props.children.join('')
          : node.props.children ?? ''
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

  it('creates an SVG chart image and shares it when tapping Share Chart Image', async () => {
    const readings = makeReadings(6, 28);

    mockUseUser.mockReturnValue({
      hrvReadings: readings,
      analysisResult: {
        currentTrend: 'stable',
        inversionStatus: InversionStatus.ON_TRACK,
        confidence: 'medium',
        lastAnalyzedAt: new Date().toISOString(),
        message: 'Stable trend',
      },
      currentGestationalWeek: readings[readings.length - 1].gestationalWeek,
    });

    render(React.createElement(DataScreen, null));

    fireEvent.press(screen.getByText('Share Chart Image'));

    await waitFor(() => {
      expect(mockWriteAsStringAsync).toHaveBeenCalledTimes(1);
    });
    expect(mockWriteAsStringAsync.mock.calls[0][0]).toContain('file:///cache/labor-cue-chart-');
    expect(mockWriteAsStringAsync.mock.calls[0][1]).toContain('<svg');
    expect(mockWriteAsStringAsync.mock.calls[0][1]).toContain('Labor Cue HRV Chart');
    expect(mockShareAsync).toHaveBeenCalledWith(
      expect.stringContaining('file:///cache/labor-cue-chart-'),
      expect.objectContaining({
        mimeType: 'image/svg+xml',
        dialogTitle: 'Share HRV Chart',
      })
    );
  });

  it('falls back to sharing the generated chart file URL when native sharing is unavailable', async () => {
    const readings = makeReadings(6, 28);
    mockIsAvailableAsync.mockResolvedValue(false);

    mockUseUser.mockReturnValue({
      hrvReadings: readings,
      analysisResult: {
        currentTrend: 'stable',
        inversionStatus: InversionStatus.ON_TRACK,
        confidence: 'medium',
        lastAnalyzedAt: new Date().toISOString(),
        message: 'Stable trend',
      },
      currentGestationalWeek: readings[readings.length - 1].gestationalWeek,
    });

    render(React.createElement(DataScreen, null));
    fireEvent.press(screen.getByText('Share Chart Image'));

    await waitFor(() => {
      expect(mockWriteAsStringAsync).toHaveBeenCalledTimes(1);
    });
    expect(mockShareAsync).not.toHaveBeenCalled();
    expect(mockShare).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Labor Cue HRV Chart',
        message: expect.stringContaining('file:///cache/labor-cue-chart-'),
        url: expect.stringContaining('file:///cache/labor-cue-chart-'),
      })
    );
  });
});

describe('DataScreen STORY-1007 helpers', () => {
  it('builds a shareable SVG with summary and inflection marker', () => {
    const readings = makeReadings(8, 30);
    const analysisResult: HRVAnalysisResult = {
      currentTrend: 'increasing',
      inversionStatus: InversionStatus.POSSIBLE_INVERSION,
      confidence: 'medium',
      inversionDetectedAt: readings[4].timestamp,
      lastAnalyzedAt: new Date().toISOString(),
      message: 'Trend is increasing',
      recommendation: 'Share this chart with your provider.',
    };

    const svg = __testables.buildShareableChartSvg(readings, analysisResult);

    expect(svg).toContain('<svg');
    expect(svg).toContain('Labor Cue HRV Chart');
    expect(svg).toContain('Inflection');
    expect(svg).toContain('possible');
    expect(svg).toContain(`W${readings[0].gestationalWeek}`);
  });
});
