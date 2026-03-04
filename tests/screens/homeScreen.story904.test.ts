import { getTimeSinceLastReadingLabel } from './homeScreenStory904';

/**
 * Story test suite:
 * Verifies Home Screen display text for "time since last HRV reading".
 */
describe('getTimeSinceLastReadingLabel', () => {
  /**
   * Helper for this test file:
   * Creates a deterministic "now" date so tests are stable.
   */
  function fixedNow(): Date {
    return new Date('2026-02-10T12:00:00.000Z');
  }

  it('returns "Today" for same-day readings', () => {
    // Arrange
    const now = fixedNow();
    const sameDayReading = '2026-02-10T08:00:00.000Z';

    // Act
    const result = getTimeSinceLastReadingLabel(sameDayReading, now);

    // Assert
    expect(result).toBe('Today');
  });

  it('returns "1 day ago" for one-day-old readings', () => {
    // Arrange
    const now = fixedNow();
    const oneDayOldReading = '2026-02-09T12:00:00.000Z';

    // Act
    const result = getTimeSinceLastReadingLabel(oneDayOldReading, now);

    // Assert
    expect(result).toBe('1 day ago');
  });

  it('returns "3 days ago" for three-day-old readings', () => {
    // Arrange
    const now = fixedNow();
    const threeDaysOldReading = '2026-02-07T12:00:00.000Z';

    // Act
    const result = getTimeSinceLastReadingLabel(threeDaysOldReading, now);

    // Assert
    expect(result).toBe('3 days ago');
  });

  it('returns "4 days ago" for four-day-old readings', () => {
    // Arrange
    const now = fixedNow();
    const fourDaysOldReading = '2026-02-06T12:00:00.000Z';

    // Act
    const result = getTimeSinceLastReadingLabel(fourDaysOldReading, now);

    // Assert
    expect(result).toBe('4 days ago');
  });

  it('returns "Unknown" when timestamp is invalid', () => {
    // Arrange
    const now = fixedNow();
    const invalidTimestamp = 'not-a-date';

    // Act
    const result = getTimeSinceLastReadingLabel(invalidTimestamp, now);

    // Assert
    expect(result).toBe('Unknown');
  });
});
