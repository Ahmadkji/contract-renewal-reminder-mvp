import { getResendClient } from '@/lib/resend';
import { logEmailEvent } from './email-logger';
import { SendEmailResult } from '@/types/email';
import type {
  CreateBatchRequestOptions,
  CreateEmailOptions,
  CreateEmailRequestOptions,
} from 'resend';

function parseRetryAfterSeconds(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.trunc(value);
  }

  if (typeof value === 'string') {
    const numeric = Number.parseInt(value, 10);
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric;
    }

    const parsedDate = Date.parse(value);
    if (!Number.isNaN(parsedDate)) {
      const seconds = Math.ceil((parsedDate - Date.now()) / 1000);
      return seconds > 0 ? seconds : undefined;
    }
  }

  return undefined;
}

function extractRetryAfterSeconds(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const typed = error as {
    retryAfter?: unknown;
    retry_after?: unknown;
    headers?: unknown;
  };

  const explicitRetryAfter =
    parseRetryAfterSeconds(typed.retryAfter) ||
    parseRetryAfterSeconds(typed.retry_after);
  if (explicitRetryAfter) {
    return explicitRetryAfter;
  }

  const headers = typed.headers as
    | { get?: (name: string) => string | null; ['retry-after']?: unknown; retryAfter?: unknown }
    | undefined;

  if (!headers) {
    return undefined;
  }

  return (
    parseRetryAfterSeconds(headers.get?.('retry-after') ?? undefined) ||
    parseRetryAfterSeconds(headers['retry-after']) ||
    parseRetryAfterSeconds(headers.retryAfter)
  );
}

function computeRetryDelayMs(attempt: number, retryAfterSeconds?: number): number {
  const exponentialMs = Math.min(6_000, Math.pow(2, attempt) * 400);
  const jitterMs = Math.floor(Math.random() * 200);
  const hintedMs = retryAfterSeconds ? retryAfterSeconds * 1000 : 0;
  return Math.max(exponentialMs + jitterMs, hintedMs);
}

function shouldRetryStatusCode(statusCode?: number): boolean {
  if (!Number.isFinite(statusCode)) {
    return false;
  }

  const normalized = Number(statusCode);
  return normalized === 408 || normalized === 429 || normalized >= 500;
}

/**
 * EmailService class for handling all email operations
 * Provides methods for sending single emails, batch emails, and retry logic
 */
export class EmailService {
  private maxRetries: number;
  private enableLogging: boolean;

  constructor(maxRetries: number = 2, enableLogging: boolean = true) {
    this.maxRetries = maxRetries;
    this.enableLogging = enableLogging;
  }

  /**
   * Send a single email
   * @param {CreateEmailOptions} data - Email data to send
   * @returns {Promise<SendEmailResult>} Send result with success status
   */
  async sendEmail(
    data: CreateEmailOptions,
    options?: CreateEmailRequestOptions
  ): Promise<SendEmailResult> {
    try {
      const resend = getResendClient();
      const { data: result, error } = await resend.emails.send(data, options);

      if (error) {
        const retryAfterSeconds = extractRetryAfterSeconds(error);
        const errorResult: SendEmailResult = {
          success: false,
          error: error.message,
          statusCode: error.statusCode || undefined,
          retryAfterSeconds,
        };

        if (this.enableLogging) {
          logEmailEvent({
            type: 'failed',
            emailData: data,
            result: errorResult,
            metadata: { errorMessage: error.message },
          });
        }

        return errorResult;
      }

      const successResult: SendEmailResult = {
        success: true,
        data: result,
      };

      if (this.enableLogging) {
        logEmailEvent({
          type: 'sent',
          emailData: data,
          result: successResult,
          metadata: { emailId: result?.id },
        });
      }

      return successResult;
    } catch (error) {
      const errorResult: SendEmailResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500,
        retryAfterSeconds: extractRetryAfterSeconds(error),
      };

      if (this.enableLogging) {
        logEmailEvent({
          type: 'failed',
          emailData: data,
          result: errorResult,
          metadata: { errorMessage: errorResult.error },
        });
      }

      return errorResult;
    }
  }

  /**
   * Send multiple emails in batch
   * @param {CreateEmailOptions[]} emails - Array of email data to send
   * @returns {Promise<SendEmailResult>} Send result with success status
   */
  async sendBatch(
    emails: CreateEmailOptions[],
    options?: CreateBatchRequestOptions
  ): Promise<SendEmailResult> {
    try {
      const resend = getResendClient();
      const { data, error } = await resend.batch.send(emails, options);

      if (error) {
        const retryAfterSeconds = extractRetryAfterSeconds(error);
        const errorResult: SendEmailResult = {
          success: false,
          error: error.message,
          statusCode: error.statusCode || undefined,
          retryAfterSeconds,
        };

        if (this.enableLogging) {
          logEmailEvent({
            type: 'failed',
            emailData: emails[0], // Log first email as representative
            result: errorResult,
            metadata: { 
              batch: true, 
              count: emails.length,
              errorMessage: error.message 
            },
          });
        }

        return errorResult;
      }

      const successResult: SendEmailResult = {
        success: true,
        data,
      };

      if (this.enableLogging) {
        logEmailEvent({
          type: 'sent',
          emailData: emails[0], // Log first email as representative
          result: successResult,
          metadata: { 
            batch: true, 
            count: emails.length,
            data 
          },
        });
      }

      return successResult;
    } catch (error) {
      const errorResult: SendEmailResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500,
        retryAfterSeconds: extractRetryAfterSeconds(error),
      };

      if (this.enableLogging) {
        logEmailEvent({
          type: 'failed',
          emailData: emails[0], // Log first email as representative
          result: errorResult,
          metadata: { 
            batch: true, 
            count: emails.length,
            errorMessage: errorResult.error 
          },
        });
      }

      return errorResult;
    }
  }

  /**
   * Send email with retry logic for rate limits
   * Implements exponential backoff for 429 (rate limit) errors
   * @param {CreateEmailOptions} data - Email data to send
   * @param {number} maxRetries - Maximum number of retry attempts
   * @returns {Promise<SendEmailResult>} Send result with success status
   */
  async sendWithRetry(
    data: CreateEmailOptions,
    maxRetries: number = this.maxRetries,
    options?: CreateEmailRequestOptions
  ): Promise<SendEmailResult> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const result = await this.sendEmail(data, options);

      if (result.success) {
        return result;
      }

      // Retry only transient failures (408/429/5xx) with bounded backoff.
      if (shouldRetryStatusCode(result.statusCode) && attempt < maxRetries - 1) {
        const delay = computeRetryDelayMs(attempt, result.retryAfterSeconds);
        
        if (this.enableLogging) {
          logEmailEvent({
            type: 'rate_limited',
            emailData: data,
            result: result,
            metadata: { 
              attempt: attempt + 1,
              maxRetries,
              delayMs: delay,
            },
          });
        }

        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Return error for non-retryable errors or max retries exceeded
      return result;
    }

    // This should theoretically never be reached, but TypeScript needs it
    return {
      success: false,
      error: 'Max retries exceeded',
      statusCode: 500,
    };
  }

  /**
   * Send batch emails with retry logic
   * @param {CreateEmailOptions[]} emails - Array of email data to send
   * @param {number} maxRetries - Maximum number of retry attempts
   * @returns {Promise<SendEmailResult>} Send result with success status
   */
  async sendBatchWithRetry(
    emails: CreateEmailOptions[],
    maxRetries: number = this.maxRetries,
    options?: CreateBatchRequestOptions
  ): Promise<SendEmailResult> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const result = await this.sendBatch(emails, options);

      if (result.success) {
        return result;
      }

      // Retry only transient failures (408/429/5xx) with bounded backoff.
      if (shouldRetryStatusCode(result.statusCode) && attempt < maxRetries - 1) {
        const delay = computeRetryDelayMs(attempt, result.retryAfterSeconds);
        
        if (this.enableLogging) {
          logEmailEvent({
            type: 'rate_limited',
            emailData: emails[0], // Log first email as representative
            result: result,
            metadata: { 
              attempt: attempt + 1,
              maxRetries,
              delayMs: delay,
              batch: true,
              count: emails.length,
            },
          });
        }

        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Return error for non-retryable errors or max retries exceeded
      return result;
    }

    return {
      success: false,
      error: 'Max retries exceeded',
      statusCode: 500,
    };
  }
}

/**
 * Export singleton instance for use throughout the application
 * Usage: import { emailService } from '@/lib/email/email-service';
 */
export const emailService = new EmailService();
