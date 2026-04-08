import React from 'react';
import { render, act } from '@testing-library/react-native';
import { UserProvider, useUser } from '../../src/context/UserContext';
import { analyzeHRV } from '../../src/services/hrvAnalysis';
import * as storage from '../../src/services/storage';
import { HRVReading, UserProfile, InversionStatus } from '../../src/types';

jest.mock('../../src/services/hrvAnalysis', () => ({
  analyzeHRV: jest.fn(),
}));

jest.mock('../../src/services/storage', () => ({
  loadUserProfile: jest.fn(),
  saveUserProfile: jest.fn(),
  getAllHRVReadings: jest.fn(),
  saveHRVReading: jest.fn(),
  isFirstLaunch: jest.fn(),
  initializeDatabase: jest.fn(),
}));

const mockAnalyzeHRV = analyzeHRV as jest.MockedFunction<typeof analyzeHRV>;
const mockStorage = storage as jest.Mocked<typeof storage>;

type CaptureFn = (ctx: ReturnType<typeof useUser>) => void;

const ContextProbe = ({ capture }: { capture: CaptureFn }): JSX.Element => {
  const ctx = useUser();
  capture(ctx);
  return null;
};

function renderWithProvider() {
  let latest: ReturnType<typeof useUser>;
  const capture: CaptureFn = (ctx) => {
    latest = ctx;
  };

  render(
    <UserProvider>
      <ContextProbe capture={capture} />
    </UserProvider>
  );

  return () => latest!;
}

const profile: UserProfile = {
  id: 'user-1',
  name: 'Test User',
  pregnancyStartDate: new Date().toISOString(),
  estimatedDueDate: new Date().toISOString(),
  currentWeeksPregnant: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  isFirstLaunch: false,
};

const mockAnalysis = {
  currentTrend: 'improving' as const,
  inversionStatus: InversionStatus.ON_TRACK,
  confidence: 'medium' as const,
  lastAnalyzedAt: new Date().toISOString(),
  message: 'analysis',
};

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('UserContext optimistic updates (STORY-602)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();

    mockStorage.initializeDatabase.mockResolvedValue();
    mockStorage.isFirstLaunch.mockResolvedValue(false);
    mockStorage.loadUserProfile.mockResolvedValue(profile);
    mockStorage.getAllHRVReadings.mockResolvedValue([]);
    mockStorage.saveHRVReading.mockResolvedValue({
      ...createReading(),
      id: 'saved-default',
    });

    mockAnalyzeHRV.mockReturnValue(mockAnalysis);
  });

  function createReading(): Omit<HRVReading, 'id'> {
    return {
      timestamp: new Date().toISOString(),
      hrvValue: 42,
      gestationalWeek: 30,
      gestationalDay: 1,
      source: 'device',
      metadata: { note: 'test' },
    };
  }

  it('applies optimistic update and reconciles on success', async () => {
    let resolveSave: (reading: HRVReading) => void = () => {};
    mockStorage.saveHRVReading.mockImplementation(
      (reading: Omit<HRVReading, 'id'>) =>
        new Promise<HRVReading>((resolve) => {
          resolveSave = (finalReading) => resolve(finalReading);
        })
    );

    const getCtx = renderWithProvider();
    await flushMicrotasks(); // wait for init effect

    const newReading = createReading();

    // Trigger optimistic update without awaiting the save promise
    act(() => {
      void getCtx().addHRVReading(newReading);
    });

    expect(getCtx().hrvReadings).toHaveLength(1);
    expect(getCtx().hrvReadings[0].id).toContain('temp-');
    expect(mockAnalyzeHRV).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSave({ ...newReading, id: 'saved-1' });
    });

    expect(getCtx().hrvReadings).toHaveLength(1);
    expect(getCtx().hrvReadings[0].id).toBe('saved-1');
    expect(getCtx().errorMessage).toBeNull();
    expect(mockAnalyzeHRV).toHaveBeenCalledTimes(2);
  });

  it('rolls back optimistic update and surfaces error on failure', async () => {
    mockStorage.saveHRVReading.mockRejectedValue(new Error('db down'));

    const getCtx = renderWithProvider();
    await flushMicrotasks();

    const newReading = createReading();

    await act(async () => {
      await expect(getCtx().addHRVReading(newReading)).rejects.toThrow('db down');
    });

    expect(getCtx().hrvReadings).toHaveLength(0);
    expect(getCtx().analysisResult?.inversionStatus).toBe(InversionStatus.INSUFFICIENT_DATA);
    expect(getCtx().errorMessage).toContain('could not save');
    expect(mockAnalyzeHRV).toHaveBeenCalledTimes(1);
  });
});
