/**
 * Labor Cue App - Constants
 * 
 * Central location for all app-wide constant values.
 * Modify these values to adjust app behavior globally.
 * 
 * =============================================================================
 * TODOS FOR THIS FILE:
 * =============================================================================
 * 
 * TODO [STORY-201]: Create a dark mode color palette
 *   - Priority: Low
 *   - Points: 2
 *   - Description: Add a COLORS_DARK object with dark mode equivalents
 *     for all colors. Will be used with theme switching.
 * 
 * TODO [STORY-202]: Make thresholds configurable via settings
 *   - Priority: Medium
 *   - Points: 3
 *   - Description: Allow users/researchers to adjust analysis thresholds
 *     like SIGNIFICANT_CHANGE_THRESHOLD from the settings screen
 * 
 * TODO [STORY-203]: Add accessibility constants
 *   - Priority: Medium
 *   - Points: 2
 *   - Description: Add constants for minimum touch target sizes (44x44),
 *     font scaling factors, and color contrast ratios for WCAG compliance
 * 
 * =============================================================================
 */

// ============================================================================
// PREGNANCY CONSTANTS
// Based on the research paper findings
// ============================================================================

/**
 * Standard pregnancy duration in weeks (40 weeks from LMP)
 */
export const FULL_TERM_WEEKS = 40;

/**
 * Preterm is defined as delivery before 37 weeks
 * Source: American College of Obstetricians and Gynecologists
 */
export const PRETERM_THRESHOLD_WEEKS = 37;

/**
 * The gestational week at which HRV typically shows inflection in term pregnancies
 * Source: Rowan et al. (2022), confirmed in the current paper
 */
export const EXPECTED_INFLECTION_WEEK = 33;

/**
 * Number of weeks before delivery when HRV typically inflects
 * Source: Jasinski et al. (2024) - the paper this app is based on
 */
export const WEEKS_BEFORE_DELIVERY_INFLECTION = 7;

/**
 * Minimum gestational week from which we start tracking
 * The paper analyzed data from week 24 onwards
 */
export const MINIMUM_TRACKING_WEEK = 24;

// ============================================================================
// DATA COLLECTION CONSTANTS
// ============================================================================

/**
 * Minimum number of data points needed before showing trend analysis
 * Based on needing at least 2 weeks of data with readings every 2 nights
 */
export const MINIMUM_DATA_POINTS_FOR_TREND = 7;

/**
 * Minimum number of data points for high-confidence inversion detection
 */
export const MINIMUM_DATA_POINTS_FOR_INVERSION = 14;

/**
 * Number of consecutive readings needed to confirm a trend change
 */
export const CONSECUTIVE_READINGS_FOR_TREND_CHANGE = 3;

/**
 * Number of days between expected readings from the wearable device
 */
export const DATA_COLLECTION_INTERVAL_DAYS = 2;

/**
 * Rolling window size for calculating average HRV (in days)
 */
export const ROLLING_AVERAGE_WINDOW_DAYS = 7;

// ============================================================================
// HRV ANALYSIS THRESHOLDS
// ============================================================================

/**
 * Minimum percentage change to be considered a significant trend
 * e.g., 5% = 0.05 means HRV must change by at least 5% to register
 */
export const SIGNIFICANT_CHANGE_THRESHOLD = 0.05;

/**
 * Normal HRV range in milliseconds (RMSSD)
 * These are approximate ranges for reference
 */
export const HRV_RANGES = {
  low: { min: 0, max: 30 },
  normal: { min: 30, max: 70 },
  high: { min: 70, max: 150 }
} as const;

// ============================================================================
// UI CONSTANTS
// ============================================================================

/**
 * App color palette
 */
export const COLORS = {
  // Primary brand colors
  primary: '#6B4EE6',           // Purple - main brand color
  primaryLight: '#9B85F0',
  primaryDark: '#4A32B8',
  
  // Status colors
  success: '#4CAF50',           // Green - on track
  warning: '#FFC107',           // Yellow - possible concern
  danger: '#F44336',            // Red - consult physician
  neutral: '#9E9E9E',           // Grey - insufficient data
  
  // Background colors
  background: '#FFFFFF',
  backgroundSecondary: '#F5F5F5',
  
  // Text colors
  textPrimary: '#212121',
  textSecondary: '#757575',
  textLight: '#FFFFFF',
  
  // Chart colors
  chartLine: '#6B4EE6',
  chartFill: 'rgba(107, 78, 230, 0.1)',
  chartGrid: '#E0E0E0',
  chartInversion: '#FF5722',
  
  // Border colors
  border: '#E0E0E0',
  borderLight: '#F0F0F0'
} as const;

/**
 * Typography sizes
 */
export const FONT_SIZES = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 24,
  xxl: 32,
  title: 28
} as const;

/**
 * Spacing values (used for margins, padding, etc.)
 */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48
} as const;

/**
 * Border radius values
 */
export const BORDER_RADIUS = {
  sm: 4,
  md: 8,
  lg: 16,
  xl: 24,
  round: 9999
} as const;

// ============================================================================
// CHART CONSTANTS
// ============================================================================

/**
 * Chart configuration defaults
 */
export const CHART_CONFIG = {
  backgroundColor: COLORS.background,
  backgroundGradientFrom: COLORS.background,
  backgroundGradientTo: COLORS.background,
  decimalPlaces: 1,
  color: (opacity = 1) => `rgba(107, 78, 230, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(33, 33, 33, ${opacity})`,
  strokeWidth: 2,
  propsForDots: {
    r: 4,
    strokeWidth: 2,
    stroke: COLORS.primary
  },
  propsForBackgroundLines: {
    strokeDasharray: '',
    stroke: COLORS.chartGrid
  }
} as const;

// ============================================================================
// STATUS MESSAGES
// ============================================================================

/**
 * Human-readable messages for each status
 */
export const STATUS_MESSAGES = {
  on_track: {
    title: 'On Track',
    description: 'Your HRV patterns are following the expected trajectory.',
    recommendation: 'Continue regular monitoring and prenatal care.'
  },
  possible: {
    title: 'Possible Early Inversion',
    description: 'Your HRV may be showing early signs of change. More data is needed.',
    recommendation: 'Continue monitoring closely and mention at your next prenatal visit.'
  },
  probable: {
    title: 'Consult Your Physician',
    description: 'Your HRV patterns suggest potential early delivery indicators.',
    recommendation: 'Contact your healthcare provider to discuss these findings.'
  },
  insufficient_data: {
    title: 'Collecting Data',
    description: 'More readings are needed to establish your HRV baseline.',
    recommendation: 'Continue wearing your device and syncing data regularly.'
  }
} as const;

// ============================================================================
// STORAGE CONSTANTS
// ============================================================================

/**
 * Database name for SQLite
 */
export const DATABASE_NAME = 'laborcue.db';

/**
 * Current database version for migrations
 */
export const DATABASE_VERSION = 1;

/**
 * Maximum number of readings to store (prevents unbounded growth)
 */
export const MAX_STORED_READINGS = 1000;

// ============================================================================
// VALIDATION CONSTANTS
// ============================================================================

/**
 * Minimum age for app users (must be 18+)
 */
export const MINIMUM_AGE = 18;

/**
 * Maximum weeks pregnant at which someone can start using the app
 */
export const MAXIMUM_STARTING_WEEK = 36;

/**
 * Valid HRV reading range (for data validation)
 */
export const VALID_HRV_RANGE = {
  min: 5,
  max: 200
} as const;
