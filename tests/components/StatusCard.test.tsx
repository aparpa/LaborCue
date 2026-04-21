import React from 'react';
import renderer, { act } from 'react-test-renderer';

const mockTiming = jest.fn(() => ({
  start: jest.fn(),
}));
const mockStopAnimation = jest.fn();
const mockSetValue = jest.fn();

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  StyleSheet: {
    create: (styles: unknown) => styles,
  },
  Animated: {
    Value: function Value() {
      return {
        interpolate: ({ outputRange }: { outputRange: unknown[] }) => outputRange[1],
        stopAnimation: mockStopAnimation,
        setValue: mockSetValue,
      };
    },
    timing: (...args: unknown[]) => mockTiming(...args),
    View: 'AnimatedView',
    Text: 'AnimatedText',
  },
  Easing: {
    inOut: (value: unknown) => value,
    ease: 'ease',
  },
}));

import StatusCard from '../../src/components/StatusCard';
import { InversionStatus } from '../../src/types';

/**
 * STORY-902 - Animated status transition tests
 *
 * Verifies that changing status causes the StatusCard animation flow to run.
 */
describe('StatusCard (STORY-902)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('animates when the inversion status changes', () => {
    const tree = renderer.create(
      React.createElement(StatusCard, {
        inversionStatus: InversionStatus.ON_TRACK,
        message: 'All good',
        confidence: 'medium',
      })
    );

    expect(mockTiming).not.toHaveBeenCalled();

    act(() => {
      tree.update(
        React.createElement(StatusCard, {
          inversionStatus: InversionStatus.PROBABLE_INVERSION,
          message: 'Please contact your doctor',
          confidence: 'high',
          recommendation: 'Reach out to your provider',
        })
      );
    });

    expect(mockStopAnimation).toHaveBeenCalled();
    expect(mockSetValue).toHaveBeenCalledWith(0);
    expect(mockTiming).toHaveBeenCalledWith(
      expect.objectContaining({
        interpolate: expect.any(Function),
        setValue: expect.any(Function),
        stopAnimation: expect.any(Function),
      }),
      expect.objectContaining({
        toValue: 1,
        duration: 450,
        useNativeDriver: false,
      })
    );
  });
});
