# Resend Email Integration - Usage Guide

## Quick Start

### 1. Setup Environment Variables

Copy the example file and add your actual values:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your Resend API key:

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com
RESEND_FROM_NAME=Your Company
```

### 2. Verify Your Domain

Before sending emails to real recipients, you need to verify your domain:

1. Go to [resend.com/domains](https://resend.com/domains)
2. Add your domain
3. Configure DKIM/SPF records as shown in the dashboard
4. Wait for verification

**Note:** During development, you can use Resend's test domain `onboarding@resend.dev` and send emails only to your own email address.

### 3. Send Your First Email

#### Option A: Using Server Action (Recommended)

```tsx
import { sendWelcomeEmail } from '@/actions/email/send-welcome';

async function handleSignup(formData: FormData) {
  const result = await sendWelcomeEmail(formData);
  
  if (result.success) {
    console.log('Email sent successfully!');
  } else {
    console.error('Failed to send email:', result.error);
  }
}
```

#### Option B: Using Email Service Directly

```typescript
import { emailService } from '@/lib/email/email-service';

const result = await emailService.sendWithRetry({
  from: 'noreply@yourdomain.com',
  to: 'user@example.com',
  subject: 'Hello!',
  html: '<p>This is a test email.</p>',
});
```

## Usage Examples

### Sending a Welcome Email

```tsx
'use client';

import { sendWelcomeEmail } from '@/actions/email/send-welcome';

export function SignupForm() {
  async function handleSubmit(formData: FormData) {
    const result = await sendWelcomeEmail(formData);
    
    if (result.success) {
      alert('Welcome email sent!');
    } else {
      alert(`Failed: ${result.error}`);
    }
  }

  return (
    <form action={handleSubmit}>
      <input name="email" type="email" placeholder="Email" required />
      <input name="firstName" type="text" placeholder="First Name" required />
      <input name="companyName" type="text" placeholder="Company Name" />
      <input name="loginUrl" type="url" placeholder="Login URL" />
      <button type="submit">Sign Up</button>
    </form>
  );
}
```

### Sending a Notification Email

```tsx
'use client';

import { sendNotificationEmail } from '@/actions/email/send-notification';

export function NotificationButton() {
  async function handleSend() {
    const formData = new FormData();
    formData.append('email', 'user@example.com');
    formData.append('recipientName', 'John Doe');
    formData.append('notificationTitle', 'New Feature Available');
    formData.append('notificationBody', 'We just launched a new feature you might like!');
    formData.append('actionUrl', 'https://yourdomain.com/features');
    formData.append('actionText', 'Learn More');
    
    const result = await sendNotificationEmail(formData);
    
    if (result.success) {
      alert('Notification sent!');
    }
  }

  return <button onClick={handleSend}>Send Notification</button>;
}
```

### Sending Batch Emails

```typescript
import { sendBatch } from '@/actions/email/send-batch';

async function sendBulkNotifications() {
  const emails = [
    {
      from: 'noreply@yourdomain.com',
      to: 'user1@example.com',
      subject: 'Update Available',
      html: '<p>A new update is available.</p>',
    },
    {
      from: 'noreply@yourdomain.com',
      to: 'user2@example.com',
      subject: 'Update Available',
      html: '<p>A new update is available.</p>',
    },
  ];

  const result = await sendBatch(emails);
  
  if (result.success) {
    console.log('Batch emails sent successfully!');
  }
}
```

### Custom Email Template

```typescript
import { sendEmail } from '@/actions/email/send-email';

async function sendCustomEmail() {
  const formData = new FormData();
  formData.append('to', 'user@example.com');
  formData.append('subject', 'Custom Email');
  formData.append('html', '<h1>Custom Content</h1><p>This is a custom email.</p>');
  
  const result = await sendEmail(formData);
  
  if (result.success) {
    console.log('Custom email sent!');
  }
}
```

## Server Actions Reference

### `sendEmail(formData)`

Generic email sending action.

**Parameters:**
- `to` (required): Recipient email address
- `subject` (required): Email subject
- `html` (optional): HTML content
- `text` (optional): Plain text content
- `cc` (optional): CC recipients
- `bcc` (optional): BCC recipients
- `replyTo` (optional): Reply-to address

**Returns:**
```typescript
{
  success: boolean;
  data?: any;
  error?: string;
  statusCode?: number;
}
```

### `sendBatch(emails[])`

Send multiple emails in a single API call.

**Parameters:**
- `emails`: Array of email objects

**Returns:**
```typescript
{
  success: boolean;
  data?: any;
  error?: string;
  statusCode?: number;
}
```

### `sendWelcomeEmail(formData)`

Send welcome email to new users.

**Parameters:**
- `email` (required): Recipient email
- `firstName` (required): User's first name
- `companyName` (optional): Company name
- `loginUrl` (optional): Login URL

**Returns:**
```typescript
{
  success: boolean;
  data?: any;
  error?: string;
  statusCode?: number;
}
```

### `sendNotificationEmail(formData)`

Send notification emails.

**Parameters:**
- `email` (required): Recipient email
- `recipientName` (required): Recipient name
- `notificationTitle` (required): Notification title
- `notificationBody` (required): Notification body
- `actionUrl` (optional): Action URL
- `actionText` (optional): Action button text

**Returns:**
```typescript
{
  success: boolean;
  data?: any;
  error?: string;
  statusCode?: number;
}
```

### `sendConfirmationEmail(formData)`

Send confirmation emails.

**Parameters:**
- `email` (required): Recipient email
- `recipientName` (required): Recipient name
- `confirmationTitle` (required): Confirmation title
- `confirmationBody` (required): Confirmation body
- `details` (optional): JSON string of details array

**Returns:**
```typescript
{
  success: boolean;
  data?: any;
  error?: string;
  statusCode?: number;
}
```

## Error Handling

All Server Actions return a consistent result object:

```typescript
{
  success: boolean;      // Whether the email was sent successfully
  data?: any;            // Response data from Resend (if successful)
  error?: string;         // Error message (if failed)
  statusCode?: number;    // HTTP status code (if failed)
}
```

### Common Error Codes

- **400**: Validation error - Check your input data
- **401**: Missing API key - Check environment variables
- **403**: Invalid API key or domain not verified
- **429**: Rate limit exceeded - Automatic retry will handle this
- **500**: Server error - Try again later

### Handling Errors

```tsx
'use client';

import { sendEmail } from '@/actions/email/send-email';

export function EmailForm() {
  async function handleSubmit(formData: FormData) {
    const result = await sendEmail(formData);
    
    if (result.success) {
      // Success - show success message
      toast.success('Email sent successfully!');
    } else {
      // Error - handle based on status code
      switch (result.statusCode) {
        case 400:
          toast.error('Invalid email data');
          break;
        case 401:
          toast.error('API key not configured');
          break;
        case 429:
          toast.error('Too many requests, please try again later');
          break;
        default:
          toast.error(`Failed to send email: ${result.error}`);
      }
    }
  }

  return <form action={handleSubmit}>...</form>;
}
```

## Testing

### Local Testing

1. Use Resend's test domain: `onboarding@resend.dev`
2. Send emails only to your own email address
3. Check the Resend dashboard for logs: https://resend.com/dashboard

### Testing with Real Domain

1. Verify your domain in Resend dashboard
2. Update `RESEND_FROM_EMAIL` to use your verified domain
3. Send test emails to real recipients
4. Monitor delivery in Resend dashboard

## Best Practices

### 1. Use Server Actions
- Server Actions are type-safe
- Better performance (no extra HTTP request)
- Direct form integration
- Automatic error handling

### 2. Validate Input
- Always validate email addresses
- Sanitize HTML content
- Check required fields

### 3. Handle Errors Gracefully
- Show user-friendly error messages
- Implement retry logic for rate limits
- Log errors for debugging

### 4. Use Email Templates
- Create reusable React components
- Maintain consistent branding
- Easy to update and maintain

### 5. Monitor Usage
- Check Resend dashboard regularly
- Monitor rate limits
- Track email delivery rates

## Troubleshooting

### Emails not sending

1. Check environment variables are set
2. Verify API key is valid
3. Check domain is verified (for production)
4. Check rate limits in Resend dashboard

### Emails not delivered

1. Check spam folder
2. Verify domain DNS records
3. Check email content for spam triggers
4. Review Resend dashboard logs

### Rate limit errors

The email service automatically retries with exponential backoff. If you're hitting rate limits frequently:

1. Use batch sending for multiple emails
2. Implement a queue system
3. Request a rate limit increase from Resend

## Advanced Features

### Custom Email Templates

Create your own React components:

```tsx
import * as React from 'react';
import { EmailLayout } from '@/components/email/shared/email-layout';
import { EmailFooter } from '@/components/email/shared/email-footer';

interface MyTemplateProps {
  userName: string;
  customData: string;
}

export function MyTemplate({ userName, customData }: MyTemplateProps) {
  return (
    <EmailLayout>
      <h1>Hello {userName}!</h1>
      <p>{customData}</p>
      <EmailFooter />
    </EmailLayout>
  );
}
```

Use it in a Server Action:

```typescript
import { MyTemplate } from '@/components/email/my-template';

const result = await emailService.sendWithRetry({
  from: getFormattedFromAddress(),
  to: 'user@example.com',
  subject: 'Custom Email',
  react: MyTemplate({ userName: 'John', customData: 'Custom data here' }),
});
```

### Email Attachments

```typescript
const result = await emailService.sendWithRetry({
  from: 'noreply@yourdomain.com',
  to: 'user@example.com',
  subject: 'Email with Attachment',
  html: '<p>Please find the attached file.</p>',
  attachments: [
    {
      filename: 'document.pdf',
      path: 'https://yourdomain.com/document.pdf',
    },
  ],
});
```

### Email Tags for Tracking

```typescript
const result = await emailService.sendWithRetry({
  from: 'noreply@yourdomain.com',
  to: 'user@example.com',
  subject: 'Tracked Email',
  html: '<p>This email is tracked.</p>',
  tags: [
    { name: 'category', value: 'welcome' },
    { name: 'user_type', value: 'premium' },
  ],
});
```

## Deployment

### Environment Variables in Production

Set these in your deployment platform (Vercel, Netlify, etc.):

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_FROM_NAME` (optional)

### Monitoring

Set up monitoring for:

- Email send rates
- Success/failure rates
- Rate limit hits
- Error types

## Support

- **Resend Documentation**: https://resend.com/docs
- **Resend Dashboard**: https://resend.com/dashboard
- **Next.js Server Actions**: https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions

## File Structure Reference

```
src/
├── actions/
│   └── email/
│       ├── send-email.ts          # Generic email sending
│       ├── send-batch.ts          # Batch email sending
│       ├── send-welcome.ts        # Welcome email
│       ├── send-notification.ts   # Notification email
│       └── send-confirmation.ts   # Confirmation email
├── components/
│   └── email/
│       ├── welcome-email.tsx      # Welcome template
│       ├── notification-email.tsx  # Notification template
│       ├── confirmation-email.tsx # Confirmation template
│       └── shared/
│           ├── email-layout.tsx   # Base layout
│           └── email-footer.tsx   # Footer component
├── lib/
│   ├── resend.ts                  # Resend client
│   └── email/
│       ├── email-service.ts       # Email service
│       ├── email-validator.ts    # Validation utilities
│       └── email-logger.ts       # Logging utilities
└── types/
    └── email.ts                   # Type definitions
```
