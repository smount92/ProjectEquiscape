---
description: Page-by-page mobile responsive polish. 14 CSS fixes across 4 phases based on 375px browser audit. Login as testbot to verify.
---

# Mobile Polish Workflow — Page by Page

> **Audit date:** 2026-03-08
> **Methodology:** Browser screenshots at 375×812px (iPhone) of every authenticated page
> **Test account:** testbot@modelhorsehub.com / testbot123

// turbo-all

## Pre-flight

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Phase 1: Header (Highest Impact)

### M-1: Move "Sign Out" + Simple Mode toggle into hamburger on mobile

The header at 375px shows: 🐴 ☰ [Sign Out] [👁] — cramped.

**Step 1:** Open `src/components/Header.tsx`. Find the "Sign Out" button and Simple Mode toggle.

**Step 2:** Wrap them in two containers:
- `.header-auth-actions-desktop` — for the current desktop position
- `.header-auth-actions-mobile` — duplicate inside the hamburger nav dropdown

**Step 3:** In `src/app/globals.css`, inside the existing `@media (max-width: 768px)` section, add:

```css
.header-auth-actions-desktop {
    display: none !important;
}

.header-nav .header-auth-actions-mobile {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    padding-top: var(--space-md);
    border-top: 1px solid var(--color-border);
    margin-top: var(--space-md);
}
```

And in the desktop/default styles, hide the mobile version:

```css
.header-auth-actions-mobile {
    display: none;
}
```

**Verify:**
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Phase 2: Core Page Layouts (5 fixes)

### M-2: Dashboard — Reduce whitespace

Add to `globals.css` inside `@media (max-width: 768px)`:

```css
.getting-started-card {
    padding: var(--space-md);
}
.getting-started-card h2 {
    font-size: var(--font-size-lg);
}
.stable-header {
    margin-bottom: var(--space-md);
}
.stable-header h1 {
    font-size: var(--font-size-xl);
}
```

> **Note:** Verify these class names exist by searching globals.css first. If they don't exist, search for the actual class names used on the dashboard page component.

### M-3: Feed — Fix "Following" tab contrast + tighten hero

The "Following" tab is barely visible. Check the actual class for the inactive tab and ensure it has sufficient contrast:

```css
/* Check if .feed-tab exists or if it's .community-tab or .tab-btn */
.feed-tab:not(.feed-tab-active),
.tab-btn:not(.active) {
    color: var(--color-text-secondary);
    opacity: 0.85;
}
```

Also tighten the hero in `@media (max-width: 768px)`:

```css
.community-hero h1 {
    font-size: var(--font-size-xl);
}
```

### M-4: Add Horse — Photo grid for small screens

Add inside `@media (max-width: 480px)`:

```css
/* Photo upload grid */
.photo-upload-grid {
    grid-template-columns: 1fr 1fr;
    gap: var(--space-sm);
}
.photo-upload-grid > :first-child {
    grid-column: 1 / -1;
}
.upload-zone-label {
    font-size: var(--font-size-xs);
}
/* Step indicator horizontal scroll */
.step-indicator {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    justify-content: flex-start;
}
```

> Check class names — the upload zones may use `.lsq-photo-slot` or similar.

### M-5: Show Ring — Single column on mobile

Add inside `@media (max-width: 768px)`:

```css
.show-ring-grid {
    grid-template-columns: 1fr;
    gap: var(--space-md);
}
.filter-tabs {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    flex-wrap: nowrap;
}
.filter-tabs .filter-tab {
    white-space: nowrap;
    flex-shrink: 0;
}
.filter-row {
    flex-direction: column;
    gap: var(--space-sm);
}
```

> **Key:** Before applying, grep for the actual grid class names used in `/community` page component.

### M-6: Discover — Single column on phone

Add inside `@media (max-width: 480px)`:

```css
.discover-grid {
    grid-template-columns: 1fr;
}
.discover-card {
    padding: var(--space-md);
}
```

**Verify Phase 2:**
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Phase 3: Secondary Pages (6 fixes)

### M-7: Settings — Smaller toggles + compact layout

```css
@media (max-width: 768px) {
    .settings-section { padding: var(--space-md); }
    .toggle-switch { transform: scale(0.85); }
    .avatar-upload-section {
        flex-direction: column;
        align-items: center;
    }
}
```

### M-8: Notifications — Compact items

```css
@media (max-width: 768px) {
    .notification-item {
        padding: var(--space-sm) var(--space-md);
    }
    .notification-time { font-size: var(--font-size-xs); }
}
```

### M-9: Inbox — Message layout

```css
@media (max-width: 768px) {
    .message-bubble { max-width: 85%; font-size: var(--font-size-sm); }
    .message-input-row { padding: var(--space-sm); }
}
```

### M-10: Wishlist — Reduce empty state

```css
@media (max-width: 768px) {
    .shelf-empty {
        padding: var(--space-xl) var(--space-md);
    }
    .shelf-empty-icon { font-size: 2.5rem; }
}
```

### M-11: Shows — Card layout

```css
@media (max-width: 768px) {
    .shows-grid { grid-template-columns: 1fr; }
    .show-card-header {
        flex-direction: column;
        gap: var(--space-xs);
    }
}
```

### M-12: Getting Started — Tighten

```css
@media (max-width: 768px) {
    .getting-started-steps { gap: var(--space-md); }
    .getting-started-step { padding: var(--space-md); }
}
```

> **Critical note for Phase 3:** Many of these class names are ESTIMATED based on conventions. Before writing CSS, grep for actual class names in the relevant page component files. For example:
> ```
> findstr /i /n "className" src\app\settings\page.tsx
> ```

**Verify Phase 3:**
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Phase 4: Detail Pages (2 fixes)

### M-13: Profile page — Stack header, single column grid

```css
@media (max-width: 768px) {
    .profile-header {
        flex-direction: column;
        align-items: center;
        text-align: center;
    }
    .profile-stats { justify-content: center; flex-wrap: wrap; }
    .profile-horse-grid { grid-template-columns: 1fr; }
    .profile-actions {
        width: 100%;
        flex-direction: column;
    }
    .profile-actions .btn { width: 100%; }
}
```

### M-14: Passport + Edit Horse

```css
@media (max-width: 768px) {
    /* Passport gallery → horizontal scroll */
    .passport-gallery {
        display: flex;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        scroll-snap-type: x mandatory;
        gap: var(--space-sm);
    }
    .passport-gallery img {
        scroll-snap-align: center;
        min-width: 280px;
    }
    .passport-info-grid { grid-template-columns: 1fr; }
    /* Edit form */
    .edit-horse-form .form-row { flex-direction: column; }
}
```

**Verify Phase 4:**
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Final Steps

### Commit

```
cd c:\Project Equispace\model-horse-hub && cmd /c "git add -A && git commit -m "polish: mobile responsive fixes for all authenticated pages (M-1 through M-14)" 2>&1"
```

### Push

```
cd c:\Project Equispace\model-horse-hub && cmd /c "git push origin main 2>&1"
```

### Visual verification

Use browser subagent at 375×812 to verify. Login as testbot@modelhorsehub.com / testbot123 and screenshot:
- /dashboard
- /feed
- /add-horse
- /community
- /settings
- /profile/BlackFoxFarm (or any profile with data)
