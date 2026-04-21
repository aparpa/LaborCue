/**
 * Labor Cue App - Status Card Component
 * 
 * Displays the current HRV status with color-coded visual feedback.
 * This is the main status indicator on the home screen.
 * 
 * =============================================================================
 * TODOS FOR THIS FILE:
 * =============================================================================
 * 
 * TODO [STORY-1202]: Implement expandable/collapsible card
 *   - Priority: Low
 *   - Points: 2
 *   - Description: Allow tapping to expand card for more details or
 *     collapse for a compact view.
 * 
 * TODO [STORY-1203]: Add accessibility labels
 *   - Priority: High
 *   - Points: 2
 *   - Description: Add proper accessibilityLabel and accessibilityRole
 *     props for screen reader support.
 * 
 * TODO [STORY-1204]: Create status history view
 *   - Priority: Low
 *   - Points: 3
 *   - Description: Add option to see how status has changed over time
 *     (timeline of status changes).
 * 
 * =============================================================================
 */

import React from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { InversionStatus, ConfidenceLevel, STATUS_COLORS } from '../types';
import { SPACING, FONT_SIZES, BORDER_RADIUS, COLORS } from '../constants';

interface StatusCardProps {
  inversionStatus: InversionStatus;
  message: string;
  recommendation?: string;
  confidence: ConfidenceLevel;
}

export default function StatusCard({
  inversionStatus,
  message,
  recommendation,
  confidence,
}: StatusCardProps): JSX.Element {
  const colors = STATUS_COLORS[inversionStatus];
  const pulseAnimation = React.useRef(new Animated.Value(0)).current;
  const isUrgentStatus = inversionStatus === InversionStatus.PROBABLE_INVERSION;

  React.useEffect(() => {
    if (!isUrgentStatus) {
      pulseAnimation.setValue(0);
      return undefined;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [isUrgentStatus, pulseAnimation]);

  const pulseScale = pulseAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.015],
  });

  const pulseOpacity = pulseAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.96],
  });
  
  // Get status title
  const getStatusTitle = (): string => {
    switch (inversionStatus) {
      case InversionStatus.ON_TRACK:
        return 'On Track';
      case InversionStatus.POSSIBLE_INVERSION:
        return 'Possible Early Inversion';
      case InversionStatus.PROBABLE_INVERSION:
        return 'Consult Your Physician';
      case InversionStatus.INSUFFICIENT_DATA:
      default:
        return 'Collecting Data';
    }
  };
  
  // Get status icon
  const getStatusIcon = (): string => {
    switch (inversionStatus) {
      case InversionStatus.ON_TRACK:
        return '✓';
      case InversionStatus.POSSIBLE_INVERSION:
        return '⚠';
      case InversionStatus.PROBABLE_INVERSION:
        return '!';
      case InversionStatus.INSUFFICIENT_DATA:
      default:
        return '○';
    }
  };
  
  // Get confidence label
  const getConfidenceLabel = (): string => {
    switch (confidence) {
      case 'high':
        return 'High confidence';
      case 'medium':
        return 'Medium confidence';
      case 'low':
        return 'Low confidence';
      default:
        return 'More data needed';
    }
  };
  
  return (
    <Animated.View
      testID="status-card-root"
      style={[
        styles.container,
        { backgroundColor: colors.background },
        isUrgentStatus && {
          opacity: pulseOpacity,
          transform: [{ scale: pulseScale }],
        },
      ]}
    >
      {/* Status Header */}
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: colors.primary }]}>
          <Text style={styles.icon}>{getStatusIcon()}</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text }]}>
            {getStatusTitle()}
          </Text>
          <Text style={styles.confidence}>{getConfidenceLabel()}</Text>
        </View>
      </View>
      
      {/* Status Bar */}
      <View style={styles.statusBarContainer}>
        <View style={styles.statusBarBackground}>
          <View
            style={[
              styles.statusBarFill,
              { backgroundColor: colors.primary },
              inversionStatus === InversionStatus.ON_TRACK && styles.statusBarGreen,
              inversionStatus === InversionStatus.POSSIBLE_INVERSION && styles.statusBarYellow,
              inversionStatus === InversionStatus.PROBABLE_INVERSION && styles.statusBarRed,
            ]}
          />
        </View>
        <View style={styles.statusLabels}>
          <Text style={styles.statusLabel}>Low Risk</Text>
          <Text style={styles.statusLabel}>Consult MD</Text>
        </View>
      </View>
      
      {/* Message */}
      <Text style={[styles.message, { color: colors.text }]}>{message}</Text>
      
      {/* Recommendation */}
      {recommendation && (
        <View style={[styles.recommendationContainer, { borderColor: colors.primary }]}>
          <Text style={styles.recommendationLabel}>Recommendation:</Text>
          <Text style={styles.recommendationText}>{recommendation}</Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  icon: {
    color: COLORS.textLight,
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
  },
  confidence: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  statusBarContainer: {
    marginBottom: SPACING.lg,
  },
  statusBarBackground: {
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  statusBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  statusBarGreen: {
    width: '25%',
    backgroundColor: COLORS.success,
  },
  statusBarYellow: {
    width: '60%',
    backgroundColor: COLORS.warning,
  },
  statusBarRed: {
    width: '90%',
    backgroundColor: COLORS.danger,
  },
  statusLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
  },
  statusLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  message: {
    fontSize: FONT_SIZES.md,
    lineHeight: 22,
    marginBottom: SPACING.md,
  },
  recommendationContainer: {
    borderLeftWidth: 3,
    paddingLeft: SPACING.md,
    marginTop: SPACING.sm,
  },
  recommendationLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  recommendationText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
});
