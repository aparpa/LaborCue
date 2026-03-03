/**
 * Labor Cue App - Home Screen
 * 
 * Main dashboard showing:
 * - Welcome message with user name
 * - Current HRV status with color-coded indicators
 * - Trend information
 * - Quick access to detailed data view
 * 
 * =============================================================================
 * TODOS FOR THIS FILE:
 * =============================================================================
 * 
 * TODO [STORY-901]: Add pull-to-refresh with haptic feedback
 *   - Priority: Low
 *   - Points: 1
 *   - Description: Add haptic feedback when pull-to-refresh triggers
 *     using expo-haptics.
 * 
 * TODO [STORY-902]: Create animated status transitions
 *   - Priority: Medium
 *   - Points: 3
 *   - Description: Animate the status card color changes and status bar
 *     transitions when analysis results change.
 * 
 * TODO [STORY-903]: Add mini HRV sparkline chart
 *   - Priority: Medium
 *   - Points: 3
 *   - Description: Show a small inline chart (last 7 readings) on the
 *     home screen without requiring navigation to Data screen.
 * 
 * TODO [STORY-904]: Implement "time since last reading" indicator
 *   - Priority: High
 *   - Points: 2
 *   - Description: Show how long since last HRV reading. Highlight if
 *     overdue (e.g., >3 days since last reading).
 * 
 * TODO [STORY-905]: Add educational tooltips for first-time users
 *   - Priority: Medium
 *   - Points: 3
 *   - Description: Show explanatory tooltips pointing to different UI
 *     elements on first visit (coach marks).
 * 
 * TODO [STORY-906]: Create quick action buttons
 *   - Priority: Low
 *   - Points: 2
 *   - Description: Add quick actions: "Sync Device", "Add Manual Reading",
 *     "Contact Provider" buttons below the main status.
 * 
 * TODO [STORY-907]: Display pregnancy milestone celebrations
 *   - Priority: Low
 *   - Points: 2
 *   - Description: Show celebratory UI when reaching milestones like
 *     viability (24w), third trimester (28w), full term (37w).
 * 
 * =============================================================================
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';

import { useUser } from '../context/UserContext';
import StatusCard from '../components/StatusCard';
import TrendIndicator from '../components/TrendIndicator';
import { formatGestationalAge, formatDate, getTimeUntil } from '../utils/dateUtils';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants';
import { InversionStatus } from '../types';
import type { DrawerParamList } from '../types';

type HomeScreenNavigationProp = DrawerNavigationProp<DrawerParamList, 'Home'>;

export default function HomeScreen(): JSX.Element {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const {
    profile,
    hrvReadings,
    analysisResult,
    currentGestationalWeek,
    currentGestationalDay,
    latestReading,
    refreshData,
  } = useUser();
  
  const [refreshing, setRefreshing] = React.useState(false);
  
  const onRefresh = React.useCallback(async () => {
    // STORY-901 start: trigger haptic feedback when refresh begins.
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);
  
  const userName = profile?.name || 'there';
  const gestationalAge = formatGestationalAge(currentGestationalWeek, currentGestationalDay);
  
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Welcome Header */}
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Welcome, {userName}!</Text>
        <Text style={styles.gestationalText}>
          You are {gestationalAge} pregnant
        </Text>
        {/* STORY-907 start: insert milestone celebration UI near gestational age. */}
        {profile?.estimatedDueDate && (
          <Text style={styles.dueDateText}>
            Due date: {formatDate(profile.estimatedDueDate)} ({getTimeUntil(profile.estimatedDueDate)})
          </Text>
        )}
        {/* STORY-905 start: show first-time user tooltips/coach marks here. */}
      </View>
      
      {/* Main Status Card */}
      {/* STORY-902 start: animate status card transitions when analysisResult changes. */}
      <StatusCard
        inversionStatus={analysisResult?.inversionStatus ?? InversionStatus.INSUFFICIENT_DATA}
        message={analysisResult?.message ?? 'Collecting data...'}
        recommendation={analysisResult?.recommendation}
        confidence={analysisResult?.confidence ?? 'none'}
      />
      
      {/* HRV Trend Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>HRV Trend</Text>
        <View style={styles.trendContainer}>
          <TrendIndicator
            trend={analysisResult?.currentTrend ?? 'insufficient_data'}
          />
          {/* STORY-903 start: add a mini sparkline chart alongside trend info. */}
          {latestReading && (
            <View style={styles.latestReading}>
              <Text style={styles.latestValue}>{latestReading.hrvValue.toFixed(1)} ms</Text>
              <Text style={styles.latestLabel}>Latest reading</Text>
              <Text style={styles.latestDate}>
                {formatDate(latestReading.timestamp, 'MMM d')}
              </Text>
              {/* STORY-904 start: display "time since last reading" here. */}
              <Text style={styles.latestDate}>
                {getTimeUntil(latestReading.timestamp)}
              </Text>
            </View>
          )}
        </View>
      </View>
      
      {/* Quick Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Summary</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{hrvReadings.length}</Text>
            <Text style={styles.statLabel}>Total Readings</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {hrvReadings.length > 0 
                ? (hrvReadings.reduce((sum, r) => sum + r.hrvValue, 0) / hrvReadings.length).toFixed(1)
                : '--'}
            </Text>
            <Text style={styles.statLabel}>Avg HRV (ms)</Text>
          </View>
        </View>
      </View>
      
      {/* Prediction Section (if available) */}
      {analysisResult?.predictedDeliveryWindow && (
        <View style={[styles.section, styles.predictionSection]}>
          <Text style={styles.sectionTitle}>Predicted Delivery Window</Text>
          <View style={styles.predictionCard}>
            <Text style={styles.predictionDate}>
              {formatDate(analysisResult.predictedDeliveryWindow.mostLikely, 'MMMM d, yyyy')}
            </Text>
            <Text style={styles.predictionRange}>
              Range: {formatDate(analysisResult.predictedDeliveryWindow.earliest, 'MMM d')} - {' '}
              {formatDate(analysisResult.predictedDeliveryWindow.latest, 'MMM d')}
            </Text>
            <Text style={styles.predictionNote}>
              Based on HRV inflection pattern
            </Text>
          </View>
        </View>
      )}
      
      {/* View Data Button */}
      {/* STORY-906 start: add quick action buttons above or below this CTA. */}
      <TouchableOpacity
        style={styles.viewDataButton}
        onPress={() => navigation.navigate('Data')}
      >
        <Text style={styles.viewDataButtonText}>View Compiled Data</Text>
      </TouchableOpacity>
      
      {/* Info Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Data is collected overnight and updated every 2 nights from your wearable device.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.lg,
  },
  header: {
    marginBottom: SPACING.xl,
  },
  welcomeText: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  gestationalText: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.primary,
    fontWeight: '500',
  },
  dueDateText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
  },
  latestReading: {
    alignItems: 'flex-end',
  },
  latestValue: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  latestLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  latestDate: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  statValue: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  statLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  predictionSection: {
    backgroundColor: COLORS.primaryLight + '20',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginHorizontal: -SPACING.lg,
    paddingHorizontal: SPACING.xl,
  },
  predictionCard: {
    alignItems: 'center',
  },
  predictionDate: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  predictionRange: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  predictionNote: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginTop: SPACING.sm,
  },
  viewDataButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  viewDataButtonText: {
    color: COLORS.textLight,
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
  },
  footer: {
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  footerText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
