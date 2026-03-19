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