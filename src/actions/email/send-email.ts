"use server";

import { emailService } from '@/lib/email/email-service';
import { validateEmailData } from '@/lib/email/email-validator';
import { getFormattedFromAddress } from '@/lib/resend';
import { SendEmailResult } from '@/types/email';
import type { CreateEmailOptions } from 'resend';

/**
 * Generic email sending Server Action
 * Can be used to send any type of email
 * 
 * @param {FormData} formData - Form data containing email fields
 * @returns {Promise<SendEmailResult>} Send result with success status
 */
export async function sendEmail(formData: FormData): Promise<SendEmailResult> {
  try {
    // Extract form data
    const to = formData.get('to') as string;
    const subject = formData.get('subject') as string;
    const html = formData.get('html') as string;
    const text = formData.get('text') as string;
    const cc = formData.get('cc') as string;
    const bcc = formData.get('bcc') as string;
    const replyTo = formData.get('replyTo') as string;

    // Validate required fields
    if (!to || !subject) {
      return {
        success: false,
        error: 'Missing required fields: to and subject are required',
        statusCode: 400,
      };
    }

    // Prepare email data
    const emailData = {
      from: getFormattedFromAddress(),
      to: to.includes(',') || to.includes(';') ? to.split(/[,;]/).map(e => e.trim()) : to,
      subject,
      html: html || undefined,
      text: text || undefined,
      cc: cc || undefined,
      bcc: bcc || undefined,
      replyTo: replyTo || undefined,
    } as CreateEmailOptions;

    // Validate email data
    const validation = validateEmailData(emailData);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error,
        statusCode: 400,
        details: validation.data,
      };
    }

    // Send email with retry logic
    const result = await emailService.sendWithRetry(emailData);

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      statusCode: 500,
    };
  }
}
