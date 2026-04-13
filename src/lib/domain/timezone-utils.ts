/**
 * Timezone conversion utilities for contract reminder system
 * 
 * Handles timezone conversions between local timezones and UTC,
 * particularly for Pakistan timezone (UTC+5 with no DST).
 */

/**
 * Timezone offset information
 * @param timezone - IANA timezone identifier (e.g., "Asia/Karachi", "UTC")
 * @returns Offset in hours from UTC
 */
function getTimezoneOffset(timezone: string): number {
  if (timezone === 'UTC') {
    return 0;
  }
  
  // For Asia/Karachi and similar timezones, we need to handle fixed offsets
  // Pakistan Standard Time is UTC+5 with no DST
  if (timezone === 'Asia/Karachi' || timezone === 'PKT') {
    return 5;
  }

  // For other timezones, use the browser's Intl API
  // Create a formatter to get the offset
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  // Get a date and format it in both UTC and target timezone
  const date = new Date();
  const parts = formatter.formatToParts(date);
  
  // Build the local time components from the formatter
  const localParts: Record<string, number> = {};
  parts.forEach(part => {
    if (part.type !== 'literal') {
      localParts[part.type] = parseInt(part.value, 10);
    }
  });

  // Create a UTC date with the same year, month, day, hour, minute, second
  const utcDate = new Date(
    Date.UTC(
      localParts.year,
      (localParts.month || 1) - 1,
      localParts.day,
      localParts.hour,
      localParts.minute,
      localParts.second
    )
  );

  // The difference between local and UTC tells us the offset
  const diffInMs = date.getTime() - utcDate.getTime();
  const offsetHours = diffInMs / (1000 * 60 * 60);

  return offsetHours;
}

/**
 * Parse a date string (YYYY-MM-DD) into a Date object
 * 
 * @param dateString - Date in YYYY-MM-DD format
 * @returns Date object or null if invalid
 */
function parseDateString(dateString: string): Date | null {
  const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateOnlyPattern.test(dateString)) {
    return null;
  }

  const [year, month, day] = dateString.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);

  // Validate that the date is valid
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

/**
 * Format a Date object as YYYY-MM-DD string
 * 
 * @param date - Date object
 * @returns Date string in YYYY-MM-DD format
 */
function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculate reminder date by subtracting days from contract end date
 * Performs calculation in the source timezone, then converts to UTC
 * 
 * @param contractDate - Contract end date in YYYY-MM-DD format (local timezone)
 * @param daysBefore - Number of days to subtract
 * @param timezone - Timezone of the contract date (e.g., "Asia/Karachi", "UTC")
 * @returns UTC reminder date in YYYY-MM-DD format
 */
export function calculateReminderDate(
  contractDate: string,
  daysBefore: number,
  timezone: string
): string {
  const date = parseDateString(contractDate);
  if (!date) {
    return '';
  }

  // Subtract days from the date (working in local timezone)
  const reminderDate = new Date(date);
  reminderDate.setDate(reminderDate.getDate() - daysBefore);

  // If timezone is UTC, just return the formatted date
  if (timezone === 'UTC') {
    return formatDateString(reminderDate);
  }

  // Get the timezone offset
  const offsetHours = getTimezoneOffset(timezone);

  // Convert to UTC by adding the offset (since our dates are in local timezone)
  // For example, Pakistan (UTC+5): a local date is 5 hours ahead, 
  // so we subtract 5 hours to get UTC
  const utcDate = new Date(reminderDate.getTime() - (offsetHours * 60 * 60 * 1000));

  return formatDateString(utcDate);
}

/**
 * Convert a contract date from local timezone to UTC
 * 
 * @param contractDate - Contract date in YYYY-MM-DD format (local timezone)
 * @param timezone - Timezone of the contract date
 * @returns UTC date in YYYY-MM-DD format
 */
export function convertToUTC(
  contractDate: string,
  timezone: string
): string {
  const date = parseDateString(contractDate);
  if (!date) {
    return '';
  }

  // If already UTC, return as-is
  if (timezone === 'UTC') {
    return contractDate;
  }

  // Get timezone offset
  const offsetHours = getTimezoneOffset(timezone);

  // Convert to UTC
  const utcDate = new Date(date.getTime() - (offsetHours * 60 * 60 * 1000));

  return formatDateString(utcDate);
}

/**
 * Convert a UTC date to a specific timezone
 * 
 * @param utcDate - Date in YYYY-MM-DD format (UTC)
 * @param timezone - Target timezone
 * @returns Date in YYYY-MM-DD format in the target timezone
 */
export function convertFromUTC(
  utcDate: string,
  timezone: string
): string {
  const date = parseDateString(utcDate);
  if (!date) {
    return '';
  }

  // If target is UTC, return as-is
  if (timezone === 'UTC') {
    return utcDate;
  }

  // Get timezone offset
  const offsetHours = getTimezoneOffset(timezone);

  // Convert from UTC to local timezone
  const localDate = new Date(date.getTime() + (offsetHours * 60 * 60 * 1000));

  return formatDateString(localDate);
}

/**
 * Calculate days between two dates (date-only, no time component)
 * 
 * @param date1 - First date in YYYY-MM-DD format
 * @param date2 - Second date in YYYY-MM-DD format
 * @returns Number of days from date1 to date2 (positive if date2 is after date1)
 */
export function daysBetween(date1: string, date2: string): number {
  const d1 = parseDateString(date1);
  const d2 = parseDateString(date2);

  if (!d1 || !d2) {
    return 0;
  }

  const diffInMs = d2.getTime() - d1.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  return diffInDays;
}

/**
 * Check if a date is in the past
 * 
 * @param date - Date in YYYY-MM-DD format
 * @param referenceDate - Reference date (defaults to today)
 * @returns true if date is before referenceDate
 */
export function isPastDate(date: string, referenceDate?: string): boolean {
  const d = parseDateString(date);
  if (!d) {
    return false;
  }

  const refDate = referenceDate ? parseDateString(referenceDate) : new Date();
  if (!refDate) {
    return false;
  }

  // Set time to midnight for both dates for comparison
  d.setHours(0, 0, 0, 0);
  refDate.setHours(0, 0, 0, 0);

  return d < refDate;
}

/**
 * Check if a date is in the future
 * 
 * @param date - Date in YYYY-MM-DD format
 * @param referenceDate - Reference date (defaults to today)
 * @returns true if date is after referenceDate
 */
export function isFutureDate(date: string, referenceDate?: string): boolean {
  const d = parseDateString(date);
  if (!d) {
    return false;
  }

  const refDate = referenceDate ? parseDateString(referenceDate) : new Date();
  if (!refDate) {
    return false;
  }

  // Set time to midnight for both dates for comparison
  d.setHours(0, 0, 0, 0);
  refDate.setHours(0, 0, 0, 0);

  return d > refDate;
}
