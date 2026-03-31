# Task Plan: Subscription Production-Safety Integration Testing

## Goal
Create and run exactly 10 high-value integration tests that validate subscription checkout, recurring billing state transitions, webhook security/idempotency, authorization isolation, and database consistency.

## Scope
- Add a runnable integration test harness under `tests/integration`
- Exercise app routes:
  - `POST /api/billing/checkout`
  - `GET /api/billing/status`
  - `POST /api/webhooks/creem`
- Verify DB mutations in billing tables and entitlement snapshots
- Include cleanup for all created test fixtures

## Will Not Touch
- Core billing business logic implementation
- Production migration definitions (read-only verification only)

## Phases
| Phase | Status | Description |
|-------|--------|-------------|
| A | `complete` | Map billing/webhook data model and test harness constraints |
| B | `complete` | Implement 10-scenario integration test suite |
| C | `complete` | Execute suite and capture pass/fail evidence |
| D | `complete` | Summarize confidence, residual risk, and next tests |

---

# Task Plan: Contract Management UI Specification Implementation

## Goal
Implement all features from the pasted specification document for the contract management dashboard.

---

## Phase Status

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | `complete` | Duration Picker - Visual date range selector |
| 2 | `complete` | Status Selector - Horizontal pills UI |
| 3 | `complete` | Contract Value Calculator - Auto-calculates alternatives |
| 4 | `complete` | Full-screen Mobile Sheet |
| 5 | `complete` | Enhanced Toast System |
| 6 | `complete` | Validation States & Animations |
| 7 | `complete` | Sticky Footer Glass Effect |

---

## Features Detail

### Phase 1: Duration Picker (Section 1.5)
- Visual bar showing full duration
- Filled portion: `#1a1a1a`
- Handles: Drag to adjust (desktop), tap to edit (mobile)
- Quick actions: "Extend 30 days" / "Set exact date"

### Phase 2: Status Selector (Section 1.6)
- Horizontal pills: Active | Expiring | Expired | Archive
- Visual indicator dot with status colors

### Phase 3: Contract Value Calculator (Section 1.7)
- Amount, Currency, Per (year/month/week)
- Auto-calculates alternatives below
- Monospace for numbers
- 300ms fade-in delay

### Phase 4: Full-screen Mobile Sheet (Section 1.10)
- Header: 56px, sticky
- Save button: Top right
- Drag down to dismiss with unsaved warning

### Phase 5: Enhanced Toast (Section 1.9)
- Position: Fixed top-center, 24px from top
- Left border: 2px success color (#22c55e)
- Animation: translateY + fade

### Phase 6: Validation States (Section 1.11)
- Input shake animation (300ms)
- Error styling with icons

### Phase 7: Sticky Footer Glass Effect (Section 1.8)
- Background: rgba(10,10,10,0.8)
- Backdrop-filter: blur(12px)

---

## Technical Decisions

### Framework: Next.js 16
- Server Components for data fetching
- Client Components only for interactivity
- TypeScript for type safety

### CSS Approach
- Tailwind CSS utilities
- Custom CSS animations in globals.css
- Match spec timing exactly

---

## Files to Create/Modify

### New Components
- `src/components/dashboard/duration-picker.tsx`
- `src/components/dashboard/status-pills.tsx`
- `src/components/dashboard/value-calculator.tsx`
- `src/components/dashboard/enhanced-toast.tsx`

### Modify Existing
- `src/components/dashboard/slide-over-panel.tsx` - Add mobile full-screen
- `src/components/dashboard/add-contract-form.tsx` - Integrate new components
- `src/app/globals.css` - Add animation utilities

---

## Next Action
Start implementing Phase 1: Duration Picker component

---

## Task Plan: Contract Edit/Delete Wiring

### Goal
Enable users to edit and delete their own contracts through the active dashboard runtime path without changing the broader dashboard architecture.

### Scope
- Modify only the active runtime dashboard layout: `src/app/dashboard/layout.tsx`
- Reuse existing detail modal and add-contract form
- Add missing update/delete React Query mutations in `src/hooks/use-contracts.ts`
- Tighten contract relation update behavior in `src/lib/db/contracts.ts`

### Will Not Touch
- `src/contexts/AuthContext.tsx`
- `src/app/dashboard/layout-new.tsx`
- `src/app/dashboard/layout-server.tsx`
- API route shape in `src/app/api/contracts/route.ts`
- Auth/session architecture

---

## Task Plan: Auth Abuse Protection And Sensitive Logging Hardening

### Goal
Reduce MVP launch risk by adding real server-side throttling to auth flows and removing sensitive data from app/browser logs and client-side error webhook paths.

### Scope
- `src/actions/auth.ts`
- `src/lib/error-tracking.ts`
- `src/lib/email/email-logger.ts`
- `src/lib/errors/auth-errors.ts`
- `src/components/dashboard/add-contract-form.tsx`
- `src/lib/env/public.ts`

### Will Not Touch
- Supabase auth provider configuration
- CAPTCHA/Turnstile integration
- Core billing logic

### Phases
| Phase | Status | Description |
|-------|--------|-------------|
| A | `complete` | Add server-side auth rate limiting for signup, login, and forgot-password |
| B | `complete` | Redact sensitive logs and disable browser webhook fallback telemetry |
| C | `complete` | Run focused ESLint and TypeScript verification |

### Phases
| Phase | Status | Description |
|-------|--------|-------------|
| A | `in_progress` | Wire active layout edit/delete flow |
| B | `pending` | Add update/delete hooks with cache invalidation |
| C | `pending` | Fix DB relation update edge cases |
| D | `pending` | Run focused verification |

---

## Task Plan: Contract Update Error Debugging

### Goal
Resolve the contract edit flow returning `Internal server error` and remove the related Next.js 16 client-time render warning.

### Scope
- `src/app/api/contracts/[id]/route.ts`
- `src/components/dashboard/form-inputs.tsx`
- `src/components/dashboard/add-contract-form.tsx`

### Will Not Touch
- Auth/session architecture
- Contract DB schema
- Dashboard layout data flow

### Phases
| Phase | Status | Description |
|-------|--------|-------------|
| A | `complete` | Trace client mutation -> route -> server log failure |
| B | `complete` | Patch route cache invalidation bug |
| C | `complete` | Patch DatePicker current-time render warning |
| D | `complete` | Improve error logging and run focused lint |

---

## Task Plan: Stale Edit UI After Mutation

### Goal
Make edited contract changes appear immediately on the dashboard and contracts screens without requiring navigation.

### Scope
- `src/hooks/use-contracts.ts`
- `src/components/dashboard/dashboard-client.tsx`
- `src/app/api/contracts/route.ts`
- `src/app/dashboard/page.tsx`

### Will Not Touch
- Auth/session architecture
- Contract DB update logic
- Modal component structure

### Phases
| Phase | Status | Description |
|-------|--------|-------------|
| A | `complete` | Trace stale-data path after edit |
| B | `complete` | Remove browser/API caching from mutable contract list fetches |
| C | `complete` | Make dashboard home consume shared contracts query state |
| D | `complete` | Run focused verification |

---

## Task Plan: Contract Mutation Atomicity And Date Integrity

### Goal
Eliminate partial contract writes and timezone-fragile date-only handling in the active contract flow without widening into unrelated architecture changes.

### Scope
- `supabase/migrations/20260321000001_restore_atomic_contract_mutations.sql`
- `src/lib/db/contracts.ts`
- `src/lib/utils/date-utils.ts`
- `src/lib/validation/contract-schema.ts`
- `src/app/dashboard/layout.tsx`

### Will Not Touch
- Auth/session architecture
- Legacy dashboard layouts
- React Query cache strategy
- Contract detail modal fetch architecture

### Phases
| Phase | Status | Description |
|-------|--------|-------------|
| A | `complete` | Trace non-atomic contract create/update path and date-only parsing conflicts |
| B | `complete` | Verify minimal permanent fix against official Supabase/Postgres guidance |
| C | `complete` | Restore atomic DB mutation boundary with RPC functions |
| D | `complete` | Centralize date-only parsing/formatting in shared utilities and active form path |
| E | `complete` | Run focused ESLint and TypeScript verification |

---

## Task Plan: Email Reminder Delivery Completion

### Goal
Make contract email reminders production-correct by adding a real server-side delivery path, a durable server-side source of truth for the per-contract email toggle, and secure Resend-backed processing without changing the existing auth or dashboard architecture.

### Scope
- `supabase/migrations/*` for the smallest schema/function change required
- `src/lib/db/contracts.ts`
- `src/app/api/contracts/route.ts`
- `src/app/api/contracts/[id]/route.ts`
- `src/lib/env.ts`
- `src/lib/email/email-service.ts`
- New reminder processing code under `src/lib/reminders/*`
- New internal reminder processing route under `src/app/api/internal/*`

### Will Not Touch
- `src/contexts/AuthContext.tsx`
- React Query cache architecture in `src/hooks/use-contracts.ts`
- Existing contract page layouts unrelated to reminder delivery
- Login/signup/session architecture

### Phases
| Phase | Status | Description |
|-------|--------|-------------|
| A | `complete` | Trace reminder persistence, Resend integration, and missing delivery path |
| B | `complete` | Validate permanent fix options against official Next.js, React, Resend, Supabase, and Vercel docs |
| C | `complete` | Implement minimal permanent fix with Supabase-backed due reminder processing and Resend delivery |
| D | `complete` | Run focused TypeScript/ESLint verification and document remaining live-deployment blockers |
| E | `complete` | Add atomic reminder claiming to harden concurrent processing |

---

# Task Plan: Production Hardening Implementation (Rate-Limit Store Deferred)

## Goal
Implement and validate the production hardening changes for reminders, webhook ingestion/processing, auth/contracts hot paths, provider outage handling, and load-harness realism while deferring distributed/shared rate limiting.

## Phase Status
| Phase | Status | Description |
|-------|--------|-------------|
| 1 | `complete` | Reminder processor schema-alignment fix + failure-path behavior |
| 2 | `complete` | Webhook fast-ack + async worker claim/retry/dead-letter pipeline |
| 3 | `complete` | Auth/contracts hot-path performance changes (`getClaims`, API bypass, countMode) |
| 4 | `complete` | Creem/Resend retry hardening + controlled checkout `503` behavior |
| 5 | `complete` | DB migration package for claim columns + restored indexes + claim RPC |
| 6 | `complete` | Load harness updated for production mode + backlog/soak/outage-recovery scenarios |
| 7 | `in_progress` | Full integration validation rerun under stable network conditions |

## Known Validation Blockers
- Subscription suite rerun reached `6/10` passing before DNS failures against Supabase (`ENOTFOUND`) interrupted remaining cases.
- Reminder regression test passes locally after route segment-config fix.

---

# Task Plan: Security/Scalability Hardening (Items 3-8)

## Goal
Implement a permanent, secure, and scalable baseline for: fail-closed critical rate limits, safe contracts query parsing, lint/type safety ratchet, CI quality/security gates, stale layout cleanup + monolith risk reduction, and production observability.

## Phases
| Phase | Status | Description |
|-------|--------|-------------|
| 1 | `in_progress` | Deep root-cause + dependency tracing for items 3-8 |
| 2 | `pending` | Research + compare 5 solution methods (official docs validation) |
| 3 | `pending` | Select most secure/scalable method with system-wide risk analysis |
| 4 | `pending` | Implement selected method across codebase |
| 5 | `pending` | Execute verification tests and summarize residual risk |

## Acceptance Criteria
- Critical auth/billing limiter fails closed when persistent backend unavailable.
- Contracts pagination/query params are finite, bounded, and defaulted before DB calls.
- Core lint/type policies are re-enabled with enforceable CI gates.
- CI workflow blocks PRs on lint/type/test/e2e smoke + security audit threshold.
- Stale landing/layout variant removed and monolith regression surface reduced.
- Structured logging + request correlation + redaction-aware error tracking baseline implemented.

## Constraints
- Avoid over-engineering and preserve current MVP behavior.
- Prefer incremental hardening with clear rollout safety.
- Keep changes auditable and testable.
