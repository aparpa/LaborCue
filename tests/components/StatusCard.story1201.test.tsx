/**
 * STORY-1201 - Pulse animation for urgent status
 *
 * Backlog details:
 * - File: StatusCard.tsx
 * - Points: 2
 * - Priority: Medium
 *
 * These tests verify that StatusCard draws subtle attention to urgent
 * probable inversion states without animating routine statuses.
 */

import React from "react";
import renderer from "react-test-renderer";

// Mock react-native so Jest can run without RN transform configuration.
jest.mock("react-native", () => {
  const animatedValues: Array<{
    interpolate: jest.Mock;
    setValue: jest.Mock;
  }> = [];
  const start = jest.fn();
  const stop = jest.fn();

  return {
    View: "View",
    Text: "Text",
    StyleSheet: {
      create: (styles: unknown) => styles,
    },
    Animated: {
      Value: function Value() {
        const value = {
          interpolate: jest.fn(() => "interpolated"),
          setValue: jest.fn(),
        };
        animatedValues.push(value);
        return value;
      },
      loop: jest.fn(() => ({
        start,
        stop,
      })),
      sequence: jest.fn(() => ({})),
      timing: jest.fn(() => ({})),
      View: "View",
      __mockAnimatedValues: animatedValues,
      __mockStart: start,
      __mockStop: stop,
    },
    Easing: {
      inOut: () => ({}),
      ease: {},
    },
  };
});

import { InversionStatus } from "../../src/types";
import StatusCard from "../../src/components/StatusCard";

const mockedReactNative = jest.requireMock("react-native") as {
  Animated: {
    loop: jest.Mock;
    sequence: jest.Mock;
    timing: jest.Mock;
    __mockAnimatedValues: Array<{
      interpolate: jest.Mock;
      setValue: jest.Mock;
    }>;
    __mockStart: jest.Mock;
    __mockStop: jest.Mock;
  };
};

function renderTree(
  props: Partial<React.ComponentProps<typeof StatusCard>> = {},
): renderer.ReactTestRenderer {
  let tree: renderer.ReactTestRenderer | undefined;

  renderer.act(() => {
    tree = renderer.create(
      <StatusCard
        inversionStatus={InversionStatus.ON_TRACK}
        message="Your HRV patterns are following the expected trajectory."
        confidence="medium"
        {...props}
      />,
    );
  });

  return tree as renderer.ReactTestRenderer;
}

function flattenStyle(styleProp: unknown): Record<string, unknown> {
  if (Array.isArray(styleProp)) {
    return styleProp.reduce<Record<string, unknown>>((acc, value) => {
      if (value && typeof value === "object") {
        return { ...acc, ...(value as Record<string, unknown>) };
      }
      return acc;
    }, {});
  }

  return (styleProp as Record<string, unknown>) || {};
}

describe("StatusCard (STORY-1201)", () => {
  beforeEach(() => {
    mockedReactNative.Animated.__mockStart.mockClear();
    mockedReactNative.Animated.__mockStop.mockClear();
    mockedReactNative.Animated.loop.mockClear();
    mockedReactNative.Animated.sequence.mockClear();
    mockedReactNative.Animated.timing.mockClear();
    mockedReactNative.Animated.__mockAnimatedValues.length = 0;
  });

  /**
   * Function: render probable inversion urgent status.
   * Purpose: ensure the urgent status is visually emphasized.
   * Expected behavior: the root card receives pulse styles and starts looping.
   */
  it("starts a subtle pulse animation for probable inversion", () => {
    // Arrange / Act
    const tree = renderTree({
      inversionStatus: InversionStatus.PROBABLE_INVERSION,
      message: "Your HRV patterns suggest potential early delivery indicators.",
      confidence: "high",
    });
    const root = tree.root.findByProps({ testID: "status-card-root" });
    const style = flattenStyle(root.props.style);

    // Assert
    expect(style.opacity).toBe("interpolated");
    expect(style.transform).toEqual([{ scale: "interpolated" }]);
    expect(mockedReactNative.Animated.timing).toHaveBeenCalledTimes(2);
    expect(mockedReactNative.Animated.loop).toHaveBeenCalledTimes(1);
    expect(mockedReactNative.Animated.__mockStart).toHaveBeenCalledTimes(1);
  });

  /**
   * Function: configure the urgent status pulse animation.
   * Purpose: keep the attention effect subtle and performant.
   * Expected behavior: two native-driver timing steps animate gently in and out.
   */
  it("uses subtle native-driver timing for the urgent pulse", () => {
    // Arrange / Act
    renderTree({
      inversionStatus: InversionStatus.PROBABLE_INVERSION,
      message: "Your HRV patterns suggest potential early delivery indicators.",
      confidence: "high",
    });
    const timingCalls = mockedReactNative.Animated.timing.mock.calls;

    // Assert
    expect(timingCalls).toHaveLength(2);
    expect(timingCalls[0][1]).toMatchObject({
      toValue: 1,
      duration: 900,
      useNativeDriver: true,
    });
    expect(timingCalls[1][1]).toMatchObject({
      toValue: 0,
      duration: 900,
      useNativeDriver: true,
    });
  });

  /**
   * Function: render non-urgent status.
   * Purpose: ensure normal statuses stay visually calm.
   * Expected behavior: no pulse style or looping animation is applied.
   */
  it("does not pulse when the status is not urgent", () => {
    // Arrange / Act
    const tree = renderTree({
      inversionStatus: InversionStatus.ON_TRACK,
      confidence: "medium",
    });
    const root = tree.root.findByProps({ testID: "status-card-root" });
    const style = flattenStyle(root.props.style);

    // Assert
    expect(style.opacity).toBeUndefined();
    expect(style.transform).toBeUndefined();
    expect(mockedReactNative.Animated.__mockStart).not.toHaveBeenCalled();
    expect(mockedReactNative.Animated.loop).not.toHaveBeenCalled();
    expect(
      mockedReactNative.Animated.__mockAnimatedValues[0].setValue,
    ).toHaveBeenCalledWith(0);
  });
});
