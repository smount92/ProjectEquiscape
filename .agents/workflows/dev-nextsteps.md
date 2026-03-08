---
description: Living task queue of dev cleanup, polish, and next-steps items. Run this workflow to pick up and execute pending work items.
---

# Dev Next-Steps — Living Task Queue

> **Purpose:** A persistent, prioritized list of cleanup, polish, and improvement tasks. Run `/dev-nextsteps` to pick up the next batch of work.
> **Last Updated:** 2026-03-08
> **Convention:** Mark items ✅ when done. Add new items at the bottom of the appropriate priority section. Commit this file alongside the code changes.
> **Source:** Beta tester feedback round 2, 2026-03-08.

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
# OPTION 11: BETA FEEDBACK ROUND 2
# ═══════════════════════════════════════

# 🔴 Priority: Critical — Bugs

## Task B2-1: Avatar Upload Not Reflecting on Profile Page

**Problem:** User uploads a new avatar in Settings (succeeds — they can see it in Settings), but the profile page (`/profile/[alias_name]`) still shows the old avatar or default 🐴 emoji. Other users can also not see the correct avatar.

**Root Cause Analysis:**

The `uploadAvatar` action in `src/app/actions/settings.ts` (lines 149-183):
1. Uploads to `avatars` bucket with path `{userId}/avatar.{ext}` using `upsert: true` ✅
2. Gets the public URL ✅
3. Updates `users.avatar_url` in the database ✅
4. Revalidates `/settings` and `/dashboard` ✅

BUT it does **NOT** revalidate:
- `/profile/[alias_name]` — so the profile page is cached with the old URL
- `/discover` — so the discover page avatar is stale
- `/community` — so comments show old avatar

Also, since the file path is always `{userId}/avatar.{ext}` with `upsert: true`, **the CDN caches the old file at the same URL**. The `?t=` cache-buster on the Settings page works locally, but the Supabase CDN may still serve the old file to other users.

**What to fix:**

**File:** `src/app/actions/settings.ts` — `uploadAvatar` function

1. **Use a unique filename** instead of always `avatar.{ext}` to bust CDN cache:

```typescript
const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
const path = `${user.id}/avatar_${Date.now()}.${ext}`;
```

2. **Delete the old avatar file** before uploading the new one:

```typescript
// Get current avatar URL to find old file path
const { data: currentProfile } = await supabase
    .from("users")
    .select("avatar_url")
    .eq("id", user.id)
    .single<{ avatar_url: string | null }>();

if (currentProfile?.avatar_url) {
    const oldMatch = currentProfile.avatar_url.match(/avatars\/(.+?)(\?|$)/);
    if (oldMatch?.[1]) {
        await supabase.storage.from("avatars").remove([oldMatch[1]]);
    }
}
```

3. **Revalidate all pages that show avatars:**

```typescript
revalidatePath("/settings");
revalidatePath("/dashboard");
revalidatePath("/discover");
revalidatePath("/feed");
// Can't revalidate dynamic [alias_name] easily, but the DB URL is fresh
```

4. **Store the URL WITHOUT cache buster in the database**, but return it WITH one:

```typescript
// Store clean URL in DB
const { error: dbError } = await supabase
    .from("users")
    .update({ avatar_url: urlData.publicUrl })
    .eq("id", user.id);

// Return with cache buster for immediate UI update
return { success: true, url: urlData.publicUrl + "?t=" + Date.now() };
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task B2-2: Reference Link Not Always Saving on Intake

**Problem:** User selects a mold/release on the Reference step (Step 2) of the Add Horse form, but after saving, the horse record sometimes has `null` for `reference_mold_id` and `release_id`. Editing the horse after and re-selecting works fine.

**Root Cause Analysis:**

The client sends `selectedMoldId`, `selectedResinId`, `selectedReleaseId` via FormData (line 333-335 of `add-horse/page.tsx`):

```typescript
if (selectedMoldId) formData.append("selectedMoldId", selectedMoldId);
```

This is correct. BUT there are edge cases:

1. **User selects a Release directly from search results** — `handleReleaseClick` sets `moldId` to `release.mold_id`, but if the mold wasn't also in the search results array, `selectedMoldInfo` stays null. The state IS set correctly though.

2. **More likely culprit: The step wizard hides Step 2 content when on Step 3/4.** If the `UnifiedReferenceSearch` component unmounts when `currentStep !== 1`, any internal state in the component that was managing the selection could be lost. BUT — the selection state is lifted to the parent (`selectedMoldId` etc.) so this shouldn't matter.

3. **Most likely: The `onCustomEntry` path.** When a user clicks "Can't find it?" (line 675-693), it explicitly clears all three IDs:
   ```typescript
   setSelectedMoldId(null);
   setSelectedResinId(null);
   setSelectedReleaseId(null);
   ```
   If the user accidentally hits this, their reference link is wiped.

**What to fix:**

**File:** `src/app/add-horse/page.tsx`

1. **Add a debug log** before FormData creation to trace exactly what's being sent:

```typescript
console.log("[AddHorse] Submitting with refs:", {
    selectedMoldId,
    selectedResinId,
    selectedReleaseId,
});
```

2. **Add a visual indicator on Step 3/4** showing what reference is linked, so the user can see if it was lost:

After the step header on Steps 3 and 4, show a compact badge:

```tsx
{/* Reference summary badge — visible on all steps after Step 2 */}
{currentStep >= 2 && (selectedMoldId || selectedResinId) && (
    <div className="getting-started-tip" style={{ marginBottom: "var(--space-lg)" }}>
        🔗 Linked to: <strong>{selectedMoldId ? "Mold" : "Resin"} selected</strong>
        {selectedReleaseId && <> · Release selected</>}
    </div>
)}
```

3. **Guard the onCustomEntry path** — show a confirmation if reference was already selected:

```typescript
onCustomEntry={(searchTerm) => {
    if (selectedMoldId || selectedResinId) {
        if (!confirm("This will clear your current reference link. Continue?")) {
            return;
        }
    }
    // ... existing clear logic
}}
```

4. **Ensure step content doesn't unmount** — use CSS visibility instead of conditional rendering:

Instead of:
```tsx
{currentStep === 1 && (<div>...step 2 content...</div>)}
```

Use:
```tsx
<div style={{ display: currentStep === 1 ? "block" : "none" }}>
    ...step 2 content...
</div>
```

This keeps the `UnifiedReferenceSearch` component mounted and preserves its internal state.

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

# 🟡 Priority: Medium — New Feature

## Task B2-3: Text Posts to Feed

**Problem:** Users want to post text updates to the activity feed — like a mini-blog or status update. Currently, the feed only shows auto-generated events (horse added, favorited, commented, etc.). There's no way for a user to manually post.

**What to build:**

### Database

The `activity_events` table already supports this! It has:
- `actor_id` (who posted)
- `event_type` (we'll add `"text_post"`)
- `horse_id` (null for text posts)
- `metadata` (we'll store `{ text: "..." }`)
- `created_at`

No migration needed.

### Server Action

**File:** `src/app/actions/activity.ts` — Add a new function:

```typescript
/**
 * Create a text post on the activity feed.
 */
export async function createTextPost(text: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    const trimmed = text.trim();
    if (!trimmed) return { success: false, error: "Post cannot be empty." };
    if (trimmed.length > 500) return { success: false, error: "Post must be 500 characters or less." };

    // Use admin client to bypass RLS if needed
    const supabaseAdmin = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabaseAdmin.from("activity_events").insert({
        actor_id: user.id,
        event_type: "text_post",
        horse_id: null,
        target_id: null,
        metadata: { text: trimmed },
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
}
```

### UI — Add Compose Bar to Feed Page

**File:** `src/app/feed/page.tsx`

The feed page is a Server Component, so the compose bar should be a separate Client Component.

**New file:** `src/components/FeedComposeBar.tsx`

```tsx
"use client";

import { useState } from "react";
import { createTextPost } from "@/app/actions/activity";
import { useRouter } from "next/navigation";

export default function FeedComposeBar() {
    const [text, setText] = useState("");
    const [isPosting, setIsPosting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handlePost = async () => {
        if (!text.trim()) return;
        setIsPosting(true);
        setError(null);

        const result = await createTextPost(text);
        if (result.success) {
            setText("");
            router.refresh(); // Refresh feed with new post
        } else {
            setError(result.error || "Failed to post.");
        }
        setIsPosting(false);
    };

    return (
        <div className="feed-compose-bar">
            <textarea
                className="form-textarea feed-compose-input"
                placeholder="Share an update with the community…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={500}
                rows={2}
            />
            <div className="feed-compose-footer">
                <span className="feed-compose-count">
                    {text.length}/500
                </span>
                <button
                    className="btn btn-primary btn-sm"
                    onClick={handlePost}
                    disabled={isPosting || !text.trim()}
                >
                    {isPosting ? "Posting…" : "📝 Post"}
                </button>
            </div>
            {error && <p className="form-error" style={{ marginTop: "var(--space-xs)" }}>{error}</p>}
        </div>
    );
}
```

**Integrate into feed page** — Add above the ActivityFeed component:

```tsx
import FeedComposeBar from "@/components/FeedComposeBar";

// ... inside the return, after the Tab Bar:
<FeedComposeBar />
```

### ActivityFeed Display — Handle "text_post" Event Type

**File:** `src/components/ActivityFeed.tsx`

In the event rendering logic, add a case for `event_type === "text_post"`:

```tsx
case "text_post":
    return (
        <div className="feed-item-text-post">
            <p>{(item.metadata as { text: string })?.text}</p>
        </div>
    );
```

### CSS

**File:** `src/app/globals.css`

```css
/* ===== Feed Compose Bar ===== */
.feed-compose-bar {
    background: var(--color-surface-1);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--space-md);
    margin-bottom: var(--space-xl);
}

.feed-compose-input {
    resize: none;
    min-height: 60px;
    margin-bottom: var(--space-sm);
}

.feed-compose-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.feed-compose-count {
    font-size: calc(0.75rem * var(--font-scale));
    color: var(--color-text-muted);
}

/* ===== Text Post in Feed ===== */
.feed-item-text-post {
    font-size: calc(var(--font-size-base) * var(--font-scale));
    line-height: 1.6;
    color: var(--color-text);
    padding: var(--space-sm) 0;
    white-space: pre-wrap;
}
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task B2-4: Commit & Push

```
cd c:\Project Equispace\model-horse-hub && cmd /c "git add -A && git commit -m "fix: avatar caching, reference save reliability, text posts to feed" 2>&1"
```

Then push:

```
cd c:\Project Equispace\model-horse-hub && cmd /c "git push origin main 2>&1"
```
