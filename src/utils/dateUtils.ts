/**
 * Labor Cue App - Date Utilities
 * 
 * Helper functions for date manipulation, particularly for
 * calculating gestational age and pregnancy-related dates.
 * 
 * =============================================================================
 * TODOS FOR THIS FILE:
 * =============================================================================
 * 
 * TODO [STORY-301]: Add timezone handling
 *   - Priority: Medium
 *   - Points: 3
 *   - Description: Ensure all date calculations work correctly across
 *     timezones. Users may travel or have devices set to different zones.
 * 
 * TODO [STORY-302]: Add date range validation for HRV data import
 *   - Priority: High
 *   - Points: 2
 *   - Description: Create function to validate that imported HRV readings
 *     fall within the user's pregnancy date range
 * 
 * TODO [STORY-303]: Create pregnancy milestone calculator
 *   - Priority: Low
 *   - Points: 2
 *   - Description: Add functions to calculate important milestones like
 *     end of each trimester, viability date (24 weeks), etc.
 * 
 * =============================================================================
 */

import { 
  differenceInDays, 
  differenceInWeeks, 
  addWeeks, 
  addDays,
  format,
  parseISO,
  isValid,
  startOfDay
} from 'date-fns';
import { FULL_TERM_WEEKS } from '../constants';

/**
 * Calculate the gestational week from a pregnancy start date
 * 
 * @param pregnancyStartDate - The date of conception or LMP
 * @param currentDate - The date to calculate gestational age for (defaults to today)
 * @returns The current gestational week (0-42+)
 * 
 * @example
 * const week = calculateGestationalWeek('2024-01-15');
 * console.log(week); // e.g., 24
 */
export function calculateGestationalWeek(
  pregnancyStartDate: string | Date,
  currentDate: Date = new Date()
): number {
  const startDate = typeof pregnancyStartDate === 'string' 
    ? parseISO(pregnancyStartDate) 
    : pregnancyStartDate;
  
  if (!isValid(startDate)) {
    throw new Error('Invalid pregnancy start date');
  }
  
  const weeks = differenceInWeeks(currentDate, startDate);
  return Math.max(0, weeks);
}

/**
 * Calculate the gestational day within the current week (0-6)
 * 
 * @param pregnancyStartDate - The date of conception or LMP
 * @param currentDate - The date to calculate for (defaults to today)
 * @returns The day within the gestational week (0-6)
 */
export function calculateGestationalDay(
  pregnancyStartDate: string | Date,
  currentDate: Date = new Date()
): number {
  const startDate = typeof pregnancyStartDate === 'string' 
    ? parseISO(pregnancyStartDate) 
    : pregnancyStartDate;
  
  if (!isValid(startDate)) {
    throw new Error('Invalid pregnancy start date');
  }
  
  const totalDays = differenceInDays(currentDate, startDate);
  return totalDays % 7;
}

/**
 * Calculate the pregnancy start date from the current gestational week
 * This is used during setup when user enters their current weeks pregnant
 * 
 * @param currentWeeks - Current gestational weeks
 * @param currentDays - Current gestational days (0-6, optional)
 * @returns The calculated pregnancy start date as ISO string
 * 
 * @example
 * const startDate = calculatePregnancyStartDate(24, 3);
 * // Returns the date that was 24 weeks and 3 days ago
 */
export function calculatePregnancyStartDate(
  currentWeeks: number,
  currentDays: number = 0
): string {
  const today = startOfDay(new Date());
  const totalDays = (currentWeeks * 7) + currentDays;
  const startDate = addDays(today, -totalDays);
  return startDate.toISOString();
}

/**
 * Calculate the estimated due date from pregnancy start date
 * Due date is typically 40 weeks (280 days) from LMP
 * 
 * @param pregnancyStartDate - The date of conception or LMP
 * @returns The estimated due date as ISO string
 */
export function calculateDueDate(pregnancyStartDate: string | Date): string {
  const startDate = typeof pregnancyStartDate === 'string' 
    ? parseISO(pregnancyStartDate) 
    : pregnancyStartDate;
  
  if (!isValid(startDate)) {
    throw new Error('Invalid pregnancy start date');
  }
  
  const dueDate = addWeeks(startDate, FULL_TERM_WEEKS);
  return dueDate.toISOString();
}

/**
 * Calculate pregnancy start date from a due date
 * 
 * @param dueDate - The expected due date
 * @returns The calculated pregnancy start date as ISO string
 */
export function calculateStartDateFromDueDate(dueDate: string | Date): string {
  const dueDateObj = typeof dueDate === 'string' 
    ? parseISO(dueDate) 
    : dueDate;
  
  if (!isValid(dueDateObj)) {
    throw new Error('Invalid due date');
  }
  
  const startDate = addWeeks(dueDateObj, -FULL_TERM_WEEKS);
  return startDate.toISOString();
}

/**
 * Calculate weeks remaining until due date
 * 
 * @param dueDate - The expected due date
 * @param currentDate - The date to calculate from (defaults to today)
 * @returns Number of weeks remaining (can be negative if past due)
 */
export function calculateWeeksRemaining(
  dueDate: string | Date,
  currentDate: Date = new Date()
): number {
  const dueDateObj = typeof dueDate === 'string' 
    ? parseISO(dueDate) 
    : dueDate;
  
  if (!isValid(dueDateObj)) {
    throw new Error('Invalid due date');
  }
  
  return differenceInWeeks(dueDateObj, currentDate);
}

/**
 * Format a date for display in the app
 * 
 * @param date - The date to format
 * @param formatString - The format string (defaults to 'MMM d, yyyy')
 * @returns Formatted date string
 * 
 * @example
 * formatDate('2024-03-15'); // "Mar 15, 2024"
 * formatDate('2024-03-15', 'MMMM d'); // "March 15"
 */
export function formatDate(
  date: string | Date,
  formatString: string = 'MMM d, yyyy'
): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  
  if (!isValid(dateObj)) {
    return 'Invalid date';
  }
  
  return format(dateObj, formatString);
}

/**
 * Format gestational age for display
 * 
 * @param weeks - Gestational weeks
 * @param days - Gestational days (0-6)
 * @returns Formatted string like "24 weeks, 3 days"
 */
export function formatGestationalAge(weeks: number, days: number = 0): string {
  const weekStr = weeks === 1 ? 'week' : 'weeks';
  const dayStr = days === 1 ? 'day' : 'days';
  
  if (days === 0) {
    return `${weeks} ${weekStr}`;
  }
  
  return `${weeks} ${weekStr}, ${days} ${dayStr}`;
}

/**
 * Get a human-readable time until date
 * 
 * @param targetDate - The target date
 * @returns Human-readable string like "7 weeks away" or "2 days ago"
 */
export function getTimeUntil(targetDate: string | Date): string {
  const target = typeof targetDate === 'string' ? parseISO(targetDate) : targetDate;
  const now = new Date();
  
  if (!isValid(target)) {
    return 'Unknown';
  }
  
  const daysDiff = differenceInDays(target, now);
  const weeksDiff = differenceInWeeks(target, now);
  
  if (daysDiff === 0) {
    return 'Today';
  } else if (daysDiff === 1) {
    return 'Tomorrow';
  } else if (daysDiff === -1) {
    return 'Yesterday';
  } else if (Math.abs(daysDiff) < 7) {
    return daysDiff > 0 
      ? `${daysDiff} days away`
      : `${Math.abs(daysDiff)} days ago`;
  } else {
    return weeksDiff > 0
      ? `${weeksDiff} weeks away`
      : `${Math.abs(weeksDiff)} weeks ago`;
  }
}

/**
 * Check if a date is within a valid pregnancy range
 * 
 * @param pregnancyStartDate - The pregnancy start date to validate
 * @returns True if the date results in a valid pregnancy (not future, not too old)
 */
export function isValidPregnancyDate(pregnancyStartDate: string | Date): boolean {
  const startDate = typeof pregnancyStartDate === 'string' 
    ? parseISO(pregnancyStartDate) 
    : pregnancyStartDate;
  
  if (!isValid(startDate)) {
    return false;
  }
  
  const now = new Date();
  const weeks = differenceInWeeks(now, startDate);
  
  // Pregnancy shouldn't be in the future or more than 45 weeks old
  return weeks >= 0 && weeks <= 45;
}

/**
 * Generate an array of week labels for chart x-axis
 * 
 * @param startWeek - Starting gestational week
 * @param endWeek - Ending gestational week
 * @returns Array of week labels
 */
export function generateWeekLabels(startWeek: number, endWeek: number): string[] {
  const labels: string[] = [];
  for (let week = startWeek; week <= endWeek; week++) {
    labels.push(`W${week}`);
  }
  return labels;
}

/**
 * Parse a date string in various formats
 * Attempts to be flexible with user input
 * 
 * @param dateString - The date string to parse
 * @returns Parsed Date object or null if invalid
 */
export function parseFlexibleDate(dateString: string): Date | null {
  // Try ISO format first
  let date = parseISO(dateString);
  if (isValid(date)) {
    return date;
  }
  
  // Try MM/DD/YYYY format
  const mmddyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const match = dateString.match(mmddyyyy);
  if (match) {
    const [, month, day, year] = match;
    date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (isValid(date)) {
      return date;
    }
  }
  
  return null;
}
