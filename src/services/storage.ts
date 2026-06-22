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

import * as SQLite from 'expo-sqlite';
import { v4 as uuidv4 } from 'uuid';
import {
  UserProfile,
  HRVReading,
  AppSettings,
  StorageKeys
} from '../types';
import { DATABASE_NAME, MAX_STORED_READINGS } from '../constants';

const BACKUP_FORMAT_VERSION = 1;
const DEFAULT_BACKUP_FILENAME = 'labor-cue-backup.json';

type FileSystemModule = {
  cacheDirectory?: string | null;
  documentDirectory?: string | null;
  writeAsStringAsync: (
    uri: string,
    contents: string,
    options?: { encoding?: string }
  ) => Promise<void>;
  readAsStringAsync: (
    uri: string,
    options?: { encoding?: string }
  ) => Promise<string>;
  EncodingType?: {
    UTF8?: string;
  };
};

type SharingModule = {
  isAvailableAsync: () => Promise<boolean>;
  shareAsync: (
    uri: string,
    options?: {
      mimeType?: string;
      dialogTitle?: string;
      UTI?: string;
    }
  ) => Promise<void>;
};

type DocumentPickerResult =
  | {
      canceled: true;
      assets?: undefined;
    }
  | {
      canceled: false;
      assets: Array<{
        uri: string;
        name?: string;
        mimeType?: string | null;
      }>;
    };

type DocumentPickerModule = {
  getDocumentAsync: (options?: {
    type?: string | string[];
    copyToCacheDirectory?: boolean;
    multiple?: boolean;
  }) => Promise<DocumentPickerResult>;
};

type AsyncStorageModule = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  multiRemove: (keys: string[]) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
  default?: AsyncStorageModule;
};

export interface CloudBackupPayload {
  version: number;
  exportedAt: string;
  profile: UserProfile | null;
  settings: AppSettings;
  lastSync: string | null;
  readings: HRVReading[];
}

export interface CloudBackupResult {
  fileUri: string;
  fileName: string;
  exportedAt: string;
  deliveryMethod: 'share_sheet';
}

export interface CloudRestoreResult {
  restored: boolean;
  importedAt?: string;
  fileName?: string;
  readingCount?: number;
}

declare const require: (moduleName: string) => unknown;

function getFileSystemModule(): FileSystemModule {
  return require('expo-file-system') as FileSystemModule;
}

function getSharingModule(): SharingModule {
  return require('expo-sharing') as SharingModule;
}

function getDocumentPickerModule(): DocumentPickerModule {
  return require('expo-document-picker') as DocumentPickerModule;
}

function getAsyncStorageModule(): AsyncStorageModule {
  const module = require('@react-native-async-storage/async-storage') as AsyncStorageModule & {
    default?: AsyncStorageModule & { default?: AsyncStorageModule };
  };

  if (module.getItem) {
    return module;
  }

  if (module.default?.getItem) {
    return module.default;
  }

  if (module.default?.default?.getItem) {
    return module.default.default;
  }

  throw new Error('AsyncStorage module is unavailable.');
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
    const storage = getAsyncStorageModule();
    const updatedProfile: UserProfile = {
      ...profile,
      updatedAt: new Date().toISOString()
    };
    await storage.setItem(
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
    const storage = getAsyncStorageModule();
    const data = await storage.getItem(StorageKeys.USER_PROFILE);
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
  dataRetentionDays: 365,
  hasSeenHomeCoachMarks: false,
};

/**
 * Save app settings
 */
export async function saveAppSettings(settings: AppSettings): Promise<void> {
  try {
    const storage = getAsyncStorageModule();
    await storage.setItem(
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
    const storage = getAsyncStorageModule();
    const data = await storage.getItem(StorageKeys.APP_SETTINGS);
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
    const storage = getAsyncStorageModule();
    await storage.setItem(
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
    const storage = getAsyncStorageModule();
    return await storage.getItem(StorageKeys.LAST_SYNC);
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

// STORY-506 start: add PDF export generation here, reusing the chart
// rendering/data used on the Data screen.

function getBackupDirectory(): string {
  const fileSystem = getFileSystemModule();
  const baseDirectory = fileSystem.cacheDirectory || fileSystem.documentDirectory;

  if (!baseDirectory) {
    throw new Error('Cloud backup directory is unavailable.');
  }

  return baseDirectory;
}

export async function createCloudBackupPayload(): Promise<CloudBackupPayload> {
  const [profile, settings, lastSync, readings] = await Promise.all([
    loadUserProfile(),
    loadAppSettings(),
    getLastSyncTime(),
    getAllHRVReadings(),
  ]);

  return {
    version: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    profile,
    settings,
    lastSync,
    readings,
  };
}

export function serializeCloudBackup(payload: CloudBackupPayload): string {
  return JSON.stringify(payload, null, 2);
}

function assertValidCloudBackupPayload(
  payload: Partial<CloudBackupPayload>
): asserts payload is CloudBackupPayload {
  if (
    typeof payload.version !== 'number' ||
    typeof payload.exportedAt !== 'string' ||
    !Array.isArray(payload.readings) ||
    typeof payload.settings !== 'object' ||
    payload.settings === null
  ) {
    throw new Error('Invalid cloud backup file.');
  }
}

function getFileNameFromUri(uri: string): string {
  const segments = uri.split('/');
  return segments[segments.length - 1] || DEFAULT_BACKUP_FILENAME;
}

async function replaceLocalDataWithBackup(payload: CloudBackupPayload): Promise<void> {
  const storage = getAsyncStorageModule();
  await deleteAllHRVReadings();

  if (payload.profile) {
    await saveUserProfile(payload.profile);
  } else {
    await storage.removeItem(StorageKeys.USER_PROFILE);
  }

  await saveAppSettings(payload.settings);

  if (payload.lastSync) {
    await storage.setItem(StorageKeys.LAST_SYNC, payload.lastSync);
  } else {
    await storage.removeItem(StorageKeys.LAST_SYNC);
  }

  if (payload.readings.length > 0) {
    await saveMultipleHRVReadings(
      payload.readings.map(({ id: _id, ...reading }) => reading)
    );
  }
}

export async function backupDataToCloud(
  options?: {
    fileName?: string;
    privacyAcknowledged?: boolean;
  }
): Promise<CloudBackupResult> {
  if (!options?.privacyAcknowledged) {
    throw new Error('Cloud backup requires explicit privacy acknowledgement.');
  }

  const fileSystem = getFileSystemModule();
  const sharing = getSharingModule();
  const payload = await createCloudBackupPayload();
  const fileName = options.fileName || DEFAULT_BACKUP_FILENAME;
  const fileUri = `${getBackupDirectory()}${fileName}`;

  await fileSystem.writeAsStringAsync(fileUri, serializeCloudBackup(payload), {
    encoding: fileSystem.EncodingType?.UTF8,
  });

  const canShare = await sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Cloud backup sharing is unavailable on this device.');
  }

  await sharing.shareAsync(fileUri, {
    mimeType: 'application/json',
    dialogTitle: 'Save backup to iCloud Drive or Google Drive',
    UTI: 'public.json',
  });

  return {
    fileUri,
    fileName,
    exportedAt: payload.exportedAt,
    deliveryMethod: 'share_sheet',
  };
}

export async function restoreDataFromCloud(): Promise<CloudRestoreResult> {
  const documentPicker = getDocumentPickerModule();
  const fileSystem = getFileSystemModule();
  const selection = await documentPicker.getDocumentAsync({
    type: ['application/json', 'text/json'],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (selection.canceled) {
    return { restored: false };
  }

  const asset = selection.assets[0];
  const rawContents = await fileSystem.readAsStringAsync(asset.uri, {
    encoding: fileSystem.EncodingType?.UTF8,
  });
  const parsed = JSON.parse(rawContents) as Partial<CloudBackupPayload>;
  assertValidCloudBackupPayload(parsed);
  await replaceLocalDataWithBackup(parsed);

  return {
    restored: true,
    importedAt: new Date().toISOString(),
    fileName: asset.name || getFileNameFromUri(asset.uri),
    readingCount: parsed.readings.length,
  };
}

// ============================================================================
// RESET/CLEAR
// ============================================================================

/**
 * Clear all app data (for reset functionality)
 */
export async function clearAllData(): Promise<void> {
  try {
    const storage = getAsyncStorageModule();
    // Clear AsyncStorage
    await storage.multiRemove([
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
