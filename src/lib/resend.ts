import { Resend } from 'resend';

/**
 * Singleton pattern for Resend client
 * Ensures only one instance is created and reused
 */
let resendInstance: Resend | null = null;

/**
 * Get or create Resend client instance
 * @throws {Error} If RESEND_API_KEY environment variable is not set
 * @returns {Resend} Resend client instance
 */
export function getResendClient(): Resend {
  if (!resendInstance) {
    const apiKey = process.env.RESEND_API_KEY;
    
    if (!apiKey) {
      throw new Error(
        'RESEND_API_KEY environment variable is not set. ' +
        'Please add it to your .env.local file. ' +
        'Get your API key from https://resend.com/api-keys'
      );
    }
    
    resendInstance = new Resend(apiKey);
  }
  
  return resendInstance;
}

/**
 * Export singleton instance for direct use
 * Usage: import { resend } from '@/lib/resend';
 */
export const resend = getResendClient();

/**
 * Get default sender email from environment variables
 * @returns {string} Default sender email address
 */
export function getDefaultFromEmail(): string {
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  
  if (!fromEmail) {
    throw new Error(
      'RESEND_FROM_EMAIL environment variable is not set. ' +
      'Please add it to your .env.local file.'
    );
  }
  
  return fromEmail;
}

/**
 * Get default sender name from environment variables
 * @returns {string | undefined} Default sender name or undefined
 */
export function getDefaultFromName(): string | undefined {
  return process.env.RESEND_FROM_NAME;
}

/**
 * Get formatted sender address with optional name
 * @returns {string} Formatted sender address (e.g., "Name <email@domain.com>")
 */
export function getFormattedFromAddress(): string {
  const email = getDefaultFromEmail();
  const name = getDefaultFromName();
  
  if (name) {
    return `${name} <${email}>`;
  }
  
  return email;
}
