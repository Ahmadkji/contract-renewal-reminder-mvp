import { SendEmailResult, EmailLogEntry } from '@/types/email';
import type { CreateEmailOptions } from 'resend';

function countRecipients(value: CreateEmailOptions['to']): number {
  if (Array.isArray(value)) {
    return value.length
  }

  return value ? 1 : 0
}

function summarizeEmailResult(result?: SendEmailResult): Record<string, unknown> | undefined {
  if (!result) {
    return undefined
  }

  const rawId =
    result.data && typeof result.data === 'object' && 'id' in result.data
      ? (result.data as { id?: unknown }).id
      : undefined

  return {
    success: result.success,
    statusCode: result.statusCode,
    retryAfterSeconds: result.retryAfterSeconds,
    emailId: typeof rawId === 'string' ? rawId : undefined,
    error: result.success ? undefined : result.error,
  }
}

/**
 * Log email event to console
 * In production, you might want to send this to a logging service
 * @param {Object} event - Email event data
 */
export function logEmailEvent(event: {
  type: 'sent' | 'failed' | 'retry' | 'rate_limited';
  emailData: CreateEmailOptions;
  result?: SendEmailResult;
  metadata?: any;
}): void {
  const logEntry: EmailLogEntry = {
    timestamp: new Date().toISOString(),
    type: event.type,
    emailData: event.emailData,
    result: event.result,
    metadata: event.metadata,
  };

  // Log to console (in production, send to logging service)
  console.log(`[Email ${event.type.toUpperCase()}]`, {
    recipientCount: countRecipients(event.emailData.to),
    hasSubject: Boolean(event.emailData.subject),
    result: summarizeEmailResult(event.result),
    timestamp: logEntry.timestamp,
    ...event.metadata,
  });

  // In production, you might want to:
  // - Send to a logging service (e.g., Datadog, Sentry)
  // - Store in database for analytics
  // - Send to monitoring dashboard
}

/**
 * Log email sent event
 * @param {CreateEmailOptions} emailData - Email data that was sent
 * @param {SendEmailResult} result - Send result
 * @param {any} metadata - Additional metadata
 */
export function logEmailSent(
  emailData: CreateEmailOptions,
  result: SendEmailResult,
  metadata?: any
): void {
  logEmailEvent({
    type: 'sent',
    emailData,
    result,
    metadata,
  });
}

/**
 * Log email failed event
 * @param {CreateEmailOptions} emailData - Email data that failed
 * @param {SendEmailResult} result - Send result with error
 * @param {any} metadata - Additional metadata
 */
export function logEmailFailed(
  emailData: CreateEmailOptions,
  result: SendEmailResult,
  metadata?: any
): void {
  logEmailEvent({
    type: 'failed',
    emailData,
    result,
    metadata,
  });
}

/**
 * Log email retry event
 * @param {CreateEmailOptions} emailData - Email data being retried
 * @param {number} attempt - Current attempt number
 * @param {number} maxRetries - Maximum retry attempts
 * @param {number} delayMs - Delay before retry in milliseconds
 */
export function logEmailRetry(
  emailData: CreateEmailOptions,
  attempt: number,
  maxRetries: number,
  delayMs: number
): void {
  logEmailEvent({
    type: 'retry',
    emailData,
    metadata: {
      attempt,
      maxRetries,
      delayMs,
    },
  });
}

/**
 * Log rate limit event
 * @param {CreateEmailOptions} emailData - Email data that hit rate limit
 * @param {number} attempt - Current attempt number
 * @param {number} maxRetries - Maximum retry attempts
 * @param {number} delayMs - Delay before retry in milliseconds
 */
export function logRateLimit(
  emailData: CreateEmailOptions,
  attempt: number,
  maxRetries: number,
  delayMs: number
): void {
  logEmailEvent({
    type: 'rate_limited',
    emailData,
    metadata: {
      attempt,
      maxRetries,
      delayMs,
    },
  });
}
