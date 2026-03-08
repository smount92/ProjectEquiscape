---
description: Living task queue of dev cleanup, polish, and next-steps items. Run this workflow to pick up and execute pending work items.
---

# Dev Next-Steps — Living Task Queue

> **Purpose:** A persistent, prioritized list of cleanup, polish, and improvement tasks. Run `/dev-nextsteps` to pick up the next batch of work.
> **Last Updated:** 2026-03-07
> **Convention:** Mark items ✅ when done. Add new items at the bottom of the appropriate priority section. Commit this file alongside the code changes.
> **Archive:** Completed tasks are moved to `dev-nextsteps-archive.md` in this same directory.

// turbo-all

## How to Use This Workflow

1. Read this entire file to understand pending tasks
2. Start with 🔴 Critical items first, then 🟡 Medium, then 🟢 Nice-to-Have
3. Each task has clear instructions — follow them exactly
4. After completing a task, mark it ✅ in this file
5. Run `npm run build` after each task to verify nothing broke
6. Commit with a descriptive message after completing a batch of related tasks

---

## Pre-flight

Verify the current build is clean:

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

# ═══════════════════════════════════════
# OPTION 9: NAVIGATION & AUTH UX FIXES
# ═══════════════════════════════════════

> **Context:** Three user-facing bugs reported: (1) authenticated users cannot access landing/about/contact pages, (2) sign-out button doesn't work, (3) no clear "My Profile" link. These are pre-launch blockers.

# 🔴 Priority: Critical — Launch Blockers

## Task NV-1: Fix Authenticated Access to Public Pages (Landing, About, Contact)

**Problem:** When signed in, the logo link goes to `/dashboard` and there are no nav links to `/`, `/about`, or `/contact`. Authenticated users are effectively locked out of these pages.

**Root Cause:** The Header component (lines 206-216) only shows About/Contact links when `!user`. When signed in, only the app nav is shown. There's no way to navigate back to the landing page or see the about/contact pages.

**What to fix:**

**File:** `src/components/Header.tsx`

Add a secondary nav section or a "More" area inside the authenticated nav. Insert these links at the end of the authenticated nav block (around line 202, before the closing `</nav>`):

```tsx
{/* ── Public info links (always accessible) ── */}
<div className="header-nav-divider" aria-hidden="true" />
<Link href="/" className="header-nav-link header-nav-link-secondary" id="nav-home" onClick={closeMobileMenu}>
    🏡 Home
</Link>
<Link href="/about" className="header-nav-link header-nav-link-secondary" id="nav-about" onClick={closeMobileMenu}>
    ℹ️ About
</Link>
<Link href="/contact" className="header-nav-link header-nav-link-secondary" id="nav-contact" onClick={closeMobileMenu}>
    ✉️ Contact
</Link>
```

**Important:** These should be visually secondary (slightly muted) so they don't crowd the main app nav. Add CSS:

**File:** `src/app/globals.css`

```css
/* ── Header nav divider + secondary links ── */
.header-nav-divider {
    width: 1px;
    height: 16px;
    background: rgba(255, 255, 255, 0.1);
    align-self: center;
    margin: 0 var(--space-xs);
}

.header-nav-link-secondary {
    opacity: 0.6;
    font-size: calc(0.8rem * var(--font-scale)) !important;
}

.header-nav-link-secondary:hover {
    opacity: 1;
}

@media (max-width: 768px) {
    .header-nav-divider {
        width: 100%;
        height: 1px;
        margin: var(--space-xs) 0;
    }
}
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task NV-2: Fix Sign-Out Button

**Problem:** The sign-out button doesn't work. Users are stuck signed in.

**Root Cause Analysis:** The `handleSignOut` function (line 93-97 in Header.tsx) does:
```typescript
const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
};
```

This uses `router.push()` + `router.refresh()` which can race in Next.js App Router. The sign-out may succeed on the Supabase side but the client-side auth state listener (line 67-81) may re-set the user before the redirect completes. Also, `router.refresh()` after `router.push()` can be ignored since the route is already changing.

**What to fix:**

**File:** `src/components/Header.tsx`

Replace the `handleSignOut` function (lines 93-97) with a more reliable approach:

```typescript
const handleSignOut = async () => {
    try {
        await supabase.auth.signOut();
        // Clear local state immediately to prevent flicker
        setUser(null);
        setAliasName(null);
        setUnreadCount(0);
        // Use window.location for a hard redirect — kills all client state
        window.location.href = "/login";
    } catch (err) {
        console.error("Sign-out error:", err);
        // Force redirect even on error
        window.location.href = "/login";
    }
};
```

**Why `window.location.href` instead of `router.push()`:**
- `router.push()` is a soft navigation that preserves client state
- `window.location.href` triggers a full page reload, which:
  - Clears all React state (including stale auth data)
  - Forces the server to re-evaluate auth on the next page load
  - Guarantees the user is fully logged out from the browser's perspective

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task NV-3: Add "My Profile" Link to Header

**Problem:** There **is** a profile link in the nav (lines 173-182), but it says "👤 Profile" which isn't clear enough. Users don't realize it shows their *public-facing* profile. Also, if `aliasName` is null (still loading), the link disappears entirely.

**What to fix:**

**File:** `src/components/Header.tsx`

1. Change the profile link label to make it clear this is their public profile:

Replace lines 173-182:
```tsx
{aliasName && (
    <Link
        href={`/profile/${encodeURIComponent(aliasName)}`}
        className="header-nav-link"
        id="nav-profile"
        onClick={closeMobileMenu}
    >
        👤 Profile
    </Link>
)}
```

With:
```tsx
{aliasName && (
    <Link
        href={`/profile/${encodeURIComponent(aliasName)}`}
        className="header-nav-link"
        id="nav-profile"
        onClick={closeMobileMenu}
    >
        👤 My Profile
    </Link>
)}
```

2. **Also move it to be more prominent** — place it right after "🏠 Digital Stable" (line 152-154), before Show Ring. The profile is a primary destination, not something buried at the bottom of the nav.

So the nav link order should be:
```
🏠 Digital Stable → 👤 My Profile → 🏆 Show Ring → 👥 Discover → 📰 Feed → 📸 Shows → ❤️ Wishlist → 📦 Claim → ⚙️ Settings → ✉️ Inbox → 🔔 Notifications
──separator──
🏡 Home → ℹ️ About → ✉️ Contact
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

# 🟡 Priority: Medium — Related Polish

## Task NV-4: Add Landing Page Link for Signed-In Users (Logo)

**Problem:** Currently the logo link goes to `/dashboard` when signed in (line 116). This is fine behavior, but it means there's truly no way to see the landing page without signing out first.

**What to fix:**

The Home link added in Task NV-1 covers this. But also consider adding a subtle "View site" or equivalent in the footer of authenticated pages if needed.

**No code change needed if NV-1 is done.** Mark as ✅ after NV-1.

---

## Task NV-5: Deduplicate Nav Links + Clean Up Order

**Problem:** The nav has a lot of links now. Some may benefit from grouping or an overflow menu on mobile.

**What to review:**

Check the mobile menu (`header-nav-open` state) and ensure it doesn't feel overwhelming with 12+ links. Consider:

1. **Grouping:** Use the divider from NV-1 to visually separate app nav from info nav
2. **Priority:** The most-used links should be first: Dashboard, Profile, Show Ring, Feed
3. **Collapse candidates for mobile:** Claim, Settings could go behind a "⋯ More" submenu (future — not needed now)

**For now:** Just ensure the order from NV-3 is applied and the mobile menu scrolls if needed. Add this CSS:

**File:** `src/app/globals.css`

```css
/* ── Ensure mobile nav scrolls when many links ── */
@media (max-width: 768px) {
    .header-nav-open {
        max-height: 80vh;
        overflow-y: auto;
    }
}
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task NV-6: Commit & Push

```
cd c:\Project Equispace\model-horse-hub && cmd /c "git add -A && git commit -m "fix: sign-out button, public page access when signed in, My Profile link" 2>&1"
```

Then push:

```
cd c:\Project Equispace\model-horse-hub && cmd /c "git push origin main 2>&1"
```
