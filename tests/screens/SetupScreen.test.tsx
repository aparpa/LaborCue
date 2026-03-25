import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import SetupScreen from '../../src/screens/SetupScreen';

jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

const mockSetProfile = jest.fn();
const mockCompleteSetup = jest.fn();
const mockCreateNewProfile = jest.fn(() => ({
  id: 'profile-1',
  pregnancyStartDate: '2024-01-01T00:00:00.000Z',
  estimatedDueDate: '2024-10-07T00:00:00.000Z',
  currentWeeksPregnant: 0,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  isFirstLaunch: false,
}));

jest.mock('../../src/context/UserContext', () => ({
  useUser: () => ({
    setProfile: mockSetProfile,
    completeSetup: mockCompleteSetup,
  }),
}));

jest.mock('../../src/services/storage', () => ({
  createNewProfile: (...args: unknown[]) => mockCreateNewProfile(...args),
}));

jest.mock('../../src/utils/dateUtils', () => ({
  calculatePregnancyStartDate: jest.fn(() => '2024-01-01T00:00:00.000Z'),
  calculateDueDate: jest.fn(() => '2024-10-07T00:00:00.000Z'),
  calculateStartDateFromDueDate: jest.fn(() => '2024-01-01T00:00:00.000Z'),
  parseFlexibleDate: jest.fn(() => new Date('2024-10-07T00:00:00.000Z')),
}));

function renderSetupScreen() {
  return render(<SetupScreen />);
}

function goToPregnancyDetailsStep(): void {
  fireEvent.press(screen.getByText('Next'));
}

function fillPregnancyDetails(): void {
  fireEvent.changeText(screen.getByPlaceholderText('24'), '28');
  fireEvent.changeText(screen.getByPlaceholderText('0'), '3');
}

function goToProviderStep(): void {
  fireEvent.press(screen.getByText('Next'));
}

function getProgressFillWidth(): unknown {
  return StyleSheet.flatten(screen.getByTestId('setup-progress-fill').props.style).width;
}

describe('SetupScreen multi-step flow (STORY-803)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows progress through the three setup steps', () => {
    renderSetupScreen();

    expect(screen.getByText('Step 1 of 3')).toBeTruthy();
    expect(screen.getByText('33%')).toBeTruthy();
    expect(screen.getByTestId('setup-progress-track').props.accessibilityRole).toBe('progressbar');
    expect(getProgressFillWidth()).toBe('33.33333333333333%');
    expect(screen.getAllByText('Basic Info').length).toBeGreaterThan(0);
    expect(screen.queryByText('Pregnancy Information')).toBeNull();
    expect(screen.queryByText('Previous')).toBeNull();
    expect(screen.queryByText('Start Tracking')).toBeNull();

    goToPregnancyDetailsStep();

    expect(screen.getByText('Step 2 of 3')).toBeTruthy();
    expect(screen.getByText('67%')).toBeTruthy();
    expect(getProgressFillWidth()).toBe('66.66666666666666%');
    expect(screen.getByText('Pregnancy Information')).toBeTruthy();
    expect(screen.getByText('Previous')).toBeTruthy();
    expect(screen.getByText('Next')).toBeTruthy();

    fireEvent.press(screen.getByText('Previous'));

    expect(screen.getByText('Step 1 of 3')).toBeTruthy();
    expect(getProgressFillWidth()).toBe('33.33333333333333%');
    expect(screen.queryByText('Pregnancy Information')).toBeNull();
  });

  it('does not submit before the final step', () => {
    renderSetupScreen();

    fireEvent.press(screen.getByText('Next'));

    expect(mockSetProfile).not.toHaveBeenCalled();
    expect(mockCompleteSetup).not.toHaveBeenCalled();
    expect(screen.queryByText('Start Tracking')).toBeNull();
  });

  it('submits only on the final provider step', async () => {
    renderSetupScreen();
    goToPregnancyDetailsStep();
    fillPregnancyDetails();
    goToProviderStep();

    expect(screen.getByText('Step 3 of 3')).toBeTruthy();
    expect(screen.getByText('100%')).toBeTruthy();
    expect(getProgressFillWidth()).toBe('100%');
    expect(screen.getByText('Start Tracking')).toBeTruthy();

    fireEvent.changeText(screen.getByPlaceholderText('Provider name'), 'Midwife Team');
    fireEvent.changeText(screen.getByPlaceholderText('Phone or email'), 'care@example.com');
    fireEvent.press(screen.getByText('Start Tracking'));

    await waitFor(() => {
      expect(mockSetProfile).toHaveBeenCalledTimes(1);
      expect(mockCompleteSetup).toHaveBeenCalledTimes(1);
    });

    expect(mockSetProfile.mock.calls[0][0]).toMatchObject({
      healthcareProvider: {
        name: 'Midwife Team',
        contact: 'care@example.com',
      },
    });
  });

  it('blocks submission on the final step and shows the inline error when pregnancy details are invalid', async () => {
    renderSetupScreen();
    goToPregnancyDetailsStep();
    fireEvent.changeText(screen.getByPlaceholderText('24'), '0');
    goToProviderStep();
    fireEvent.press(screen.getByText('Start Tracking'));

    await waitFor(() => {
      expect(screen.getByText('Please enter weeks between 1 and 42.')).toBeTruthy();
      expect(screen.getByText('Step 2 of 3')).toBeTruthy();
    });
    expect(mockSetProfile).not.toHaveBeenCalled();
    expect(mockCompleteSetup).not.toHaveBeenCalled();
  });
});
