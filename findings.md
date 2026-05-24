# Findings

## Initial Observations
- The repo already contains auth, billing, CSRF, rate limiting, and webhook handling.
- Creem is already the payment provider in code, so switching providers would be unnecessary churn.
- The requested backend is not a blank slate; the main work is hardening and completing existing flows.

## Code-Backed Notes
- Checkout route: `src/app/api/billing/checkout/route.ts`
- Webhook route: `src/app/api/webhooks/creem/route.ts`
- Webhook signature verification: `src/lib/billing/webhook-signature.ts`
- CSRF validation: `src/lib/security/csrf.ts`
- Rate limiting: `src/lib/security/rate-limit.ts`
- Supabase server auth: `src/lib/supabase/server.ts`
- Billing schema and RLS: `supabase/migrations/20260323000001_add_secure_billing_and_entitlements.sql`

## Current Gaps to Check
- Checkout deduplication is in-memory, so it may not survive multi-instance deployment.
- Webhook signature verification should be reviewed for strict timestamp binding.
- The report text may not match all actual status codes and control behavior.

