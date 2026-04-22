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
import {
  UserProfile,
  HRVReading,
  AppSettings,
  StorageKeys,
  HRVAnalysisResult,
} from '../types';
import { DATABASE_NAME, MAX_STORED_READINGS } from '../constants';

declare const require: (moduleName: string) => unknown;

const PDF_PAGE_WIDTH = 612;
const PDF_PAGE_HEIGHT = 792;
const PDF_MARGIN = 48;
const PDF_CHART_LEFT = 80;
const PDF_CHART_RIGHT = PDF_PAGE_WIDTH - 72;
const PDF_CHART_BOTTOM = 390;
const PDF_CHART_TOP = 590;

type FileSystemModule = {
  cacheDirectory?: string | null;
  EncodingType?: { UTF8?: string };
  writeAsStringAsync?: (
    uri: string,
    contents: string,
    options?: { encoding?: string }
  ) => Promise<void>;
  default?: FileSystemModule;
};

type PdfChartPoint = {
  reading: HRVReading;
  x: number;
  y: number;
};

function getFileSystemApi(): FileSystemModule {
  const module = require('expo-file-system') as FileSystemModule;
  return module.writeAsStringAsync ? module : (module.default ?? {});
}

function escapePdfText(value: string): string {
  return value
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r?\n/g, ' ');
}

function formatPdfDate(value?: string): string {
  if (!value) {
    return 'Not available';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Not available';
  }

  return date.toISOString().slice(0, 10);
}

function humanizeEnumValue(value?: string): string {
  if (!value) {
    return 'Not available';
  }

  return value.replace(/_/g, ' ');
}

function wrapPdfText(value: string, maxChars = 72): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [''];
  }

  const lines: string[] = [];
  let currentLine = words[0];

  for (const word of words.slice(1)) {
    if ((currentLine + ' ' + word).length <= maxChars) {
      currentLine += ' ' + word;
      continue;
    }

    lines.push(currentLine);
    currentLine = word;
  }

  lines.push(currentLine);
  return lines;
}

function getPdfChartPoints(readings: HRVReading[]): PdfChartPoint[] {
  if (readings.length === 0) {
    return [];
  }

  const values = readings.map((reading) => reading.hrvValue);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;

  return readings.map((reading, index) => ({
    reading,
    x: readings.length === 1
      ? (PDF_CHART_LEFT + PDF_CHART_RIGHT) / 2
      : PDF_CHART_LEFT + ((PDF_CHART_RIGHT - PDF_CHART_LEFT) * index) / (readings.length - 1),
    y: PDF_CHART_BOTTOM + ((reading.hrvValue - minValue) / range) * (PDF_CHART_TOP - PDF_CHART_BOTTOM),
  }));
}

function getInflectionPoint(
  analysis: HRVAnalysisResult | null | undefined,
  readings: HRVReading[]
): PdfChartPoint | null {
  if (!analysis?.inversionDetectedAt) {
    return null;
  }

  const threshold = new Date(analysis.inversionDetectedAt).getTime();
  if (Number.isNaN(threshold)) {
    return null;
  }

  return getPdfChartPoints(readings).find(
    (point) => new Date(point.reading.timestamp).getTime() >= threshold
  ) ?? null;
}

function buildPdfObject(index: number, body: string): string {
  return `${index} 0 obj\n${body}\nendobj\n`;
}

function buildPdfFile(objects: string[]): string {
  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  for (const object of objects) {
    offsets.push(pdf.length);
    pdf += object;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';

  for (const offset of offsets.slice(1)) {
    pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}

function buildPdfReportDocument(
  readings: HRVReading[],
  analysis: HRVAnalysisResult | null | undefined,
  profile: UserProfile | null
): string {
  const commands: string[] = [];
  const chartPoints = getPdfChartPoints(readings);
  const inflectionPoint = getInflectionPoint(analysis, readings);
  const latestReading = readings[readings.length - 1];
  const recommendation = analysis?.recommendation
    ?? analysis?.message
    ?? 'Continue tracking regularly and share this report with your provider if you have concerns.';

  const addText = (
    x: number,
    y: number,
    text: string,
    size = 12,
    font = 'F1',
    color = '0 0 0'
  ): void => {
    commands.push(
      `BT /${font} ${size} Tf ${color} rg 1 0 0 1 ${x} ${y} Tm (${escapePdfText(text)}) Tj ET`
    );
  };

  commands.push('0.96 0.97 0.99 rg');
  commands.push(`24 24 ${PDF_PAGE_WIDTH - 48} ${PDF_PAGE_HEIGHT - 48} re f`);

  addText(PDF_MARGIN, 744, 'Labor Cue HRV Report', 24, 'F2', '0.09 0.13 0.18');
  addText(PDF_MARGIN, 724, `Generated: ${formatPdfDate(new Date().toISOString())}`, 11, 'F1', '0.35 0.39 0.45');
  addText(
    PDF_MARGIN,
    708,
    `Due date: ${formatPdfDate(profile?.estimatedDueDate)}    Pregnancy start: ${formatPdfDate(profile?.pregnancyStartDate)}`,
    11,
    'F1',
    '0.35 0.39 0.45'
  );
  addText(PDF_MARGIN, 692, `Readings included: ${readings.length}`, 11, 'F1', '0.35 0.39 0.45');
  addText(
    PDF_MARGIN,
    676,
    `Analysis summary: ${analysis ? `${humanizeEnumValue(analysis.currentTrend)} trend - ${humanizeEnumValue(analysis.inversionStatus)} - ${analysis.confidence} confidence` : 'No analysis available yet'}`,
    11,
    'F1',
    '0.35 0.39 0.45'
  );

  commands.push('0.86 0.89 0.94 rg');
  commands.push(`${PDF_MARGIN} 364 ${PDF_PAGE_WIDTH - (PDF_MARGIN * 2)} 250 re f`);
  commands.push('0.78 0.82 0.88 RG 1 w');
  commands.push(`${PDF_CHART_LEFT} ${PDF_CHART_BOTTOM} m ${PDF_CHART_LEFT} ${PDF_CHART_TOP} l ${PDF_CHART_RIGHT} ${PDF_CHART_TOP} l S`);

  if (chartPoints.length === 0) {
    addText(PDF_CHART_LEFT, 476, 'No HRV readings available for this report.', 14, 'F1', '0.35 0.39 0.45');
  } else {
    const values = readings.map((reading) => reading.hrvValue);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const path = chartPoints
      .map((point, index) =>
        `${index === 0 ? 'm' : 'l'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
      )
      .join(' ');

    commands.push('0.42 0.31 0.90 RG 2.5 w');
    commands.push(path);
    commands.push('S');

    commands.push('0.42 0.31 0.90 rg');
    for (const point of chartPoints) {
      commands.push(`${(point.x - 2).toFixed(2)} ${(point.y - 2).toFixed(2)} 4 4 re f`);
    }

    if (inflectionPoint) {
      commands.push('0.89 0.27 0.23 RG 1.5 w [6 4] 0 d');
      commands.push(`${inflectionPoint.x.toFixed(2)} ${PDF_CHART_BOTTOM} m ${inflectionPoint.x.toFixed(2)} ${PDF_CHART_TOP} l S`);
      commands.push('[] 0 d');
      addText(inflectionPoint.x - 28, PDF_CHART_TOP + 10, 'Inflection', 10, 'F2', '0.89 0.27 0.23');
    }

    addText(PDF_CHART_LEFT - 28, PDF_CHART_TOP - 4, `${maxValue.toFixed(1)} ms`, 10, 'F1', '0.35 0.39 0.45');
    addText(PDF_CHART_LEFT - 28, PDF_CHART_BOTTOM - 4, `${minValue.toFixed(1)} ms`, 10, 'F1', '0.35 0.39 0.45');

    for (const point of chartPoints.filter((_, index) =>
      index === 0 || index === chartPoints.length - 1 || index % 3 === 0
    )) {
      addText(point.x - 10, PDF_CHART_BOTTOM - 18, `W${point.reading.gestationalWeek}`, 9, 'F1', '0.35 0.39 0.45');
    }
  }

  addText(PDF_MARGIN, 334, 'Clinical Summary', 14, 'F2', '0.09 0.13 0.18');
  addText(PDF_MARGIN, 316, `Latest reading: ${latestReading ? `${latestReading.hrvValue.toFixed(1)} ms on ${formatPdfDate(latestReading.timestamp)}` : 'Not available'}`, 11, 'F1', '0.18 0.20 0.24');
  addText(PDF_MARGIN, 300, `Current status: ${analysis ? humanizeEnumValue(analysis.inversionStatus) : 'Not available'}`, 11, 'F1', '0.18 0.20 0.24');
  addText(PDF_MARGIN, 284, `Trend confidence: ${analysis?.confidence ?? 'Not available'}`, 11, 'F1', '0.18 0.20 0.24');
  addText(PDF_MARGIN, 256, 'Recommendation', 14, 'F2', '0.09 0.13 0.18');

  let recommendationY = 238;
  for (const line of wrapPdfText(recommendation)) {
    addText(PDF_MARGIN, recommendationY, line, 11, 'F1', '0.18 0.20 0.24');
    recommendationY -= 14;
  }

  const content = commands.join('\n');
  const objects = [
    buildPdfObject(1, '<< /Type /Catalog /Pages 2 0 R >>'),
    buildPdfObject(2, '<< /Type /Pages /Count 1 /Kids [3 0 R] >>'),
    buildPdfObject(
      3,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>`
    ),
    buildPdfObject(4, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`),
    buildPdfObject(5, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'),
    buildPdfObject(6, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'),
  ];

  return buildPdfFile(objects);
}

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
    await AsyncStorage.setItem(
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
    const data = await AsyncStorage.getItem(StorageKeys.USER_PROFILE);
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
    await AsyncStorage.setItem(
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
    const data = await AsyncStorage.getItem(StorageKeys.APP_SETTINGS);
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
    await AsyncStorage.setItem(
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
    return await AsyncStorage.getItem(StorageKeys.LAST_SYNC);
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

export async function exportDataAsPDF(
  readingsOverride?: HRVReading[],
  analysis?: HRVAnalysisResult | null
): Promise<string> {
  const fileSystemApi = getFileSystemApi();
  const writer = fileSystemApi.writeAsStringAsync;
  const cacheDirectory = fileSystemApi.cacheDirectory;

  if (!writer || !cacheDirectory) {
    throw new Error('PDF export directory is unavailable.');
  }

  const readings = readingsOverride ?? await getAllHRVReadings();
  const profile = await loadUserProfile();
  const pdf = buildPdfReportDocument(readings, analysis, profile);
  const uri = `${cacheDirectory}labor-cue-report-${Date.now()}.pdf`;

  await writer(uri, pdf, {
    encoding: fileSystemApi.EncodingType?.UTF8,
  });

  return uri;
}

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
    await AsyncStorage.multiRemove([
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

export const __testables = {
  buildPdfReportDocument,
};
