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

// ============================================================================
// STORY-801 TESTS
// ============================================================================

describe('SetupScreen STORY-801', () => {
  it('shows the due date text input when the Due Date toggle is selected', () => {
    const { getByText, getByPlaceholderText } = render(<SetupScreen />);

    fireEvent.press(getByText('Due Date'));

    expect(getByPlaceholderText('MM/DD/YYYY')).toBeTruthy();
  });

  it('updates the due date display after selecting a date', () => {
    const { getByText, getByPlaceholderText, getByDisplayValue } = render(<SetupScreen />);
    const selectedDate = new Date(2026, 1, 10);
    fireEvent.press(getByText('Due Date'));
    const dueInput = getByPlaceholderText('MM/DD/YYYY');
    fireEvent.changeText(dueInput, '02/10/2026');

    expect(getByDisplayValue('02/10/2026')).toBeTruthy();
  });
});
