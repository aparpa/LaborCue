import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import SetupScreen from '../../src/screens/SetupScreen';

// ============================================================================
// TEST SETUP: STORY-801 (DATE PICKER)
// ============================================================================

jest.mock('../../src/context/UserContext', () => ({
  useUser: () => ({
    setProfile: jest.fn().mockResolvedValue(undefined),
    completeSetup: jest.fn(),
  }),
}));

jest.mock('../../src/services/storage', () => ({
  createNewProfile: jest.fn(() => ({
    id: 'test-profile-id',
    name: undefined,
    pregnancyStartDate: new Date().toISOString(),
    estimatedDueDate: new Date().toISOString(),
    currentWeeksPregnant: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isFirstLaunch: false,
  })),
}));

jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const MockPicker = (props: any) => <Text testID="date-time-picker" {...props} />;
  return {
    __esModule: true,
    default: MockPicker,
  };
}, { virtual: true });

// ============================================================================
// STORY-801 TESTS
// ============================================================================

describe('SetupScreen STORY-801', () => {
  it('shows a date picker when the due date field is pressed', () => {
    // Arrange
    const { getByText, queryByTestId } = render(<SetupScreen />);

    // Act
    fireEvent.press(getByText('Due Date'));
    fireEvent.press(getByText('Select a date'));

    // Assert
    expect(queryByTestId('date-time-picker')).toBeTruthy();
  });

  it('updates the due date display after selecting a date', () => {
    // Arrange
    const { getByText, getByTestId } = render(<SetupScreen />);
    const selectedDate = new Date(2026, 1, 10);

    // Act
    fireEvent.press(getByText('Due Date'));
    fireEvent.press(getByText('Select a date'));
    fireEvent(getByTestId('date-time-picker'), 'onChange', { type: 'set' }, selectedDate);

    // Assert
    expect(getByText('02/10/2026')).toBeTruthy();
  });
});
