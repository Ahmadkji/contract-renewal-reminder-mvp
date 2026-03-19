"use server";

import { emailService } from '@/lib/email/email-service';
import { getFormattedFromAddress } from '@/lib/resend';
import { SendEmailResult } from '@/types/email';
import type { CreateEmailOptions } from 'resend';

/**
 * Batch email sending Server Action
 * Sends multiple emails in a single API call
 * 
 * @param {CreateEmailOptions[]} emails - Array of email data to send
 * @returns {Promise<SendEmailResult>} Send result with success status
 */
export async function sendBatch(emails: CreateEmailOptions[]): Promise<SendEmailResult> {
  try {
    // Validate input
    if (!Array.isArray(emails) || emails.length === 0) {
      return {
        success: false,
        error: 'Emails must be a non-empty array',
        statusCode: 400,
      };
    }

    // Validate each email
    for (const email of emails) {
      if (!email.to || !email.subject) {
        return {
          success: false,
          error: 'Each email must have to and subject fields',
          statusCode: 400,
        };
      }
    }

    // Add default from address to each email
    const emailsWithFrom = emails.map(email => ({
      ...email,
      from: email.from || getFormattedFromAddress(),
    }));

    // Send batch emails with retry logic
    const result = await emailService.sendBatchWithRetry(emailsWithFrom);

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      statusCode: 500,
    };
  }
}
