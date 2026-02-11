/**
 * Labor Cue App - Trend Indicator Component
 * 
 * Visual indicator showing the current HRV trend direction.
 * 
 * =============================================================================
 * TODOS FOR THIS FILE:
 * =============================================================================
 * 
 * TODO [STORY-1301]: Add animated trend arrow
 *   - Priority: Low
 *   - Points: 2
 *   - Description: Animate the arrow icon with a subtle bounce or
 *     continuous movement to draw attention.
 * 
 * TODO [STORY-1302]: Show percentage change
 *   - Priority: Medium
 *   - Points: 2
 *   - Description: Display the percentage change (e.g., "↑ 5.2%") along
 *     with the trend direction.
 * 
 * TODO [STORY-1303]: Add mini sparkline
 *   - Priority: Medium
 *   - Points: 3
 *   - Description: Include a tiny sparkline chart (last 5-7 readings)
 *     inside the indicator.
 * 
 * TODO [STORY-1304]: Create horizontal variant layout
 *   - Priority: Low
 *   - Points: 1
 *   - Description: Add a 'horizontal' layout option where icon and text
 *     are side by side for use in different contexts.
 * 
 * =============================================================================
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { HRVTrend } from '../types';
import { COLORS, SPACING, FONT_SIZES } from '../constants';

interface TrendIndicatorProps {
  trend: HRVTrend;
  size?: 'small' | 'medium' | 'large';
}

export default function TrendIndicator({
  trend,
  size = 'medium',
}: TrendIndicatorProps): JSX.Element {
  // Get trend info
  const getTrendInfo = () => {
    switch (trend) {
      case 'increasing':
        return {
          icon: '↑',
          label: 'Increasing',
          color: COLORS.success,
          description: 'HRV is trending upward',
        };
      case 'decreasing':
        return {
          icon: '↓',
          label: 'Decreasing',
          color: COLORS.primary,
          description: 'HRV is trending downward (typical)',
        };
      case 'stable':
        return {
          icon: '→',
          label: 'Stable',
          color: COLORS.neutral,
          description: 'HRV is relatively stable',
        };
      case 'insufficient_data':
      default:
        return {
          icon: '?',
          label: 'Collecting',
          color: COLORS.neutral,
          description: 'More data needed',
        };
    }
  };
  
  const info = getTrendInfo();
  
  // Size-based styling
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
  
  return (
    <View style={styles.container}>
      <View
        style={[
          styles.iconContainer,
          {
            width: currentSize.container,
            height: currentSize.container,
            borderRadius: currentSize.container / 2,
            backgroundColor: info.color + '20',
            borderColor: info.color,
          },
        ]}
      >
        <Text
          style={[
            styles.icon,
            {
              fontSize: currentSize.icon,
              color: info.color,
            },
          ]}
        >
          {info.icon}
        </Text>
      </View>
      <View style={styles.textContainer}>
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
        {size !== 'small' && (
          <Text style={styles.description}>{info.description}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  icon: {
    fontWeight: 'bold',
  },
  textContainer: {
    marginLeft: SPACING.md,
  },
  label: {
    fontWeight: '600',
  },
  description: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
});
