/**
 * Labor Cue App - Data Screen
 * 
 * Displays detailed HRV data visualization:
 * - Interactive line chart (HRV vs Date)
 * - Clickable data points with tooltips
 * - Trend line (after sufficient data)
 * - Export functionality
 * 
 * =============================================================================
 * TODOS FOR THIS FILE:
 * =============================================================================
 * 
 * TODO [STORY-1001]: Implement pinch-to-zoom on chart
 *   - Priority: High
 *   - Points: 5
 *   - Description: Allow users to pinch-zoom and pan the chart to examine
 *     specific time periods in detail. Consider using react-native-gesture-handler.
 * 
 * TODO [STORY-1002]: Add trend line overlay
 *   - Priority: High
 *   - Points: 3
 *   - Description: Draw a smoothed trend line over the raw data points
 *     to make the overall pattern clearer.
 * 
 * TODO [STORY-1003]: Highlight the inflection point on chart
 *   - Priority: High
 *   - Points: 3
 *   - Description: When an inflection is detected, mark it on the chart
 *     with a vertical line and annotation.
 * 
 * TODO [STORY-1004]: Add date range filter
 *   - Priority: Medium
 *   - Points: 3
 *   - Description: Allow filtering chart to show: Last 2 weeks, Last month,
 *     All time, or custom date range.
 * 
 * TODO [STORY-1005]: Implement comparison view (expected vs actual)
 *   - Priority: Medium
 *   - Points: 5
 *   - Description: Show the expected HRV curve for term pregnancy as a
 *     reference line, with user's actual data overlaid.
 * 
 * TODO [STORY-1006]: Add data annotations
 *   - Priority: Low
 *   - Points: 3
 *   - Description: Allow users to add notes to specific data points
 *     (e.g., "didn't sleep well", "feeling stressed").
 * 
 * TODO [STORY-1007]: Create shareable chart image
 *   - Priority: Medium
 *   - Points: 3
 *   - Description: Add "Share Chart" button that captures the chart as
 *     an image for sharing with healthcare providers.
 * 
 * TODO [STORY-1008]: Improve tooltip positioning
 *   - Priority: Medium
 *   - Points: 2
 *   - Description: Make tooltip appear near the tapped point rather than
 *     always at the bottom. Handle edge cases near screen edges.
 * 
 * TODO [STORY-1009]: Add statistical summary panel
 *   - Priority: Medium
 *   - Points: 3
 *   - Description: Show statistics: mean, median, std deviation, trend
 *     slope, R² value for the current view.
 * 
 * =============================================================================
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
  Share,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';

import { useUser } from '../context/UserContext';
import { formatDate } from '../utils/dateUtils';
import { exportDataAsCSV, exportDataAsJSON } from '../services/storage';
import { calculateWeeklyAverages } from '../services/hrvAnalysis';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, CHART_CONFIG } from '../constants';
import type { HRVReading } from '../types';

const screenWidth = Dimensions.get('window').width;

export default function DataScreen(): JSX.Element {
  const { hrvReadings, analysisResult, currentGestationalWeek } = useUser();
  const [selectedPoint, setSelectedPoint] = useState<HRVReading | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  // STORY-1004 start: add date range filter state here.
  // STORY-1006 start: add annotation draft state here.
  
  // Prepare chart data
  const chartData = prepareChartData(hrvReadings);
  const weeklyAverages = hrvReadings.length > 0 
    ? calculateWeeklyAverages(hrvReadings)
    : [];
  
  // Handle data point selection
  const handleDataPointClick = useCallback((data: { index: number }) => {
    if (hrvReadings[data.index]) {
      setSelectedPoint(hrvReadings[data.index]);
    }
  }, [hrvReadings]);
  
  // Handle export
  const handleExport = useCallback(async (format: 'csv' | 'json') => {
    setIsExporting(true);
    try {
      const data = format === 'csv' 
        ? await exportDataAsCSV()
        : await exportDataAsJSON();
      
      await Share.share({
        message: data,
        title: `Labor Cue HRV Data (${format.toUpperCase()})`,
      });
    } catch (error) {
      console.error('Export failed:', error);
      Alert.alert('Export Failed', 'Unable to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, []);
  
  // Show empty state if no data
  if (hrvReadings.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No Data Yet</Text>
        <Text style={styles.emptyText}>
          HRV readings will appear here once your wearable device syncs data.
          Data is collected overnight every 2 nights.
        </Text>
        <View style={styles.emptyTip}>
          <Text style={styles.emptyTipTitle}>Tip:</Text>
          <Text style={styles.emptyTipText}>
            For testing, you can manually add sample data in the Settings screen.
          </Text>
        </View>
      </View>
    );
  }
  
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Chart Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>HRV Over Time</Text>
        <Text style={styles.sectionSubtitle}>
          Tap a data point for details
        </Text>
        {/* STORY-1004 start: render date range filter controls here. */}
        
        <View style={styles.chartContainer}>
          {/* STORY-1001 start: enable pinch-to-zoom/pan on this chart container. */}
          <LineChart
            data={chartData}
            width={screenWidth - SPACING.lg * 2}
            height={220}
            chartConfig={{
              ...CHART_CONFIG,
              decimalPlaces: 0,
            }}
            bezier
            style={styles.chart}
            onDataPointClick={handleDataPointClick}
            withInnerLines={true}
            withOuterLines={true}
            withVerticalLabels={true}
            withHorizontalLabels={true}
            fromZero={false}
          />
          {/* STORY-1002 start: draw a smoothed trend line overlay here. */}
          {/* STORY-1003 start: mark the inflection point on the chart here. */}
          {/* STORY-1005 start: overlay expected vs actual comparison line here. */}
        </View>
        
        {/* Selected Point Details */}
        {selectedPoint && (
          <View style={styles.tooltipCard}>
            {/* STORY-1008 start: reposition tooltip near the selected point. */}
            <View style={styles.tooltipHeader}>
              <Text style={styles.tooltipTitle}>Reading Details</Text>
              <TouchableOpacity onPress={() => setSelectedPoint(null)}>
                <Text style={styles.tooltipClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.tooltipContent}>
              <View style={styles.tooltipRow}>
                <Text style={styles.tooltipLabel}>Date:</Text>
                <Text style={styles.tooltipValue}>
                  {formatDate(selectedPoint.timestamp, 'MMMM d, yyyy h:mm a')}
                </Text>
              </View>
              <View style={styles.tooltipRow}>
                <Text style={styles.tooltipLabel}>HRV:</Text>
                <Text style={styles.tooltipValue}>
                  {selectedPoint.hrvValue.toFixed(1)} ms
                </Text>
              </View>
              <View style={styles.tooltipRow}>
                <Text style={styles.tooltipLabel}>Gestational Week:</Text>
                <Text style={styles.tooltipValue}>
                  Week {selectedPoint.gestationalWeek}, Day {selectedPoint.gestationalDay}
                </Text>
              </View>
              <View style={styles.tooltipRow}>
                <Text style={styles.tooltipLabel}>Source:</Text>
                <Text style={styles.tooltipValue}>
                  {selectedPoint.source.charAt(0).toUpperCase() + selectedPoint.source.slice(1)}
                </Text>
              </View>
            </View>
            {/* STORY-1006 start: add annotation editor for this data point here. */}
          </View>
        )}
      </View>
      
      {/* Weekly Averages Table */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Weekly Averages</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCell, styles.tableHeaderCell]}>Week</Text>
            <Text style={[styles.tableCell, styles.tableHeaderCell]}>Avg HRV</Text>
            <Text style={[styles.tableCell, styles.tableHeaderCell]}>Readings</Text>
          </View>
          {weeklyAverages.map((week, index) => (
            <View 
              key={index} 
              style={[
                styles.tableRow,
                week.gestationalWeek === currentGestationalWeek && styles.tableRowCurrent,
              ]}
            >
              <Text style={styles.tableCell}>Week {week.gestationalWeek}</Text>
              <Text style={styles.tableCell}>{week.averageHRV.toFixed(1)} ms</Text>
              <Text style={styles.tableCell}>{week.readingCount}</Text>
            </View>
          ))}
        </View>
      </View>
      
      {/* Analysis Summary */}
      {analysisResult && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Analysis Summary</Text>
          <View style={styles.analysisCard}>
            <View style={styles.analysisRow}>
              <Text style={styles.analysisLabel}>Current Trend:</Text>
              <Text style={styles.analysisValue}>
                {analysisResult.currentTrend.charAt(0).toUpperCase() + 
                 analysisResult.currentTrend.slice(1).replace('_', ' ')}
              </Text>
            </View>
            <View style={styles.analysisRow}>
              <Text style={styles.analysisLabel}>Status:</Text>
              <Text style={styles.analysisValue}>
                {analysisResult.inversionStatus.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
            <View style={styles.analysisRow}>
              <Text style={styles.analysisLabel}>Confidence:</Text>
              <Text style={styles.analysisValue}>
                {analysisResult.confidence.charAt(0).toUpperCase() + 
                 analysisResult.confidence.slice(1)}
              </Text>
            </View>
            <View style={styles.analysisRow}>
              <Text style={styles.analysisLabel}>Last Analyzed:</Text>
              <Text style={styles.analysisValue}>
                {formatDate(analysisResult.lastAnalyzedAt, 'MMM d, h:mm a')}
              </Text>
            </View>
          </View>
          {/* STORY-1009 start: add statistical summary panel beneath analysis. */}
        </View>
      )}
      
      {/* Export Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Export Data</Text>
        <Text style={styles.exportDescription}>
          Share your HRV data with your healthcare provider
        </Text>
        {/* STORY-1007 start: add a "Share Chart Image" button here. */}
        <View style={styles.exportButtons}>
          <TouchableOpacity
            style={[styles.exportButton, isExporting && styles.exportButtonDisabled]}
            onPress={() => handleExport('csv')}
            disabled={isExporting}
          >
            <Text style={styles.exportButtonText}>Export CSV</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.exportButton, styles.exportButtonSecondary, isExporting && styles.exportButtonDisabled]}
            onPress={() => handleExport('json')}
            disabled={isExporting}
          >
            <Text style={[styles.exportButtonText, styles.exportButtonTextSecondary]}>
              Export JSON
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

/**
 * Prepare data for the chart component
 */
function prepareChartData(readings: HRVReading[]) {
  if (readings.length === 0) {
    return {
      labels: [],
      datasets: [{ data: [0] }],
    };
  }
  
  // Show last 14 readings or all if fewer
  const displayReadings = readings.slice(-14);
  
  // Create labels (gestational week)
  const labels = displayReadings.map((r, i) => 
    i % 3 === 0 ? `W${r.gestationalWeek}` : ''
  );
  
  // Create data points
  const data = displayReadings.map(r => r.hrvValue);
  
  return {
    labels,
    datasets: [{
      data,
      color: (opacity = 1) => `rgba(107, 78, 230, ${opacity})`,
      strokeWidth: 2,
    }],
    legend: ['HRV (ms)'],
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.lg,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  emptyTip: {
    marginTop: SPACING.xl,
    padding: SPACING.lg,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.md,
  },
  emptyTipTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  emptyTipText: {
    fontSize: FONT_SIZES.sm,
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
    marginBottom: SPACING.xs,
  },
  sectionSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  chartContainer: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.sm,
    alignItems: 'center',
  },
  chart: {
    borderRadius: BORDER_RADIUS.md,
  },
  tooltipCard: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  tooltipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  tooltipTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  tooltipClose: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.textSecondary,
    padding: SPACING.xs,
  },
  tooltipContent: {},
  tooltipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
  },
  tooltipLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  tooltipValue: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  table: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
  },
  tableHeaderCell: {
    color: COLORS.textLight,
    fontWeight: '600',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tableRowCurrent: {
    backgroundColor: COLORS.primaryLight + '20',
  },
  tableCell: {
    flex: 1,
    textAlign: 'center',
    fontSize: FONT_SIZES.sm,
    color: COLORS.textPrimary,
  },
  analysisCard: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
  },
  analysisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
  },
  analysisLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  analysisValue: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  exportDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  exportButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  exportButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
  },
  exportButtonSecondary: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  exportButtonDisabled: {
    opacity: 0.5,
  },
  exportButtonText: {
    color: COLORS.textLight,
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
  },
  exportButtonTextSecondary: {
    color: COLORS.primary,
  },
});
