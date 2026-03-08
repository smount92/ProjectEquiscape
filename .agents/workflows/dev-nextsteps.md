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
# OPTION 8: ACCOUNT SETTINGS, AVATARS, & POLISH
# ═══════════════════════════════════════

> **Context:** All major features are shipped (Social Expansion, Photo Shows, Hoofprint, Marketing). This batch closes the remaining UX gaps: edit-form life stage, auto-events, Settings page, user avatars, and About page polish.

# 🔴 Priority: Critical (Users Notice These)

## ✅ Task AP-1: Edit Form — Life Stage Selector + Hoofprint Auto-Events

**Problem:** The add-horse form has a 🐾 Life Stage selector, but the edit-horse form (`src/app/stable/[id]/edit/page.tsx`) doesn't. Users can't update a horse's life stage after creation. Also, changing `trade_status` to "For Sale" or "Open to Offers" should auto-create a `listed` timeline event.

**What to fix:**

**File:** `src/app/stable/[id]/edit/page.tsx`

### Part A: Life Stage selector

1. The import for `updateLifeStage` from `@/app/actions/hoofprint` already exists (line ~14). Good.

2. Add `lifeStage` state. Find where the other state variables are declared (around line ~55-90):
```typescript
const [lifeStage, setLifeStage] = useState("completed");
```

3. In the `loadHorse()` function (line ~102), the query selects fields from `user_horses`. Add `life_stage` to the select:
```typescript
// Find the .select() call and add life_stage
.select("id, custom_name, finish_type, condition_grade, is_public, trade_status, listing_price, marketplace_notes, reference_mold_id, artist_resin_id, collection_id, life_stage")
```

4. In the data assignment section after the fetch, add:
```typescript
setLifeStage((data as any).life_stage || "completed");
```

5. Add the Life Stage dropdown in the form JSX. Place it near the Trade Status dropdown:
```tsx
{/* Life Stage (Hoofprint) */}
<div className="form-group">
    <label htmlFor="edit-life-stage" className="form-label">
        🐾 Life Stage
    </label>
    <select
        id="edit-life-stage"
        className="form-select"
        value={lifeStage}
        onChange={(e) => setLifeStage(e.target.value)}
    >
        <option value="blank">🎨 Blank / Unpainted</option>
        <option value="in_progress">🔧 Work in Progress</option>
        <option value="completed">✅ Completed</option>
        <option value="for_sale">💲 For Sale</option>
    </select>
    <span className="form-hint">
        Changing this updates your Hoofprint™ timeline.
    </span>
</div>
```

6. In the `handleSave()` function, add `life_stage: lifeStage` to the update object:
```typescript
// Find the .update() call and add life_stage
.update({ ...otherFields, life_stage: lifeStage })
```

7. After the successful update (after the `.update()` call succeeds), call `updateLifeStage` to auto-create a timeline event if the stage changed:
```typescript
// After successful save, fire-and-forget stage update event
try {
    await updateLifeStage(horseId, lifeStage as "blank" | "in_progress" | "completed" | "for_sale");
} catch {
    // Non-blocking — the DB update already succeeded
}
```

**Note:** `updateLifeStage` already checks if the stage actually changed (returns early if same), so it's safe to always call it.

### Part B: Trade Status → Hoofprint auto-event

In the same `handleSave()` function, after the update succeeds, check if trade status changed to "For Sale" or "Open to Offers" and create a timeline event:

```typescript
import { addTimelineEvent } from "@/app/actions/hoofprint";

// After successful save:
if (tradeStatus === "For Sale" || tradeStatus === "Open to Offers") {
    try {
        await addTimelineEvent({
            horseId: horseId,
            eventType: "listed",
            title: `Listed: ${tradeStatus}`,
            description: listingPrice ? `Listed at $${listingPrice}` : undefined,
        });
    } catch {
        // Non-blocking
    }
}
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## ✅ Task AP-2: Settings Page — Database Migration

**Problem:** No settings page exists. Users can't change password, update email, edit bio/alias, or manage notification preferences.

**IMPORTANT:** After creating this file, STOP and tell the user to run it in the Supabase SQL Editor. Wait for confirmation before proceeding.

**File:** `supabase/migrations/019_settings.sql`

```sql
-- ============================================================
-- Migration 019: Settings — Avatar + Notification Preferences
-- ============================================================

-- ── 1. Avatar URL on users table ──
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN users.avatar_url IS 'URL to user avatar image in Supabase Storage.';

-- ── 2. Notification Preferences ──
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB DEFAULT '{
    "show_votes": true,
    "favorites": true,
    "comments": true,
    "new_followers": true,
    "messages": true,
    "show_results": true,
    "transfers": true
  }';

COMMENT ON COLUMN users.notification_prefs IS 'Per-event notification preferences. True = receive notification.';

-- ── 3. Default horse visibility preference ──
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS default_horse_public BOOLEAN DEFAULT true;

COMMENT ON COLUMN users.default_horse_public IS 'Default value for is_public when adding new horses.';
```

### Verify migration file was created:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "dir supabase\migrations\019_settings.sql 2>&1"
```

**⚠️ STOP HERE** — Ask the user to run this migration in the Supabase SQL Editor. Do NOT proceed until they confirm success.

---

## ✅ Task AP-3: Settings Server Actions

**What:** Create the server actions for profile updates, password change, and notification preferences.

**File:** `src/app/actions/settings.ts` (new file)

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ============================================================
// SETTINGS — Account Management Actions
// ============================================================

// ── Get current profile ──

export async function getProfile(): Promise<{
    aliasName: string;
    bio: string;
    avatarUrl: string | null;
    email: string;
    notificationPrefs: Record<string, boolean>;
    defaultHorsePublic: boolean;
} | null> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
        .from("users")
        .select("alias_name, bio, avatar_url, notification_prefs, default_horse_public")
        .eq("id", user.id)
        .single();

    if (!data) return null;
    const d = data as {
        alias_name: string;
        bio: string | null;
        avatar_url: string | null;
        notification_prefs: Record<string, boolean> | null;
        default_horse_public: boolean | null;
    };

    return {
        aliasName: d.alias_name,
        bio: d.bio || "",
        avatarUrl: d.avatar_url,
        email: user.email || "",
        notificationPrefs: d.notification_prefs || {
            show_votes: true,
            favorites: true,
            comments: true,
            new_followers: true,
            messages: true,
            show_results: true,
            transfers: true,
        },
        defaultHorsePublic: d.default_horse_public ?? true,
    };
}

// ── Update profile (alias, bio) ──

export async function updateProfile(data: {
    aliasName?: string;
    bio?: string;
    defaultHorsePublic?: boolean;
}): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    const updates: Record<string, unknown> = {};

    if (data.aliasName !== undefined) {
        const trimmed = data.aliasName.trim();
        if (trimmed.length < 3 || trimmed.length > 30) {
            return { success: false, error: "Alias must be 3-30 characters." };
        }
        // Check uniqueness
        const { data: existing } = await supabase
            .from("users")
            .select("id")
            .eq("alias_name", trimmed)
            .neq("id", user.id)
            .maybeSingle();
        if (existing) return { success: false, error: "That alias is already taken." };
        updates.alias_name = trimmed;
    }

    if (data.bio !== undefined) {
        updates.bio = data.bio.trim().slice(0, 500);
    }

    if (data.defaultHorsePublic !== undefined) {
        updates.default_horse_public = data.defaultHorsePublic;
    }

    if (Object.keys(updates).length === 0) return { success: true };

    const { error } = await supabase
        .from("users")
        .update(updates)
        .eq("id", user.id);

    if (error) return { success: false, error: error.message };
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    return { success: true };
}

// ── Update notification preferences ──

export async function updateNotificationPrefs(
    prefs: Record<string, boolean>
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    const { error } = await supabase
        .from("users")
        .update({ notification_prefs: prefs })
        .eq("id", user.id);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

// ── Change password ──

export async function changePassword(data: {
    newPassword: string;
    confirmPassword: string;
}): Promise<{ success: boolean; error?: string }> {
    if (data.newPassword !== data.confirmPassword) {
        return { success: false, error: "Passwords do not match." };
    }
    if (data.newPassword.length < 8) {
        return { success: false, error: "Password must be at least 8 characters." };
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({
        password: data.newPassword,
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
}

// ── Upload avatar ──

export async function uploadAvatar(
    formData: FormData
): Promise<{ success: boolean; url?: string; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    const file = formData.get("avatar") as File;
    if (!file || file.size === 0) return { success: false, error: "No file selected." };
    if (file.size > 2 * 1024 * 1024) return { success: false, error: "File must be under 2MB." };

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/avatar.${ext}`;

    // Upload to storage (upsert)
    const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) return { success: false, error: uploadError.message };

    // Get public URL
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);

    // Update user record
    const { error: dbError } = await supabase
        .from("users")
        .update({ avatar_url: urlData.publicUrl })
        .eq("id", user.id);

    if (dbError) return { success: false, error: dbError.message };
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    return { success: true, url: urlData.publicUrl };
}
```

**Note:** The `avatars` storage bucket must be created in Supabase Storage (Dashboard → Storage → Create Bucket → Name: `avatars`, public: true). Remind the user to create this bucket.

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## ✅ Task AP-4: Settings Page UI

**What:** Create the `/settings` page with sections for Profile, Security, Notifications, and Preferences.

**File:** `src/app/settings/page.tsx` (new file)

Build a client component with these sections:

### Section 1: Profile
- **Alias Name** — text input, validates 3-30 chars, checks uniqueness on save
- **Bio** — textarea, 500 char max
- **Avatar** — circular preview with upload button, file input accepts images, max 2MB
- Save button calls `updateProfile()` and shows success/error toast

### Section 2: Security
- **Change Password** — two password inputs (new + confirm), calls `changePassword()`
- **Email** — display only (show current email, note that email change requires verification — future enhancement)

### Section 3: Notification Preferences
- Toggle switches for each notification type:
  - 📸 Show votes
  - ❤️ Favorites on your horses
  - 💬 Comments on your horses
  - 👥 New followers
  - ✉️ Messages
  - 🏆 Show results
  - 📦 Transfer notifications
- Auto-save on toggle via `updateNotificationPrefs()`

### Section 4: Preferences
- **Default New Horse Visibility** — toggle between Public / Private
- Save button

### Layout
Use the existing `static-page` layout for consistency. Each section is a card.

**Modify `src/components/Header.tsx`:**
Add a ⚙️ Settings link in the nav, between the profile link and the sign out button:
```tsx
<Link href="/settings" className="header-nav-link" onClick={closeMobileMenu}>
    ⚙️ Settings
</Link>
```

**CSS to add to `src/app/globals.css`:**

```css
/* ===== Settings Page ===== */
.settings-section {
    margin-bottom: var(--space-2xl);
}

.settings-section-title {
    font-size: calc(1.1rem * var(--font-scale));
    font-weight: 700;
    margin-bottom: var(--space-lg);
    display: flex;
    align-items: center;
    gap: var(--space-sm);
}

.settings-card {
    padding: var(--space-lg);
    border-radius: var(--radius-xl);
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
}

.settings-avatar-row {
    display: flex;
    align-items: center;
    gap: var(--space-lg);
    margin-bottom: var(--space-lg);
}

.settings-avatar {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2rem;
    overflow: hidden;
    border: 2px solid rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
}

.settings-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.settings-toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-sm) 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.settings-toggle-row:last-child {
    border-bottom: none;
}

.settings-toggle-label {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: calc(0.85rem * var(--font-scale));
}

.settings-toggle {
    position: relative;
    width: 44px;
    height: 24px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    cursor: pointer;
    transition: background 0.2s;
    border: none;
    padding: 0;
}

.settings-toggle.active {
    background: var(--color-accent-primary);
}

.settings-toggle::after {
    content: "";
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: white;
    transition: transform 0.2s;
}

.settings-toggle.active::after {
    transform: translateX(20px);
}

.settings-success {
    color: #22c55e;
    font-size: calc(0.8rem * var(--font-scale));
    margin-top: var(--space-xs);
}
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## ✅ Task AP-5: Display Avatars Across the Platform

**What:** Show user avatars wherever user identity appears. Currently these show generic emoji/initial icons.

**Files to update:**

### 1. `src/app/profile/[alias_name]/page.tsx`
- Fetch `avatar_url` from the users query
- Replace the generic profile hero icon with: `{avatarUrl ? <img src={avatarUrl} alt="" /> : "🐴"}`

### 2. `src/components/ActivityFeed.tsx`
- Fetch `avatar_url` alongside alias in the activity events query
- Display avatar next to each feed item

### 3. `src/app/discover/page.tsx`
- Include `avatar_url` in the users query
- Show avatar on collector cards

### 4. `src/components/Header.tsx`
- If user has avatar, show small circular avatar instead of the profile emoji in the nav

### 5. Comment/rating displays
- Wherever user alias is shown with a comment or rating, add a small avatar

**Pattern:** Create a reusable `UserAvatar` component:

**File:** `src/components/UserAvatar.tsx` (new file)

```tsx
interface UserAvatarProps {
    avatarUrl: string | null;
    aliasName: string;
    size?: number;
}

export default function UserAvatar({ avatarUrl, aliasName, size = 32 }: UserAvatarProps) {
    return (
        <div className="user-avatar" style={{ width: size, height: size }}>
            {avatarUrl ? (
                <img src={avatarUrl} alt={aliasName} />
            ) : (
                <span>{aliasName.charAt(0).toUpperCase()}</span>
            )}
        </div>
    );
}
```

**CSS:**
```css
.user-avatar {
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
    font-weight: 700;
    font-size: 0.7em;
    color: var(--color-text-muted);
}

.user-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

# 🟡 Priority: Medium

## ✅ Task AP-6: About Page — Expand Vision Section

**Problem:** The About page is solid but the "Vision" section at the bottom feels thin (just 2 short paragraphs). It should hint at what's coming and give users a reason to stick around.

**What to change:**

**File:** `src/app/about/page.tsx`

Replace the Vision section (lines ~92-104) with something more substantive:

```tsx
{/* The Vision */}
<section className="static-section">
    <h2>Where We&apos;re Going</h2>
    <p>
        Model Horse Hub isn&apos;t finished — it&apos;s just getting started. Every feature on this
        platform exists because a real collector said &ldquo;I wish this existed.&rdquo; Virtual photo
        shows, wishlist matchmaking, seller ratings, and Hoofprint™ provenance all started
        as conversations in the community.
    </p>
    <p>
        Here&apos;s what&apos;s on our horizon:
    </p>
    <div className="about-values-grid" style={{ marginTop: "var(--space-md)" }}>
        <div className="about-value-card">
            <span className="about-value-icon" aria-hidden="true">📊</span>
            <h3>Market Price Guide</h3>
            <p>
                Aggregate pricing data across the hobby. See what your release
                is worth based on real collector data — not guesswork.
            </p>
        </div>
        <div className="about-value-card">
            <span className="about-value-icon" aria-hidden="true">📱</span>
            <h3>Mobile Experience</h3>
            <p>
                Take your collection to live shows. Quick photo capture,
                offline access, and push notifications — all from your phone.
            </p>
        </div>
        <div className="about-value-card">
            <span className="about-value-icon" aria-hidden="true">🤝</span>
            <h3>Your Features</h3>
            <p>
                We build what you ask for. Every feature request from the community
                gets heard, prioritized, and built. This is your platform.
            </p>
        </div>
    </div>
</section>
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## ✅ Task AP-7: Commit & Push

```
cd c:\Project Equispace\model-horse-hub && cmd /c "git add -A && git commit -m "feat: settings page, user avatars, edit form life stage, about page polish" 2>&1"
```

Then push:

```
cd c:\Project Equispace\model-horse-hub && cmd /c "git push origin main 2>&1"
```
