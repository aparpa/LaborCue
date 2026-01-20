/**
 * Labor Cue App - Type Definitions
 * 
 * This file contains all the TypeScript interfaces and types used throughout
 * the application. Understanding these types is crucial for working with
 * the app's data structures.
 * 
 * =============================================================================
 * TODOS FOR THIS FILE:
 * =============================================================================
 * 
 * TODO [STORY-101]: Add validation schemas using Zod or Yup library
 *   - Priority: Medium
 *   - Points: 3
 *   - Description: Create runtime validation for all interfaces to ensure
 *     data integrity when loading from storage or receiving from device
 * 
 * TODO [STORY-102]: Add internationalization (i18n) types
 *   - Priority: Low
 *   - Points: 2
 *   - Description: Create types to support multiple languages for status
 *     messages and UI text
 * 
 * TODO [STORY-103]: Add types for Bluetooth device communication
 *   - Priority: High (for device integration phase)
 *   - Points: 5
 *   - Description: Define interfaces for BLE device discovery, connection,
 *     and data transfer protocols
 * 
 * =============================================================================
 */

// ============================================================================
// USER & PROFILE TYPES
// ============================================================================

/**
 * Represents the user's profile information
 * Collected during initial setup and editable in settings
 */
export interface UserProfile {
  id: string;
  name?: string;                    // Optional: user's display name
  pregnancyStartDate: string;       // ISO date string of conception/LMP
  estimatedDueDate: string;         // ISO date string of expected delivery
  currentWeeksPregnant: number;     // Calculated field
  healthcareProvider?: HealthcareProvider;
  createdAt: string;
  updatedAt: string;
  isFirstLaunch: boolean;           // Tracks if setup has been completed
}

/**
 * Healthcare provider contact information
 */
export interface HealthcareProvider {
  name: string;
  contact: string;                  // Phone, email, or other contact method
}

// ============================================================================
// HRV DATA TYPES
// ============================================================================

/**
 * A single HRV measurement reading
 * These are collected every 2 nights from the wearable device
 */
export interface HRVReading {
  id: string;
  timestamp: string;                // ISO date string when reading was taken
  hrvValue: number;                 // RMSSD value in milliseconds
  gestationalWeek: number;          // Week of pregnancy when recorded
  gestationalDay: number;           // Day within the gestational week (0-6)
  source: DataSource;               // How the data was entered
  metadata?: HRVMetadata;           // Optional additional information
}

/**
 * Source of the HRV data
 */
export type DataSource = 'manual' | 'device' | 'imported';

/**
 * Optional metadata that can accompany an HRV reading
 */
export interface HRVMetadata {
  sleepDuration?: number;           // Hours of sleep
  sleepQuality?: number;            // 1-10 scale
  notes?: string;                   // User notes
  deviceId?: string;                // ID of the measuring device
}

/**
 * Aggregated HRV data for a specific time period
 * Used for calculating trends and displaying summaries
 */
export interface HRVAggregate {
  periodStart: string;              // Start of the aggregation period
  periodEnd: string;                // End of the aggregation period
  averageHRV: number;               // Mean HRV for the period
  minHRV: number;                   // Minimum HRV recorded
  maxHRV: number;                   // Maximum HRV recorded
  readingCount: number;             // Number of readings in period
  gestationalWeek: number;          // Primary gestational week
}

// ============================================================================
// ANALYSIS & STATUS TYPES
// ============================================================================

/**
 * The current trend direction of HRV
 */
export type HRVTrend = 'increasing' | 'decreasing' | 'stable' | 'insufficient_data';

/**
 * Status of potential HRV inversion detection
 * Based on the paper's findings about the ~7-week pre-delivery inflection
 */
export enum InversionStatus {
  ON_TRACK = 'on_track',                    // No early inversion detected
  POSSIBLE_INVERSION = 'possible',          // Early signs, low confidence
  PROBABLE_INVERSION = 'probable',          // Strong indication, consult physician
  INSUFFICIENT_DATA = 'insufficient_data'   // Not enough data to determine
}

/**
 * Confidence level for analysis results
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'none';

/**
 * Complete analysis result for the current HRV status
 */
export interface HRVAnalysisResult {
  currentTrend: HRVTrend;
  inversionStatus: InversionStatus;
  confidence: ConfidenceLevel;
  predictedDeliveryWindow?: DateRange;      // Estimated delivery timeframe
  inversionDetectedAt?: string;             // When inversion was first detected
  lastAnalyzedAt: string;                   // Timestamp of this analysis
  message: string;                          // Human-readable status message
  recommendation?: string;                  // Action recommendation
}

/**
 * A range of dates for predictions
 */
export interface DateRange {
  earliest: string;
  latest: string;
  mostLikely: string;
}

// ============================================================================
// UI & DISPLAY TYPES
// ============================================================================

/**
 * Color scheme for status indicators
 * Maps to the paper's recommendation for visual feedback
 */
export interface StatusColors {
  primary: string;                  // Main status color
  background: string;               // Background/card color
  text: string;                     // Text color for contrast
}

/**
 * Status display configuration
 */
export const STATUS_COLORS: Record<InversionStatus, StatusColors> = {
  [InversionStatus.ON_TRACK]: {
    primary: '#4CAF50',             // Green
    background: '#E8F5E9',
    text: '#1B5E20'
  },
  [InversionStatus.POSSIBLE_INVERSION]: {
    primary: '#FFC107',             // Yellow/Amber
    background: '#FFF8E1',
    text: '#FF6F00'
  },
  [InversionStatus.PROBABLE_INVERSION]: {
    primary: '#F44336',             // Red
    background: '#FFEBEE',
    text: '#B71C1C'
  },
  [InversionStatus.INSUFFICIENT_DATA]: {
    primary: '#9E9E9E',             // Grey
    background: '#F5F5F5',
    text: '#424242'
  }
};

/**
 * Data point for chart display
 */
export interface ChartDataPoint {
  x: number;                        // X-axis value (typically days/dates)
  y: number;                        // Y-axis value (HRV)
  label?: string;                   // Display label
  date: string;                     // Full date string
  hrvReading: HRVReading;           // Original reading data
}

/**
 * Configuration for the HRV chart
 */
export interface ChartConfig {
  showTrendLine: boolean;           // Whether to display the trend line
  showDataPoints: boolean;          // Whether to show individual points
  startDate?: string;               // Filter start date
  endDate?: string;                 // Filter end date
  highlightInversion: boolean;      // Highlight inversion point if detected
}

// ============================================================================
// NAVIGATION TYPES
// ============================================================================

/**
 * Type definitions for navigation routes
 * Used by React Navigation for type-safe navigation
 */
export type RootStackParamList = {
  Setup: undefined;
  Main: undefined;
};

export type DrawerParamList = {
  Home: undefined;
  Data: undefined;
  Settings: undefined;
};

// ============================================================================
// STORAGE TYPES
// ============================================================================

/**
 * Keys used for AsyncStorage
 */
export enum StorageKeys {
  USER_PROFILE = 'user_profile',
  HRV_DATA = 'hrv_data',
  APP_SETTINGS = 'app_settings',
  LAST_SYNC = 'last_sync'
}

/**
 * App-wide settings
 */
export interface AppSettings {
  notificationsEnabled: boolean;
  reminderTime?: string;            // Time for daily reminders
  theme: 'light' | 'dark' | 'system';
  dataRetentionDays: number;        // How long to keep data
}

// ============================================================================
// EXPORT TYPES
// ============================================================================

/**
 * Supported export formats
 */
export type ExportFormat = 'csv' | 'pdf' | 'json';

/**
 * Export configuration
 */
export interface ExportConfig {
  format: ExportFormat;
  dateRange?: DateRange;
  includeAnalysis: boolean;
  includeRawData: boolean;
  recipientEmail?: string;
}

// ============================================================================
// DEVICE INTEGRATION TYPES (Future)
// ============================================================================

/**
 * Placeholder for future Bluetooth device integration
 */
export interface DeviceInfo {
  id: string;
  name: string;
  connected: boolean;
  batteryLevel?: number;
  lastSync?: string;
  firmwareVersion?: string;
}

/**
 * Device connection status
 */
export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';
