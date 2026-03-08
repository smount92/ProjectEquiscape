---
description: Desktop UI polish — 10 fixes across header, containers, grids, and page-specific improvements based on 1440px audit.
---

# Desktop Polish Workflow

> **Audit date:** 2026-03-08
> **Resolution:** 1440×900 (standard desktop)
> **Test account:** testbot@modelhorsehub.com / testbot123
> **Key findings:** Header wraps to 2 rows, pages feel too narrow, grids don't use widescreen space

// turbo-all

## Pre-flight

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## The Big 3 Issues (from screenshots)

Looking at the screenshots:

1. **Header wraps to 2 rows** — 14 nav links don't fit in one line at 1440px. Row 1: Digital Stable, My Profile, Show Ring, Discover, Feed, Shows, Wishlist, Claim. Row 2: Settings, Inbox, 🔔, Home, About, Contact. This looks cluttered.

2. **Pages are too narrow** — Feed, Dashboard, Settings all feel like they're in a skinny column with massive dark gutters on both sides.

3. **Grids don't scale up** — Show Ring uses 3 columns (good), Profile uses 3 columns (could be 4), Discover only shows 2 cards per row.

---

## Phase 1: Header Consolidation (Highest Impact)

### D-1: Reorganize navigation into primary + secondary grouping

The header currently shows ALL 14 links in a flat list. This needs hierarchy.

**File:** `src/components/Header.tsx`

**Current structure (from screenshot):**
Row 1: Digital Stable | My Profile | Show Ring | Discover | Feed | Shows | Wishlist | Claim
Row 2: Settings | Inbox | 🔔 | Home | About | Contact

**Proposed structure — single row with grouped items:**
- **Primary nav (always visible):** Digital Stable | Show Ring | Feed | Discover | Shows
- **User actions (icon buttons):** 🔔 Notifications | ✉️ Inbox | ❤️ Wishlist
- **User menu (dropdown on avatar/username click):** My Profile | Settings | Claim | Sign Out
- **Footer only:** Home | About | Contact (these are not needed in the logged-in header)

> [!IMPORTANT]
> This is a COMPONENT change, not just CSS. The Header.tsx file needs restructuring. Read the entire component first to understand the current structure before making changes.

**Step 1:** Read `src/components/Header.tsx` fully.

**Step 2:** Restructure the nav into groups:

```tsx
{/* Primary navigation */}
<nav className="header-nav-primary">
    <Link href="/dashboard" className="header-nav-link">🏠 Stable</Link>
    <Link href="/community" className="header-nav-link">🏆 Show Ring</Link>
    <Link href="/feed" className="header-nav-link">📋 Feed</Link>
    <Link href="/discover" className="header-nav-link">👥 Discover</Link>
    <Link href="/shows" className="header-nav-link">📷 Shows</Link>
</nav>

{/* Icon actions */}
<div className="header-icon-actions">
    <Link href="/notifications" className="header-icon-btn" title="Notifications">🔔</Link>
    <Link href="/inbox" className="header-icon-btn" title="Inbox">✉️</Link>
    <Link href="/wishlist" className="header-icon-btn" title="Wishlist">❤️</Link>
</div>

{/* User menu dropdown */}
<div className="header-user-menu">
    {/* Avatar/name that toggles a dropdown */}
    {/* Dropdown contains: My Profile, Settings, Claim, Sign Out */}
</div>
```

**Step 3:** Add CSS for the new structure:

```css
/* Header layout — single row */
.header-nav-primary {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
}

.header-icon-actions {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
}

.header-icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--color-surface-glass);
    transition: background 0.2s;
    text-decoration: none;
    font-size: 1.1rem;
}

.header-icon-btn:hover {
    background: var(--color-surface-glass-hover);
}

/* Remove Home, About, Contact from header (keep in footer only) */
```

> [!WARNING]
> This is the most complex change. The mobile hamburger menu from the mobile polish work must still work. The restructured nav should use the same `.header-nav` class for the mobile dropdown, just with the new groupings inside it.

**Verify:**
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Phase 2: Container Widths

### D-2: Increase page container max-width for desktop

Many pages use a narrow max-width. At 1440px, the content area should be wider.

**Step 1:** Find the current `.page-container` max-width in globals.css:

```
cd c:\Project Equispace\model-horse-hub && cmd /c "findstr /i /n "page-container\|max-width" src\app\globals.css 2>&1"
```

**Step 2:** Update the max-width for desktop:

```css
/* Global page container — wider on desktop */
.page-container {
    max-width: 1200px; /* was likely ~900px or similar */
    margin: 0 auto;
    padding: 0 var(--space-xl);
}

/* Widescreen override for content-rich pages */
@media (min-width: 1200px) {
    .page-container-wide {
        max-width: 1400px;
    }
}
```

**Step 3:** Apply `.page-container-wide` to grid-heavy pages:
- `/community` (Show Ring) — more columns
- `/discover` — more cards per row
- `/profile/[alias]` — wider horse grid

> [!NOTE]
> Some pages intentionally want a narrow container (Settings, Add Horse forms). DON'T make those wider — forms should stay at ~700-800px max for readability. Only widen pages that display grids of cards.

### D-3: Feed page — Constrain but make better use of width

The feed is centered in a very narrow column. Feed items should be wider but not full-bleed.

```css
/* Feed container — comfortable reading width */
.feed-container {
    max-width: 720px; /* Feed should feel focused, not sprawling */
    margin: 0 auto;
}

/* But the hero can be wider */
.community-hero {
    max-width: 100%;
}
```

The feed is actually fine being narrower — it's a content stream like Twitter/Threads. The issue is more that the hero section above it wastes vertical space.

```css
/* Tighten hero on desktop too */
.community-hero {
    padding: var(--space-xl) var(--space-lg);
}
```

**Verify:**
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Phase 3: Grid Density

### D-4: Show Ring — 4 columns at widescreen

The Show Ring currently shows 3 columns. At 1440px with a wider container, 4 columns would be perfect.

```css
@media (min-width: 1200px) {
    .show-ring-grid {
        grid-template-columns: repeat(4, 1fr);
    }
}
```

> First, grep for the actual grid class name used on the community page.

### D-5: Profile page — 4 columns for horse grid

```css
@media (min-width: 1200px) {
    .profile-horse-grid {
        grid-template-columns: repeat(4, 1fr);
    }
}
```

### D-6: Discover page — 3 columns minimum

Currently shows 2 cards at 1440px. With wider container it should fit 3.

```css
@media (min-width: 1200px) {
    .discover-grid {
        grid-template-columns: repeat(3, 1fr);
    }
}
```

**Verify:**
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Phase 4: Page-Specific Polish

### D-7: Settings — Bio textarea should be full-width

From the screenshot, the Bio textarea is tiny compared to the Display Name input above it. Both should be the same width.

```css
.settings-section textarea {
    width: 100%;
    min-height: 100px;
    resize: vertical;
}
```

### D-8: Shows — Show cards should use grid, not stack

The shows page has cards that left-align in a narrow column. At desktop width:

```css
.shows-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: var(--space-lg);
}
```

### D-9: Dashboard (empty state) — Welcome card is too tall

The "Welcome to Model Horse Hub" card takes up the entire viewport. Tighten it:

```css
.welcome-card {
    padding: var(--space-xl);
    max-width: 700px;
    margin: 0 auto var(--space-xl);
}
```

### D-10: Community hero — Reduce dead space

The hero sections on Show Ring, Feed, Discover, and Shows all have excessive vertical padding with just a title and subtitle:

```css
.community-hero {
    padding: var(--space-xl) var(--space-lg);
}

.community-hero h1 {
    margin-bottom: var(--space-xs);
}

/* The stat number below the title needs less space */
.community-stat-label {
    margin-top: var(--space-sm);
}
```

**Verify:**
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Final Steps

### Commit

```
cd c:\Project Equispace\model-horse-hub && cmd /c "git add -A && git commit -m "polish: desktop UI improvements — header consolidation, wider containers, grid density" 2>&1"
```

### Push

```
cd c:\Project Equispace\model-horse-hub && cmd /c "git push origin main 2>&1"
```

### Visual verification

Use browser subagent at 1440x900 to verify. Login as testbot@modelhorsehub.com / testbot123 and screenshot:
- /dashboard
- /community (Show Ring — should have 4 columns)
- /discover (should have 3 columns)
- /profile/Black%20Fox%20Farm (should have 4-column grid)
- /settings (bio textarea full width)
- /feed (hero tightened)

---

## Checklist

- [ ] D-1: Header restructured — primary nav + icon actions + user menu dropdown
- [ ] D-2: Page container max-width increased for desktop
- [ ] D-3: Feed hero tightened
- [ ] D-4: Show Ring grid → 4 columns at ≥1200px
- [ ] D-5: Profile horse grid → 4 columns at ≥1200px
- [ ] D-6: Discover grid → 3 columns at ≥1200px
- [ ] D-7: Settings bio textarea full width
- [ ] D-8: Shows grid layout
- [ ] D-9: Dashboard welcome card tightened
- [ ] D-10: Community hero vertical spacing reduced
