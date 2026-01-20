/**
 * Labor Cue App - HRV Analysis Service
 * 
 * This is the core analysis engine that implements the findings from
 * Jasinski et al. (2024). It analyzes maternal HRV data to detect
 * potential early labor indicators.
 * 
 * KEY CONCEPT FROM THE PAPER:
 * - HRV typically DECREASES during pregnancy
 * - About 7 weeks before delivery, HRV shows an INFLECTION (starts increasing)
 * - In preterm births, this inflection happens earlier than expected
 * - If we see the inflection before ~33 weeks gestational age, it may
 *   indicate preterm labor risk
 * 
 * =============================================================================
 * TODOS FOR THIS FILE:
 * =============================================================================
 * 
 * TODO [STORY-401]: Implement more sophisticated trend detection
 *   - Priority: High
 *   - Points: 8
 *   - Description: Replace simple slope calculation with proper statistical
 *     methods like LOESS smoothing or change-point detection algorithms.
 *     Consider using the 'simple-statistics' npm package.
 * 
 * TODO [STORY-402]: Add confidence intervals to predictions
 *   - Priority: High
 *   - Points: 5
 *   - Description: Calculate and display 95% confidence intervals for
 *     the predicted delivery window based on data variance.
 * 
 * TODO [STORY-403]: Implement individual baseline adjustment
 *   - Priority: Medium
 *   - Points: 5
 *   - Description: Account for individual differences in baseline HRV.
 *     Some users naturally have higher/lower HRV. Normalize trends
 *     relative to user's personal baseline.
 * 
 * TODO [STORY-404]: Add anomaly detection for outlier readings
 *   - Priority: Medium
 *   - Points: 3
 *   - Description: Detect and flag HRV readings that are statistical
 *     outliers (e.g., >3 standard deviations from mean). These may
 *     indicate measurement errors or unusual circumstances.
 * 
 * TODO [STORY-405]: Create unit tests for analysis functions
 *   - Priority: High
 *   - Points: 5
 *   - Description: Write Jest unit tests for all analysis functions.
 *     Include test cases for: normal term pregnancy, preterm with early
 *     inflection, insufficient data, and edge cases.
 * 
 * TODO [STORY-406]: Implement the exact spline model from the paper
 *   - Priority: High
 *   - Points: 8
 *   - Description: The paper used mixed-effect spline models with a knot
 *     at 7 weeks before delivery. Implement this more precisely using
 *     a statistics library.
 * 
 * =============================================================================
 */

import {
  HRVReading,
  HRVAnalysisResult,
  HRVTrend,
  InversionStatus,
  ConfidenceLevel,
  HRVAggregate,
  DateRange
} from '../types';
import {
  MINIMUM_DATA_POINTS_FOR_TREND,
  MINIMUM_DATA_POINTS_FOR_INVERSION,
  CONSECUTIVE_READINGS_FOR_TREND_CHANGE,
  ROLLING_AVERAGE_WINDOW_DAYS,
  SIGNIFICANT_CHANGE_THRESHOLD,
  EXPECTED_INFLECTION_WEEK,
  WEEKS_BEFORE_DELIVERY_INFLECTION,
  STATUS_MESSAGES,
  FULL_TERM_WEEKS
} from '../constants';
import { addWeeks, parseISO } from 'date-fns';

/**
 * Main analysis function - analyzes all HRV data and returns comprehensive results
 * 
 * @param readings - Array of HRV readings sorted by date (oldest first)
 * @param estimatedDueDate - The expected due date
 * @returns Complete analysis result with status and recommendations
 */
export function analyzeHRV(
  readings: HRVReading[],
  estimatedDueDate: string
): HRVAnalysisResult {
  const now = new Date().toISOString();
  
  // Check if we have enough data
  if (readings.length < MINIMUM_DATA_POINTS_FOR_TREND) {
    return {
      currentTrend: 'insufficient_data',
      inversionStatus: InversionStatus.INSUFFICIENT_DATA,
      confidence: 'none',
      lastAnalyzedAt: now,
      message: STATUS_MESSAGES.insufficient_data.description,
      recommendation: STATUS_MESSAGES.insufficient_data.recommendation
    };
  }
  
  // Sort readings by date (oldest first) to ensure correct order
  const sortedReadings = [...readings].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  // Calculate weekly averages for trend analysis
  const weeklyAverages = calculateWeeklyAverages(sortedReadings);
  
  // Determine current trend
  const currentTrend = detectCurrentTrend(weeklyAverages);
  
  // Detect if an inversion has occurred
  const inversionResult = detectInversion(weeklyAverages, sortedReadings);
  
  // Determine the status based on inversion timing
  const status = determineStatus(inversionResult, estimatedDueDate);
  
  // Calculate confidence level
  const confidence = calculateConfidence(readings.length, inversionResult);
  
  // Generate prediction if we have enough data
  const prediction = generatePrediction(inversionResult, estimatedDueDate);
  
  // Get appropriate messages
  const messages = STATUS_MESSAGES[getStatusKey(status.inversionStatus)];
  
  return {
    currentTrend,
    inversionStatus: status.inversionStatus,
    confidence,
    predictedDeliveryWindow: prediction,
    inversionDetectedAt: inversionResult.inversionWeek 
      ? getDateForGestationalWeek(inversionResult.inversionWeek, estimatedDueDate)
      : undefined,
    lastAnalyzedAt: now,
    message: messages.description,
    recommendation: messages.recommendation
  };
}

/**
 * Calculate weekly average HRV values
 * Groups readings by gestational week and calculates mean
 */
export function calculateWeeklyAverages(readings: HRVReading[]): HRVAggregate[] {
  // Group readings by gestational week
  const weeklyGroups = new Map<number, HRVReading[]>();
  
  for (const reading of readings) {
    const week = reading.gestationalWeek;
    if (!weeklyGroups.has(week)) {
      weeklyGroups.set(week, []);
    }
    weeklyGroups.get(week)!.push(reading);
  }
  
  // Calculate averages for each week
  const aggregates: HRVAggregate[] = [];
  
  weeklyGroups.forEach((weekReadings, week) => {
    if (weekReadings.length > 0) {
      const hrvValues = weekReadings.map(r => r.hrvValue);
      const avgHRV = hrvValues.reduce((sum, v) => sum + v, 0) / hrvValues.length;
      
      // Find date range for this week's readings
      const timestamps = weekReadings.map(r => r.timestamp).sort();
      
      aggregates.push({
        periodStart: timestamps[0],
        periodEnd: timestamps[timestamps.length - 1],
        averageHRV: avgHRV,
        minHRV: Math.min(...hrvValues),
        maxHRV: Math.max(...hrvValues),
        readingCount: weekReadings.length,
        gestationalWeek: week
      });
    }
  });
  
  // Sort by gestational week
  return aggregates.sort((a, b) => a.gestationalWeek - b.gestationalWeek);
}

/**
 * Detect the current HRV trend based on recent data
 */
function detectCurrentTrend(weeklyAverages: HRVAggregate[]): HRVTrend {
  if (weeklyAverages.length < 2) {
    return 'insufficient_data';
  }
  
  // Look at the last few weeks
  const recentWeeks = weeklyAverages.slice(-CONSECUTIVE_READINGS_FOR_TREND_CHANGE);
  
  if (recentWeeks.length < 2) {
    return 'insufficient_data';
  }
  
  // Calculate trend direction
  let increasingCount = 0;
  let decreasingCount = 0;
  
  for (let i = 1; i < recentWeeks.length; i++) {
    const change = recentWeeks[i].averageHRV - recentWeeks[i - 1].averageHRV;
    const percentChange = Math.abs(change) / recentWeeks[i - 1].averageHRV;
    
    if (percentChange >= SIGNIFICANT_CHANGE_THRESHOLD) {
      if (change > 0) {
        increasingCount++;
      } else {
        decreasingCount++;
      }
    }
  }
  
  if (increasingCount > decreasingCount && increasingCount >= 2) {
    return 'increasing';
  } else if (decreasingCount > increasingCount && decreasingCount >= 2) {
    return 'decreasing';
  }
  
  return 'stable';
}

/**
 * Inversion detection result
 */
interface InversionDetectionResult {
  inversionDetected: boolean;
  inversionWeek: number | null;
  confidence: number;  // 0-1 scale
  trendBeforeInversion: 'decreasing' | 'stable' | null;
  trendAfterInversion: 'increasing' | 'stable' | null;
}

/**
 * Detect if an HRV inversion (trend reversal) has occurred
 * 
 * An inversion is when HRV stops decreasing and starts increasing.
 * In the paper, this typically happens around 7 weeks before delivery.
 */
function detectInversion(
  weeklyAverages: HRVAggregate[],
  readings: HRVReading[]
): InversionDetectionResult {
  const noInversion: InversionDetectionResult = {
    inversionDetected: false,
    inversionWeek: null,
    confidence: 0,
    trendBeforeInversion: null,
    trendAfterInversion: null
  };
  
  if (weeklyAverages.length < 4) {
    return noInversion;
  }
  
  // Look for the point where trend changes from decreasing to increasing
  let potentialInversionIndex = -1;
  
  for (let i = 2; i < weeklyAverages.length - 1; i++) {
    // Check if previous weeks were decreasing
    const prevDecreasing = 
      weeklyAverages[i - 2].averageHRV > weeklyAverages[i - 1].averageHRV &&
      weeklyAverages[i - 1].averageHRV > weeklyAverages[i].averageHRV;
    
    // Check if following weeks are increasing
    const nextIncreasing = 
      weeklyAverages[i].averageHRV < weeklyAverages[i + 1].averageHRV;
    
    if (prevDecreasing && nextIncreasing) {
      potentialInversionIndex = i;
      break;
    }
  }
  
  if (potentialInversionIndex === -1) {
    return noInversion;
  }
  
  const inversionWeek = weeklyAverages[potentialInversionIndex].gestationalWeek;
  
  // Calculate confidence based on how clear the trend change is
  const beforeSlope = calculateSlope(weeklyAverages.slice(0, potentialInversionIndex + 1));
  const afterSlope = calculateSlope(weeklyAverages.slice(potentialInversionIndex));
  
  let confidence = 0;
  if (beforeSlope < 0 && afterSlope > 0) {
    // Clear inversion - negative slope before, positive after
    confidence = Math.min(1, (Math.abs(beforeSlope) + Math.abs(afterSlope)) / 2);
  }
  
  return {
    inversionDetected: true,
    inversionWeek,
    confidence,
    trendBeforeInversion: beforeSlope < 0 ? 'decreasing' : 'stable',
    trendAfterInversion: afterSlope > 0 ? 'increasing' : 'stable'
  };
}

/**
 * Calculate the slope of HRV trend over a series of weekly averages
 * Negative slope = decreasing, Positive slope = increasing
 */
function calculateSlope(averages: HRVAggregate[]): number {
  if (averages.length < 2) return 0;
  
  // Simple linear regression
  const n = averages.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += averages[i].averageHRV;
    sumXY += i * averages[i].averageHRV;
    sumX2 += i * i;
  }
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  return slope;
}

/**
 * Determine the status based on when inversion occurred relative to expected timing
 */
function determineStatus(
  inversionResult: InversionDetectionResult,
  estimatedDueDate: string
): { inversionStatus: InversionStatus } {
  if (!inversionResult.inversionDetected) {
    return { inversionStatus: InversionStatus.ON_TRACK };
  }
  
  const inversionWeek = inversionResult.inversionWeek!;
  
  // Expected inversion should happen around 7 weeks before due date
  // For a 40-week pregnancy, that's around week 33
  // If inversion happens significantly earlier, it could indicate preterm risk
  
  if (inversionWeek < 30) {
    // Very early inversion - high concern
    return { inversionStatus: InversionStatus.PROBABLE_INVERSION };
  } else if (inversionWeek < EXPECTED_INFLECTION_WEEK) {
    // Somewhat early inversion - moderate concern
    return { inversionStatus: InversionStatus.POSSIBLE_INVERSION };
  }
  
  // Inversion at expected time or later
  return { inversionStatus: InversionStatus.ON_TRACK };
}

/**
 * Calculate confidence level based on data quantity and quality
 */
function calculateConfidence(
  readingCount: number,
  inversionResult: InversionDetectionResult
): ConfidenceLevel {
  if (readingCount < MINIMUM_DATA_POINTS_FOR_TREND) {
    return 'none';
  }
  
  if (readingCount < MINIMUM_DATA_POINTS_FOR_INVERSION) {
    return 'low';
  }
  
  if (inversionResult.inversionDetected && inversionResult.confidence > 0.7) {
    return 'high';
  }
  
  if (inversionResult.inversionDetected && inversionResult.confidence > 0.4) {
    return 'medium';
  }
  
  return 'low';
}

/**
 * Generate a predicted delivery window based on inversion timing
 */
function generatePrediction(
  inversionResult: InversionDetectionResult,
  estimatedDueDate: string
): DateRange | undefined {
  if (!inversionResult.inversionDetected || !inversionResult.inversionWeek) {
    return undefined;
  }
  
  // Based on the paper: delivery typically occurs ~7 weeks after inversion
  const inversionWeek = inversionResult.inversionWeek;
  const predictedDeliveryWeek = inversionWeek + WEEKS_BEFORE_DELIVERY_INFLECTION;
  
  // Get the date for that week
  const dueDate = parseISO(estimatedDueDate);
  const weeksUntilDue = FULL_TERM_WEEKS - predictedDeliveryWeek;
  
  const predictedDate = addWeeks(dueDate, -weeksUntilDue);
  const earliestDate = addWeeks(predictedDate, -1);
  const latestDate = addWeeks(predictedDate, 1);
  
  return {
    earliest: earliestDate.toISOString(),
    mostLikely: predictedDate.toISOString(),
    latest: latestDate.toISOString()
  };
}

/**
 * Get the date for a specific gestational week
 */
function getDateForGestationalWeek(
  targetWeek: number,
  estimatedDueDate: string
): string {
  const dueDate = parseISO(estimatedDueDate);
  const weeksUntilDue = FULL_TERM_WEEKS - targetWeek;
  return addWeeks(dueDate, -weeksUntilDue).toISOString();
}

/**
 * Helper to get status message key
 */
function getStatusKey(status: InversionStatus): keyof typeof STATUS_MESSAGES {
  switch (status) {
    case InversionStatus.ON_TRACK:
      return 'on_track';
    case InversionStatus.POSSIBLE_INVERSION:
      return 'possible';
    case InversionStatus.PROBABLE_INVERSION:
      return 'probable';
    case InversionStatus.INSUFFICIENT_DATA:
    default:
      return 'insufficient_data';
  }
}

/**
 * Calculate a simple rolling average for smoothing data
 * 
 * @param readings - Array of HRV readings
 * @param windowSize - Number of readings to include in the window
 * @returns Array of smoothed values
 */
export function calculateRollingAverage(
  readings: HRVReading[],
  windowSize: number = 3
): number[] {
  if (readings.length < windowSize) {
    return readings.map(r => r.hrvValue);
  }
  
  const result: number[] = [];
  
  for (let i = 0; i < readings.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const window = readings.slice(start, i + 1);
    const avg = window.reduce((sum, r) => sum + r.hrvValue, 0) / window.length;
    result.push(avg);
  }
  
  return result;
}

/**
 * Get a summary string describing the current HRV status
 */
export function getStatusSummary(result: HRVAnalysisResult): string {
  const trendText = result.currentTrend === 'increasing' 
    ? 'Your HRV is trending upward'
    : result.currentTrend === 'decreasing'
    ? 'Your HRV is trending downward'
    : result.currentTrend === 'stable'
    ? 'Your HRV is stable'
    : 'More data is needed';
    
  return `${trendText}. ${result.message}`;
}
