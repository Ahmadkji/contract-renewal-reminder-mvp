import { z } from 'zod';

/**
 * Email validation schemas using Zod
 */

/**
 * Single email address validation
 */
export const EmailSchema = z.string().email('Invalid email address format');

/**
 * Multiple email addresses validation (comma or semicolon separated)
 */
export const MultipleEmailsSchema = z.string().transform((value) => {
  // Split by comma or semicolon
  const emails = value.split(/[,;]/).map(e => e.trim());
  return emails;
}).pipe(
  z.array(z.string().email('Invalid email address format'))
);

/**
 * Email data validation schema
 */
export const EmailDataSchema = z.object({
  from: z.string().min(1, 'From address is required'),
  to: z.union([
    z.string().email('Invalid to email address'),
    z.array(z.string().email('Invalid to email address')),
  ]),
  subject: z.string().min(1, 'Subject is required').max(255, 'Subject too long'),
  html: z.string().optional(),
  text: z.string().optional(),
  cc: z.union([
    z.string().email('Invalid cc email address'),
    z.array(z.string().email('Invalid cc email address')),
  ]).optional(),
  bcc: z.union([
    z.string().email('Invalid bcc email address'),
    z.array(z.string().email('Invalid bcc email address')),
  ]).optional(),
  replyTo: z.string().email('Invalid reply-to email address').optional(),
});

type ValidatedEmailData = z.infer<typeof EmailDataSchema>;
type EmailAttachment = {
  filename?: string;
  content?: string | Buffer;
  path?: string;
};

/**
 * Validate email address
 * @param {string} email - Email address to validate
 * @returns {boolean} True if valid, false otherwise
 */
export function isValidEmail(email: string): boolean {
  try {
    EmailSchema.parse(email.trim());
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate multiple email addresses
 * @param {string} emails - Comma or semicolon separated email addresses
 * @returns {boolean} True if all valid, false otherwise
 */
export function isValidMultipleEmails(emails: string): boolean {
  try {
    MultipleEmailsSchema.parse(emails);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate email data
 * @param {any} data - Email data to validate
 * @returns {Object} Validation result with success and error
 */
export function validateEmailData(data: unknown): {
  success: boolean;
  error?: string;
  data?: ValidatedEmailData;
} {
  try {
    const validatedData = EmailDataSchema.parse(data);
    return {
      success: true,
      data: validatedData,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || 'Validation failed',
      };
    }
    return {
      success: false,
      error: 'Unknown validation error',
    };
  }
}

/**
 * Validate and format email addresses
 * @param {string | string[]} emails - Email address(es) to validate and format
 * @returns {string[]} Array of valid email addresses
 */
export function validateAndFormatEmails(
  emails: string | string[]
): string[] {
  if (typeof emails === 'string') {
    // Split by comma or semicolon
    const emailArray = emails.split(/[,;]/).map(e => e.trim());
    return emailArray.filter(email => isValidEmail(email));
  }
  
  // Already an array
  return emails.filter(email => isValidEmail(email));
}

/**
 * Sanitize email content to prevent XSS
 * @param {string} content - Content to sanitize
 * @returns {string} Sanitized content
 */
export function sanitizeEmailContent(content: string): string {
  // Basic XSS prevention
  return content
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#x27;');
}

/**
 * Validate email attachment
 * @param {any} attachment - Attachment to validate
 * @returns {boolean} True if valid, false otherwise
 */
export function isValidAttachment(attachment: unknown): boolean {
  if (!attachment || typeof attachment !== 'object') {
    return false;
  }

  const candidate = attachment as EmailAttachment;

  // Check for required fields
  if (!candidate.filename || typeof candidate.filename !== 'string') {
    return false;
  }

  // Check for content or path
  if (!candidate.content && !candidate.path) {
    return false;
  }

  return true;
}

/**
 * Validate email attachments
 * @param {any[]} attachments - Attachments to validate
 * @returns {boolean} True if all valid, false otherwise
 */
export function isValidAttachments(attachments: unknown[]): boolean {
  if (!Array.isArray(attachments)) {
    return false;
  }

  return attachments.every(attachment => isValidAttachment(attachment));
}
