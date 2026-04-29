/**
 * Tests for SettingsScreen.tsx
 *
 * STORY-1108: Account deletion flow
 * Backlog summary:
 * - Priority: High
 * - Points: 2
 * - Requirement: provide a clear option to delete all user data
 *   with a confirmation flow suitable for app store requirements.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react';
import renderer from 'react-test-renderer';
import SettingsScreen from '../../src/screens/SettingsScreen';

// ============================================================================
// MOCKS
// ============================================================================

const mockAlert = jest.fn();
const mockRefreshData = jest.fn();
const mockClearAllData = jest.fn();

jest.mock('react-native', () => {
  const ReactModule = require('react');

  return {
    View: (props: any) => ReactModule.createElement('view', props, props.children),
    Text: (props: any) => ReactModule.createElement('text', props, props.children),
    ScrollView: (props: any) =>
      ReactModule.createElement('scrollview', props, props.children),
    TouchableOpacity: (props: any) =>
      ReactModule.createElement('touchableopacity', props, props.children),
    TextInput: (props: any) =>
      ReactModule.createElement('textinput', props, props.children),
    Switch: (props: any) => ReactModule.createElement('switch', props, props.children),
    StyleSheet: {
      create: (styles: any) => styles,
      flatten: (styles: any) => styles,
    },
    Alert: { alert: (...args: unknown[]) => mockAlert(...args) },
  };
});

jest.mock('../../src/context/UserContext', () => ({
  useUser: () => ({
    profile: {
      id: 'user-1',
      name: 'Sam',
      pregnancyStartDate: '2024-01-01T00:00:00.000Z',
      estimatedDueDate: '2024-10-01T00:00:00.000Z',
      currentWeeksPregnant: 20,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      isFirstLaunch: false,
    },
    setProfile: jest.fn(),
    currentGestationalWeek: 30,
    currentGestationalDay: 2,
    refreshData: mockRefreshData,
    hrvReadings: [],
  }),
}));

jest.mock('../../src/services/storage', () => ({
  clearAllData: (...args: unknown[]) => mockClearAllData(...args),
  saveHRVReading: jest.fn(),
}));

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Render the settings screen using the mocked React Native primitives.
 */
function renderSettingsScreen(): renderer.ReactTestRenderer {
  let tree: renderer.ReactTestRenderer;

  renderer.act(() => {
    tree = renderer.create(<SettingsScreen />);
  });

  return tree!;
}

/**
 * Collect text content from a rendered text node.
 */
function getTextContent(node: renderer.ReactTestInstance): string {
  const { children } = node.props;
  if (!children) {
    return '';
  }

  const rawChildren = Array.isArray(children) ? children : [children];
  return rawChildren
    .map((child) => {
      if (typeof child === 'string') {
        return child;
      }

      if (child?.props?.children) {
        const nestedChildren = Array.isArray(child.props.children)
          ? child.props.children
          : [child.props.children];
        return nestedChildren.join('');
      }

      return '';
    })
    .join('');
}

/**
 * Recursively flatten a node's children into a plain text string.
 * This helps locate the correct touchable by its visible label.
 */
function getNodeText(children: unknown): string {
  if (typeof children === 'string') {
    return children;
  }

  if (Array.isArray(children)) {
    return children.map((child) => getNodeText(child)).join('');
  }

  if (
    typeof children === 'object' &&
    children !== null &&
    'props' in children &&
    typeof (children as { props?: { children?: unknown } }).props === 'object'
  ) {
    return getNodeText((children as { props: { children?: unknown } }).props.children);
  }

  return '';
}

/**
 * Find the touchable that triggers the destructive delete-account flow.
 */
function getDeleteActionButton(
  tree: renderer.ReactTestRenderer
): renderer.ReactTestInstance | undefined {
  const actionButtons = tree.root.findAllByType('touchableopacity');

  return actionButtons.find((node) =>
    getNodeText(node.props.children).includes('Delete Account and Data')
  );
}

// ============================================================================
// STORY-1108 TESTS
// ============================================================================

describe('SettingsScreen STORY-1108', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClearAllData.mockResolvedValue(undefined);
    mockRefreshData.mockResolvedValue(undefined);
  });

  it('renders a clear delete-account section describing permanent data removal', () => {
    // Arrange
    const tree = renderSettingsScreen();

    // Act
    const textNodes = tree.root.findAllByType('text');
    const textContent = textNodes.map(getTextContent).join(' ');

    // Assert
    expect(textContent).toContain('Delete Account and Data');
    expect(textContent).toContain(
      'Remove your profile, HRV history, and saved settings from this device.'
    );
    expect(textContent).toContain('This action is permanent.');
  });

  it('requires two confirmations before deleting data and then refreshes local state', async () => {
    // Arrange
    const tree = renderSettingsScreen();
    const deleteButton = getDeleteActionButton(tree);

    expect(deleteButton).toBeDefined();

    // Act: first destructive prompt
    await renderer.act(async () => {
      deleteButton?.props.onPress();
    });

    // Assert: first confirmation explains the deletion scope
    expect(mockAlert).toHaveBeenCalledWith(
      'Delete Account and Data',
      'This permanently removes your profile, HRV readings, and saved settings from this device.',
      expect.any(Array)
    );

    const firstPromptButtons = mockAlert.mock.calls[0][2] as Array<{
      text: string;
      onPress?: () => void;
    }>;
    const continueButton = firstPromptButtons.find((button) => button.text === 'Continue');

    expect(continueButton?.onPress).toBeDefined();

    // Act: second destructive prompt
    await renderer.act(async () => {
      continueButton?.onPress?.();
    });

    // Assert: second confirmation makes the permanence explicit
    expect(mockAlert).toHaveBeenNthCalledWith(
      2,
      'Confirm Permanent Deletion',
      'This action cannot be undone. Delete all account data now?',
      expect.any(Array)
    );

    const secondPromptButtons = mockAlert.mock.calls[1][2] as Array<{
      text: string;
      onPress?: () => void;
    }>;
    const confirmDeleteButton = secondPromptButtons.find(
      (button) => button.text === 'Delete Everything'
    );

    expect(confirmDeleteButton?.onPress).toBeDefined();

    // Act: complete deletion
    await renderer.act(async () => {
      confirmDeleteButton?.onPress?.();
      await Promise.resolve();
    });

    // Assert: storage is cleared, context refreshes, and success feedback appears
    expect(mockClearAllData).toHaveBeenCalledTimes(1);
    expect(mockRefreshData).toHaveBeenCalledTimes(1);
    expect(mockAlert).toHaveBeenNthCalledWith(
      3,
      'Account Deleted',
      'All profile data, readings, and saved settings were removed from this device.'
    );
  });
});
