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
  SIGNIFICANT_CHANGE_THRESHOLD,
  EXPECTED_INFLECTION_WEEK,
  WEEKS_BEFORE_DELIVERY_INFLECTION,
  STATUS_MESSAGES,
  FULL_TERM_WEEKS
} from '../constants';
import { addWeeks, parseISO } from 'date-fns';

// Internal tuning constants for trend/inversion detection
const SMOOTHING_WINDOW_POINTS = 3;
const RECENT_TREND_WINDOW_POINTS = 14;           // ~2 weeks of nightly data
const INVERSION_RECENT_WINDOW_POINTS = 14;       // window to check for positive slope
const INVERSION_PERSISTENCE_POINTS = 7;          // require ~2 weeks of positive run (assuming q2n)
const MIN_R2_FOR_TREND = 0.15;
const MIN_NORMALIZED_SLOPE = 0.003;              // ~0.3% change per point

interface SmoothedPoint {
  value: number;
  timestamp: string;
  gestationalWeek: number;
}

// STORY-405 start: add Jest tests in a new `src/services/__tests__/hrvAnalysis.test.ts`
// file and keep the core helpers exported for coverage.

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
  
  // STORY-404 start: filter/flag outlier readings here before aggregation.
  // STORY-403 start: normalize readings against a personal baseline here.
  
  // Smooth nightly readings for trend analysis
  const smoothedReadings = buildSmoothedSeries(sortedReadings, SMOOTHING_WINDOW_POINTS);
  
  // Determine current trend
  const currentTrend = detectCurrentTrend(smoothedReadings);
  
  // Detect if an inversion has occurred
  const inversionResult = detectInversion(sortedReadings, smoothedReadings);
  
  // Determine the status based on inversion timing
  const status = determineStatus(inversionResult);
  
  // Calculate confidence level
  const confidence = calculateConfidence(readings.length, inversionResult);
  
  // Generate prediction if we have enough data
  const prediction = generatePrediction(inversionResult, estimatedDueDate, sortedReadings);
  
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
function detectCurrentTrend(smoothedReadings: SmoothedPoint[]): HRVTrend {
  if (smoothedReadings.length < 2) {
    return 'insufficient_data';
  }
  
  const window = smoothedReadings.slice(-RECENT_TREND_WINDOW_POINTS);
  
  if (window.length < 2) {
    return 'insufficient_data';
  }
  
  const regression = computeRegression(window);
  return slopeToTrend(regression.slope, regression.r2, window);
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
// STORY-406 start: replace this inversion logic with the spline/mixed-effect
// model from the paper, keeping the returned shape compatible.
function detectInversion(
  readings: HRVReading[],
  smoothedReadings: SmoothedPoint[]
): InversionDetectionResult {
  const noInversion: InversionDetectionResult = {
    inversionDetected: false,
    inversionWeek: null,
    confidence: 0,
    trendBeforeInversion: null,
    trendAfterInversion: null
  };
  
  if (smoothedReadings.length < MINIMUM_DATA_POINTS_FOR_INVERSION) {
    return noInversion;
  }
  
  const longTermRegression = computeRegression(smoothedReadings);
  const recentWindow = smoothedReadings.slice(-INVERSION_RECENT_WINDOW_POINTS);
  const recentRegression = computeRegression(recentWindow);
  
  const longTermTrend = slopeToTrend(longTermRegression.slope, longTermRegression.r2, smoothedReadings);
  const recentTrend = slopeToTrend(recentRegression.slope, recentRegression.r2, recentWindow);
  
  const recentPositiveRun = getPositiveRunLength(smoothedReadings);
  const hasPersistentPositiveRun = recentPositiveRun >= INVERSION_PERSISTENCE_POINTS - 1;
  
  const longTermMean = computeMean(smoothedReadings.map(p => p.value));
  const recentMean = computeMean(recentWindow.map(p => p.value));
  const longTermNormalizedSlope = normalizeSlope(longTermRegression.slope, longTermMean);
  const recentNormalizedSlope = normalizeSlope(recentRegression.slope, recentMean);
  
  const looksLikeInversion =
    longTermTrend === 'decreasing' &&
    recentTrend === 'increasing' &&
    recentNormalizedSlope > MIN_NORMALIZED_SLOPE &&
    longTermNormalizedSlope < -MIN_NORMALIZED_SLOPE &&
    hasPersistentPositiveRun;
  
  if (!looksLikeInversion) {
    return noInversion;
  }
  
  const inversionStartIndex = smoothedReadings.length - (INVERSION_PERSISTENCE_POINTS - 1);
  const inversionWeek =
    readings[inversionStartIndex]?.gestationalWeek ??
    smoothedReadings[inversionStartIndex - 1]?.gestationalWeek ??
    null;
  
  const confidence = clamp01(
    recentRegression.r2 * 0.6 +
    (recentPositiveRun / INVERSION_PERSISTENCE_POINTS) * 0.4
  );
  
  return {
    inversionDetected: true,
    inversionWeek,
    confidence,
    trendBeforeInversion: longTermTrend === 'decreasing' ? 'decreasing' : 'stable',
    trendAfterInversion: 'increasing'
  };
}

/**
 * Determine the status based on when inversion occurred relative to expected timing
 */
function determineStatus(
  inversionResult: InversionDetectionResult
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
// STORY-402 start: add confidence intervals to the prediction window,
// and expose them via HRVAnalysisResult.
function generatePrediction(
  inversionResult: InversionDetectionResult,
  estimatedDueDate: string,
  readings: HRVReading[]
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
  const marginWeeks = getPredictionMarginWeeks(readings, inversionResult.confidence);
  const earliestDate = addWeeks(predictedDate, -marginWeeks);
  const latestDate = addWeeks(predictedDate, marginWeeks);
  
  return {
    earliest: earliestDate.toISOString(),
    mostLikely: predictedDate.toISOString(),
    latest: latestDate.toISOString(),
    confidenceInterval95: {
      lowerBound: earliestDate.toISOString(),
      upperBound: latestDate.toISOString(),
      weeksMargin: marginWeeks,
    },
  };
}

/**
 * Estimate 95% CI half-width in weeks from value variance and inversion confidence.
 */
function getPredictionMarginWeeks(
  readings: HRVReading[],
  inversionConfidence: number
): number {
  if (readings.length < 2) {
    return 1;
  }

  const values = readings.map((r) => r.hrvValue);
  const mean = computeMean(values);
  const stdDev = computeStandardDeviation(values);
  const coefficientOfVariation = mean === 0 ? 0 : stdDev / Math.abs(mean);

  const varianceFactor = clamp01(coefficientOfVariation / 0.35);
  const confidencePenalty = clamp01(1 - inversionConfidence);

  const rawMargin = 0.75 + varianceFactor * 1.75 + confidencePenalty;
  return roundToNearestHalf(rawMargin);
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

/**
 * Build a smoothed nightly series using a trailing window average
 */
function buildSmoothedSeries(
  readings: HRVReading[],
  windowSize: number
): SmoothedPoint[] {
  if (readings.length === 0) {
    return [];
  }
  
  const smoothedValues = calculateRollingAverage(readings, windowSize);
  
  return smoothedValues.map((value, index) => ({
    value,
    timestamp: readings[index].timestamp,
    gestationalWeek: readings[index].gestationalWeek
  }));
}

/**
 * Compute linear regression slope and r2 for a series of smoothed points
 */
function computeRegression(points: SmoothedPoint[]): { slope: number; r2: number } {
  if (points.length < 2) {
    return { slope: 0, r2: 0 };
  }
  
  const n = points.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  
  for (let i = 0; i < n; i++) {
    const x = i;
    const y = points[i].value;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  
  // Calculate r-squared
  const meanY = sumY / n;
  let ssTot = 0;
  let ssRes = 0;
  
  for (let i = 0; i < n; i++) {
    const x = i;
    const y = points[i].value;
    const predicted = (slope * x) + (sumY - slope * sumX) / n;
    ssTot += Math.pow(y - meanY, 2);
    ssRes += Math.pow(y - predicted, 2);
  }
  
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  
  return { slope, r2 };
}

/**
 * Convert slope and r2 into a trend classification
 */
function slopeToTrend(
  slope: number,
  r2: number,
  window: SmoothedPoint[]
): HRVTrend {
  const mean = computeMean(window.map(p => p.value));
  const normalizedSlope = normalizeSlope(slope, mean);
  
  if (window.length < CONSECUTIVE_READINGS_FOR_TREND_CHANGE) {
    return 'insufficient_data';
  }
  
  if (Math.abs(normalizedSlope) < MIN_NORMALIZED_SLOPE || r2 < MIN_R2_FOR_TREND) {
    return 'stable';
  }
  
  return normalizedSlope > 0 ? 'increasing' : 'decreasing';
}

/**
 * Count the trailing positive differences to ensure persistence
 */
function getPositiveRunLength(points: SmoothedPoint[]): number {
  let run = 0;
  for (let i = points.length - 1; i > 0; i--) {
    const delta = points[i].value - points[i - 1].value;
    if (delta > 0) {
      run++;
    } else {
      break;
    }
  }
  return run;
}

function normalizeSlope(slope: number, mean: number): number {
  if (mean === 0) return slope;
  return slope / Math.abs(mean);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function computeMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function computeStandardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = computeMean(values);
  const variance =
    values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) /
    (values.length - 1);
  return Math.sqrt(variance);
}

function roundToNearestHalf(value: number): number {
  return Math.max(0.5, Math.round(value * 2) / 2);
}

// Expose internal helpers for targeted unit tests (non-production use).
export const __testables = {
  detectCurrentTrend,
  detectInversion,
  determineStatus,
  calculateConfidence,
  generatePrediction,
  getStatusKey,
  buildSmoothedSeries,
  computeRegression,
  slopeToTrend,
  getPositiveRunLength,
  normalizeSlope,
  computeMean,
  computeStandardDeviation,
  roundToNearestHalf,
  getPredictionMarginWeeks,
};
