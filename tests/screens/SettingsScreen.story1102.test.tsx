/**
 * Tests for SettingsScreen.tsx (STORY-1102: Notification scheduling)
 *
 * Verifies that SettingsScreen loads persisted notification preferences,
 * schedules daily sync reminders when reminders are enabled, reschedules
 * reminders when the selected time changes, and cancels reminders when
 * notifications are turned off.
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import SettingsScreen from '../../src/screens/SettingsScreen';

jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

// ============================================================================
// TEST SETUP: CONTEXT, STORAGE, AND NOTIFICATION SERVICE MOCKS
// ============================================================================

const mockLoadAppSettings = jest.fn();
const mockSaveAppSettings = jest.fn();
const mockScheduleDailySyncReminder = jest.fn();
const mockCancelDailySyncReminder = jest.fn();

jest.mock('../../src/context/UserContext', () => ({
  useUser: () => ({
    profile: {
      id: 'profile-1102',
      name: 'Avery',
      pregnancyStartDate: '2025-08-01T00:00:00.000Z',
      estimatedDueDate: '2026-05-08T00:00:00.000Z',
      currentWeeksPregnant: 37,
      createdAt: '2025-08-01T00:00:00.000Z',
      updatedAt: '2026-04-21T00:00:00.000Z',
      isFirstLaunch: false,
    },
    setProfile: jest.fn(),
    currentGestationalWeek: 37,
    currentGestationalDay: 2,
    refreshData: jest.fn(),
    hrvReadings: [],
  }),
}));

jest.mock('../../src/services/storage', () => ({
  clearAllData: jest.fn(),
  loadAppSettings: () => mockLoadAppSettings(),
  saveAppSettings: (...args: unknown[]) => mockSaveAppSettings(...args),
  saveHRVReading: jest.fn(),
}));

jest.mock('../../src/services/notifications', () => ({
  DEFAULT_REMINDER_TIME: '20:00',
  cancelDailySyncReminder: () => mockCancelDailySyncReminder(),
  formatReminderTime: (time: string) => `formatted:${time}`,
  getReminderTimeParts: (time: string) => {
    const [hourText = '20', minuteText = '00'] = time.split(':');
    const hour = Number.parseInt(hourText, 10);

    return {
      hourLabel: `${hour % 12 === 0 ? 12 : hour % 12}`,
      minuteLabel: minuteText,
      periodLabel: hour >= 12 ? 'PM' : 'AM',
    };
  },
  scheduleDailySyncReminder: (...args: unknown[]) => mockScheduleDailySyncReminder(...args),
  shiftReminderTime: (time: string, deltaMinutes: number) => {
    const [hourText = '20', minuteText = '00'] = time.split(':');
    const totalMinutes =
      (Number.parseInt(hourText, 10) * 60) +
      Number.parseInt(minuteText, 10) +
      deltaMinutes;
    const normalized = (totalMinutes + (24 * 60)) % (24 * 60);
    const nextHour = Math.floor(normalized / 60);
    const nextMinute = normalized % 60;

    return `${nextHour.toString().padStart(2, '0')}:${nextMinute.toString().padStart(2, '0')}`;
  },
  toggleReminderPeriod: (time: string) => {
    const [hourText = '20', minuteText = '00'] = time.split(':');
    const nextHour = (Number.parseInt(hourText, 10) + 12) % 24;

    return `${nextHour.toString().padStart(2, '0')}:${minuteText}`;
  },
}));

jest.mock('../../src/utils/dateUtils', () => ({
  formatDate: () => 'May 8, 2026',
  formatGestationalAge: () => '37w 2d',
}));

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Returns the default mocked app settings used by STORY-1102 tests.
 */
function makeAppSettings(overrides: Record<string, unknown> = {}) {
  return {
    notificationsEnabled: false,
    reminderTime: '07:30',
    theme: 'system',
    dataRetentionDays: 365,
    hasSeenHomeCoachMarks: false,
    ...overrides,
  };
}

/**
 * Renders SettingsScreen with the shared STORY-1102 mocks.
 */
function renderSettingsScreen() {
  return render(<SettingsScreen />);
}

// ============================================================================
// STORY-1102 TESTS
// ============================================================================

describe('SettingsScreen STORY-1102', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadAppSettings.mockResolvedValue(makeAppSettings());
    mockSaveAppSettings.mockResolvedValue(undefined);
    mockScheduleDailySyncReminder.mockResolvedValue(true);
    mockCancelDailySyncReminder.mockResolvedValue(undefined);
  });

  it('loads persisted reminder settings on mount', async () => {
    // Arrange + Act
    renderSettingsScreen();

    // Assert
    expect(await screen.findByText('formatted:07:30')).toBeTruthy();
    expect(screen.getByTestId('sync-reminder-switch').props.value).toBe(false);
  });

  it('schedules a daily reminder when sync reminders are enabled', async () => {
    // Arrange
    renderSettingsScreen();
    await waitFor(() => {
      expect(mockLoadAppSettings).toHaveBeenCalled();
    });

    // Act
    fireEvent(screen.getByTestId('sync-reminder-switch'), 'valueChange', true);

    // Assert
    await waitFor(() => {
      expect(mockScheduleDailySyncReminder).toHaveBeenCalledWith('07:30');
    });
    expect(mockSaveAppSettings).toHaveBeenLastCalledWith(expect.objectContaining({
      notificationsEnabled: true,
      reminderTime: '07:30',
    }));
  });

  it('reschedules the reminder when the user changes the reminder hour', async () => {
    // Arrange
    mockLoadAppSettings.mockResolvedValue(makeAppSettings({
      notificationsEnabled: true,
    }));
    renderSettingsScreen();

    await waitFor(() => {
      expect(screen.getByTestId('sync-reminder-switch').props.value).toBe(true);
    });

    // Act
    fireEvent.press(screen.getByLabelText('Increase reminder hour'));

    // Assert
    await waitFor(() => {
      expect(mockScheduleDailySyncReminder).toHaveBeenLastCalledWith('08:30');
    });
    expect(mockSaveAppSettings).toHaveBeenLastCalledWith(expect.objectContaining({
      notificationsEnabled: true,
      reminderTime: '08:30',
    }));
  });

  it('cancels the existing reminder when sync reminders are disabled', async () => {
    // Arrange
    mockLoadAppSettings.mockResolvedValue(makeAppSettings({
      notificationsEnabled: true,
    }));
    renderSettingsScreen();

    await waitFor(() => {
      expect(screen.getByTestId('sync-reminder-switch').props.value).toBe(true);
    });

    // Act
    fireEvent(screen.getByTestId('sync-reminder-switch'), 'valueChange', false);

    // Assert
    await waitFor(() => {
      expect(mockCancelDailySyncReminder).toHaveBeenCalled();
    });
    expect(mockSaveAppSettings).toHaveBeenLastCalledWith(expect.objectContaining({
      notificationsEnabled: false,
      reminderTime: '07:30',
    }));
  });
});
