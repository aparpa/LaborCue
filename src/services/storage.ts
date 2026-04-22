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
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as SQLite from 'expo-sqlite';
import { v4 as uuidv4 } from 'uuid';
import {
  UserProfile,
  HRVReading,
  AppSettings,
  StorageKeys
} from '../types';
import { DATABASE_NAME, MAX_STORED_READINGS, VALID_HRV_RANGE } from '../constants';
import {
  calculateGestationalDay,
  calculateGestationalWeek,
  parseFlexibleDate,
} from '../utils/dateUtils';

// ============================================================================
// DATABASE INITIALIZATION
// ============================================================================

let db: SQLite.SQLiteDatabase | null = null;

type ImportFormat = 'csv' | 'json';

type ImportedReadingInput = Partial<Omit<HRVReading, 'id' | 'source'>> & {
  source?: string;
};

export interface ImportHRVDataResult {
  format: ImportFormat;
  importedCount: number;
  skippedCount: number;
  readings: HRVReading[];
  errors: string[];
  fileName?: string;
}

interface ParsedImportResult {
  validReadings: Omit<HRVReading, 'id'>[];
  errors: string[];
}

const CSV_HEADER_ALIASES: Record<string, string> = {
  date: 'timestamp',
  datetime: 'timestamp',
  time: 'timestamp',
  recordedat: 'timestamp',
  recorded_at: 'timestamp',
  timestamp: 'timestamp',
  hrv: 'hrvValue',
  hrvms: 'hrvValue',
  'hrv(ms)': 'hrvValue',
  'hrv_ms': 'hrvValue',
  rmssd: 'hrvValue',
  value: 'hrvValue',
  hrvvalue: 'hrvValue',
  gestationalweek: 'gestationalWeek',
  gestational_week: 'gestationalWeek',
  week: 'gestationalWeek',
  gestationalday: 'gestationalDay',
  gestational_day: 'gestationalDay',
  day: 'gestationalDay',
  source: 'source',
  metadata: 'metadata',
  notes: 'notes',
  deviceid: 'deviceId',
  device_id: 'deviceId',
  sleepduration: 'sleepDuration',
  sleep_duration: 'sleepDuration',
  sleepquality: 'sleepQuality',
  sleep_quality: 'sleepQuality',
};

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
 * Import HRV readings from a user-selected CSV or JSON file.
 */
export async function importHRVDataFromFile(): Promise<ImportHRVDataResult> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['text/csv', 'text/plain', 'application/json', 'text/json'],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || result.assets.length === 0) {
    return {
      format: 'json',
      importedCount: 0,
      skippedCount: 0,
      readings: [],
      errors: ['Import cancelled'],
    };
  }

  const asset = result.assets[0];
  const format = detectImportFormat(asset.name, asset.mimeType);
  const rawData = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const imported = await importHRVData(rawData, format);
  return {
    ...imported,
    fileName: asset.name,
  };
}

/**
 * Import HRV readings from raw CSV or JSON content.
 */
export async function importHRVData(
  rawData: string,
  format: ImportFormat
): Promise<ImportHRVDataResult> {
  const profile = await loadUserProfile();
  const existingReadings = await getAllHRVReadings();
  const existingKeys = new Set(existingReadings.map(buildReadingDedupKey));

  const parsed = parseImportedHRVData(rawData, format, profile ?? undefined);
  const dedupedReadings: Omit<HRVReading, 'id'>[] = [];
  const errors = [...parsed.errors];

  for (const reading of parsed.validReadings) {
    const dedupKey = buildReadingDedupKey(reading);
    if (existingKeys.has(dedupKey)) {
      errors.push(`Skipped duplicate reading for ${reading.timestamp}.`);
      continue;
    }

    existingKeys.add(dedupKey);
    dedupedReadings.push(reading);
  }

  const savedReadings = await saveMultipleHRVReadings(dedupedReadings);

  return {
    format,
    importedCount: savedReadings.length,
    skippedCount: errors.length,
    readings: savedReadings,
    errors,
  };
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
  dataRetentionDays: 365,
  hasSeenHomeCoachMarks: false,
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

function detectImportFormat(fileName?: string, mimeType?: string | null): ImportFormat {
  const normalizedName = fileName?.toLowerCase() ?? '';
  const normalizedMime = mimeType?.toLowerCase() ?? '';

  if (normalizedName.endsWith('.csv') || normalizedMime.includes('csv')) {
    return 'csv';
  }

  return 'json';
}

function parseImportedHRVData(
  rawData: string,
  format: ImportFormat,
  profile?: UserProfile
): ParsedImportResult {
  const records = format === 'csv'
    ? parseCSVRecords(rawData)
    : parseJSONRecords(rawData);

  const validReadings: Omit<HRVReading, 'id'>[] = [];
  const errors: string[] = [];

  records.forEach((record, index) => {
    try {
      validReadings.push(normalizeImportedReading(record, profile));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown import error';
      errors.push(`Row ${index + 1}: ${message}`);
    }
  });

  return { validReadings, errors };
}

function parseJSONRecords(rawData: string): ImportedReadingInput[] {
  const parsed = JSON.parse(rawData) as unknown;

  if (Array.isArray(parsed)) {
    return parsed as ImportedReadingInput[];
  }

  if (parsed && typeof parsed === 'object') {
    const candidate = parsed as { readings?: unknown };
    if (Array.isArray(candidate.readings)) {
      return candidate.readings as ImportedReadingInput[];
    }
  }

  throw new Error('JSON import must be an array of readings or an object with a readings array.');
}

function parseCSVRecords(rawData: string): ImportedReadingInput[] {
  const lines = rawData
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter(line => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error('CSV import must include a header row and at least one data row.');
  }

  const headers = parseCSVLine(lines[0]).map(normalizeCSVHeader);
  const records: ImportedReadingInput[] = [];

  for (const line of lines.slice(1)) {
    const values = parseCSVLine(line);
    const record: ImportedReadingInput = {};

    headers.forEach((header, index) => {
      const value = values[index]?.trim();
      if (!header || value === undefined || value === '') {
        return;
      }

      if (header === 'notes' || header === 'deviceId' || header === 'sleepDuration' || header === 'sleepQuality') {
        const metadata = typeof record.metadata === 'object' && record.metadata !== null
          ? record.metadata
          : {};
        (metadata as Record<string, unknown>)[header] = value;
        record.metadata = metadata;
        return;
      }

      (record as Record<string, unknown>)[header] = value;
    });

    records.push(record);
  }

  return records;
}

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function normalizeCSVHeader(header: string): string {
  const compact = header.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9_()]/g, '');
  return CSV_HEADER_ALIASES[compact] ?? header.trim();
}

function normalizeImportedReading(
  record: ImportedReadingInput,
  profile?: UserProfile
): Omit<HRVReading, 'id'> {
  if (!record || typeof record !== 'object') {
    throw new Error('Reading must be an object.');
  }

  const timestamp = normalizeTimestamp(record.timestamp);
  const hrvValue = normalizeHRVValue(record.hrvValue);
  const metadata = normalizeMetadata(record.metadata);
  const gestationalAge = normalizeGestationalAge(record, timestamp, profile);

  return {
    timestamp,
    hrvValue,
    gestationalWeek: gestationalAge.gestationalWeek,
    gestationalDay: gestationalAge.gestationalDay,
    source: 'imported',
    metadata,
  };
}

function normalizeTimestamp(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('Missing timestamp/date.');
  }

  const parsed = parseFlexibleDate(value.trim()) ?? new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid timestamp "${String(value)}".`);
  }

  return parsed.toISOString();
}

function normalizeHRVValue(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error('Missing or invalid HRV value.');
  }

  if (parsed < VALID_HRV_RANGE.min || parsed > VALID_HRV_RANGE.max) {
    throw new Error(
      `HRV value ${parsed} is outside the supported range (${VALID_HRV_RANGE.min}-${VALID_HRV_RANGE.max}).`
    );
  }

  return parsed;
}

function normalizeGestationalAge(
  record: ImportedReadingInput,
  timestamp: string,
  profile?: UserProfile
): { gestationalWeek: number; gestationalDay: number } {
  const gestationalWeek = normalizeInteger(record.gestationalWeek);
  const gestationalDay = normalizeInteger(record.gestationalDay);

  if (gestationalWeek !== null && gestationalDay !== null) {
    validateGestationalAge(gestationalWeek, gestationalDay);
    return { gestationalWeek, gestationalDay };
  }

  if (!profile) {
    throw new Error('Missing gestational age and no profile is available to calculate it.');
  }

  const timestampDate = new Date(timestamp);
  const calculatedWeek = calculateGestationalWeek(profile.pregnancyStartDate, timestampDate);
  const calculatedDay = calculateGestationalDay(profile.pregnancyStartDate, timestampDate);
  validateGestationalAge(calculatedWeek, calculatedDay);

  return {
    gestationalWeek: calculatedWeek,
    gestationalDay: calculatedDay,
  };
}

function normalizeInteger(value: unknown): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function validateGestationalAge(gestationalWeek: number, gestationalDay: number): void {
  if (gestationalWeek < 0 || gestationalWeek > 45) {
    throw new Error(`Gestational week ${gestationalWeek} is out of range.`);
  }

  if (gestationalDay < 0 || gestationalDay > 6) {
    throw new Error(`Gestational day ${gestationalDay} must be between 0 and 6.`);
  }
}

function normalizeMetadata(value: unknown): HRVReading['metadata'] | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as HRVReading['metadata'];
    } catch {
      return { notes: value };
    }
  }

  if (typeof value === 'object') {
    const metadata = { ...(value as Record<string, unknown>) };
    if (metadata.sleepDuration !== undefined) {
      metadata.sleepDuration = Number(metadata.sleepDuration);
    }
    if (metadata.sleepQuality !== undefined) {
      metadata.sleepQuality = Number(metadata.sleepQuality);
    }
    return metadata as HRVReading['metadata'];
  }

  return undefined;
}

function buildReadingDedupKey(reading: Omit<HRVReading, 'id'> | HRVReading): string {
  return [
    new Date(reading.timestamp).toISOString(),
    reading.hrvValue.toFixed(4),
    reading.gestationalWeek,
    reading.gestationalDay,
  ].join('|');
}

export const __testables = {
  detectImportFormat,
  parseImportedHRVData,
  parseCSVLine,
  parseCSVRecords,
  parseJSONRecords,
  normalizeImportedReading,
  buildReadingDedupKey,
};

// STORY-506 start: add PDF export generation here, reusing the chart
// rendering/data used on the Data screen.

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
