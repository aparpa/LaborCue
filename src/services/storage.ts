/**
 * Labor Cue App - Storage Service
 * 
 * Handles all local data persistence using AsyncStorage for simple data
 * and SQLite for structured HRV reading data.
 * 
 * This service provides a unified interface for:
 * - Saving/loading user profile
 * - Storing/retrieving HRV readings
 * - Managing app settings
 * 
 * =============================================================================
 * TODOS FOR THIS FILE:
 * =============================================================================
 * 
 * TODO [STORY-501]: Implement data encryption at rest
 *   - Priority: High
 *   - Points: 5
 *   - Description: Encrypt sensitive health data before storing locally.
 *     Use expo-secure-store for encryption keys and encrypt the SQLite
 *     database or individual records.
 * 
 * TODO [STORY-502]: Add cloud backup functionality
 *   - Priority: Medium
 *   - Points: 8
 *   - Description: Allow optional cloud backup to user's Google Drive or
 *     iCloud. Must be opt-in with clear privacy disclosure.
 * 
 * TODO [STORY-503]: Implement data migration system
 *   - Priority: Medium
 *   - Points: 5
 *   - Description: Create a versioned migration system for database schema
 *     changes. When DATABASE_VERSION changes, run appropriate migrations.
 * 
 * TODO [STORY-504]: Add data import from CSV/JSON
 *   - Priority: Medium
 *   - Points: 3
 *   - Description: Allow users to import HRV data from other apps or
 *     devices via CSV or JSON file upload.
 * 
 * TODO [STORY-505]: Implement data compression for large datasets
 *   - Priority: Low
 *   - Points: 3
 *   - Description: Compress older HRV readings to save storage space
 *     while keeping recent data readily accessible.
 * 
 * TODO [STORY-506]: Add PDF export with charts
 *   - Priority: High
 *   - Points: 5
 *   - Description: Generate a professional PDF report that includes
 *     the HRV chart, analysis summary, and recommendations. Use
 *     react-native-pdf-lib or similar library.
 * 
 * =============================================================================
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SQLite from 'expo-sqlite';
import { v4 as uuidv4 } from 'uuid';
import { format, parseISO } from 'date-fns';
import {
  UserProfile,
  HRVReading,
  AppSettings,
  StorageKeys,
  HRVAnalysisResult
} from '../types';
import { COLORS, DATABASE_NAME, MAX_STORED_READINGS } from '../constants';
import { analyzeHRV, getStatusSummary } from './hrvAnalysis';

type AsyncStorageModule = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  multiRemove: (keys: string[]) => Promise<void>;
  default?: AsyncStorageModule;
};

const storageBackend: AsyncStorageModule = (
  (AsyncStorage as unknown as AsyncStorageModule).getItem
    ? (AsyncStorage as unknown as AsyncStorageModule)
    : ((AsyncStorage as unknown as AsyncStorageModule).default ??
      (AsyncStorage as unknown as AsyncStorageModule))
);

// ============================================================================
// DATABASE INITIALIZATION
// ============================================================================

let db: SQLite.SQLiteDatabase | null = null;

/**
 * Initialize the SQLite database and create tables if they don't exist
 */
// STORY-503 start: add schema migration checks here (compare DATABASE_VERSION
// and run incremental migrations before creating tables).
export async function initializeDatabase(): Promise<void> {
  try {
    db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    
    // Create HRV readings table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS hrv_readings (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        hrv_value REAL NOT NULL,
        gestational_week INTEGER NOT NULL,
        gestational_day INTEGER NOT NULL,
        source TEXT NOT NULL,
        metadata TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_hrv_timestamp ON hrv_readings(timestamp);
      CREATE INDEX IF NOT EXISTS idx_hrv_week ON hrv_readings(gestational_week);
    `);
    
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Get the database instance, initializing if necessary
 */
async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    await initializeDatabase();
  }
  return db!;
}

// ============================================================================
// USER PROFILE OPERATIONS
// ============================================================================

/**
 * Save the user profile to AsyncStorage
 */
// STORY-501 start: encrypt/decrypt the user profile payload before storage.
export async function saveUserProfile(profile: UserProfile): Promise<void> {
  try {
    const updatedProfile: UserProfile = {
      ...profile,
      updatedAt: new Date().toISOString()
    };
    await storageBackend.setItem(
      StorageKeys.USER_PROFILE,
      JSON.stringify(updatedProfile)
    );
  } catch (error) {
    console.error('Failed to save user profile:', error);
    throw error;
  }
}

/**
 * Load the user profile from AsyncStorage
 * Returns null if no profile exists (first launch)
 */
// STORY-501 start: decrypt the stored payload before JSON.parse.
export async function loadUserProfile(): Promise<UserProfile | null> {
  try {
    const data = await storageBackend.getItem(StorageKeys.USER_PROFILE);
    if (data) {
      return JSON.parse(data) as UserProfile;
    }
    return null;
  } catch (error) {
    console.error('Failed to load user profile:', error);
    return null;
  }
}

/**
 * Create a new user profile with default values
 */
export function createNewProfile(
  pregnancyStartDate: string,
  estimatedDueDate: string,
  name?: string
): UserProfile {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    name,
    pregnancyStartDate,
    estimatedDueDate,
    currentWeeksPregnant: 0, // Will be calculated on load
    createdAt: now,
    updatedAt: now,
    isFirstLaunch: false
  };
}

/**
 * Check if this is the first app launch (no profile exists)
 */
export async function isFirstLaunch(): Promise<boolean> {
  const profile = await loadUserProfile();
  return profile === null || profile.isFirstLaunch;
}

// ============================================================================
// HRV READING OPERATIONS
// ============================================================================

/**
 * Save a new HRV reading to the database
 */
// STORY-501 start: encrypt sensitive HRV fields (or the entire record)
// prior to persistence if encrypting at rest.
export async function saveHRVReading(reading: Omit<HRVReading, 'id'>): Promise<HRVReading> {
  const database = await getDatabase();
  
  const newReading: HRVReading = {
    ...reading,
    id: uuidv4()
  };
  
  try {
    await database.runAsync(
      `INSERT INTO hrv_readings (id, timestamp, hrv_value, gestational_week, gestational_day, source, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        newReading.id,
        newReading.timestamp,
        newReading.hrvValue,
        newReading.gestationalWeek,
        newReading.gestationalDay,
        newReading.source,
        newReading.metadata ? JSON.stringify(newReading.metadata) : null
      ]
    );
    
    // Clean up old readings if we have too many
    await cleanupOldReadings();
    
    return newReading;
  } catch (error) {
    console.error('Failed to save HRV reading:', error);
    throw error;
  }
}

/**
 * Save multiple HRV readings at once (for batch imports)
 */
// STORY-504 start: validate imported records, then pass them through this
// helper to persist the batch.
export async function saveMultipleHRVReadings(
  readings: Omit<HRVReading, 'id'>[]
): Promise<HRVReading[]> {
  const savedReadings: HRVReading[] = [];
  
  for (const reading of readings) {
    const saved = await saveHRVReading(reading);
    savedReadings.push(saved);
  }
  
  return savedReadings;
}

/**
 * Get all HRV readings, sorted by timestamp (oldest first)
 */
export async function getAllHRVReadings(): Promise<HRVReading[]> {
  const database = await getDatabase();
  
  try {
    const results = await database.getAllAsync<{
      id: string;
      timestamp: string;
      hrv_value: number;
      gestational_week: number;
      gestational_day: number;
      source: string;
      metadata: string | null;
    }>('SELECT * FROM hrv_readings ORDER BY timestamp ASC');
    
    return results.map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      hrvValue: row.hrv_value,
      gestationalWeek: row.gestational_week,
      gestationalDay: row.gestational_day,
      source: row.source as HRVReading['source'],
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }));
  } catch (error) {
    console.error('Failed to load HRV readings:', error);
    return [];
  }
}

/**
 * Get HRV readings for a specific gestational week
 */
export async function getHRVReadingsByWeek(week: number): Promise<HRVReading[]> {
  const database = await getDatabase();
  
  try {
    const results = await database.getAllAsync<{
      id: string;
      timestamp: string;
      hrv_value: number;
      gestational_week: number;
      gestational_day: number;
      source: string;
      metadata: string | null;
    }>(
      'SELECT * FROM hrv_readings WHERE gestational_week = ? ORDER BY timestamp ASC',
      [week]
    );
    
    return results.map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      hrvValue: row.hrv_value,
      gestationalWeek: row.gestational_week,
      gestationalDay: row.gestational_day,
      source: row.source as HRVReading['source'],
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }));
  } catch (error) {
    console.error('Failed to load HRV readings by week:', error);
    return [];
  }
}

/**
 * Get the most recent HRV reading
 */
export async function getLatestHRVReading(): Promise<HRVReading | null> {
  const database = await getDatabase();
  
  try {
    const result = await database.getFirstAsync<{
      id: string;
      timestamp: string;
      hrv_value: number;
      gestational_week: number;
      gestational_day: number;
      source: string;
      metadata: string | null;
    }>('SELECT * FROM hrv_readings ORDER BY timestamp DESC LIMIT 1');
    
    if (!result) return null;
    
    return {
      id: result.id,
      timestamp: result.timestamp,
      hrvValue: result.hrv_value,
      gestationalWeek: result.gestational_week,
      gestationalDay: result.gestational_day,
      source: result.source as HRVReading['source'],
      metadata: result.metadata ? JSON.parse(result.metadata) : undefined
    };
  } catch (error) {
    console.error('Failed to get latest HRV reading:', error);
    return null;
  }
}

/**
 * Delete an HRV reading by ID
 */
export async function deleteHRVReading(id: string): Promise<void> {
  const database = await getDatabase();
  
  try {
    await database.runAsync('DELETE FROM hrv_readings WHERE id = ?', [id]);
  } catch (error) {
    console.error('Failed to delete HRV reading:', error);
    throw error;
  }
}

/**
 * Delete all HRV readings (for data reset)
 */
export async function deleteAllHRVReadings(): Promise<void> {
  const database = await getDatabase();
  
  try {
    await database.runAsync('DELETE FROM hrv_readings');
  } catch (error) {
    console.error('Failed to delete all HRV readings:', error);
    throw error;
  }
}

/**
 * Get the count of HRV readings
 */
export async function getHRVReadingCount(): Promise<number> {
  const database = await getDatabase();
  
  try {
    const result = await database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM hrv_readings'
    );
    return result?.count ?? 0;
  } catch (error) {
    console.error('Failed to get reading count:', error);
    return 0;
  }
}

/**
 * Clean up old readings to prevent unbounded database growth
 */
async function cleanupOldReadings(): Promise<void> {
  const database = await getDatabase();
  const count = await getHRVReadingCount();
  
  if (count > MAX_STORED_READINGS) {
    // STORY-505 start: consider compressing or archiving old readings here
    // instead of deleting outright.
    const toDelete = count - MAX_STORED_READINGS;
    try {
      await database.runAsync(
        `DELETE FROM hrv_readings WHERE id IN (
          SELECT id FROM hrv_readings ORDER BY timestamp ASC LIMIT ?
        )`,
        [toDelete]
      );
    } catch (error) {
      console.error('Failed to cleanup old readings:', error);
    }
  }
}

// ============================================================================
// APP SETTINGS OPERATIONS
// ============================================================================

/**
 * Default app settings
 */
const DEFAULT_SETTINGS: AppSettings = {
  notificationsEnabled: true,
  theme: 'system',
  dataRetentionDays: 365
};

/**
 * Save app settings
 */
export async function saveAppSettings(settings: AppSettings): Promise<void> {
  try {
    await storageBackend.setItem(
      StorageKeys.APP_SETTINGS,
      JSON.stringify(settings)
    );
  } catch (error) {
    console.error('Failed to save app settings:', error);
    throw error;
  }
}

/**
 * Load app settings (with defaults if not set)
 */
export async function loadAppSettings(): Promise<AppSettings> {
  try {
    const data = await storageBackend.getItem(StorageKeys.APP_SETTINGS);
    if (data) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    }
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Failed to load app settings:', error);
    return DEFAULT_SETTINGS;
  }
}

// ============================================================================
// SYNC TRACKING
// ============================================================================

/**
 * Record when data was last synced from the device
 */
export async function recordLastSync(): Promise<void> {
  try {
    await storageBackend.setItem(
      StorageKeys.LAST_SYNC,
      new Date().toISOString()
    );
  } catch (error) {
    console.error('Failed to record last sync:', error);
  }
}

/**
 * Get the last sync timestamp
 */
export async function getLastSyncTime(): Promise<string | null> {
  try {
    return await storageBackend.getItem(StorageKeys.LAST_SYNC);
  } catch (error) {
    console.error('Failed to get last sync time:', error);
    return null;
  }
}

// ============================================================================
// DATA EXPORT
// ============================================================================

/**
 * Export all HRV data as JSON string
 */
export async function exportDataAsJSON(): Promise<string> {
  const readings = await getAllHRVReadings();
  const profile = await loadUserProfile();
  
  const exportData = {
    exportedAt: new Date().toISOString(),
    profile: profile ? {
      pregnancyStartDate: profile.pregnancyStartDate,
      estimatedDueDate: profile.estimatedDueDate
    } : null,
    readings
  };
  
  return JSON.stringify(exportData, null, 2);
}

/**
 * Export HRV data as CSV string
 */
export async function exportDataAsCSV(): Promise<string> {
  const readings = await getAllHRVReadings();
  
  const header = 'Date,HRV (ms),Gestational Week,Gestational Day,Source\n';
  const rows = readings.map(r => 
    `${r.timestamp},${r.hrvValue},${r.gestationalWeek},${r.gestationalDay},${r.source}`
  ).join('\n');
  
  return header + rows;
}

type PrintToFileOptions = {
  html: string;
  base64?: boolean;
  width?: number;
  height?: number;
};

type PrintModule = {
  printToFileAsync: (options: PrintToFileOptions) => Promise<{ uri: string }>;
};

interface PDFExportContext {
  profile: UserProfile | null;
  readings: HRVReading[];
  analysis: HRVAnalysisResult | null;
  exportedAt: string;
}

const PDF_CHART_WIDTH = 720;
const PDF_CHART_HEIGHT = 240;
const PDF_CHART_PADDING_X = 48;
const PDF_CHART_PADDING_Y = 28;

declare const require: (moduleName: string) => unknown;

function loadPrintModule(): PrintModule {
  return require('expo-print') as PrintModule;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDisplayDate(timestamp: string): string {
  return format(parseISO(timestamp), 'MMM d, yyyy');
}

function getFallbackDueDate(readings: HRVReading[]): string {
  if (readings.length === 0) {
    return new Date().toISOString();
  }

  const latest = readings.reduce((currentLatest, reading) =>
    new Date(reading.timestamp).getTime() > new Date(currentLatest.timestamp).getTime()
      ? reading
      : currentLatest
  );

  const dueDate = new Date(latest.timestamp);
  dueDate.setDate(dueDate.getDate() + Math.max(0, 40 - latest.gestationalWeek) * 7);
  return dueDate.toISOString();
}

function buildChartPath(readings: HRVReading[]): string {
  if (readings.length === 0) {
    return '';
  }

  if (readings.length === 1) {
    const centerX = PDF_CHART_WIDTH / 2;
    const centerY = PDF_CHART_HEIGHT / 2;
    return `M ${centerX} ${centerY}`;
  }

  const values = readings.map(reading => reading.hrvValue);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const yRange = maxValue - minValue || 1;
  const xStep = (PDF_CHART_WIDTH - PDF_CHART_PADDING_X * 2) / (readings.length - 1);
  const yScale = (PDF_CHART_HEIGHT - PDF_CHART_PADDING_Y * 2) / yRange;

  return readings
    .map((reading, index) => {
      const x = PDF_CHART_PADDING_X + xStep * index;
      const y =
        PDF_CHART_HEIGHT - PDF_CHART_PADDING_Y - (reading.hrvValue - minValue) * yScale;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

function buildChartSvg(readings: HRVReading[]): string {
  if (readings.length === 0) {
    return `
      <div class="empty-state">
        No HRV readings are available yet, so the chart could not be generated.
      </div>
    `;
  }

  const values = readings.map(reading => reading.hrvValue);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const firstReading = readings[0];
  const lastReading = readings[readings.length - 1];

  return `
    <svg viewBox="0 0 ${PDF_CHART_WIDTH} ${PDF_CHART_HEIGHT}" class="chart" role="img" aria-label="HRV trend chart">
      <rect x="0" y="0" width="${PDF_CHART_WIDTH}" height="${PDF_CHART_HEIGHT}" rx="18" fill="#FFFFFF" />
      <line x1="${PDF_CHART_PADDING_X}" y1="${PDF_CHART_PADDING_Y}" x2="${PDF_CHART_PADDING_X}" y2="${PDF_CHART_HEIGHT - PDF_CHART_PADDING_Y}" stroke="${COLORS.chartGrid}" stroke-width="2" />
      <line x1="${PDF_CHART_PADDING_X}" y1="${PDF_CHART_HEIGHT - PDF_CHART_PADDING_Y}" x2="${PDF_CHART_WIDTH - PDF_CHART_PADDING_X}" y2="${PDF_CHART_HEIGHT - PDF_CHART_PADDING_Y}" stroke="${COLORS.chartGrid}" stroke-width="2" />
      <path d="${buildChartPath(readings)}" fill="none" stroke="${COLORS.chartLine}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
      <text x="${PDF_CHART_PADDING_X}" y="20" class="chart-label">Min ${minValue.toFixed(1)} ms</text>
      <text x="${PDF_CHART_WIDTH - PDF_CHART_PADDING_X}" y="20" text-anchor="end" class="chart-label">Max ${maxValue.toFixed(1)} ms</text>
      <text x="${PDF_CHART_PADDING_X}" y="${PDF_CHART_HEIGHT - 8}" class="chart-label">${escapeHtml(formatDisplayDate(firstReading.timestamp))}</text>
      <text x="${PDF_CHART_WIDTH - PDF_CHART_PADDING_X}" y="${PDF_CHART_HEIGHT - 8}" text-anchor="end" class="chart-label">${escapeHtml(formatDisplayDate(lastReading.timestamp))}</text>
    </svg>
  `;
}

function buildRecommendations(analysis: HRVAnalysisResult | null): string[] {
  if (!analysis) {
    return [
      'Continue collecting readings consistently to unlock analysis trends.',
      'Review the report with your care team if you notice sudden changes in symptoms.',
    ];
  }

  return [
    analysis.recommendation ?? 'Continue following your current monitoring plan.',
    analysis.predictedDeliveryWindow
      ? `Predicted delivery window: ${formatDisplayDate(analysis.predictedDeliveryWindow.earliest)} to ${formatDisplayDate(analysis.predictedDeliveryWindow.latest)}.`
      : 'Prediction window is not yet available because more trend data is needed.',
  ];
}

function buildPDFReportHtml(context: PDFExportContext): string {
  const { profile, readings, analysis, exportedAt } = context;
  const latestReading = readings[readings.length - 1] ?? null;
  const recommendations = buildRecommendations(analysis);
  const summary = analysis ? getStatusSummary(analysis) : 'More HRV readings are needed before analysis can be included in the report.';

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Labor Cue HRV Report</title>
        <style>
          body {
            font-family: Helvetica, Arial, sans-serif;
            color: #212121;
            margin: 0;
            padding: 32px;
            background: #f7f7fb;
          }
          .report {
            background: #ffffff;
            border: 1px solid #e0e0e0;
            border-radius: 20px;
            padding: 32px;
          }
          h1, h2 {
            margin: 0 0 12px;
          }
          h1 {
            color: ${COLORS.primaryDark};
            font-size: 28px;
          }
          h2 {
            font-size: 18px;
            color: ${COLORS.textPrimary};
            margin-top: 28px;
          }
          p, li {
            font-size: 14px;
            line-height: 1.5;
          }
          .meta-grid {
            display: table;
            width: 100%;
            margin-top: 20px;
          }
          .meta-row {
            display: table-row;
          }
          .meta-cell {
            display: table-cell;
            padding: 8px 12px 8px 0;
            vertical-align: top;
          }
          .meta-label {
            color: ${COLORS.textSecondary};
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }
          .meta-value {
            font-size: 15px;
            font-weight: 600;
          }
          .chart {
            width: 100%;
            margin-top: 16px;
          }
          .chart-label {
            fill: ${COLORS.textSecondary};
            font-size: 12px;
          }
          .summary-card {
            background: ${COLORS.backgroundSecondary};
            border-left: 6px solid ${COLORS.primary};
            border-radius: 12px;
            padding: 18px 20px;
            margin-top: 16px;
          }
          .empty-state {
            padding: 24px;
            border-radius: 12px;
            background: ${COLORS.backgroundSecondary};
            margin-top: 16px;
            color: ${COLORS.textSecondary};
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 16px;
            font-size: 13px;
          }
          th, td {
            border-bottom: 1px solid #ececf2;
            padding: 10px 8px;
            text-align: left;
          }
          th {
            color: ${COLORS.textSecondary};
            text-transform: uppercase;
            font-size: 12px;
            letter-spacing: 0.06em;
          }
        </style>
      </head>
      <body>
        <div class="report">
          <h1>Labor Cue HRV Report</h1>
          <p>Exported on ${escapeHtml(formatDisplayDate(exportedAt))}</p>

          <div class="meta-grid">
            <div class="meta-row">
              <div class="meta-cell">
                <div class="meta-label">Profile</div>
                <div class="meta-value">${escapeHtml(profile?.name || 'Patient')}</div>
              </div>
              <div class="meta-cell">
                <div class="meta-label">Due Date</div>
                <div class="meta-value">${escapeHtml(profile ? formatDisplayDate(profile.estimatedDueDate) : 'Not provided')}</div>
              </div>
              <div class="meta-cell">
                <div class="meta-label">Readings</div>
                <div class="meta-value">${readings.length}</div>
              </div>
              <div class="meta-cell">
                <div class="meta-label">Latest Reading</div>
                <div class="meta-value">${latestReading ? `${latestReading.hrvValue.toFixed(1)} ms` : 'N/A'}</div>
              </div>
            </div>
          </div>

          <h2>HRV Chart</h2>
          ${buildChartSvg(readings)}

          <h2>Analysis Summary</h2>
          <div class="summary-card">
            <p>${escapeHtml(summary)}</p>
          </div>

          <h2>Recommendations</h2>
          <ul>
            ${recommendations.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
          </ul>

          <h2>Recent Readings</h2>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Week</th>
                <th>Day</th>
                <th>HRV</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              ${readings.slice(-10).reverse().map(reading => `
                <tr>
                  <td>${escapeHtml(formatDisplayDate(reading.timestamp))}</td>
                  <td>${reading.gestationalWeek}</td>
                  <td>${reading.gestationalDay}</td>
                  <td>${reading.hrvValue.toFixed(1)} ms</td>
                  <td>${escapeHtml(reading.source)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </body>
    </html>
  `;
}

export async function exportDataAsPDF(): Promise<string> {
  const readings = await getAllHRVReadings();
  const profile = await loadUserProfile();
  const exportedAt = new Date().toISOString();
  const analysis = readings.length > 0
    ? analyzeHRV(readings, profile?.estimatedDueDate ?? getFallbackDueDate(readings))
    : null;
  const html = buildPDFReportHtml({
    profile,
    readings,
    analysis,
    exportedAt,
  });

  const printModule = loadPrintModule();
  const result = await printModule.printToFileAsync({
    html,
    base64: false,
    width: 612,
    height: 792,
  });

  return result.uri;
}

export const __testables = {
  buildChartPath,
  buildChartSvg,
  buildPDFReportHtml,
  buildRecommendations,
  getFallbackDueDate,
};

// STORY-502 start: add cloud backup upload/download helpers here (opt-in
// flow, encryption, and restore).

// ============================================================================
// RESET/CLEAR
// ============================================================================

/**
 * Clear all app data (for reset functionality)
 */
export async function clearAllData(): Promise<void> {
  try {
    // Clear AsyncStorage
    await storageBackend.multiRemove([
      StorageKeys.USER_PROFILE,
      StorageKeys.APP_SETTINGS,
      StorageKeys.LAST_SYNC
    ]);
    
    // Clear SQLite database
    await deleteAllHRVReadings();
    
    console.log('All data cleared successfully');
  } catch (error) {
    console.error('Failed to clear all data:', error);
    throw error;
  }
}
