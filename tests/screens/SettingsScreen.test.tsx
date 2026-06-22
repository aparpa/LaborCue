/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import SettingsScreen from '../../src/screens/SettingsScreen';

jest.mock('../../src/services/storage', () => ({
  clearAllData: jest.fn(),
  saveHRVReading: jest.fn(),
}));

jest.mock('react-native', () => {
  const React = require('react');
  const mock = (name: string) => (props: any) => React.createElement(name, props, props.children);

  return {
    View: mock('view'),
    Text: mock('text'),
    ScrollView: mock('scrollview'),
    TouchableOpacity: mock('touchableopacity'),
    TextInput: mock('textinput'),
    Switch: mock('switch'),
    Alert: { alert: jest.fn() },
    StyleSheet: {
      create: (styles: any) => styles,
    },
  };
});

const mockUseUser = jest.fn();
jest.mock('../../src/context/UserContext', () => ({
  useUser: () => mockUseUser(),
}));

describe('SettingsScreen STORY-1101 device pairing UI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseUser.mockReturnValue({
      profile: {
        id: 'profile-1',
        name: 'Taylor',
        pregnancyStartDate: '2025-01-01T00:00:00.000Z',
        estimatedDueDate: '2025-10-08T00:00:00.000Z',
        currentWeeksPregnant: 26,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-04-21T00:00:00.000Z',
        isFirstLaunch: false,
      },
      setProfile: jest.fn(),
      currentGestationalWeek: 26,
      currentGestationalDay: 3,
      refreshData: jest.fn(),
      hrvReadings: [],
    });
  });

  it('renders the device pairing section with scan prompt', () => {
    render(React.createElement(SettingsScreen, null));

    expect(screen.getByText('Device Pairing')).toBeTruthy();
    expect(screen.getByText('No device paired')).toBeTruthy();
    expect(screen.getByText('Scan for Devices')).toBeTruthy();
    expect(screen.getByText('No devices discovered yet. Start a scan to find nearby wearables.')).toBeTruthy();
  });

  it('scans, pairs, disconnects, and forgets a device', () => {
    render(React.createElement(SettingsScreen, null));

    fireEvent.press(screen.getByText('Scan for Devices'));

    expect(screen.getByText('Labor Cue Band A1')).toBeTruthy();
    expect(screen.getByText('SleepSense HRV Clip')).toBeTruthy();

    fireEvent.press(screen.getAllByText('Pair')[0]);

    expect(screen.getByText('Connected')).toBeTruthy();
    expect(screen.getByText('Forget paired device')).toBeTruthy();
    expect(screen.getByText('Disconnect')).toBeTruthy();

    fireEvent.press(screen.getByText('Disconnect'));

    expect(screen.getByText('Reconnect')).toBeTruthy();
    expect(screen.getByText('Not Connected')).toBeTruthy();

    fireEvent.press(screen.getByText('Forget paired device'));

    expect(screen.getByText('No device paired')).toBeTruthy();
    expect(screen.queryByText('Disconnect')).toBeNull();
  });
});
