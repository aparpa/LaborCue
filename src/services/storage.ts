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
  StorageKeys
} from '../types';
import { DATABASE_NAME, MAX_STORED_READINGS } from '../constants';

type ImportedReadingCandidate = Partial<Omit<HRVReading, 'id'>> & {
  date?: string;
  hrv?: number | string;
  hrvMs?: number | string;
  hrvValue?: number | string;
  gestationalWeek?: number | string;
  gestationalDay?: number | string;
  source?: string;
  metadata?: HRVReading['metadata'];
};

type ImportedJsonPayload = {
  readings?: ImportedReadingCandidate[];
};

const VALID_SOURCES: HRVReading['source'][] = ['manual', 'device', 'imported'];

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
  validateImportedReadings(readings);

  const savedReadings: HRVReading[] = [];
  
  for (const reading of readings) {
    const saved = await saveHRVReading(reading);
    savedReadings.push(saved);
  }
  
  return savedReadings;
}

/**
 * Import HRV readings from a JSON payload string.
 * Supports either an array of readings or an object with a `readings` array.
 */
export async function importDataFromJSON(jsonData: string): Promise<HRVReading[]> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonData);
  } catch (error) {
    throw new Error('Invalid JSON import payload.');
  }

  const rawReadings = Array.isArray(parsed)
    ? parsed
    : isImportedJsonPayload(parsed)
      ? parsed.readings
      : undefined;

  if (!rawReadings || rawReadings.length === 0) {
    throw new Error('No readings found in JSON import.');
  }

  const normalizedReadings = rawReadings.map((reading, index) =>
    normalizeImportedReading(reading, `JSON row ${index + 1}`)
  );

  return saveMultipleHRVReadings(normalizedReadings);
}

/**
 * Import HRV readings from a CSV payload string.
 * Expected columns include timestamp/date, HRV, gestational week/day, and optional source.
 */
export async function importDataFromCSV(csvData: string): Promise<HRVReading[]> {
  const lines = csvData
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error('CSV import must include a header row and at least one reading.');
  }

  const headerCells = parseCsvLine(lines[0]).map(normalizeCsvHeader);
  const normalizedReadings = lines.slice(1).map((line, index) => {
    const cells = parseCsvLine(line);
    const readingObject = headerCells.reduce<Record<string, string>>((accumulator, header, cellIndex) => {
      accumulator[header] = cells[cellIndex] ?? '';
      return accumulator;
    }, {});

    return normalizeImportedReading(readingObject, `CSV row ${index + 2}`);
  });

  return saveMultipleHRVReadings(normalizedReadings);
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

function isImportedJsonPayload(value: unknown): value is ImportedJsonPayload {
  return typeof value === 'object' && value !== null && 'readings' in value;
}

function normalizeImportedReading(
  rawReading: ImportedReadingCandidate,
  contextLabel: string
): Omit<HRVReading, 'id'> {
  const timestampValue = rawReading.timestamp ?? rawReading.date;
  const hrvValueCandidate = rawReading.hrvValue ?? rawReading.hrv ?? rawReading.hrvMs;
  const timestamp = normalizeTimestamp(timestampValue, contextLabel);
  const hrvValue = parseFiniteNumber(hrvValueCandidate, `${contextLabel}: HRV value`);
  const gestationalWeek = parseInteger(
    rawReading.gestationalWeek,
    `${contextLabel}: gestational week`
  );
  const gestationalDay = parseInteger(
    rawReading.gestationalDay,
    `${contextLabel}: gestational day`
  );
  const source = normalizeSource(rawReading.source);

  const normalizedReading: Omit<HRVReading, 'id'> = {
    timestamp,
    hrvValue,
    gestationalWeek,
    gestationalDay,
    source,
  };

  if (rawReading.metadata) {
    normalizedReading.metadata = rawReading.metadata;
  }

  validateImportedReadings([normalizedReading]);

  return normalizedReading;
}

function validateImportedReadings(readings: Omit<HRVReading, 'id'>[]): void {
  readings.forEach((reading, index) => {
    const contextLabel = `Reading ${index + 1}`;

    normalizeTimestamp(reading.timestamp, `${contextLabel}: timestamp`);

    if (!Number.isFinite(reading.hrvValue) || reading.hrvValue <= 0) {
      throw new Error(`${contextLabel}: HRV value must be a positive number.`);
    }

    if (!Number.isInteger(reading.gestationalWeek) || reading.gestationalWeek < 0 || reading.gestationalWeek > 42) {
      throw new Error(`${contextLabel}: gestational week must be an integer between 0 and 42.`);
    }

    if (!Number.isInteger(reading.gestationalDay) || reading.gestationalDay < 0 || reading.gestationalDay > 6) {
      throw new Error(`${contextLabel}: gestational day must be an integer between 0 and 6.`);
    }

    if (!VALID_SOURCES.includes(reading.source)) {
      throw new Error(`${contextLabel}: source must be manual, device, or imported.`);
    }
  });
}

function normalizeTimestamp(value: unknown, contextLabel: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${contextLabel} is required.`);
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error(`${contextLabel} must be a valid date.`);
  }

  return parsedDate.toISOString();
}

function parseFiniteNumber(value: unknown, contextLabel: string): number {
  const parsedValue = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value.trim())
      : NaN;

  if (!Number.isFinite(parsedValue)) {
    throw new Error(`${contextLabel} must be a valid number.`);
  }

  return parsedValue;
}

function parseInteger(value: unknown, contextLabel: string): number {
  const parsedValue = parseFiniteNumber(value, contextLabel);

  if (!Number.isInteger(parsedValue)) {
    throw new Error(`${contextLabel} must be a whole number.`);
  }

  return parsedValue;
}

function normalizeSource(source: unknown): HRVReading['source'] {
  if (typeof source !== 'string' || source.trim().length === 0) {
    return 'imported';
  }

  const normalizedSource = source.trim().toLowerCase();
  if (VALID_SOURCES.includes(normalizedSource as HRVReading['source'])) {
    return normalizedSource as HRVReading['source'];
  }

  throw new Error('Source must be manual, device, or imported.');
}

function normalizeCsvHeader(header: string): string {
  const normalized = header.trim().toLowerCase();

  switch (normalized) {
    case 'date':
    case 'timestamp':
      return 'timestamp';
    case 'hrv (ms)':
    case 'hrv':
    case 'hrv value':
    case 'hrv_value':
    case 'hrvms':
      return 'hrvValue';
    case 'gestational week':
    case 'gestational_week':
      return 'gestationalWeek';
    case 'gestational day':
    case 'gestational_day':
      return 'gestationalDay';
    case 'source':
      return 'source';
    default:
      return header.trim();
  }
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let currentValue = '';
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        currentValue += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (character === ',' && !insideQuotes) {
      values.push(currentValue.trim());
      currentValue = '';
      continue;
    }

    currentValue += character;
  }

  values.push(currentValue.trim());

  return values;
}

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
