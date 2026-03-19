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
