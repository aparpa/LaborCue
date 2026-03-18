/**
 * Tests for SetupScreen.tsx (STORY-803: Multi-step setup with progress bar)
 *
 * Verifies that setup is split into the backlog-defined steps:
 * 1. Basic Info
 * 2. Pregnancy Details
 * 3. Provider
 *
 * Also verifies that the progress indicator updates as the user advances
 * and that profile submission still occurs on the final step only.
 */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires */

import React from 'react';
import { render, screen, fireEvent, waitFor, configure } from '@testing-library/react-native';
import SetupScreen from '../../src/screens/SetupScreen';

jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: (props: any) => React.createElement('view', props, props.children),
    Text: (props: any) => React.createElement('text', props, props.children),
    TextInput: (props: any) => React.createElement('textinput', props, props.children),
    TouchableOpacity: (props: any) =>
      React.createElement('touchableopacity', props, props.children),
    ScrollView: (props: any) => React.createElement('scrollview', props, props.children),
    KeyboardAvoidingView: (props: any) =>
      React.createElement('keyboardavoidingview', props, props.children),
    StyleSheet: {
      create: (styles: any) => styles,
      flatten: (styles: any) => styles,
    },
    Platform: { OS: 'ios' },
    Alert: { alert: jest.fn() },
  };
});

const mockSetProfile = jest.fn();
const mockCompleteSetup = jest.fn();

jest.mock('../../src/context/UserContext', () => ({
  useUser: () => ({
    setProfile: mockSetProfile,
    completeSetup: mockCompleteSetup,
  }),
}));

jest.mock('../../src/services/storage', () => ({
  createNewProfile: jest.fn(() => ({
    id: 'profile-1',
    pregnancyStartDate: '2024-01-01T00:00:00.000Z',
    estimatedDueDate: '2024-10-07T00:00:00.000Z',
    currentWeeksPregnant: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    isFirstLaunch: false,
  })),
}));

jest.mock('../../src/utils/dateUtils', () => ({
  calculatePregnancyStartDate: jest.fn(() => '2024-01-01T00:00:00.000Z'),
  calculateDueDate: jest.fn(() => '2024-10-07T00:00:00.000Z'),
  calculateStartDateFromDueDate: jest.fn(() => '2024-01-01T00:00:00.000Z'),
  parseFlexibleDate: jest.fn(() => new Date('2024-10-07T00:00:00.000Z')),
}));

/**
 * @brief Render the SetupScreen under the lightweight RN test mocks.
 * @returns Testing Library queries and helpers for the rendered screen.
 */
function renderSetupScreen() {
  return render(React.createElement(SetupScreen, null));
}

/**
 * @brief Move from step 1 to step 2 using the screen's primary CTA.
 */
function goToPregnancyDetailsStep(): void {
  fireEvent.press(screen.getByText('Next'));
}

/**
 * @brief Fill the pregnancy details inputs required for weeks-based setup.
 */
function fillPregnancyDetails(): void {
  fireEvent.changeText(screen.getByPlaceholderText('24'), '28');
  fireEvent.changeText(screen.getByPlaceholderText('0'), '3');
}

/**
 * @brief Move from step 2 to the final provider step.
 */
function goToProviderStep(): void {
  fireEvent.press(screen.getByText('Next'));
}

describe('SetupScreen multi-step flow (STORY-803)', () => {
  /**
   * @brief Reset mocks and configure host component mappings before each test.
   */
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

  /**
   * @brief The progress indicator should reflect the active step and support
   * backward navigation between the backlog-defined setup sections.
   */
  it('shows progress through the three setup steps', () => {
    renderSetupScreen();

    expect(screen.getByText('Step 1 of 3')).toBeTruthy();
    expect(screen.getByText('33%')).toBeTruthy();
    expect(screen.getAllByText('Basic Info').length).toBeGreaterThan(0);
    expect(screen.queryByText('Pregnancy Information')).toBeNull();

    goToPregnancyDetailsStep();

    expect(screen.getByText('Step 2 of 3')).toBeTruthy();
    expect(screen.getByText('67%')).toBeTruthy();
    expect(screen.getByText('Pregnancy Information')).toBeTruthy();
    expect(screen.getByText('Previous')).toBeTruthy();

    fireEvent.press(screen.getByText('Previous'));

    expect(screen.getByText('Step 1 of 3')).toBeTruthy();
    expect(screen.queryByText('Pregnancy Information')).toBeNull();
  });

  /**
   * @brief Submission should only occur from the Provider step after the user
   * progresses through the prior setup sections.
   */
  it('submits only on the final provider step', async () => {
    renderSetupScreen();
    goToPregnancyDetailsStep();
    fillPregnancyDetails();
    goToProviderStep();

    expect(screen.getByText('Step 3 of 3')).toBeTruthy();
    expect(screen.getByText('100%')).toBeTruthy();
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
});
