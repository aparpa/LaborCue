/**
 * Tests for UserContext optimistic updates (STORY-602).
 *
 * Verifies we:
 * - Apply an optimistic HRV reading immediately.
 * - Reconcile with saved data on success.
 * - Roll back and surface an error on failure.
 */

import React from 'react';
import { render, act } from '@testing-library/react-native';
import { UserProvider, useUser } from '../../src/context/UserContext';
import type { HRVAnalysisResult, HRVReading, UserProfile } from '../../src/types';
import { InversionStatus } from '../../src/types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockAnalysis: HRVAnalysisResult = {
  currentTrend: 'stable',
  inversionStatus: InversionStatus.ON_TRACK,
  confidence: 'low',
  lastAnalyzedAt: new Date().toISOString(),
  message: 'ok',
};

jest.mock('../../src/services/hrvAnalysis', () => ({
  analyzeHRV: jest.fn(() => mockAnalysis),
}));

jest.mock('../../src/services/storage', () => {
  return {
    initializeDatabase: jest.fn().mockResolvedValue(undefined),
    checkFirstLaunch: jest.fn().mockResolvedValue(false),
    isFirstLaunch: jest.fn().mockResolvedValue(false),
    loadUserProfile: jest.fn().mockResolvedValue(profile),
    saveUserProfile: jest.fn().mockResolvedValue(undefined),
    getAllHRVReadings: jest.fn().mockResolvedValue([]),
    saveHRVReading: jest.fn(),
  };
});

import * as storage from '../../src/services/storage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const profile: UserProfile = {
  id: 'user-1',
  pregnancyStartDate: '2024-01-01T00:00:00.000Z',
  estimatedDueDate: '2024-10-01T00:00:00.000Z',
  currentWeeksPregnant: 20,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  isFirstLaunch: false,
};

const readingInput: Omit<HRVReading, 'id'> = {
  timestamp: '2024-02-01T00:00:00.000Z',
  hrvValue: 65,
  gestationalWeek: 24,
  gestationalDay: 2,
  source: 'manual',
};

function renderWithConsumer() {
  let ctx: ReturnType<typeof useUser> | undefined;
  const Consumer = () => {
    ctx = useUser();
    return null;
  };
  render(
    <UserProvider>
      <Consumer />
    </UserProvider>
  );
  return () => {
    if (!ctx) {
      throw new Error('User context was not initialized');
    }
    return ctx;
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UserContext optimistic addHRVReading (STORY-602)', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('optimistically adds a reading and reconciles on success', async () => {
    const getCtx = renderWithConsumer();

    // Wait for initial effect to finish
    await act(async () => {});

    const saveHRVReadingMock = jest.mocked(storage.saveHRVReading);

    saveHRVReadingMock.mockResolvedValue({
      ...readingInput,
      id: 'saved-1',
    });

    let addPromise: Promise<void>;
    await act(async () => {
      addPromise = getCtx().addHRVReading(readingInput);
    });

    // Optimistic state: temp id present
    expect(getCtx().hrvReadings).toHaveLength(1);
    expect(getCtx().hrvReadings[0].id).toBeDefined();

    await act(async () => {
      await addPromise!;
    });

    // Reconciled state: saved id present, no error
    expect(getCtx().hrvReadings).toHaveLength(1);
    expect(getCtx().hrvReadings[0].id).toBe('saved-1');
    // Ignore warning message from missing readings during test bootstrap
    expect(
      getCtx().errorMessage === null ||
      getCtx().errorMessage?.includes('no HRV data')
    ).toBe(true);
  });

  it('rolls back optimistic update and surfaces error on failure', async () => {
    const getCtx = renderWithConsumer();

    await act(async () => {});

    const saveHRVReadingMock = jest.mocked(storage.saveHRVReading);

    saveHRVReadingMock.mockRejectedValue(new Error('db failure'));

    await expect(
      act(async () => {
        await getCtx().addHRVReading(readingInput);
      })
    ).rejects.toThrow();

    // State rolled back
    expect(getCtx().hrvReadings).toHaveLength(0);
    expect(getCtx().errorMessage).toBeTruthy();
  });
});
