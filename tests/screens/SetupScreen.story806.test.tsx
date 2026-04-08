import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import SetupScreen from '../../src/screens/SetupScreen';
import { SPACING } from '../../src/constants';

jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

const mockSetProfile = jest.fn();
const mockCompleteSetup = jest.fn();
const mockScrollTo = jest.fn();
const mockKeyboardRemove = jest.fn();
const mockKeyboardListeners: Record<string, (() => void) | undefined> = {};

jest.mock('../../src/context/UserContext', () => ({
  useUser: () => ({
    setProfile: mockSetProfile,
    completeSetup: mockCompleteSetup,
  }),
}));

jest.mock('react-native/Libraries/Components/ScrollView/ScrollView', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  const ReactNative = jest.requireActual<typeof import('react-native')>('react-native');

  const MockScrollView = ReactModule.forwardRef(
    (
      {
        children,
        ...props
      }: React.ComponentProps<typeof ReactNative.View>,
      ref
    ) => {
      ReactModule.useImperativeHandle(ref, () => ({
        scrollTo: mockScrollTo,
      }));

      return ReactModule.createElement(ReactNative.View, props, children);
    }
  );

  MockScrollView.displayName = 'MockScrollView';

  return MockScrollView;
});

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Renders the setup screen with the default mocked context.
 */
function renderSetupScreen() {
  return render(<SetupScreen />);
}

/**
 * Advances the flow from step 1 to the pregnancy details step.
 */
function goToPregnancyDetailsStep(screen: ReturnType<typeof render>): void {
  fireEvent.press(screen.getByText('Next'));
}

/**
 * Fires an onLayout event for the wrapper that stores the field position.
 */
function setFieldPosition(input: ReactTestInstance, y: number): void {
  fireEvent(input.parent, 'layout', {
    nativeEvent: {
      layout: {
        x: 0,
        y,
        width: 240,
        height: 56,
      },
    },
  });
}

// ============================================================================
// STORY-806 TESTS
// ============================================================================

describe('SetupScreen STORY-806', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(mockKeyboardListeners).forEach((key) => {
      delete mockKeyboardListeners[key];
    });

    jest.spyOn(Keyboard, 'addListener').mockImplementation((eventName, callback) => {
      mockKeyboardListeners[eventName] = callback;
      return {
        remove: mockKeyboardRemove,
      };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('configures KeyboardAvoidingView with the expected platform offset', () => {
    // Arrange
    const screen = renderSetupScreen();

    // Act
    const keyboardAvoidingView = screen.UNSAFE_getByType(KeyboardAvoidingView);

    // Assert
    expect(keyboardAvoidingView.props.behavior).toBe(Platform.OS === 'ios' ? 'padding' : 'height');
    expect(keyboardAvoidingView.props.keyboardVerticalOffset).toBe(
      Platform.OS === 'ios' ? SPACING.lg : 0
    );
  });

  it('scrolls to the focused pregnancy input so it stays visible', () => {
    // Arrange
    const screen = renderSetupScreen();
    goToPregnancyDetailsStep(screen);
    const weeksInput = screen.getByPlaceholderText('24');
    setFieldPosition(weeksInput, 320);

    // Act
    fireEvent(weeksInput, 'focus');

    // Assert
    expect(mockScrollTo).toHaveBeenCalledWith({
      y: 320 - SPACING.xl,
      animated: true,
    });
  });

  it('re-scrolls the active field when the keyboard show event fires', () => {
    // Arrange
    const screen = renderSetupScreen();
    goToPregnancyDetailsStep(screen);
    fireEvent.press(screen.getByText('Due Date'));
    const dueDateInput = screen.getByPlaceholderText('MM/DD/YYYY');
    setFieldPosition(dueDateInput, 260);
    fireEvent(dueDateInput, 'focus');
    mockScrollTo.mockClear();

    // Act
    const keyboardEventName = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const keyboardListener = mockKeyboardListeners[keyboardEventName];
    keyboardListener?.();

    // Assert
    expect(keyboardListener).toBeDefined();
    expect(mockScrollTo).toHaveBeenCalledWith({
      y: 260 - SPACING.xl,
      animated: true,
    });
  });
});
