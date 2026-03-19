import { resend } from '@/lib/resend';
import { logEmailEvent } from './email-logger';
import { SendEmailResult } from '@/types/email';
import type { CreateEmailOptions } from 'resend';

/**
 * EmailService class for handling all email operations
 * Provides methods for sending single emails, batch emails, and retry logic
 */
export class EmailService {
  private maxRetries: number;
  private enableLogging: boolean;

  constructor(maxRetries: number = 3, enableLogging: boolean = true) {
    this.maxRetries = maxRetries;
    this.enableLogging = enableLogging;
  }

  /**
   * Send a single email
   * @param {CreateEmailOptions} data - Email data to send
   * @returns {Promise<SendEmailResult>} Send result with success status
   */
  async sendEmail(data: CreateEmailOptions): Promise<SendEmailResult> {
    try {
      const { data: result, error } = await resend.emails.send(data);

      if (error) {
        const errorResult: SendEmailResult = {
          success: false,
          error: error.message,
          statusCode: error.statusCode || undefined,
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
  async sendBatch(emails: CreateEmailOptions[]): Promise<SendEmailResult> {
    try {
      const { data, error } = await resend.batch.send(emails);

      if (error) {
        const errorResult: SendEmailResult = {
          success: false,
          error: error.message,
          statusCode: error.statusCode || undefined,
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
    maxRetries: number = this.maxRetries
  ): Promise<SendEmailResult> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const result = await this.sendEmail(data);

      if (result.success) {
        return result;
      }

      // Retry on rate limit (429)
      if (result.statusCode === 429 && attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s, 4s
        
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
    maxRetries: number = this.maxRetries
  ): Promise<SendEmailResult> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const result = await this.sendBatch(emails);

      if (result.success) {
        return result;
      }

      // Retry on rate limit (429)
      if (result.statusCode === 429 && attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s, 4s
        
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
