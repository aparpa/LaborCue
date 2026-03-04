import { differenceInCalendarDays, isValid, parseISO } from 'date-fns';

/**
 * Story helper:
 * Convert the latest reading timestamp into display text like
 * "Today", "1 day ago", or "4 days ago".
 */
export function getTimeSinceLastReadingLabel(
  latestReadingTimestamp: string | Date,
  now: Date = new Date()
): string {
  const latest =
    typeof latestReadingTimestamp === 'string'
      ? parseISO(latestReadingTimestamp)
      : latestReadingTimestamp;

  if (!isValid(latest) || !isValid(now)) {
    return 'Unknown';
  }

  const daysSince = Math.max(0, differenceInCalendarDays(now, latest));

  if (daysSince === 0) {
    return 'Today';
  }

  if (daysSince === 1) {
    return '1 day ago';
  }

  return `${daysSince} days ago`;
}
