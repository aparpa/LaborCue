/**
 * Labor Cue App - User Context
 * 
 * This React Context provides global state management for user data,
 * HRV readings, and analysis results throughout the app.
 * 
 * Using Context API instead of Redux because:
 * 1. It's simpler for beginners to understand
 * 2. Our state requirements are not overly complex
 * 3. It's built into React (no additional dependencies)
 * 
 * =============================================================================
 * TODOS FOR THIS FILE:
 * =============================================================================
 * 
 * TODO [STORY-601]: Add error state management
 *   - Priority: High
 *   - Points: 3
 *   - Description: Add error state and error handling to context. Display
 *     user-friendly error messages when operations fail.
 * 
 * TODO [STORY-602]: Implement optimistic updates
 *   - Priority: Medium
 *   - Points: 3
 *   - Description: When adding HRV readings, update UI immediately then
 *     sync to storage. Roll back if storage fails.
 * 
 * TODO [STORY-603]: Add undo functionality for deletions
 *   - Priority: Low
 *   - Points: 3
 *   - Description: When user deletes data, keep it temporarily and allow
 *     undo within 10 seconds before permanent deletion.
 * 
 * TODO [STORY-604]: Create separate contexts for different concerns
 *   - Priority: Medium
 *   - Points: 5
 *   - Description: Split into UserProfileContext, HRVDataContext, and
 *     AnalysisContext to prevent unnecessary re-renders.
 * 
 * TODO [STORY-605]: Add real-time sync status indicator
 *   - Priority: Medium
 *   - Points: 2
 *   - Description: Track and display sync status (syncing, synced, error)
 *     so users know when their data is saved.
 * 
 * =============================================================================
 */

import React, { 
  createContext, 
  useContext, 
  useState, 
  useEffect, 
  useCallback,
  useMemo,
  ReactNode 
} from 'react';
import {
  UserProfile,
  HRVReading,
  HRVAnalysisResult,
  InversionStatus
} from '../types';
import {
  loadUserProfile,
  saveUserProfile,
  getAllHRVReadings,
  saveHRVReading,
  isFirstLaunch as checkFirstLaunch,
  initializeDatabase
} from '../services/storage';
import { analyzeHRV } from '../services/hrvAnalysis';
import { calculateGestationalWeek, calculateGestationalDay } from '../utils/dateUtils';

// ============================================================================
// CONTEXT TYPE DEFINITIONS
// ============================================================================

interface UserContextType {
  // User profile data
  profile: UserProfile | null;
  isFirstLaunch: boolean;
  isLoading: boolean;
  
  // HRV data
  hrvReadings: HRVReading[];
  latestReading: HRVReading | null;
  
  // Analysis results
  analysisResult: HRVAnalysisResult | null;
  
  // Actions
  setProfile: (profile: UserProfile) => Promise<void>;
  addHRVReading: (reading: Omit<HRVReading, 'id'>) => Promise<void>;
  refreshData: () => Promise<void>;
  completeSetup: () => void;
  
  // Computed values
  currentGestationalWeek: number;
  currentGestationalDay: number;
  
  // Error handling
  errorMessage: string | null;
}

// Default context value (used before initialization)
const defaultContext: UserContextType = {
  profile: null,
  isFirstLaunch: true,
  isLoading: true,
  hrvReadings: [],
  latestReading: null,
  analysisResult: null,
  setProfile: async () => {},
  addHRVReading: async () => {},
  refreshData: async () => {},
  completeSetup: () => {},
  currentGestationalWeek: 0,
  currentGestationalDay: 0,
  errorMessage: null
};

// ============================================================================
// CONTEXT CREATION
// ============================================================================

const UserContext = createContext<UserContextType>(defaultContext);

/**
 * Custom hook to access the User Context
 * Must be used within a UserProvider
 */
export function useUser(): UserContextType {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

interface UserProviderProps {
  children: ReactNode;
}

/**
 * UserProvider component that wraps the app and provides global state
 */
export function UserProvider({ children }: UserProviderProps): React.JSX.Element {
  // State
  const [profile, setProfileState] = useState<UserProfile | null>(null);
  const [isFirstLaunch, setIsFirstLaunch] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [hrvReadings, setHrvReadings] = useState<HRVReading[]>([]);
  const [analysisResult, setAnalysisResult] = useState<HRVAnalysisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Show a warning when we go a full night without any readings
  const HOURS_WITHOUT_READING_FOR_WARNING = 24;
  const NO_DATA_WARNING_MESSAGE = 'Warning: no HRV data detected';
  
  // Computed values
  const currentGestationalWeek = profile 
    ? calculateGestationalWeek(profile.pregnancyStartDate)
    : 0;
  
  const currentGestationalDay = profile
    ? calculateGestationalDay(profile.pregnancyStartDate)
    : 0;
  
  const latestReading = hrvReadings.length > 0 
    ? hrvReadings[hrvReadings.length - 1] 
    : null;
  
  const shouldWarnForMissingReadings = useCallback((): boolean => {
    if (isLoading || isFirstLaunch) {
      return false;
    }
    
    const now = Date.now();
    const hoursSince = (timestamp: number): number =>
      (now - timestamp) / (1000 * 60 * 60);
    
    if (!latestReading) {
      if (!profile?.createdAt) {
        return false;
      }
      return hoursSince(new Date(profile.createdAt).getTime()) >= HOURS_WITHOUT_READING_FOR_WARNING;
    }
    
    return hoursSince(new Date(latestReading.timestamp).getTime()) >= HOURS_WITHOUT_READING_FOR_WARNING;
  }, [HOURS_WITHOUT_READING_FOR_WARNING, isFirstLaunch, isLoading, latestReading, profile]);

  const warningMessage = shouldWarnForMissingReadings()
    ? NO_DATA_WARNING_MESSAGE
    : null;
  const visibleErrorMessage = errorMessage ?? warningMessage;
  
  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  
  useEffect(() => {
    initializeApp();
  }, []);
  
  /**
   * Initialize the app: load saved data and set up database
   */
  async function initializeApp(): Promise<void> {
    try {
      setIsLoading(true);
      
      // Initialize database
      await initializeDatabase();
      
      // Check if first launch
      const firstLaunch = await checkFirstLaunch();
      setIsFirstLaunch(firstLaunch);
      
      if (!firstLaunch) {
        // Load existing data
        const savedProfile = await loadUserProfile();
        if (savedProfile) {
          setProfileState(savedProfile);
        }
        
        const savedReadings = await getAllHRVReadings();
        setHrvReadings(savedReadings);
        
        // Run analysis if we have data
        if (savedProfile && savedReadings.length > 0) {
          const result = analyzeHRV(savedReadings, savedProfile.estimatedDueDate);
          setAnalysisResult(result);
        }
      }
    } catch (error) {
      console.error('Failed to initialize app:', error);
    } finally {
      setIsLoading(false);
    }
  }
  
  // ============================================================================
  // ACTIONS
  // ============================================================================
  
  /**
   * Save or update the user profile
   */
  const setProfile = useCallback(async (newProfile: UserProfile): Promise<void> => {
    try {
      await saveUserProfile(newProfile);
      setProfileState(newProfile);
      
      // Re-run analysis with new profile
      if (hrvReadings.length > 0) {
        const result = analyzeHRV(hrvReadings, newProfile.estimatedDueDate);
        setAnalysisResult(result);
      }
    } catch (error) {
      console.error('Failed to save profile:', error);
      throw error;
    }
  }, [hrvReadings]);
  
  /**
   * Add a new HRV reading
   */
  const addHRVReading = useCallback(async (
    reading: Omit<HRVReading, 'id'>
  ): Promise<void> => {
    // If no profile, just persist without optimistic analysis
    if (!profile) {
      const savedReading = await saveHRVReading(reading);
      const updatedReadings = [...hrvReadings, savedReading].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      setHrvReadings(updatedReadings);
      return;
    }

    const previousReadings = hrvReadings;
    const previousAnalysis = analysisResult;
    const optimisticReading: HRVReading = {
      ...reading,
      id: `temp-${Date.now()}`,
    };

    // Optimistic update
    const optimisticReadings = [...previousReadings, optimisticReading].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    setHrvReadings(optimisticReadings);
    setAnalysisResult(analyzeHRV(optimisticReadings, profile.estimatedDueDate));
    setErrorMessage(null);

    try {
      const savedReading = await saveHRVReading(reading);
      const reconciledReadings = [...previousReadings, savedReading].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      setHrvReadings(reconciledReadings);
      setAnalysisResult(analyzeHRV(reconciledReadings, profile.estimatedDueDate));
    } catch (error) {
      console.error('Failed to add HRV reading:', error);
      // Roll back optimistic state
      setHrvReadings(previousReadings);
      setAnalysisResult(previousAnalysis ?? null);
      setErrorMessage('We could not save your latest reading. Your data was restored.');
      throw error;
    }
  }, [analysisResult, hrvReadings, profile]);
  
  /**
   * Refresh all data from storage
   */
  const refreshData = useCallback(async (): Promise<void> => {
    try {
      const savedReadings = await getAllHRVReadings();
      setHrvReadings(savedReadings);
      
      if (profile && savedReadings.length > 0) {
        const result = analyzeHRV(savedReadings, profile.estimatedDueDate);
        setAnalysisResult(result);
      }
    } catch (error) {
      console.error('Failed to refresh data:', error);
    }
  }, [profile]);
  
  /**
   * Mark setup as complete (for first launch flow)
   */
  const completeSetup = useCallback((): void => {
    setIsFirstLaunch(false);
  }, []);
  
  const analysisResultWithError = useMemo<HRVAnalysisResult | null>(() => {
    if (visibleErrorMessage) {
      const baseResult = analysisResult ?? {
        currentTrend: 'insufficient_data' as const,
        inversionStatus: InversionStatus.INSUFFICIENT_DATA,
        confidence: 'none' as const,
        lastAnalyzedAt: new Date().toISOString(),
        message: NO_DATA_WARNING_MESSAGE
      };
      
      return {
        ...baseResult,
        inversionStatus: InversionStatus.INSUFFICIENT_DATA,
        confidence: 'none',
        message: NO_DATA_WARNING_MESSAGE,
        recommendation: undefined
      };
    }
    
    return analysisResult;
  }, [NO_DATA_WARNING_MESSAGE, analysisResult, visibleErrorMessage]);
  
  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================
  
  const contextValue: UserContextType = {
    profile,
    isFirstLaunch,
    isLoading,
    hrvReadings,
    latestReading,
    analysisResult: analysisResultWithError,
    setProfile,
    addHRVReading,
    refreshData,
    completeSetup,
    currentGestationalWeek,
    currentGestationalDay,
    errorMessage: visibleErrorMessage
  };
  
  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  );
}

// ============================================================================
// SELECTOR HOOKS (for optimized re-renders)
// ============================================================================

/**
 * Hook to get only the analysis status (prevents re-renders from other data)
 */
export function useAnalysisStatus(): {
  status: InversionStatus;
  isLoading: boolean;
} {
  const { analysisResult, isLoading } = useUser();
  
  return {
    status: analysisResult?.inversionStatus ?? InversionStatus.INSUFFICIENT_DATA,
    isLoading
  };
}

/**
 * Hook to get the current gestational info
 */
export function useGestationalInfo(): {
  week: number;
  day: number;
  isLoading: boolean;
} {
  const { currentGestationalWeek, currentGestationalDay, isLoading } = useUser();
  
  return {
    week: currentGestationalWeek,
    day: currentGestationalDay,
    isLoading
  };
}
