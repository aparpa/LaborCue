import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Alert, StyleSheet } from 'react-native';
import SetupScreen from '../../src/screens/SetupScreen';
import { COLORS } from '../../src/constants';

// ============================================================================
// TEST SETUP: STORY-802 (INLINE VALIDATION + RED FIELD HIGHLIGHT)
// ============================================================================

const mockSetProfile = jest.fn().mockResolvedValue(undefined);
const mockCompleteSetup = jest.fn();

jest.mock('../../src/context/UserContext', () => ({
  useUser: () => ({
    setProfile: mockSetProfile,
    completeSetup: mockCompleteSetup,
  }),
}));

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Flattens React Native style arrays/objects into a single style object.
 */
function flattenStyle(styleProp: unknown): Record<string, unknown> {
  return (StyleSheet.flatten(styleProp as object) as Record<string, unknown>) || {};
}

/**
 * Returns the screen in "Due Date" mode.
 */
function renderInDueDateMode() {
  const screen = render(<SetupScreen />);
  fireEvent.press(screen.getByText('Due Date'));
  return screen;
}

// ============================================================================
// STORY-802 TESTS
// ============================================================================

describe('SetupScreen STORY-802', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows inline error and red border for invalid weeks input', () => {
    // Arrange
    const { getByText, getByPlaceholderText } = render(<SetupScreen />);
    const weeksInput = getByPlaceholderText('24');
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    // Act
    fireEvent.changeText(weeksInput, '0');
    fireEvent.press(getByText('Start Tracking'));

    // Assert
    expect(getByText('Please enter weeks between 1 and 42.')).toBeTruthy();
    expect(flattenStyle(weeksInput.props.style).borderColor).toBe(COLORS.danger);
    expect(alertSpy).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('shows inline error and red border for invalid days input', () => {
    // Arrange
    const { getByText, getByPlaceholderText } = render(<SetupScreen />);
    const weeksInput = getByPlaceholderText('24');
    const daysInput = getByPlaceholderText('0');
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    // Act
    fireEvent.changeText(weeksInput, '24');
    fireEvent.changeText(daysInput, '9');
    fireEvent.press(getByText('Start Tracking'));

    // Assert
    expect(getByText('Days should be between 0 and 6.')).toBeTruthy();
    expect(flattenStyle(daysInput.props.style).borderColor).toBe(COLORS.danger);
    expect(alertSpy).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('shows inline error and red border for invalid due date format', () => {
    // Arrange
    const { getByText, getByPlaceholderText } = renderInDueDateMode();
    const dueDateInput = getByPlaceholderText('MM/DD/YYYY');
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    // Act
    fireEvent.changeText(dueDateInput, 'not-a-date');
    fireEvent.press(getByText('Start Tracking'));

    // Assert
    expect(getByText('Please enter a valid due date (MM/DD/YYYY).')).toBeTruthy();
    expect(flattenStyle(dueDateInput.props.style).borderColor).toBe(COLORS.danger);
    expect(alertSpy).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('shows inline error and red border for a past due date', () => {
    // Arrange
    const { getByText, getByPlaceholderText } = renderInDueDateMode();
    const dueDateInput = getByPlaceholderText('MM/DD/YYYY');

    // Act
    fireEvent.changeText(dueDateInput, '01/01/2020');
    fireEvent.press(getByText('Start Tracking'));

    // Assert
    expect(getByText('Due date cannot be in the past.')).toBeTruthy();
    expect(flattenStyle(dueDateInput.props.style).borderColor).toBe(COLORS.danger);
  });

  it('clears weeks inline error after the user updates the field', () => {
    // Arrange
    const { getByText, getByPlaceholderText, queryByText } = render(<SetupScreen />);
    const weeksInput = getByPlaceholderText('24');

    // Act
    fireEvent.changeText(weeksInput, '0');
    fireEvent.press(getByText('Start Tracking'));
    expect(getByText('Please enter weeks between 1 and 42.')).toBeTruthy();

    fireEvent.changeText(weeksInput, '24');

    // Assert
    expect(queryByText('Please enter weeks between 1 and 42.')).toBeNull();
  });
});
