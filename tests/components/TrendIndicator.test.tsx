/**
 * STORY-1302 - TrendIndicator percentage change tests
 *
 * These tests define the expected UI behavior for showing percentage
 * change in trend direction.
 */

import React from "react";
import renderer from "react-test-renderer";

// Mock react-native so Jest can run without RN transform configuration.
jest.mock("react-native", () => {
  return {
    View: "View",
    Text: "Text",
    StyleSheet: {
      create: (styles: unknown) => styles,
    },
    Animated: {
      Value: function Value() {
        return {
          interpolate: () => 0,
        };
      },
      loop: () => ({
        start: jest.fn(),
        stop: jest.fn(),
      }),
      sequence: () => ({}),
      timing: () => ({}),
      Text: "Text",
    },
    Easing: {
      inOut: () => ({}),
      ease: {},
    },
  };
});

import TrendIndicator from "../../src/components/TrendIndicator";

function renderAsString(props: React.ComponentProps<typeof TrendIndicator>): string {
  let tree: renderer.ReactTestRenderer;
  renderer.act(() => {
    tree = renderer.create(React.createElement(TrendIndicator, props));
  });
  return JSON.stringify(tree!.toJSON());
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

function renderTree(props: React.ComponentProps<typeof TrendIndicator>) {
  let tree: renderer.ReactTestRenderer;
  renderer.act(() => {
    tree = renderer.create(React.createElement(TrendIndicator, props));
  });
  return tree!;
}

describe("TrendIndicator (STORY-1302)", () => {
  /**
   * Function: displays percentage change for an increasing trend.
   * Expected behavior: a positive percentage value is rendered.
   */
  it("shows positive percentage change when data trends upward", () => {
    // Arrange
    const heartRateData = [100, 110];

    // Act
    const output = renderAsString({ heartRateData });

    // Assert
    expect(output).toMatch(/\+?10(\.0)?%/);
  });

  /**
   * Function: displays percentage change for a decreasing trend.
   * Expected behavior: a negative percentage value is rendered.
   */
  it("shows negative percentage change when data trends downward", () => {
    // Arrange
    const heartRateData = [100, 90];

    // Act
    const output = renderAsString({ heartRateData });

    // Assert
    expect(output).toMatch(/-10(\.0)?%/);
  });

  /**
   * Function: calculates trend direction using chronological order.
   * Expected behavior: timestamps are respected before percentage is derived.
   */
  it("uses timestamps to compute percentage change in chronological order", () => {
    // Arrange
    const heartRateData = [90, 100];
    const timestamps = [
      "2026-02-02T00:00:00.000Z",
      "2026-02-01T00:00:00.000Z",
    ];

    // Act
    const output = renderAsString({ heartRateData, timestamps });

    // Assert
    // Chronological order resolves to [100, 90], which is -10%.
    expect(output).toMatch(/-10(\.0)?%/);
  });

  /**
   * Function: hides percentage when trend cannot be computed.
   * Expected behavior: no percentage is rendered for a single point.
   */
  it("does not render percentage change with insufficient data", () => {
    // Arrange
    const heartRateData = [100];

    // Act
    const output = renderAsString({ heartRateData });

    // Assert
    expect(output).not.toMatch(/%/);
  });

  /**
   * Function: supports the horizontal layout variant.
   * Expected behavior: the same trend content renders when horizontal layout is enabled.
   */
  it("renders trend details in the horizontal layout variant", () => {
    // Arrange
    const heartRateData = [100, 110];

    // Act
    const tree = renderTree({
      heartRateData,
      layout: "horizontal",
    });
    const output = JSON.stringify(tree.toJSON());
    const root = tree.root.findByProps({ testID: "trend-indicator-root" });
    const textContainer = tree.root.findByProps({
      testID: "trend-indicator-text-container",
    });
    const labelRow = tree.root.findByProps({ testID: "trend-indicator-label-row" });

    // Assert
    expect(output).toContain("Increasing");
    expect(output).toMatch(/\+?10(\.0)?%/);
    expect(flattenStyle(root.props.style).flex).toBe(1);
    expect(flattenStyle(root.props.style).justifyContent).toBe("flex-start");
    expect(flattenStyle(textContainer.props.style).minWidth).toBe(0);
    expect(flattenStyle(labelRow.props.style).justifyContent).toBe("space-between");
  });

  /**
   * Function: keeps default layout styling when horizontal mode is not requested.
   * Expected behavior: horizontal-only container overrides are absent.
   */
  it("does not apply horizontal layout overrides in default mode", () => {
    // Arrange
    const tree = renderTree({ heartRateData: [100, 110] });
    const root = tree.root.findByProps({ testID: "trend-indicator-root" });
    const textContainer = tree.root.findByProps({
      testID: "trend-indicator-text-container",
    });

    // Assert
    expect(flattenStyle(root.props.style).flex).toBeUndefined();
    expect(flattenStyle(root.props.style).justifyContent).toBeUndefined();
    expect(flattenStyle(textContainer.props.style).minWidth).toBeUndefined();
  });
});
