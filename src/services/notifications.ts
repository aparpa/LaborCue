import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const SYNC_REMINDER_NOTIFICATION_ID_KEY = 'sync_reminder_notification_id';
const SYNC_REMINDER_CHANNEL_ID = 'sync-reminders';

export const DEFAULT_REMINDER_TIME = '20:00';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function scheduleDailySyncReminder(reminderTime: string): Promise<boolean> {
  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) {
    return false;
  }

  await cancelDailySyncReminder();
  await ensureNotificationChannel();

  const { hour, minute } = parseReminderTime(reminderTime);
  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Sync your device data',
      body: 'Open Labor Cue and sync your latest wearable data to keep your HRV insights current.',
      data: {
        type: 'daily-sync-reminder',
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      ...(Platform.OS === 'android' ? { channelId: SYNC_REMINDER_CHANNEL_ID } : {}),
    },
  });

  await AsyncStorage.setItem(SYNC_REMINDER_NOTIFICATION_ID_KEY, identifier);
  return true;
}

export async function cancelDailySyncReminder(): Promise<void> {
  const existingIdentifier = await AsyncStorage.getItem(SYNC_REMINDER_NOTIFICATION_ID_KEY);
  if (!existingIdentifier) {
    return;
  }

  try {
    await Notifications.cancelScheduledNotificationAsync(existingIdentifier);
  } catch (error) {
    console.warn('Failed to cancel scheduled sync reminder:', error);
  } finally {
    await AsyncStorage.removeItem(SYNC_REMINDER_NOTIFICATION_ID_KEY);
  }
}

export function formatReminderTime(reminderTime: string): string {
  const { hour, minute } = parseReminderTime(reminderTime);
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minute.toString().padStart(2, '0')} ${period}`;
}

export function shiftReminderTime(reminderTime: string, deltaMinutes: number): string {
  const { hour, minute } = parseReminderTime(reminderTime);
  const currentMinutes = (hour * 60) + minute;
  const nextMinutes = (currentMinutes + deltaMinutes + (24 * 60)) % (24 * 60);
  return buildReminderTime(Math.floor(nextMinutes / 60), nextMinutes % 60);
}

export function toggleReminderPeriod(reminderTime: string): string {
  return shiftReminderTime(reminderTime, 12 * 60);
}

export function getReminderTimeParts(reminderTime: string): {
  hourLabel: string;
  minuteLabel: string;
  periodLabel: 'AM' | 'PM';
} {
  const { hour, minute } = parseReminderTime(reminderTime);
  return {
    hourLabel: `${hour % 12 === 0 ? 12 : hour % 12}`,
    minuteLabel: minute.toString().padStart(2, '0'),
    periodLabel: hour >= 12 ? 'PM' : 'AM',
  };
}

async function requestNotificationPermission(): Promise<boolean> {
  const currentPermissions = await Notifications.getPermissionsAsync();
  if (currentPermissions.granted) {
    return true;
  }

  const requestedPermissions = await Notifications.requestPermissionsAsync();
  return requestedPermissions.granted;
}

async function ensureNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(SYNC_REMINDER_CHANNEL_ID, {
    name: 'Sync reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250],
    lightColor: '#4A90E2',
  });
}

function parseReminderTime(reminderTime: string): {
  hour: number;
  minute: number;
} {
  const [hourValue = '20', minuteValue = '00'] = reminderTime.split(':');
  const hour = Number.parseInt(hourValue, 10);
  const minute = Number.parseInt(minuteValue, 10);

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return {
      hour: 20,
      minute: 0,
    };
  }

  return {
    hour: Math.min(23, Math.max(0, hour)),
    minute: Math.min(59, Math.max(0, minute)),
  };
}

function buildReminderTime(hour: number, minute: number): string {
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}
