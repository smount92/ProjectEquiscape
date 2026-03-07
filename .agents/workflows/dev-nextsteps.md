---
description: Living task queue of dev cleanup, polish, and next-steps items. Run this workflow to pick up and execute pending work items.
---

# Dev Next-Steps — Living Task Queue

> **Purpose:** A persistent, prioritized list of cleanup, polish, and improvement tasks. Run `/dev-nextsteps` to pick up the next batch of work.
> **Last Updated:** 2026-03-07
> **Convention:** Mark items ✅ when done. Add new items at the bottom of the appropriate priority section. Commit this file alongside the code changes.

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

Before starting any work, read the developer conventions:

```
Look for 02_developer_conventions.md in any brain artifacts directory under C:\Users\MTG Test\.gemini\antigravity\brain\
```

Verify the current build is clean:

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

# ═══════════════════════════════════════
# OPTION 3: TEST-USER READINESS
# ═══════════════════════════════════════

# 🔴 Priority: Critical (Test User Blockers)

## Task TU-1: Forgot Password Flow

**Problem:** The login page has no "Forgot your password?" link. Test users who forget their password will need manual intervention. This is the #1 support request for any app.

**What to build:**

### 1. Create the server action: `src/app/auth/actions.ts`

Add this function to the EXISTING `auth/actions.ts` file (append to the bottom, don't overwrite):

```typescript
export async function forgotPasswordAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = formData.get("email") as string;

  if (!email) {
    return { error: "Please enter your email address.", success: false };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/reset-password`,
  });

  if (error) {
    return { error: error.message, success: false };
  }

  // Always show success to prevent email enumeration
  return { error: null, success: true };
}
```

### 2. Create the forgot password page: `src/app/forgot-password/page.tsx`

```tsx
"use client";

import { useActionState } from "react";
import Link from "next/link";
import { forgotPasswordAction, type AuthFormState } from "@/app/auth/actions";

const initialState: AuthFormState = { error: null, success: false };

export default function ForgotPasswordPage() {
  const [state, formAction, isPending] = useActionState(forgotPasswordAction, initialState);

  if (state.success) {
    return (
      <div className="auth-page">
        <div className="card card-auth animate-fade-in-up">
          <div className="card-header">
            <div style={{ fontSize: "3rem", marginBottom: "var(--space-md)" }} aria-hidden="true">
              ✉️
            </div>
            <h1>Check Your Email</h1>
            <p style={{ marginTop: "var(--space-md)" }}>
              If an account exists with that email, we&apos;ve sent you a password reset link.
              Check your inbox and spam folder.
            </p>
          </div>
          <Link href="/login" className="btn btn-primary btn-full" id="back-to-login">
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="card card-auth animate-fade-in-up">
        <div className="card-header">
          <h1>Reset <span className="text-gradient">Password</span></h1>
          <p>Enter your email and we&apos;ll send you a reset link</p>
        </div>

        {state.error && (
          <div className="form-error" role="alert" id="forgot-error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            {state.error}
          </div>
        )}

        <form action={formAction} noValidate>
          <div className="form-group">
            <label htmlFor="forgot-email" className="form-label">Email Address</label>
            <input
              id="forgot-email"
              name="email"
              type="email"
              className="form-input"
              placeholder="you@example.com"
              required
              autoComplete="email"
              autoFocus
            />
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={isPending} id="forgot-submit">
            {isPending ? (
              <>
                <span className="btn-spinner" aria-hidden="true" />
                Sending...
              </>
            ) : (
              "Send Reset Link"
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Remember your password?{" "}
            <Link href="/login" id="go-to-login">Sign in here</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
```

### 3. Create the reset password page: `src/app/auth/reset-password/page.tsx`

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsPending(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setIsPending(false);
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push("/dashboard"), 2000);
  };

  if (success) {
    return (
      <div className="auth-page">
        <div className="card card-auth animate-fade-in-up">
          <div className="card-header">
            <div style={{ fontSize: "3rem", marginBottom: "var(--space-md)" }} aria-hidden="true">✅</div>
            <h1>Password Updated!</h1>
            <p style={{ marginTop: "var(--space-md)" }}>Redirecting to your stable...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="card card-auth animate-fade-in-up">
        <div className="card-header">
          <h1>New <span className="text-gradient">Password</span></h1>
          <p>Choose a new password for your account</p>
        </div>

        {error && (
          <div className="form-error" role="alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="new-password" className="form-label">New Password</label>
            <input
              id="new-password"
              type="password"
              className="form-input"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label htmlFor="confirm-new-password" className="form-label">Confirm New Password</label>
            <input
              id="confirm-new-password"
              type="password"
              className="form-input"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={isPending} id="reset-submit">
            {isPending ? (
              <>
                <span className="btn-spinner" aria-hidden="true" />
                Updating...
              </>
            ) : (
              "Update Password"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
```

### 4. Add "Forgot password?" link to login page

**File:** `src/app/login/page.tsx`

Find the closing `</form>` tag and add this BEFORE the `<div className="auth-footer">`:

```tsx
        <div style={{ textAlign: "center", marginTop: "var(--space-md)" }}>
          <Link
            href="/forgot-password"
            style={{ fontSize: "calc(var(--font-size-sm) * var(--font-scale))", color: "var(--color-text-muted)" }}
            id="forgot-password-link"
          >
            Forgot your password?
          </Link>
        </div>
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task TU-2: Auth Error Page

**Problem:** The auth callback (`src/app/auth/callback/route.ts`) redirects to `/auth/auth-code-error` on failure, but that route doesn't exist. Users who click an expired email confirmation link see a generic 404.

**What to build:**

Create `src/app/auth/auth-code-error/page.tsx`:

```tsx
import Link from "next/link";

export default function AuthCodeErrorPage() {
  return (
    <div className="auth-page">
      <div className="card card-auth animate-fade-in-up">
        <div className="card-header">
          <div style={{ fontSize: "3rem", marginBottom: "var(--space-md)" }} aria-hidden="true">
            ⚠️
          </div>
          <h1>Link Expired</h1>
          <p style={{ marginTop: "var(--space-md)" }}>
            This confirmation link has expired or is invalid. Please try signing up again
            or request a new confirmation email.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
          <Link href="/signup" className="btn btn-primary btn-full" id="retry-signup">
            Sign Up Again
          </Link>
          <Link href="/login" className="btn btn-ghost btn-full" id="go-to-login">
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task TU-3: Add "My Profile" Link to Navigation

**Problem:** Users have no way to navigate to their own public profile from the header. They'd need to know their alias and type the URL manually.

**What to modify:**

**File:** `src/components/Header.tsx`

1. The component already fetches `user` and `profile` (which contains `alias_name`). Find the authenticated nav section (the `<nav>` with `className="header-nav"`) and add this link **after** the Wishlist link and **before** the Inbox link:

```tsx
          {profile?.alias_name && (
            <Link
              href={`/profile/${encodeURIComponent(profile.alias_name)}`}
              className="header-nav-link"
              id="nav-profile"
              onClick={closeMobileMenu}
            >
              👤 Profile
            </Link>
          )}
```

2. Verify by looking at the existing nav structure. The link should go right before `Inbox` or right after `Wishlist`.

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

# 🟡 Priority: Medium

## Task TU-4: Contact Seller Button on Show Ring Cards

**Problem:** Horses in the Show Ring show "For Sale" / "For Trade" badges but there's no action button until the user clicks into the full passport detail page. Users see the badge but can't act on it from the listing view.

**What to modify:**

**File:** `src/app/community/page.tsx`

Find the card rendering loop where `trade_status` badges are shown. When `trade_status` is not "Not for Sale", add a small action button that links to the full passport page with a hint to message:

```tsx
{horse.trade_status && horse.trade_status !== "Not for Sale" && (
  <Link
    href={`/community/${horse.id}`}
    className="btn btn-primary"
    style={{ fontSize: "calc(var(--font-size-xs) * var(--font-scale))", padding: "var(--space-xs) var(--space-sm)" }}
  >
    View & Contact
  </Link>
)}
```

**Alternative approach:** If the trade status badge already links to the passport, this may not need a separate button — just ensure the badge itself is clickable. Check the current implementation first.

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task TU-5: Commit & Push Test-User Readiness

After all TU tasks above are complete:

```
cd c:\Project Equispace\model-horse-hub && cmd /c "git add -A && git commit -m "feat: forgot password, auth error page, profile nav link, contact seller CTA" 2>&1"
```

Then push:

```
cd c:\Project Equispace\model-horse-hub && cmd /c "git push origin main 2>&1"
```

---

# 📝 Completed Tasks

## ✅ Task A: Wire Activity Events into Missing Actions (completed 2026-03-07)
Wired `createActivityEvent` into ratings.ts, follows.ts, provenance.ts. Added `show_record` event type to ActivityFeed component.

## ✅ Task B: Build Collection Showcases UI (completed 2026-03-07)
Added `is_public` checkbox to CollectionPicker creation modal. Added public collection pills to profile pages with CSS.

## ✅ Task C: Optimize Discover Page N+1 Queries (completed 2026-03-07)
Replaced serial `getUserRatingSummary()` loop with single batch query to `user_ratings` table. Removed unused import.

## ✅ Task D: Add "New Horse" Activity Event (completed 2026-03-07)
Created `notifyHorsePublic` server action in `horse-events.ts`. Wired into both add-horse and edit-horse pages.

## ⏭️ Task E: Middleware Public Paths (skipped — not needed)

## ✅ Task F: Documentation + Commit (completed 2026-03-07)
Committed and pushed as `fix: wire missing activity events + collection showcase UI + discover optimization`.

## ✅ LP-1: Mobile Navigation — Hamburger Menu (completed 2026-03-07)
Added `mobileMenuOpen` state and hamburger button to Header.tsx. Nav collapses to full-width slide-down menu on mobile (<768px). Auto-closes on link click and outside click. CSS with backdrop blur and glassmorphism.

## ✅ LP-2: Global Loading States (completed 2026-03-07)
Created root `loading.tsx` with shimmer skeleton (hero + 6-card grid). Added route-specific loading files for community, dashboard, discover, feed, and shows via re-exports. Added `@keyframes shimmer` and skeleton CSS.

## ✅ LP-3: Error Boundary + Not Found (completed 2026-03-07)
Created `error.tsx` (client component with retry button) and `not-found.tsx` (branded 404 with back-to-stable link).

## ✅ LP-4: Landing Page Refresh (completed 2026-03-07)
Added 3 new feature cards (Social Community, Virtual Photo Shows, Trusted Marketplace) for 6 total. Updated meta description, hero subheadline, stats section (added "7,000+ Reference Releases"). Changed grid to `auto-fit minmax(300px, 1fr)`.

## ✅ LP-5: Onboarding Welcome Card (completed 2026-03-07)
Added welcome card to dashboard for users with 0 horses. Includes 3-step getting started guide and "Add Your First Horse" CTA. Added glassmorphism CSS with numbered step indicators.

## ✅ LP-6: Mobile Polish Pass (completed 2026-03-07)
Added `@media (max-width: 640px)` rules for feed-tabs, profile-hero-stats, profile-follow-stats, discover-grid, notification-item, and stats-inner.

## ✅ LP-7: Commit Launch Prep (completed 2026-03-07)
Committed and pushed as `polish: Launch prep - mobile nav, loading states, error boundaries, landing page refresh`.

## ✅ TH-1: Migrate middleware.ts → proxy.ts (completed 2026-03-07)
Renamed file and export function per Next.js 16 convention. Deprecation warning eliminated from build output.

## ✅ TH-2: TypeScript Type Audit (completed 2026-03-07)
Cross-referenced all 8 social/expansion interfaces against migration SQL. Found and fixed missing `is_public` field on `UserCollection` interface and its Insert type.

## ✅ TH-3: Circular Import Check (completed 2026-03-07)
Verified `notifications.ts` and `activity.ts` are leaf modules. All import arrows point one-way — no circular dependencies.

## ✅ TH-4: Commit Technical Hardening (completed 2026-03-07)
Committed and pushed as `chore: Technical hardening - proxy migration, type audit, import cleanup`.

## ✅ TH-5: Add Basic Automated Test (completed 2026-03-07)
Installed vitest, created `src/__tests__/smoke.test.ts`, added `"test": "vitest run"` script. Test passes in 938ms.

## ✅ BF-1: Disappearing Comments Fix (completed 2026-03-07)
Added `revalidatePath` to `addComment`, `deleteComment`, and `toggleFavorite` in social.ts. Cache bust ensures comments/favorites persist across page loads.

## ✅ BF-2: Mobile Nav CSS Fix (completed 2026-03-07)
Added 85 lines of missing `.header-nav`, `.header-nav-link`, `.header-hamburger` CSS to globals.css. Nav now properly collapses on mobile.

## ✅ BF-3: Remove AI References (completed 2026-03-07)
Removed AI language from landing page (meta, hero, feature card). Hidden AI detect button and hint on add-horse page via `{false && ...}` guard. Code preserved for future re-enable.

## ✅ TU-1: Forgot Password Flow (completed 2026-03-07)
Added `forgotPasswordAction` to auth/actions.ts. Created `/forgot-password` page with email form + success screen. Created `/auth/reset-password` page with new password form + auto-redirect. Added "Forgot your password?" link to login page. Added `/forgot-password` to proxy public paths.

## ✅ TU-2: Auth Error Page (completed 2026-03-07)
Created `/auth/auth-code-error/page.tsx` with branded error messaging for expired/invalid confirmation links. Includes "Sign Up Again" and "Back to Sign In" CTAs.

## ✅ TU-3: My Profile Navigation Link (completed 2026-03-07)
Added `aliasName` state to Header.tsx. Fetches from `users` table on auth. Renders 👤 Profile link between Wishlist and Inbox in nav. Works on both desktop and mobile hamburger menu.

## ✅ TU-4: Contact Seller CTA on Show Ring Cards (completed 2026-03-07)
Added "View & Contact" button inside card link for For Sale / Open to Offers horses. Supplements existing trade badges and MessageSellerButton.

## ✅ TU-5: Commit & Push Test-User Readiness (completed 2026-03-07)
Committed and pushed as `feat: forgot password, auth error page, profile nav link, contact seller CTA`.
