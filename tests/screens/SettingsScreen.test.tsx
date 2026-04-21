import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import SettingsScreen from '../../src/screens/SettingsScreen';
import type { UserProfile } from '../../src/types';

jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

jest.mock('../../src/services/storage', () => ({
  clearAllData: jest.fn(),
  saveHRVReading: jest.fn(),
}));

let mockCurrentProfile: UserProfile | null;
const mockSetProfile = jest.fn(async (nextProfile: UserProfile) => {
  mockCurrentProfile = nextProfile;
});

jest.mock('../../src/context/UserContext', () => ({
  useUser: () => ({
    profile: mockCurrentProfile,
    setProfile: mockSetProfile,
    currentGestationalWeek: 28,
    currentGestationalDay: 3,
    refreshData: jest.fn(),
    hrvReadings: [],
  }),
}));

function makeProfile(): UserProfile {
  return {
    id: 'profile-1',
    name: 'Leah',
    pregnancyStartDate: '2024-01-01T00:00:00.000Z',
    estimatedDueDate: '2024-10-07T00:00:00.000Z',
    currentWeeksPregnant: 28,
    healthcareProvider: {
      id: 'provider-1',
      name: 'Northside OB',
      contact: '111-222-3333',
    },
    healthcareProviders: [
      {
        id: 'provider-1',
        name: 'Northside OB',
        contact: '111-222-3333',
      },
    ],
    primaryHealthcareProviderId: 'provider-1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    isFirstLaunch: false,
  };
}

describe('SettingsScreen provider management (STORY-1104)', () => {
  beforeEach(() => {
    mockCurrentProfile = makeProfile();
    jest.clearAllMocks();
  });

  it('adds a second provider and preserves the current primary provider', async () => {
    render(<SettingsScreen />);

    fireEvent.press(screen.getByTestId('provider-add-button'));
    fireEvent.changeText(screen.getByTestId('provider-name-input'), 'Downtown Midwives');
    fireEvent.changeText(screen.getByTestId('provider-contact-input'), 'care@example.com');
    fireEvent.press(screen.getByTestId('provider-save-button'));

    await waitFor(() => {
      expect(mockSetProfile).toHaveBeenCalledTimes(1);
    });

    const savedProfile = mockSetProfile.mock.calls[0][0] as UserProfile;
    expect(savedProfile.healthcareProviders).toHaveLength(2);
    expect(savedProfile.healthcareProviders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Downtown Midwives',
          contact: 'care@example.com',
        }),
      ])
    );
    expect(savedProfile.primaryHealthcareProviderId).toBe('provider-1');
    expect(savedProfile.healthcareProvider).toMatchObject({
      name: 'Northside OB',
      contact: '111-222-3333',
    });
  });

  it('can promote another provider to primary and sync the legacy profile field', async () => {
    mockCurrentProfile = {
      ...makeProfile(),
      healthcareProviders: [
        {
          id: 'provider-1',
          name: 'Northside OB',
          contact: '111-222-3333',
        },
        {
          id: 'provider-2',
          name: 'Downtown Midwives',
          contact: 'care@example.com',
        },
      ],
    };

    render(<SettingsScreen />);

    fireEvent.press(screen.getByTestId('provider-primary-provider-2'));

    await waitFor(() => {
      expect(mockSetProfile).toHaveBeenCalledTimes(1);
    });

    const savedProfile = mockSetProfile.mock.calls[0][0] as UserProfile;
    expect(savedProfile.primaryHealthcareProviderId).toBe('provider-2');
    expect(savedProfile.healthcareProvider).toMatchObject({
      id: 'provider-2',
      name: 'Downtown Midwives',
      contact: 'care@example.com',
    });
  });
});
