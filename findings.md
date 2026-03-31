# Findings: Subscription Production-Safety Test Design

## Billing Architecture Observed
- Checkout route creates Creem checkout session, validates allowed Creem URL host, and writes `billing_audit_logs`.
- Webhook route validates HMAC signatures + timestamp window, persists immutable inbox rows, and processes events through `apply_creem_subscription_event`.
- Duplicate webhook deliveries are deduped at `billing_webhook_inbox.provider_event_id` and can be safely reprocessed when pending/failed.
- Entitlements are derived from latest subscription status via `recompute_entitlement_snapshot`.

## Data Model Constraints Relevant To Testing
- Source-of-truth tables: `billing_customers`, `billing_subscriptions`, `billing_webhook_inbox`, `billing_audit_logs`, `entitlement_snapshots`.
- Unique safety constraints:
  - `billing_customers.user_id` unique
  - `billing_customers.provider_customer_id` unique
  - `billing_subscriptions.provider_subscription_id` unique
  - Partial unique index limiting one active-like subscription state per user
  - `billing_webhook_inbox.provider_event_id` unique (idempotency anchor)

## Important Coverage Gap In Current Schema
- No dedicated `billing_invoices` or `billing_payments` table exists.
- Invoice/payment accuracy can only be validated indirectly through webhook payload persistence (`billing_webhook_inbox.payload_json`) and audit records.

## Execution Findings (2026-03-23)
- Stable suite run passed all 10 required scenarios.
- Webhook signature rejection behaved correctly (401 + no mutation).
- Duplicate webhook delivery correctly returned `duplicate: true` and did not reapply mutations.
- Cross-user isolation held at both API layer (`/api/billing/status`) and RLS table query level.

---

# Findings: Contract Management UI Specification

## Specification Analysis

### Visual Design System

#### Colors
- Primary Background: `#0a0a0a`
- Secondary Background: `#141414`
- Card Background: `#1a1a1a`
- Border: `rgba(255, 255, 255, 0.08)`
- Status Success: `#22c55e`
- Status Warning: `#eab308`
- Status Danger: `#ef4444`
- Status Info: `#3b82f6`
- Accent Cyan: `#06b6d4`

#### Typography
- Font Family: Manrope, JetBrains Mono
- Headings: Manrope 600-700
- Body: Manrope 400-500
- Data/Numbers: JetBrains Mono 500

#### Spacing
- Base unit: 4px
- Common spacing: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64px

---

## Component Specifications

### Duration Picker (Section 1.5)
```
┌─────────────────────────────────────────────┐
│                                             │
│  ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━●   │
│                                             │
│  Start                                  End │
│                                             │
│  [Extend 30 days]  [Set exact date]        │
└─────────────────────────────────────────────┘
```
- Visual bar: Full duration with filled portion
- Filled portion color: `#1a1a1a`
- Handles: Draggable (desktop), tappable (mobile)
- Quick actions below

### Status Selector (Section 1.6)
```
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│ Active │ │Expiring│ │Expired │ │Archive│
│   ●    │ │   ●    │ │   ●    │ │   ●    │
└────────┘ └────────┘ └────────┘ └────────┘
```
- Horizontal pills
- Status colors via dot indicator

### Contract Value Input (Section 1.7)
```
Amount              Currency    Per
┌──────────────┐   ┌────────┐  ┌──────┐
│ 50000        │   │ USD  ▼ │  │ year ▼│
└──────────────┘   └────────┘  └──────┘

≈ $4,166.67/month
≈ $961.54/week
```
- Auto-calculation after 300ms delay
- Monospace for numbers

### Sticky Footer (Section 1.8)
```
┌─────────────────────────────────────────┐
│  [Cancel]              [Save Changes]   │
└─────────────────────────────────────────┘
```
- Background: `rgba(10,10,10,0.8)`
- Backdrop-filter: blur(12px)

### Toast (Section 1.9)
```
┌─────────────────┐
│ ✓  Changes saved│
└─────────────────┘
```
- Position: Fixed top-center, 24px from top
- Background: `#1a1a1a`
- Border: 1px `rgba(255,255,255,0.08)`
- Left border: 2px `#22c55e`
- Shadow: `0 10px 30px rgba(0,0,0,0.3)`
- Animation: translateY(-20px) → 0, fade in

### Animation Timings
| Element | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Panel entry | opacity + blur | 400ms | ease |
| Input focus | border + glow | 200ms | ease |
| Status select | scale + bg | 150ms | ease |
| Save hover | translateY | 150ms | ease |
| Toast | translateY + fade | 300ms | ease-spring |
| Error shake | translateX | 300ms | wobble |

---

## Next.js 16 Best Practices Applied

1. **Server Components**: Data fetching, layouts
2. **Client Components**: Interactive elements only
3. **Server Actions**: Form submissions
4. **Suspense**: Loading states
5. **Built-in caching**: Automatic

---

## Implementation Notes

- All components use TypeScript
- Follow existing component patterns from codebase
- CSS animations in globals.css for reusability
- Mobile-first responsive design

---

## Findings: Contract Edit/Delete

### Active Runtime Source Of Truth
- Active dashboard runtime layout is `src/app/dashboard/layout.tsx`
- `src/app/dashboard/layout-new.tsx` and `src/app/dashboard/layout-server.tsx` are duplicate alternate implementations and are out of scope for the minimal fix

### Verified Existing Support
- Detail modal already exposes `onEdit` and `onDelete` callbacks
- `/api/contracts/[id]` already implements GET, PATCH, and DELETE with session validation and ownership checks
- DB layer already implements `getContractById`, `updateContract`, and `deleteContract`
- RLS policies enforce contract ownership, and related tables inherit access through contract ownership
- `vendor_contacts` and `reminders` use `ON DELETE CASCADE`

### Verified Gaps
- Active layout wires `onDelete` only, not `onEdit`
- Active delete confirmation does not call the API; it only dispatches a client event
- React Query hooks only cover create; there are no update/delete mutations
- `updateContract` does not explicitly handle clearing vendor contact data
- Relation update steps in `updateContract` do not check for errors

### Invariants To Preserve
- Keep mutations on the existing API routes
- Keep React Query as the client cache source of truth in the active layout
- Avoid touching auth/session architecture
- Avoid changing server/client rendering boundaries

---

## Findings: Contract Update Error Debugging

### Root Cause Confirmed
- `PATCH /api/contracts/[id]` updated the contract, then crashed on `updateTag(...)`
- In Route Handlers, Next.js 16 requires `revalidateTag(...)`, not `updateTag(...)`
- The server log proves the 500 came from cache invalidation after the DB write, not from the DB update itself

### Related Runtime Warning
- `DatePicker` used `new Date()` in initial render state
- Because `AddContractForm` is mounted in the dashboard layout, this triggered the Next.js 16 "used new Date() inside a Client Component without a Suspense boundary" warning on dashboard routes

### Debugging Gap
- Form error logging wrapped `Error` objects inside a plain object, which made the browser console show `{}` instead of the actual message/stack

---

## Findings: Stale Contract UI After Edit

### Root Cause Confirmed
- The contracts list API response was explicitly cacheable for 60 seconds in `src/app/api/contracts/route.ts`

---

## Findings: Auth Abuse Protection And Logging Hardening

### Abuse Protection
- Auth pages had client cooldown UX, but `signup`, `login`, and `forgotPassword` server actions still called Supabase directly with no app-side throttling.
- Existing shared rate-limit utility is suitable for server actions as long as we derive the client IP from request headers.
- Email-based limiter keys should be hashed before use so identifiers are not written to fallback stores or logs in plain text.

### Sensitive Logging
- Browser error tracking fell back to a `NEXT_PUBLIC_*` webhook path, which is too permissive for production telemetry.
- Contract form error logging included the full form payload and stack trace in the browser console.
- Email logging included recipient addresses and subject lines.
- Auth error mapping logged raw provider error objects instead of sanitized metadata.
- The client contracts hook fetched that list without `cache: "no-store"`
- The home dashboard in `src/components/dashboard/dashboard-client.tsx` was not using the shared React Query contracts data at all; it only rendered server-passed `initialContracts`

### Why The UI Felt Inconsistent
- `/dashboard/contracts` depended on React Query + `/api/contracts`
- `/dashboard` depended on server-fetched `initialContracts`
- Contract mutations invalidated React Query queries, but the home dashboard list was not subscribed to those queries

### Professional Source Of Truth
- Client-rendered contract lists should share one query source of truth
- Server-fetched dashboard data should seed that client cache, not compete with it
- Authenticated mutable contract list responses should not be browser-cacheable

### Immediate UI Update Follow-up
- Invalidating queries alone was correct but not instant
- A professional compromise is to patch cached contract lists immediately on mutation success and still invalidate afterward as a safety net
- This keeps cache logic centralized in the shared hook instead of scattering `setQueryData` calls across pages/components
- For create specifically, only page-1 cached lists should be inserted immediately from partial cache data; deeper pages should update total counts and rely on refetch for exact membership

---

## Findings: Contract Mutation Atomicity And Date Integrity

### Root Cause Confirmed
- `createContract` inserted into `contracts`, then separately inserted `vendor_contacts`, then separately inserted `reminders`
- `updateContract` updated `contracts`, then separately mutated `vendor_contacts`, then separately replaced `reminders`
- Because those writes were app-orchestrated Supabase calls, any later failure could leave partial persisted state

---

## Findings: Email Reminder Delivery Completion

### Root Causes Confirmed
- Reminder creation exists, but there is no reminder delivery worker, scheduler endpoint, or route that marks `sent_at`
- Resend integration exists only as a generic utility layer; nothing in the app invokes it for contract reminders
- `emailReminders` is currently inferred from `notify_emails.length > 0`, so the product has no durable server-side source of truth for "send reminder emails for this contract"

### Code-Proven Gaps
- Reminder rows are inserted by the contract RPC functions
- The reminders table includes `sent_at`, which implies intended background processing
- No current route, action, hook, or script loads due reminders and calls `emailService`
- The reminder form labels `notifyEmails` as additional recipients, so using `notify_emails` as the only source of truth for email enablement is semantically wrong

### Constraints From The Existing Codebase
- The active authenticated contract mutations already pass `emailReminders` through API -> DB layer
- `profiles.email_notifications` and `profiles.timezone` already exist and should be respected by reminder processing
- The app build targets standalone Node.js deployment; Vercel-specific scheduling cannot be the only supported trigger path
- `.env.local` currently includes Supabase variables but not Resend variables, so the implementation must validate missing Resend config cleanly

### Best-Fit Direction
- Put `emailReminders` on `contracts` as the contract-level source of truth
- Add a protected internal Route Handler for server-side reminder processing
- Use the Supabase admin client only inside that server-only route
- Use deterministic Resend idempotency keys per reminder send attempt to avoid duplicate outbound emails during retries
- Use Supabase Cron with `pg_cron` + `pg_net` to schedule the processor instead of relying on a platform-specific scheduler
- Store the app base URL and cron bearer token in Vault so the database scheduler never hardcodes secrets in migration SQL

### Post-Implementation Verification
- TypeScript and focused ESLint both pass on the reminder-delivery change set
- The reminder schema migrations are now applied on the linked remote Supabase project
- The Supabase Cron helper RPCs are now live on the remote project and return an unconfigured status until a public app URL and cron secret are provided
- A real end-to-end send test is still blocked by the current development-phase constraints: `NEXT_PUBLIC_APP_URL` is localhost and Resend delivery secrets are not configured for live sending
- Atomic claiming is now implemented through `claim_due_email_reminders(...)`, and the remote RPC was verified live against the linked project
- The temporary live verification claim was explicitly released after the check so no reminder row was left stuck

### Related Risk Closed
- `get_due_email_reminders(...)` depends on `profiles.timezone`, and `updateProfileAction` previously accepted any trimmed string
- Server-side profile validation now rejects unsupported timezone values before they reach the reminders query path

### Concurrency Hardening Applied
- Real reminder runs no longer fetch due rows and then race to send them later
- The processor now claims due reminders atomically in SQL before sending
- Reminder rows are finalized per reminder, which narrows the crash window compared to batch-marking `sent_at` only at the end

### Development-Phase Constraint Confirmed
- A remote Supabase Cron job cannot reach `http://localhost:3000`
- The codebase is now ready for scheduling, but enabling the actual cron job must wait until the app has a public domain or tunnel URL and matching `CRON_SECRET`/`RESEND_*` configuration

### Source-Of-Truth Conflict Confirmed
- `src/lib/db/contracts.ts` had its own date-only normalization and status/display logic
- `src/lib/utils/date-utils.ts` separately parsed date strings with `new Date(...)`
- `src/app/dashboard/layout.tsx` separately converted date-only strings back into `Date` with `new Date(...)`
- `src/lib/validation/contract-schema.ts` compared `new Date(startDate)` and `new Date(endDate)`, which also drifted from the database `DATE` semantics

### Verified Integrity Gaps
- Database schema still uses `DATE` columns for `start_date` and `end_date`
- Validation allowed same-day start/end while the database check constraint requires `end_date > start_date`
- `updated_at` no longer auto-updates from a trigger because the trigger was removed in the schema simplification migration

### Minimal Permanent Direction
- Reintroduce atomic create/update via database RPC functions with `SECURITY INVOKER` so RLS remains authoritative
- Centralize `DATE` parsing/formatting in the shared date utility and reuse it from DB transforms, validation, and the active edit form
- Keep API routes and client mutation hooks unchanged so the contract flow architecture does not broaden during this pass

---

# Findings: Production Hardening Implementation (2026-03-24)

## Key Technical Findings
- Webhook ingestion now returns fast-ack (`202` for new, `200` duplicate) and no longer blocks request latency on synchronous event application.
- Async reconciliation required compatibility fallback for environments where claim/retry migration is not yet applied; fallback now processes pending/failed rows without claim token.
- Internal reminder processor route had a Next.js 16 compile blocker (`runtime` segment config incompatible with `cacheComponents`), which caused hard `500` responses until removed.
- Reminder failure path now operates against simplified schema and does not attempt `failed_at` / `error_message` writes.

## Validation Findings
- `npm run test:reminders` passes after route-segment fix and reminder regression test addition.
- Subscription suite rerun reached `6/10` pass before external Supabase DNS failures (`ENOTFOUND`) interrupted remaining cases.
- Prior webhook async-semantics assertion failures were resolved by updating tests to accept ingest semantics and trigger reconcile polling.
- Final subscription integration rerun after async-webhook test updates passed all 10 scenarios end-to-end.
- Updated production load report (`2026-03-24T10:38:38.172Z`) shows first breaking point at `contracts_ramp_20` with p95 `10962.96ms`.
- Webhook ingestion acceptance improved in the latest run (`webhook_burst` error rate `0.11%`), but worker backlog drain still failed SLO due persistent `failed` queue growth.
- Checkout outage handling behaved as designed: outage scenario returned controlled failures and recovery scenario returned to zero error rate.
- Migration execution against linked Supabase cannot proceed from this environment without CLI auth token or DB password.

---

# Findings: Security/Scalability Hardening (Items 3-8)

## Root-Cause Snapshot
- Critical auth/billing paths call `checkRateLimit(...)`, but fallback chain allows non-persistent memory fallback when durable storage is unavailable.
- `/api/contracts` query parsing uses `parseInt` without finite validation before DB-bound RPC arguments.
- ESLint config disables core safeguards (`no-explicit-any`, hooks deps, unused vars, no-console), and TS config permits implicit `any`.
- CI workflow folder is absent; no required automated gate for lint/type/tests/audit on PRs.
- Landing page has a very large monolith and a stale alternate page variant.
- Observability is inconsistent: mostly console logging, partial request-id usage, and no explicit redaction policy in error payload processing.
