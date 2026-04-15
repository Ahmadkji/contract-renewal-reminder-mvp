---
name: overlay-fix
description: Fix overlay, modal, drawer, and bottom-sheet component issues including z-index conflicts, portal rendering, scroll locking, and positioning problems. Use when fixing modal overlap, drawer positioning, z-index layering, backdrop issues, or when overlays appear behind other content.
---

# Overlay/M Modal Fix

## Root Cause Analysis

Common overlay issues:
1. **Z-index conflicts**: Overlay renders below other elements (footer, navbar, etc.)
2. **Stacking context traps**: Parent creates new stacking context, trapping overlay
3. **Positioning confusion**: Bottom-sheet vs centered modal visual overlap
4. **Scroll behavior**: Body scrolls while overlay is open
5. **Legacy CSS conflicts**: Old CSS classes conflict with component implementation

## Fix Checklist

When diagnosing overlay issues, check:

- [ ] Is the overlay portaled to `document.body`?
- [ ] Are z-index values high enough? (suggested: backdrop `z-[120]`, panel `z-[130]`)
- [ ] Does the overlay have correct positioning for device size?
- [ ] Is body scroll locked when overlay is open?
- [ ] Are there legacy CSS classes causing conflicts?

## Implementation Pattern

### 1. Portal to Body

Always render overlays at the document body level to escape stacking contexts:

```tsx
import { createPortal } from "react-dom"

function MyModal({ open, children }) {
  if (!open) return null
  
  return createPortal(
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm" />
      
      {/* Panel */}
      <div className="fixed inset-x-0 bottom-0 z-[130] ...">
        {children}
      </div>
    </>,
    document.body
  )
}
```

### 2. Z-Index Hierarchy

Use consistent z-index values:

| Layer | Z-Index | Purpose |
|-------|---------|---------|
| Navigation | `z-40` | Headers, navbars |
| Dropdowns | `z-50` | Menus, tooltips |
| Modal backdrop | `z-[120]` | Dark overlay behind modal |
| Modal panel | `z-[130]` | The modal itself |
| Toast/Alerts | `z-[140]` | Highest priority notifications |

### 3. Responsive Positioning

Mobile = bottom sheet, Desktop = centered modal:

```tsx
<div className={cn(
  "fixed z-[130] mx-auto flex max-h-[92vh] w-full flex-col bg-[#0a0a0a] shadow-2xl transition-transform duration-300 ease-out",
  // Mobile: bottom sheet
  "inset-x-0 bottom-0 border-t rounded-t-2xl",
  // Desktop: centered modal with bottom offset
  "sm:bottom-4 sm:rounded-2xl sm:border sm:w-[95vw] sm:max-w-2xl",
  open ? "translate-y-0" : "translate-y-full"
)}>
```

### 4. Lock Body Scroll

Prevent background scroll when overlay is open:

```tsx
useEffect(() => {
  if (open) {
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }
}, [open])
```

## Common Issues

### Issue: Overlay appears behind footer
**Fix**: Portal to `document.body` + increase z-index

### Issue: Drag handle visible when closed
**Check**: 
- `translate-y-full` class present when closed?
- `open` prop correctly controlled by parent?
- No CSS override preventing transform?

### Issue: Bottom sheet overlaps with legal footer on desktop
**Fix**: Center on desktop (`sm:bottom-4 sm:rounded-2xl`), keep bottom-sheet on mobile

### Issue: Body scrolls while modal is open
**Fix**: Add `useEffect` to lock `document.body.style.overflow = "hidden"`

## Validation Steps

After fixing overlay issues:

1. **Visual test**: Open overlay, verify it appears above all other content
2. **Z-index check**: Inspect element, confirm z-index values
3. **Portal check**: Verify DOM structure shows overlay as direct child of `<body>`
4. **Scroll test**: Try scrolling background while overlay is open (should be locked)
5. **Responsive test**: Check mobile (bottom-sheet) and desktop (centered modal)

## Legacy CSS Cleanup

If you find unused CSS classes in globals.css:

```css
/* ❌ Remove if not used */
.slide-over-panel {
  position: fixed;
  /* ... */
}
```

Search for usage before removing:
```bash
grep -r "slide-over-panel" src/
```

## Example: Complete SlideOverPanel

See [slide-over-panel.tsx](../../src/components/dashboard/slide-over-panel.tsx) for reference implementation.
