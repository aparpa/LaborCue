/**
 * Labor Cue App - Trend Indicator Component
 *
 * Visual indicator showing the current HRV trend direction.
 */

import React from "react";
import { View, Text, StyleSheet, Animated, Easing } from "react-native";
import type { HRVTrend } from "../types";
import { COLORS, SPACING, FONT_SIZES } from "../constants";

interface TrendIndicatorProps {
  trend?: HRVTrend;
  // R-R intervals in milliseconds, ordered by timestamp when possible.
  heartRateData?: number[];
  timestamps?: string[];
  size?: "small" | "medium" | "large";
  layout?: "default" | "horizontal";
}

interface ResolvedTrend {
  trend: HRVTrend;
  trendPercentage: number | null;
}

function alignSeriesWithTimestamps(
  heartRateData: number[] | undefined,
  timestamps: string[] | undefined,
): number[] {
  if (!heartRateData || heartRateData.length === 0) {
    return [];
  }

  if (!timestamps || timestamps.length !== heartRateData.length) {
    return heartRateData;
  }

  return heartRateData
    .map((value, index) => ({
      value,
      time: new Date(timestamps[index]).getTime(),
    }))
    .sort((a, b) => a.time - b.time)
    .map((item) => item.value);
}

function resolveTrend(
  heartRateData: number[] | undefined,
  timestamps: string[] | undefined,
  fallbackTrend: HRVTrend,
): ResolvedTrend {
  const alignedSeries = alignSeriesWithTimestamps(heartRateData, timestamps);

  if (alignedSeries.length < 2) {
    return {
      trend: fallbackTrend,
      trendPercentage: null,
    };
  }

  const first = alignedSeries[0];
  const last = alignedSeries[alignedSeries.length - 1];
  const directionDelta = last - first;
  const trendPercentage =
    first === 0 ? null : (directionDelta / Math.abs(first)) * 100;

  if (Math.abs(directionDelta) < 1) {
    return {
      trend: "stable",
      trendPercentage,
    };
  }

  return {
    trend: directionDelta > 0 ? "increasing" : "decreasing",
    trendPercentage,
  };
}

export default function TrendIndicator({
  trend = "insufficient_data",
  heartRateData,
  timestamps,
  size = "medium",
  layout = "default",
}: TrendIndicatorProps): JSX.Element {
  const trendAnimation = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(trendAnimation, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(trendAnimation, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [trendAnimation]);

  const resolved = React.useMemo(
    () => resolveTrend(heartRateData, timestamps, trend),
    [heartRateData, timestamps, trend],
  );

  const getTrendInfo = () => {
    switch (resolved.trend) {
      case "increasing":
        return {
          icon: "\u2191",
          label: "Increasing",
          color: COLORS.success,
          description: "HRV is trending upward",
        };
      case "decreasing":
        return {
          icon: "\u2193",
          label: "Decreasing",
          color: COLORS.primary,
          description: "HRV is trending downward (typical)",
        };
      case "stable":
        return {
          icon: "\u2192",
          label: "Stable",
          color: COLORS.neutral,
          description: "HRV is relatively stable",
        };
      case "insufficient_data":
      default:
        return {
          icon: "?",
          label: "Collecting",
          color: COLORS.neutral,
          description: "More data needed",
        };
    }
  };

  const info = getTrendInfo();
  const trendPercentageText =
    resolved.trendPercentage === null
      ? null
      : `${resolved.trendPercentage > 0 ? "+" : ""}${resolved.trendPercentage.toFixed(1)}%`;

  const trendTranslate = trendAnimation.interpolate({
    inputRange: [0, 1],
    outputRange:
      resolved.trend === "increasing"
        ? [0, -3]
        : resolved.trend === "decreasing"
          ? [0, 3]
          : [0, 0],
  });

  const trendScale = trendAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: resolved.trend === "stable" ? [1, 1.08] : [1, 1.02],
  });

  const sizeStyles = {
    small: {
      icon: FONT_SIZES.lg,
      label: FONT_SIZES.xs,
      container: 36,
    },
    medium: {
      icon: FONT_SIZES.xxl,
      label: FONT_SIZES.sm,
      container: 56,
    },
    large: {
      icon: 40,
      label: FONT_SIZES.md,
      container: 72,
    },
  };

  const currentSize = sizeStyles[size];
  const sparklineData = alignSeriesWithTimestamps(
    heartRateData,
    timestamps,
  ).slice(-7);
  const sparklineMin =
    sparklineData.length > 0 ? Math.min(...sparklineData) : 0;
  const sparklineMax =
    sparklineData.length > 0 ? Math.max(...sparklineData) : 0;
  const sparklineRange = Math.max(1, sparklineMax - sparklineMin);

  return (
    <View
      style={[
        styles.container,
        layout === "horizontal" && styles.horizontalContainer,
      ]}
    >
      <View
        style={[
          styles.iconContainer,
          {
            width: currentSize.container,
            height: currentSize.container,
            borderRadius: currentSize.container / 2,
            backgroundColor: info.color + "20",
            borderColor: info.color,
          },
        ]}
      >
        <Animated.Text
          style={[
            styles.icon,
            {
              fontSize: currentSize.icon,
              color: info.color,
              transform: [
                { translateY: trendTranslate },
                { scale: trendScale },
              ],
            },
          ]}
        >
          {info.icon}
        </Animated.Text>
      </View>

      <View style={styles.textContainer}>
        <View
          style={[
            styles.labelRow,
            layout === "horizontal" && styles.labelRowHorizontal,
          ]}
        >
          <Text
            style={[
              styles.label,
              {
                fontSize: currentSize.label,
                color: info.color,
              },
            ]}
          >
            {info.label}
          </Text>
          {trendPercentageText && (
            <Text style={[styles.percentage, { color: info.color }]}>
              {trendPercentageText}
            </Text>
          )}
        </View>

        {size !== "small" && (
          <Text style={styles.description}>{info.description}</Text>
        )}

        {sparklineData.length >= 2 && size !== "small" && (
          <View style={styles.sparklineContainer}>
            {sparklineData.map((value, index) => (
              <View
                key={`${value}-${index}`}
                style={[
                  styles.sparkBar,
                  {
                    height: 6 + ((value - sparklineMin) / sparklineRange) * 16,
                    backgroundColor: info.color,
                    opacity: 0.45 + (index / sparklineData.length) * 0.55,
                  },
                ]}
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },
  horizontalContainer: {
    justifyContent: "space-between",
  },
  iconContainer: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
  },
  icon: {
    fontWeight: "bold",
  },
  textContainer: {
    marginLeft: SPACING.md,
    flexShrink: 1,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: SPACING.sm,
  },
  labelRowHorizontal: {
    flexWrap: "wrap",
    rowGap: SPACING.xs,
  },
  label: {
    fontWeight: "600",
  },
  percentage: {
    fontSize: FONT_SIZES.xs,
    fontWeight: "600",
  },
  description: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  sparklineContainer: {
    marginTop: SPACING.sm,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
    height: 24,
  },
  sparkBar: {
    width: 6,
    borderRadius: 3,
  },
});
