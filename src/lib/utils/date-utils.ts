/**
 * Date utility functions for consistent date handling across the application
 * 
 * This module provides safe date parsing, formatting, and calculation utilities
 * that work with both Date objects and ISO 8601 strings.
 */

/**
 * Parse ISO date string to Date object safely
 * Handles Date objects, ISO strings, and null/undefined values
 * 
 * @param date - Date object, ISO string, or null/undefined
 * @returns Date object or null if invalid
 */
export function parseDate(date: string | Date | null | undefined): Date | null {
  if (!date) return null;
  if (date instanceof Date) return date;
  try {
    const parsed = new Date(date);
    return isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

/**
 * Format date for display in user-friendly format
 * 
 * @param date - Date object or ISO string
 * @returns Formatted date string (e.g., "Dec 31, 2024") or "Invalid date"
 */
export function formatDate(date: string | Date): string {
  const dateObj = parseDate(date);
  if (!dateObj) return 'Invalid date';
  return dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Format date with time for display
 * 
 * @param date - Date object or ISO string
 * @returns Formatted date string with time (e.g., "Dec 31, 2024, 2:30 PM")
 */
export function formatDateTime(date: string | Date): string {
  const dateObj = parseDate(date);
  if (!dateObj) return 'Invalid date';
  return dateObj.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Format currency value for display
 *
 * @param value - Numeric value to format
 * @param currency - Currency code (e.g., "USD", "EUR")
 * @returns Formatted currency string (e.g., "$1,234.56")
 */
export function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
}

/**
 * Calculate days until a specific date
 * 
 * @param date - Date object or ISO string
 * @returns Number of days until the date (positive for future, negative for past)
 */
export function getDaysUntil(date: string | Date): number {
  const dateObj = parseDate(date);
  if (!dateObj) return 0;
  const now = new Date();
  const diff = Math.ceil((dateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

/**
 * Calculate days between two dates
 * 
 * @param date1 - First date (Date object or ISO string)
 * @param date2 - Second date (Date object or ISO string)
 * @returns Number of days between the two dates
 */
export function getDaysBetween(date1: string | Date, date2: string | Date): number {
  const d1 = parseDate(date1);
  const d2 = parseDate(date2);
  if (!d1 || !d2) return 0;
  const diff = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

/**
 * Check if date1 is before date2
 * 
 * @param date1 - First date (Date object or ISO string)
 * @param date2 - Second date (Date object or ISO string)
 * @returns True if date1 is before date2
 */
export function isBefore(date1: string | Date, date2: string | Date): boolean {
  const d1 = parseDate(date1);
  const d2 = parseDate(date2);
  if (!d1 || !d2) return false;
  return d1 < d2;
}

/**
 * Check if date1 is after date2
 * 
 * @param date1 - First date (Date object or ISO string)
 * @param date2 - Second date (Date object or ISO string)
 * @returns True if date1 is after date2
 */
export function isAfter(date1: string | Date, date2: string | Date): boolean {
  const d1 = parseDate(date1);
  const d2 = parseDate(date2);
  if (!d1 || !d2) return false;
  return d1 > d2;
}

/**
 * Check if date1 is the same as date2
 * 
 * @param date1 - First date (Date object or ISO string)
 * @param date2 - Second date (Date object or ISO string)
 * @returns True if dates are the same
 */
export function isSameDay(date1: string | Date, date2: string | Date): boolean {
  const d1 = parseDate(date1);
  const d2 = parseDate(date2);
  if (!d1 || !d2) return false;
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

/**
 * Format date to ISO 8601 string for API/database
 * 
 * @param date - Date object or ISO string
 * @returns ISO 8601 string (e.g., "2024-12-31T00:00:00.000Z") or empty string
 */
export function toISOString(date: string | Date): string {
  const dateObj = parseDate(date);
  if (!dateObj) return '';
  return dateObj.toISOString();
}

/**
 * Format date to date-only string (YYYY-MM-DD) for database
 * 
 * @param date - Date object or ISO string
 * @returns Date-only string (e.g., "2024-12-31") or empty string
 */
export function toDateString(date: string | Date): string {
  const dateObj = parseDate(date);
  if (!dateObj) return '';
  return dateObj.toISOString().split('T')[0];
}

/**
 * Check if a date is in the past
 * 
 * @param date - Date object or ISO string
 * @returns True if date is in the past
 */
export function isPast(date: string | Date): boolean {
  const dateObj = parseDate(date);
  if (!dateObj) return false;
  return getDaysUntil(dateObj) < 0;
}

/**
 * Check if a date is in the future
 * 
 * @param date - Date object or ISO string
 * @returns True if date is in the future
 */
export function isFuture(date: string | Date): boolean {
  const dateObj = parseDate(date);
  if (!dateObj) return false;
  return getDaysUntil(dateObj) > 0;
}

/**
 * Check if a date is today
 * 
 * @param date - Date object or ISO string
 * @returns True if date is today
 */
export function isToday(date: string | Date): boolean {
  const dateObj = parseDate(date);
  if (!dateObj) return false;
  const today = new Date();
  return isSameDay(dateObj, today);
}

/**
 * Add days to a date
 * 
 * @param date - Date object or ISO string
 * @param days - Number of days to add
 * @returns New date as Date object or null
 */
export function addDays(date: string | Date, days: number): Date | null {
  const dateObj = parseDate(date);
  if (!dateObj) return null;
  const result = new Date(dateObj);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Subtract days from a date
 * 
 * @param date - Date object or ISO string
 * @param days - Number of days to subtract
 * @returns New date as Date object or null
 */
export function subtractDays(date: string | Date, days: number): Date | null {
  return addDays(date, -days);
}

/**
 * Get the start of a day (midnight)
 * 
 * @param date - Date object or ISO string
 * @returns Date object set to midnight of the given day
 */
export function startOfDay(date: string | Date): Date | null {
  const dateObj = parseDate(date);
  if (!dateObj) return null;
  const result = new Date(dateObj);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Get the end of a day (just before midnight)
 * 
 * @param date - Date object or ISO string
 * @returns Date object set to end of the given day
 */
export function endOfDay(date: string | Date): Date | null {
  const dateObj = parseDate(date);
  if (!dateObj) return null;
  const result = new Date(dateObj);
  result.setHours(23, 59, 59, 999);
  return result;
}
