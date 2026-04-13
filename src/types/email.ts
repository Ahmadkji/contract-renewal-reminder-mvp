import { ReactElement } from 'react';

/**
 * Email data structure for sending emails via Resend
 * Compatible with Resend SDK's CreateEmailOptions type
 */
export interface EmailData {
  /** Sender email address (e.g., "noreply@yourdomain.com" or "Name <email@domain.com>") */
  from: string;
  
  /** Recipient email address(es) */
  to: string | string[];
  
  /** Email subject line */
  subject: string;
  
  /** HTML content of the email */
  html?: string;
  
  /** Plain text content of the email */
  text?: string;
  
  /** React component for email body (Node.js SDK only) */
  react?: ReactElement;
  
  /** Resend template object (for template-based emails) */
  template?: {
    /** Template ID from Resend dashboard */
    id: string;
    /** Template variables to substitute */
    variables?: Record<string, string | number>;
  };
  
  /** CC recipients */
  cc?: string | string[];
  
  /** BCC recipients */
  bcc?: string | string[];
  
  /** Reply-to email address */
  replyTo?: string;
  
  /** Email attachments */
  attachments?: Array<{
    filename: string;
    content?: string | Buffer;
    path?: string;
  }>;
  
  /** Email tags for tracking */
  tags?: Array<{
    name: string;
    value: string;
  }>;
  
  /** Headers for the email */
  headers?: Record<string, string>;
}

/**
 * Result of email send operation
 */
export interface SendEmailResult {
  /** Whether the email was sent successfully */
  success: boolean;
  
  /** Response data from Resend API (if successful) */
  data?: unknown;
  
  /** Error message (if failed) */
  error?: string;
  
  /** HTTP status code (if failed) */
  statusCode?: number;

  /** Optional retry hint (seconds) from provider rate-limit response */
  retryAfterSeconds?: number;
  
  /** Additional error details */
  details?: unknown;
}

/**
 * Email template props interface
 */
export interface EmailTemplateProps {
  [key: string]: unknown;
}

/**
 * Email service configuration
 */
export interface EmailServiceConfig {
  /** Resend API key */
  apiKey: string;
  
  /** Default sender email */
  fromEmail: string;
  
  /** Default sender name */
  fromName?: string;
  
  /** Maximum retry attempts for failed sends */
  maxRetries?: number;
  
  /** Enable email logging */
  enableLogging?: boolean;
}

/**
 * Email log entry
 */
export interface EmailLogEntry {
  /** Log timestamp */
  timestamp: string;
  
  /** Log type */
  type: 'sent' | 'failed' | 'retry' | 'rate_limited';
  
  /** Email data */
  emailData: unknown;
  
  /** Send result */
  result?: SendEmailResult;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}
