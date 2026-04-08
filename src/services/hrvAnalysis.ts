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
  EXPECTED_INFLECTION_WEEK,
  WEEKS_BEFORE_DELIVERY_INFLECTION,
  STATUS_MESSAGES,
  FULL_TERM_WEEKS
} from '../constants';
import { addWeeks, parseISO } from 'date-fns';

// Internal tuning constants for trend/inversion detection
const SMOOTHING_WINDOW_POINTS = 3;
const RECENT_TREND_WINDOW_POINTS = 14;           // ~2 weeks of nightly data
const MIN_R2_FOR_TREND = 0.15;
const MIN_NORMALIZED_SLOPE = 0.003;              // ~0.3% change per point
const MIN_SPLINE_WEEKLY_POINTS = 6;
const MIN_SPLINE_POINTS_PER_SEGMENT = 3;
const MIN_SPLINE_R2_FOR_INVERSION = 0.35;
const MIN_SPLINE_RSS_IMPROVEMENT = 0.10;
const MIN_SPLINE_NORMALIZED_SLOPE = 0.01;        // ~1% change per week
const MATRIX_EPSILON = 1e-9;

interface SmoothedPoint {
  value: number;
  timestamp: string;
  gestationalWeek: number;
}

interface SplinePoint {
  week: number;
  value: number;
}

interface LinearSplineModel {
  candidateDeliveryWeek: number;
  knotWeek: number;
  interceptAtKnot: number;
  preKnotSlope: number;
  postKnotSlope: number;
  slopeDelta: number;
  nearBirthWeeksUntilBirthSlope: number;
  farFromBirthWeeksUntilBirthSlope: number;
  r2: number;
  rss: number;
  beforeCount: number;
  afterCount: number;
}

interface LinearFit {
  slope: number;
  rss: number;
  r2: number;
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
  const weeklyAverages = calculateWeeklyAverages(sortedReadings);
  
  // Determine current trend
  const currentTrend = detectCurrentTrend(smoothedReadings);
  
  // Detect if an inversion has occurred
  const inversionResult = detectInversion(sortedReadings, weeklyAverages);
  
  // Determine the status based on inversion timing
  const status = determineStatus(inversionResult);
  
  // Calculate confidence level
  const confidence = calculateConfidence(readings.length, inversionResult);
  
  // Generate prediction if we have enough data
  const prediction = generatePrediction(inversionResult, estimatedDueDate, sortedReadings);
  
  // Get appropriate messages
  const messages = STATUS_MESSAGES[getStatusKey(status.inversionStatus)];
  const postInversionAlert = status.inversionStatus === InversionStatus.ON_TRACK
    ? null
    : getPostInversionAlert(inversionResult, weeklyAverages);
  
  return {
    currentTrend,
    inversionStatus: status.inversionStatus,
    confidence,
    predictedDeliveryWindow: prediction,
    inversionDetectedAt: inversionResult.inversionWeek 
      ? getDateForGestationalWeek(inversionResult.inversionWeek, estimatedDueDate)
      : undefined,
    lastAnalyzedAt: now,
    message: postInversionAlert?.message ?? messages.description,
    recommendation: postInversionAlert?.recommendation ?? messages.recommendation
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
// STORY-406: single-user linear spline model based on the paper's mixed-effect
// spline approach. The population-level random effects reduce to an individual
// intercept in the app because we only have the active user's data in real time.
function detectInversion(
  readings: HRVReading[],
  weeklyAverages: HRVAggregate[]
): InversionDetectionResult {
  const noInversion: InversionDetectionResult = {
    inversionDetected: false,
    inversionWeek: null,
    confidence: 0,
    trendBeforeInversion: null,
    trendAfterInversion: null
  };
  
  if (
    readings.length < MINIMUM_DATA_POINTS_FOR_INVERSION ||
    weeklyAverages.length < MIN_SPLINE_WEEKLY_POINTS
  ) {
    return noInversion;
  }
  
  const splinePoints = weeklyAverages.map((aggregate) => ({
    week: aggregate.gestationalWeek,
    value: aggregate.averageHRV,
  }));
  const bestModel = findBestInversionSpline(splinePoints);
  const baselineFit = fitLinearModel(splinePoints);

  if (!bestModel || !baselineFit) {
    return noInversion;
  }

  const meanHRV = computeMean(splinePoints.map((point) => point.value));
  const normalizedPreSlope = normalizeSlope(bestModel.preKnotSlope, meanHRV);
  const normalizedPostSlope = normalizeSlope(bestModel.postKnotSlope, meanHRV);
  const rssImprovement = baselineFit.rss <= MATRIX_EPSILON
    ? 0
    : (baselineFit.rss - bestModel.rss) / baselineFit.rss;

  const looksLikeInversion =
    normalizedPreSlope < -MIN_SPLINE_NORMALIZED_SLOPE &&
    normalizedPostSlope > MIN_SPLINE_NORMALIZED_SLOPE &&
    bestModel.r2 >= MIN_SPLINE_R2_FOR_INVERSION &&
    rssImprovement >= MIN_SPLINE_RSS_IMPROVEMENT;

  if (!looksLikeInversion) {
    return noInversion;
  }
  
  const segmentBalance = Math.min(bestModel.beforeCount, bestModel.afterCount) /
    Math.max(bestModel.beforeCount, bestModel.afterCount);
  const slopeStrength = clamp01(
    (Math.abs(normalizedPreSlope) + Math.abs(normalizedPostSlope)) /
    (MIN_SPLINE_NORMALIZED_SLOPE * 8)
  );
  const confidence = clamp01(
    bestModel.r2 * 0.45 +
    clamp01(rssImprovement) * 0.30 +
    segmentBalance * 0.15 +
    slopeStrength * 0.10
  );
  
  return {
    inversionDetected: true,
    inversionWeek: bestModel.knotWeek,
    confidence,
    trendBeforeInversion: 'decreasing',
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
 * Build patient-facing inversion alerts:
 * - First alert at 2 weeks after inversion detection
 * - Weekly follow-up alerts after the first alert
 */
function getPostInversionAlert(
  inversionResult: InversionDetectionResult,
  weeklyAverages: HRVAggregate[]
): { message: string; recommendation: string } | null {
  if (!inversionResult.inversionDetected || !inversionResult.inversionWeek || weeklyAverages.length === 0) {
    return null;
  }

  const latestWeek = weeklyAverages[weeklyAverages.length - 1].gestationalWeek;
  const weeksSinceInversion = latestWeek - inversionResult.inversionWeek;

  if (weeksSinceInversion < 2) {
    return null;
  }

  if (weeksSinceInversion === 2) {
    return {
      message: `Inversion detected in week ${inversionResult.inversionWeek}. Two-week follow-up now confirms this trend.`,
      recommendation: 'Continue weekly monitoring. If this trend persists, contact your healthcare provider.',
    };
  }

  return {
    message: `Inversion detected ${weeksSinceInversion} weeks ago (week ${inversionResult.inversionWeek}). Weekly follow-up continues to confirm the trend prediction.`,
    recommendation: 'Confirmed detection: please contact your healthcare provider to discuss these findings.',
  };
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
 * Find the best weekly linear spline for a decline-then-rise HRV pattern.
 * Each candidate delivery week is fit with the paper's fixed knot at seven
 * weeks until birth. The inferred inversion week is delivery week minus seven.
 */
function findBestInversionSpline(points: SplinePoint[]): LinearSplineModel | null {
  if (points.length < MIN_SPLINE_WEEKLY_POINTS) {
    return null;
  }

  const sortedPoints = [...points].sort((a, b) => a.week - b.week);
  const minWeek = sortedPoints[0].week;
  const maxWeek = sortedPoints[sortedPoints.length - 1].week;
  let bestModel: LinearSplineModel | null = null;

  for (
    let candidateDeliveryWeek = Math.ceil(minWeek + WEEKS_BEFORE_DELIVERY_INFLECTION + 1);
    candidateDeliveryWeek <= Math.floor(maxWeek + WEEKS_BEFORE_DELIVERY_INFLECTION - 1);
    candidateDeliveryWeek++
  ) {
    const model = fitWeeksUntilBirthSpline(sortedPoints, candidateDeliveryWeek);

    if (!model) {
      continue;
    }

    if (!bestModel || model.rss < bestModel.rss) {
      bestModel = model;
    }
  }

  return bestModel;
}

/**
 * Fit the paper-aligned spline:
 * HRV = b0 + b1 * (weeks_until_birth - 7) +
 *       b2 * max(0, weeks_until_birth - 7).
 */
function fitWeeksUntilBirthSpline(
  points: SplinePoint[],
  candidateDeliveryWeek: number
): LinearSplineModel | null {
  const knotWeek = candidateDeliveryWeek - WEEKS_BEFORE_DELIVERY_INFLECTION;
  const beforeCount = points.filter((point) => point.week < knotWeek).length;
  const afterCount = points.filter((point) => point.week > knotWeek).length;

  if (
    beforeCount < MIN_SPLINE_POINTS_PER_SEGMENT ||
    afterCount < MIN_SPLINE_POINTS_PER_SEGMENT
  ) {
    return null;
  }

  const xtx = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const xty = [0, 0, 0];

  for (const point of points) {
    const centeredWeeksUntilBirth =
      candidateDeliveryWeek - point.week - WEEKS_BEFORE_DELIVERY_INFLECTION;
    const farFromBirthHinge = Math.max(0, centeredWeeksUntilBirth);
    const row = [1, centeredWeeksUntilBirth, farFromBirthHinge];

    for (let i = 0; i < row.length; i++) {
      xty[i] += row[i] * point.value;

      for (let j = 0; j < row.length; j++) {
        xtx[i][j] += row[i] * row[j];
      }
    }
  }

  const coefficients = solve3x3(xtx, xty);

  if (!coefficients) {
    return null;
  }

  const [interceptAtKnot, nearBirthWeeksUntilBirthSlope, slopeDelta] = coefficients;
  const farFromBirthWeeksUntilBirthSlope = nearBirthWeeksUntilBirthSlope + slopeDelta;
  const preKnotSlope = -farFromBirthWeeksUntilBirthSlope;
  const postKnotSlope = -nearBirthWeeksUntilBirthSlope;
  const mean = computeMean(points.map((point) => point.value));
  let rss = 0;
  let tss = 0;

  for (const point of points) {
    const centeredWeeksUntilBirth =
      candidateDeliveryWeek - point.week - WEEKS_BEFORE_DELIVERY_INFLECTION;
    const predicted =
      interceptAtKnot +
      nearBirthWeeksUntilBirthSlope * centeredWeeksUntilBirth +
      slopeDelta * Math.max(0, centeredWeeksUntilBirth);
    rss += Math.pow(point.value - predicted, 2);
    tss += Math.pow(point.value - mean, 2);
  }

  return {
    candidateDeliveryWeek,
    knotWeek,
    interceptAtKnot,
    preKnotSlope,
    postKnotSlope,
    slopeDelta,
    nearBirthWeeksUntilBirthSlope,
    farFromBirthWeeksUntilBirthSlope,
    r2: tss <= MATRIX_EPSILON ? 0 : 1 - rss / tss,
    rss,
    beforeCount,
    afterCount,
  };
}

/**
 * Baseline single-slope model used to ensure the spline actually improves fit.
 */
function fitLinearModel(points: SplinePoint[]): LinearFit | null {
  if (points.length < 2) {
    return null;
  }

  const n = points.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (const point of points) {
    sumX += point.week;
    sumY += point.value;
    sumXY += point.week * point.value;
    sumX2 += point.week * point.week;
  }

  const denominator = n * sumX2 - sumX * sumX;

  if (Math.abs(denominator) <= MATRIX_EPSILON) {
    return null;
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  const mean = sumY / n;
  let rss = 0;
  let tss = 0;

  for (const point of points) {
    const predicted = intercept + slope * point.week;
    rss += Math.pow(point.value - predicted, 2);
    tss += Math.pow(point.value - mean, 2);
  }

  return {
    slope,
    rss,
    r2: tss <= MATRIX_EPSILON ? 0 : 1 - rss / tss,
  };
}

/**
 * Solve a 3x3 linear system using Gaussian elimination with partial pivoting.
 */
function solve3x3(matrix: number[][], vector: number[]): number[] | null {
  const augmented = matrix.map((row, index) => [...row, vector[index]]);

  for (let column = 0; column < 3; column++) {
    let pivotRow = column;

    for (let row = column + 1; row < 3; row++) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivotRow][column])) {
        pivotRow = row;
      }
    }

    if (Math.abs(augmented[pivotRow][column]) <= MATRIX_EPSILON) {
      return null;
    }

    if (pivotRow !== column) {
      const swap = augmented[column];
      augmented[column] = augmented[pivotRow];
      augmented[pivotRow] = swap;
    }

    for (let row = column + 1; row < 3; row++) {
      const factor = augmented[row][column] / augmented[column][column];

      for (let innerColumn = column; innerColumn < 4; innerColumn++) {
        augmented[row][innerColumn] -= factor * augmented[column][innerColumn];
      }
    }
  }

  const solution = [0, 0, 0];

  for (let row = 2; row >= 0; row--) {
    let value = augmented[row][3];

    for (let column = row + 1; column < 3; column++) {
      value -= augmented[row][column] * solution[column];
    }

    solution[row] = value / augmented[row][row];
  }

  return solution;
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
  findBestInversionSpline,
  fitWeeksUntilBirthSpline,
  fitLinearModel,
  solve3x3,
  getPositiveRunLength,
  normalizeSlope,
  computeMean,
  computeStandardDeviation,
  roundToNearestHalf,
  getPredictionMarginWeeks,
};
