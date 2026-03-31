# Implementation Plan

## [Overview]

Fix the issue where newly created contracts don't appear immediately in the contracts list. The problem is that the contracts page fetches data only once on mount and doesn't listen for the `contracts-updated` event that the layout dispatches after contract creation.

## [Types]

No type changes required.

## [Files]

**Single file to modify:**
- `src/app/dashboard/contracts/page.tsx` - Add event listener for `contracts-updated` custom event to trigger contract re-fetch

## [Functions]

**Modified function:**
- `ContractsPage` component in `src/app/dashboard/contracts/page.tsx`
  - Add a `useEffect` hook that listens to `window.dispatchEvent(new CustomEvent('contracts-updated'))`
  - When the event fires, re-fetch contracts from the API
  - This mirrors the pattern already used in the layout for delete operations

## [Dependencies]

No new dependencies required.

## [Testing]

1. Create a new contract from the dashboard
2. Verify the contract appears immediately in the contracts list without page navigation

## [Implementation Order]

1. **Step 1:** Modify `src/app/dashboard/contracts/page.tsx` to add event listener
   - Add `useEffect` hook with listener for `contracts-updated` event
   - Re-fetch contracts when event is dispatched
   - Clean up event listener on unmount

