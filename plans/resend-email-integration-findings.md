# Resend Email Integration - Findings

## Research Notes

### Resend Overview
- **Service**: Email API service for developers
- **Website**: https://resend.com/
- **Documentation**: https://resend.com/docs
- **SDK**: Node.js SDK with React component support
- **Rate Limit**: 2 requests per second per team (default)

### Key Features Identified
- ✅ Transactional emails
- ✅ Email templates (React components)
- ✅ Analytics and tracking
- ✅ Webhooks
- ✅ DKIM/SPF setup
- ✅ Rate limiting
- ✅ Batch sending
- ✅ Scheduled emails
- ✅ Attachments (file, base64, inline images)

### Integration Options (3 Approaches Analyzed)

#### Option 1: Resend SDK with API Routes (App Router)
```typescript
// app/api/send/route.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST() {
  const response = await resend.emails.send({
    from: 'Acme <onboarding@resend.dev>',
    to: ['delivered@resend.dev'],
    subject: 'hello world',
    html: '<strong>it works!</strong>',
  });

  return Response.json(response, {
    status: response.error ? 500 : 200,
  });
}
```

**Pros:**
- Traditional REST API approach
- Easy to test with curl/Postman
- Clear separation of concerns
- Works with any frontend framework

**Cons:**
- Requires additional HTTP request
- More boilerplate code
- Less integrated with Next.js 16 features

#### Option 2: Resend SDK with Server Actions ⭐ RECOMMENDED
```typescript
// app/actions/send-email.ts
"use server";

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail(formData: FormData) {
  const { data, error } = await resend.emails.send({
    from: 'Acme <onboarding@resend.dev>',
    to: [formData.get("email")],
    subject: 'Hello world',
    react: EmailTemplate({ firstName: 'John' }),
  });

  return { success: !error, data, error };
}
```

**Pros:**
- Native Next.js 16 feature
- No additional HTTP requests
- Direct form integration
- Type-safe with TypeScript
- Better performance
- Automatic error handling
- Progressive enhancement

**Cons:**
- Next.js specific
- Requires Server Actions understanding

#### Option 3: Direct API calls with fetch
```typescript
export async function sendEmailDirect() {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Acme <onboarding@resend.dev>',
      to: ['delivered@resend.dev'],
      subject: 'hello world',
      html: '<strong>it works!</strong>',
    }),
  });

  return response.json();
}
```

**Pros:**
- No SDK dependency
- Full control over request
- Lightweight

**Cons:**
- More error handling needed
- No type safety
- Manual retry logic
- Missing SDK features (batch, templates, etc.)

### Next.js 16 Compatibility
- ✅ Server Components support - Full support
- ✅ Server Actions support - Full support (recommended)
- ✅ Environment variable handling - Via process.env
- ✅ Edge runtime compatible - Yes
- ✅ React 19 compatible - Yes

### Security Considerations
- ✅ API key management via environment variables
- ✅ Rate limiting (2 req/sec default)
- ✅ Input validation required
- ✅ Error handling for all HTTP status codes
- ✅ Webhook signature verification
- ✅ Domain verification required for production

---

## Documentation Links
- Official Docs: https://resend.com/docs
- Node.js SDK: https://resend.com/docs/send-with-nodejs
- Next.js Integration: https://resend.com/docs/send-with-nextjs
- Server Actions Examples: https://github.com/resend/resend-examples
- Error Handling: https://resend.com/docs/api-reference/errors
- Rate Limits: https://resend.com/docs/api-reference/introduction
- API Keys: https://resend.com/docs/knowledge-base/how-to-handle-api-keys

---

## Questions Answered

### 1. What are the different ways to integrate Resend with Next.js 16?
**Answer:** Three main approaches:
- API Routes (traditional REST)
- Server Actions (Next.js 16 native, recommended)
- Direct fetch calls (no SDK)

### 2. Which approach is best for Server Actions vs API Routes?
**Answer:** Server Actions is recommended because:
- Native Next.js 16 feature
- Better performance (no extra HTTP request)
- Type-safe with TypeScript
- Direct form integration
- Progressive enhancement

### 3. How to handle email templates?
**Answer:** Two options:
- **React Components** (recommended): Use React components as email templates with the `react` parameter
- **Hosted Templates**: Use Resend's template system with template ID and variables

```typescript
// React Component Template
import * as React from 'react';

interface EmailTemplateProps {
  firstName: string;
}

export function EmailTemplate({ firstName }: EmailTemplateProps) {
  return (
    <div>
      <h1>Welcome, {firstName}!</h1>
    </div>
  );
}

// Usage
await resend.emails.send({
  from: 'Acme <onboarding@resend.dev>',
  to: ['user@example.com'],
  subject: 'Welcome',
  react: EmailTemplate({ firstName: 'John' }),
});
```

### 4. What error handling patterns are recommended?
**Answer:** Handle all HTTP status codes:
- 400: Validation errors, invalid idempotency key
- 401: Missing or restricted API key
- 403: Invalid API key, domain not verified
- 404: Endpoint not found
- 405: Method not allowed
- 409: Idempotency conflicts
- 422: Invalid parameters, attachments
- 429: Rate limit exceeded, quota exceeded
- 500: Server error

```typescript
try {
  const { data, error } = await resend.emails.send({...});
  
  if (error) {
    // Handle specific errors
    if (error.statusCode === 429) {
      // Rate limit exceeded - implement retry with exponential backoff
    }
    return { success: false, error };
  }
  
  return { success: true, data };
} catch (error) {
  return { success: false, error };
}
```

### 5. How to configure environment variables securely?
**Answer:**
```bash
# .env.local (add to .gitignore)
RESEND_API_KEY=re_xxxxxxxxx
RESEND_WEBHOOK_SECRET=wh_xxxxxxxxx
```

**Best Practices:**
- Never commit API keys to version control
- Use .env.local for local development
- Configure in deployment platform (Vercel, etc.)
- Rotate API keys regularly
- Delete unused keys after 30 days

### 6. What are the rate limits and how to handle them?
**Answer:**
- Default: 2 requests per second per team
- Can be increased for trusted senders
- Returns 429 status when exceeded
- Implement exponential backoff for retries

```typescript
async function sendWithRetry(emailData, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { data, error } = await resend.emails.send(emailData);
      if (!error) return { success: true, data };
      
      if (error.statusCode === 429 && attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      return { success: false, error };
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
    }
  }
}
```

### 7. How to test email sending locally?
**Answer:**
- Use Resend's test domain: `onboarding@resend.dev`
- Send to your own email during development
- Check Resend dashboard for logs
- Use API routes/Server Actions to test

```bash
# Install Resend SDK
npm install resend

# Add to .env.local
RESEND_API_KEY=re_xxxxxxxxx

# Test with curl
curl -X POST http://localhost:3000/api/send \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com"}'
```

---

## Code Examples Collected

### Basic Email Sending (API Route)
```typescript
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST() {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Acme <onboarding@resend.dev>',
      to: ['delivered@resend.dev'],
      subject: 'Hello world',
      html: '<h1>Hello world</h1>',
    });

    if (error) {
      return Response.json({ error }, { status: 500 });
    }

    return Response.json({ data });
  } catch (error) {
    return Response.json({ error }, { status: 500 });
  }
}
```

### Server Action with Batch Send
```typescript
"use server";

import { resend } from "@/lib/resend";

export async function submitContactForm(formData: FormData) {
  const { data, error } = await resend.batch.send([
    // Email to user
    {
      from: "Acme <onboarding@resend.dev>",
      to: [formData.get("email")],
      subject: "We received your message",
      react: ConfirmationEmail({ ... }),
    },
    // Email to team
    {
      from: "Acme <onboarding@resend.dev>",
      to: ["onboarding@resend.dev"],
      subject: "New contact form submission",
      react: NotificationEmail({ ... }),
    },
  ]);

  return { success: !error };
}
```

### Email Template with React
```typescript
import * as React from 'react';

interface EmailTemplateProps {
  firstName: string;
}

export function EmailTemplate({ firstName }: EmailTemplateProps) {
  return (
    <div>
      <h1>Welcome, {firstName}!</h1>
    </div>
  );
}
```

### Webhook Handler
```typescript
export async function POST(request: Request) {
  const payload = await request.text();

  // Always verify webhook signatures!
  const event = resend.webhooks.verify({
    payload,
    headers: { /* svix headers */ },
    secret: process.env.RESEND_WEBHOOK_SECRET,
  });

  if (event.type === 'email.received') {
    // Fetch full email content
    const { data: email } = await resend.emails.receiving.get(
      event.data.email_id
    );
    // Process the email...
  }

  return new Response('OK');
}
```

---

## Best Practices Identified

### 1. Use Server Actions for Email Sending
- Native Next.js 16 feature
- Better performance
- Type-safe
- Direct form integration

### 2. Use React Components for Email Templates
- Type-safe templates
- Reusable components
- Dynamic content
- Easy to maintain

### 3. Implement Proper Error Handling
- Handle all HTTP status codes
- Implement retry logic for 429 errors
- Log errors for debugging
- User-friendly error messages

### 4. Secure API Key Management
- Use environment variables
- Never commit to version control
- Rotate keys regularly
- Use different keys for dev/prod

### 5. Rate Limit Handling
- Implement exponential backoff
- Queue emails if needed
- Monitor usage
- Request limit increase if needed

### 6. Domain Verification
- Verify domain before production
- Use verified domain in `from` field
- Configure DKIM/SPF records
- Test with test domain first

### 7. Testing Strategy
- Use test domain during development
- Test with your own email
- Check dashboard logs
- Implement email preview

### 8. Email Design Best Practices
- Use responsive design
- Test across email clients
- Include plain text version
- Optimize images
- Use inline styles

---

## Potential Issues

### 1. Domain Verification Error (403)
**Issue**: Can only send to your own email without verified domain
**Solution**: Verify domain in Resend dashboard, update `from` field

### 2. Rate Limit Exceeded (429)
**Issue**: Exceeding 2 requests/second limit
**Solution**: Implement exponential backoff, batch emails, request limit increase

### 3. Invalid API Key (403)
**Issue**: API key is invalid or restricted
**Solution**: Verify API key, check permissions, regenerate if needed

### 4. Template Validation Error
**Issue**: Using `html`, `text`, or `react` with template ID
**Solution**: Use only `template` object when using hosted templates

### 5. Attachment Size Limits
**Issue**: Attachments too large
**Solution**: Use URLs for large files, compress images, check size limits

### 6. Email Delivery Issues
**Issue**: Emails not delivered
**Solution**: Check spam folders, verify domain, check dashboard logs

### 7. Webhook Signature Verification
**Issue**: Webhook verification fails
**Solution**: Verify secret, check headers, use official SDK verification

---

## Project Compatibility

### Current Project Stack
- **Next.js**: 16.1.1 ✅
- **React**: 19.0.0 ✅
- **TypeScript**: 5.x ✅
- **Node**: Compatible ✅

### Required Dependencies
```json
{
  "dependencies": {
    "resend": "^3.0.0"
  }
}
```

### Environment Variables Needed
```bash
RESEND_API_KEY=re_xxxxxxxxx
RESEND_FROM_EMAIL=your-domain@yourdomain.com
```

---

## Recommended File Structure
```
src/
├── actions/
│   └── email/
│       ├── send-email.ts
│       ├── send-batch.ts
│       └── send-welcome.ts
├── components/
│   └── email/
│       ├── welcome-email.tsx
│       ├── notification-email.tsx
│       └── confirmation-email.tsx
├── lib/
│   └── resend.ts
└── types/
    └── email.ts
```
