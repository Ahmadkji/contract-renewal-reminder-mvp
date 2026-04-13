/**
 * Domain logic for contract reminder system
 * 
 * Pure, deterministic functions that can be unit tested independently.
 * These functions mirror the behavior of Supabase RPC functions but
 * are implemented in TypeScript for testability.
 */

import { isValidEmail } from '@/lib/email/email-validator';

export interface ReminderDate {
  daysBefore: number;
  triggerDate: string; // YYYY-MM-DD
}

export interface ReminderCheckParams {
  triggerDate: string; // YYYY-MM-DD
  currentDate: string; // YYYY-MM-DD
  sentAt: string | null;
}

export interface ReminderInputValidation {
  endDate: string;
  reminderDays: number[];
  notifyEmails?: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Calculate reminder trigger dates from contract end_date
 * 
 * @param endDate - Contract end date in YYYY-MM-DD format
 * @param reminderDays - Array of days before end date to trigger reminders
 * @returns Array of reminder dates sorted by daysBefore ascending
 */
export function calculateReminderDates(
  endDate: string,
  reminderDays: number[]
): ReminderDate[] {
  const normalizedDays = normalizeReminderDays(reminderDays);
  const endDateTime = parseLocalDate(endDate);

  if (!endDateTime) {
    return [];
  }

  return normalizedDays.map((daysBefore) => {
    const triggerDate = new Date(endDateTime);
    triggerDate.setDate(triggerDate.getDate() - daysBefore);
    return {
      daysBefore,
      triggerDate: formatLocalDate(triggerDate),
    };
  });
}

/**
 * Determine if a reminder should be sent based on current date
 * 
 * @param params - Reminder check parameters
 * @returns true if reminder should be sent, false otherwise
 */
export function shouldSendReminder(params: ReminderCheckParams): boolean {
  // Already sent - idempotency check
  if (params.sentAt) {
    return false;
  }

  const triggerDate = parseLocalDate(params.triggerDate);
  const currentDate = parseLocalDate(params.currentDate);

  if (!triggerDate || !currentDate) {
    return false;
  }

  // Reminder is due if current date is on or after trigger date
  return currentDate >= triggerDate;
}

/**
 * Validate reminder input parameters
 * 
 * @param params - Reminder input to validate
 * @returns Validation result with errors if invalid
 */
export function validateReminderInput(params: ReminderInputValidation): ValidationResult {
  const errors: string[] = [];

  // Validate end date
  if (!params.endDate) {
    errors.push('End date is required');
  } else if (!isDateOnlyString(params.endDate)) {
    errors.push('End date must be in YYYY-MM-DD format');
  } else {
    const endDate = parseLocalDate(params.endDate);
    if (!endDate) {
      errors.push('End date is invalid');
    }
  }

  // Validate reminder days
  if (!params.reminderDays || params.reminderDays.length === 0) {
    errors.push('At least one reminder day is required');
  } else {
    const invalidDays = params.reminderDays.filter(
      (day) => !Number.isInteger(day) || day < 1 || day > 365
    );
    if (invalidDays.length > 0) {
      errors.push(`Invalid reminder days: ${invalidDays.join(', ')}. Must be integers between 1 and 365`);
    }
  }

  // Validate notify emails if provided
  if (params.notifyEmails && params.notifyEmails.length > 0) {
    const invalidEmails = params.notifyEmails.filter((email) => !isValidEmail(email));
    if (invalidEmails.length > 0) {
      errors.push(`Invalid email addresses: ${invalidEmails.join(', ')}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Normalize and deduplicate reminder days
 * Filters invalid days, removes duplicates, sorts ascending
 * 
 * @param days - Array of reminder days
 * @returns Normalized array of valid reminder days
 */
export function normalizeReminderDays(days: number[]): number[] {
  return Array.from(
    new Set(
      (days || []).filter(
        (day) => Number.isInteger(day) && day >= 1 && day <= 365
      )
    )
  ).sort((a, b) => a - b);
}

/**
 * Normalize and validate email list
 * Trims whitespace, removes duplicates, filters invalid emails
 * 
 * @param emails - Array of email addresses
 * @returns Normalized array of valid email addresses
 */
export function normalizeEmails(emails: string[]): string[] {
  return Array.from(
    new Set(
      (emails || [])
        .map((email) => email.trim())
        .filter((email) => email.length > 0 && isValidEmail(email))
    )
  );
}

/**
 * Parse a YYYY-MM-DD date string as a local date (no timezone conversion)
 * 
 * @param date - Date string in YYYY-MM-DD format
 * @returns Date object or null if invalid
 */
function parseLocalDate(date: string): Date | null {
  if (!isDateOnlyString(date)) {
    return null;
  }

  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);

  // Validate that the date components match (catches invalid dates like Feb 30)
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
 * Format a Date object as YYYY-MM-DD string (local timezone)
 * 
 * @param date - Date object
 * @returns Formatted date string
 */
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Check if a string is a valid YYYY-MM-DD date format
 * 
 * @param value - String to check
 * @returns true if valid date-only format
 */
function isDateOnlyString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
