---
description: Living task queue of dev cleanup, polish, and next-steps items. Run this workflow to pick up and execute pending work items.
---

# Dev Next-Steps — Living Task Queue

> **Purpose:** A persistent, prioritized list of cleanup, polish, and improvement tasks. Run `/dev-nextsteps` to pick up the next batch of work.
> **Last Updated:** 2026-03-08
> **Convention:** Mark items ✅ when done. Add new items at the bottom of the appropriate priority section. Commit this file alongside the code changes.
> **Archive:** Completed tasks are moved to `dev-nextsteps-archive.md` in this same directory.
> **Source:** Real beta tester feedback from 2026-03-08.

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
# OPTION 10: BETA TESTER FEEDBACK BATCH
# ═══════════════════════════════════════

> **Context:** First real beta tester (wife) provided UI/UX feedback after using modelhorsehub.com. All items are user-reported and high-impact.

# 🔴 Priority: Critical — Users Are Hitting These

## Task BF-1: Photo Lightbox — Click to Enlarge & Scroll

**Problem:** Users want to click on photos to open them larger and scroll through all images. Currently photos display as thumbnails with no expand functionality.

**What to build:**

Create a reusable `PhotoLightbox` component that:
- Opens when any photo is clicked on the passport page (public or private)
- Shows the image at full/large size in a dark overlay
- Has left/right arrows (or swipe on mobile) to navigate between images
- Shows photo count indicator (e.g., "3 of 7")
- Closes on clicking the backdrop, pressing Escape, or clicking an X button
- Keyboard accessible (arrow keys to navigate, Escape to close)
- Prevents body scroll when open

**File:** `src/components/PhotoLightbox.tsx` (new file)

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";

interface PhotoLightboxProps {
    images: { url: string; label?: string }[];
    initialIndex: number;
    onClose: () => void;
}
```

**Key implementation:**
- Use `position: fixed; inset: 0; z-index: 1000` overlay
- Image: `max-width: 90vw; max-height: 85vh; object-fit: contain`
- Arrow buttons: large touch targets (48px+), semi-transparent
- Animate in with a fade + scale CSS transition
- Use `useEffect` for keydown listener (Escape, ArrowLeft, ArrowRight)

**Where to integrate:**

1. **`src/app/stable/[id]/page.tsx`** (private passport)
   - Import `PhotoLightbox`
   - Add `const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)`
   - Wrap each gallery image in a clickable wrapper: `onClick={() => setLightboxIndex(i)}`
   - Render `{lightboxIndex !== null && <PhotoLightbox images={allImages} initialIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />}`

2. **`src/app/community/[id]/page.tsx`** (public passport)
   - Same integration pattern

**CSS to add to `src/app/globals.css`:**

```css
/* ===== Photo Lightbox ===== */
.lightbox-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(0, 0, 0, 0.92);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: lightbox-fade-in 0.2s ease-out;
    backdrop-filter: blur(8px);
}

@keyframes lightbox-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
}

.lightbox-image {
    max-width: 90vw;
    max-height: 85vh;
    object-fit: contain;
    border-radius: var(--radius-lg);
    box-shadow: 0 0 60px rgba(0, 0, 0, 0.5);
}

.lightbox-close {
    position: absolute;
    top: var(--space-lg);
    right: var(--space-lg);
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: white;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 1.2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
    z-index: 1001;
}

.lightbox-close:hover {
    background: rgba(255, 255, 255, 0.2);
}

.lightbox-nav {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: white;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 1.4rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
}

.lightbox-nav:hover {
    background: rgba(255, 255, 255, 0.25);
}

.lightbox-nav-prev { left: var(--space-lg); }
.lightbox-nav-next { right: var(--space-lg); }

.lightbox-counter {
    position: absolute;
    bottom: var(--space-lg);
    left: 50%;
    transform: translateX(-50%);
    color: rgba(255, 255, 255, 0.6);
    font-size: calc(var(--font-size-sm) * var(--font-scale));
}

.lightbox-label {
    position: absolute;
    bottom: calc(var(--space-lg) + 24px);
    left: 50%;
    transform: translateX(-50%);
    color: rgba(255, 255, 255, 0.8);
    font-size: calc(var(--font-size-sm) * var(--font-scale));
    font-weight: 600;
}

/* Make existing gallery images show a zoom cursor */
.passport-gallery img,
.passport-photos img {
    cursor: zoom-in;
    transition: transform 0.2s, box-shadow 0.2s;
}

.passport-gallery img:hover,
.passport-photos img:hover {
    transform: scale(1.02);
    box-shadow: 0 4px 20px rgba(124, 109, 240, 0.2);
}
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task BF-2: Edit Horse Save — Fix Infinite Loading

**Problem:** When saving edits, the page appears to hang forever. On refresh, the changes were saved. The issue is that `router.push()` may stall or the `isSaving` state never resets on success.

**Root Cause:** In `handleSave()` (edit page line ~279-385), after `updateHorseAction` succeeds, the code calls fire-and-forget actions (notifyHorsePublic, addTimelineEvent) using `await` which can stall. Then `router.push("/dashboard?toast=updated...")` may not complete the navigation or the loading state doesn't clear.

**What to fix:**

**File:** `src/app/stable/[id]/edit/page.tsx`

1. Make the fire-and-forget calls truly non-blocking by NOT awaiting them:

Replace the timeline event block (around line 371-379):
```typescript
// Auto-create Hoofprint™ listed event (fire-and-forget — do NOT await)
if (tradeStatus === "For Sale" || tradeStatus === "Open to Offers") {
    addTimelineEvent({
        horseId: horseId,
        eventType: "listed",
        title: `Listed: ${tradeStatus}`,
        description: listingPrice ? `Listed at $${listingPrice}` : undefined,
    }).catch(() => { /* Non-blocking */ });
}
```

Note: remove the `await` and the `try/catch` wrapper — use `.catch()` instead.

2. Use `window.location.href` instead of `router.push()` for the redirect (same fix pattern as sign-out):

Replace `router.push("/dashboard?toast=updated&name=" + ...)` with:
```typescript
window.location.href = "/dashboard?toast=updated&name=" + encodeURIComponent(customName.trim());
```

This forces a hard navigation that clears all state, including `isSaving`.

3. As a safety net, add a `finally` block to always reset `isSaving`:

```typescript
} catch (err) {
    setSaveError(err instanceof Error ? err.message : "Failed to save changes.");
} finally {
    setIsSaving(false);
}
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

# 🟡 Priority: Medium — Quality of Life

## Task BF-3: Add "Finishing Artist" Field to Horse Record

**Problem:** Users want to track who painted/customized a model. A horse might be sculpted by one person and finished (painted) by another. This is extremely common in the custom/artist resin community.

**What to do:**

### Database Migration

**File:** `supabase/migrations/020_beta_feedback.sql` (new file)

```sql
-- ============================================================
-- Migration 020: Beta Feedback — Finishing Artist + Edition Info
-- ============================================================

-- ── 1. Finishing artist (who painted/finished the model) ──
ALTER TABLE user_horses
  ADD COLUMN IF NOT EXISTS finishing_artist TEXT;

COMMENT ON COLUMN user_horses.finishing_artist IS 'Name of the artist who painted/finished/customized this model.';

-- ── 2. Edition info (e.g., "3 of 50") ──
ALTER TABLE user_horses
  ADD COLUMN IF NOT EXISTS edition_number INTEGER;

ALTER TABLE user_horses
  ADD COLUMN IF NOT EXISTS edition_size INTEGER;

COMMENT ON COLUMN user_horses.edition_number IS 'This model''s number in a limited edition run (e.g., 3 of 50).';
COMMENT ON COLUMN user_horses.edition_size IS 'Total number produced in this edition.';

-- ── 3. Database suggestions table (user-submitted entries) ──
CREATE TABLE IF NOT EXISTS database_suggestions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by UUID NOT NULL REFERENCES auth.users(id),
  suggestion_type TEXT NOT NULL CHECK (suggestion_type IN ('mold', 'release', 'resin')),
  name         TEXT NOT NULL,
  details      TEXT,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE database_suggestions ENABLE ROW LEVEL SECURITY;

-- Users can see their own suggestions
CREATE POLICY "Users can view own suggestions"
  ON database_suggestions FOR SELECT TO authenticated
  USING (submitted_by = auth.uid());

-- Users can insert suggestions
CREATE POLICY "Users can submit suggestions"
  ON database_suggestions FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid());

CREATE INDEX idx_suggestions_status ON database_suggestions(status);
CREATE INDEX idx_suggestions_user ON database_suggestions(submitted_by);
```

**⚠️ STOP HERE** — Ask the user to run this migration in the Supabase SQL Editor. Do NOT proceed until they confirm success.

### Form Integration

**Files to update:** `src/app/add-horse/page.tsx` AND `src/app/stable/[id]/edit/page.tsx`

Add these fields after the "Sculptor" field:

```tsx
{/* Finishing Artist */}
<div className="form-group">
    <label htmlFor="finishing-artist" className="form-label">
        🎨 Finishing Artist
    </label>
    <input
        type="text"
        id="finishing-artist"
        className="form-input"
        placeholder="Who painted or customized this model?"
        value={finishingArtist}
        onChange={(e) => setFinishingArtist(e.target.value)}
    />
    <span className="form-hint">
        The artist who painted/finished this model (if different from sculptor).
    </span>
</div>

{/* Edition Info */}
<div className="form-group">
    <label className="form-label">📋 Edition Info</label>
    <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center" }}>
        <input
            type="number"
            className="form-input"
            placeholder="#"
            value={editionNumber}
            onChange={(e) => setEditionNumber(e.target.value)}
            style={{ width: 80 }}
            min="1"
        />
        <span style={{ color: "var(--color-text-muted)" }}>of</span>
        <input
            type="number"
            className="form-input"
            placeholder="Total"
            value={editionSize}
            onChange={(e) => setEditionSize(e.target.value)}
            style={{ width: 80 }}
            min="1"
        />
    </div>
    <span className="form-hint">
        e.g., "3 of 50" for limited edition runs.
    </span>
</div>
```

**Add state variables:**
```typescript
const [finishingArtist, setFinishingArtist] = useState("");
const [editionNumber, setEditionNumber] = useState("");
const [editionSize, setEditionSize] = useState("");
```

**Include in save/insert:**
```typescript
if (finishingArtist.trim()) horseData.finishing_artist = finishingArtist.trim();
if (editionNumber) horseData.edition_number = parseInt(editionNumber);
if (editionSize) horseData.edition_size = parseInt(editionSize);
```

**Also update the server action** `addHorseAction` and `updateHorseAction` in `src/app/actions/horse.ts` to handle these new fields from FormData.

**Display on passport pages:** Show "Finished by: ArtistName" and "Edition: 3 of 50" on both public and private passport pages.

**Hoofprint integration:** When `finishing_artist` is set, auto-create a timeline event:
```typescript
if (finishingArtist.trim()) {
    addTimelineEvent({
        horseId,
        eventType: "custom",
        title: `Finished by ${finishingArtist.trim()}`,
        description: "Finishing artist recorded.",
    }).catch(() => {});
}
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task BF-4: Auto-Fill Sculptor from Resin Selection

**Problem:** When a user selects an artist resin (e.g., "Midnight Dream by SculptorJane"), the sculptor field should auto-fill with the sculptor's name.

**What to fix:**

**File:** `src/app/add-horse/page.tsx` (and edit form)

In the `onSelectionChange` handler, when a resin is selected, auto-fill the sculptor field:

```typescript
// In the parent component where onSelectionChange is handled:
if (sel.resinId) {
    // The resin info should include sculptor_alias
    // Either pass it through the selection state or fetch it
    // Simplest: extend SelectionState to optionally carry sculptor info
}
```

**Simplest approach:** In `UnifiedReferenceSearch.tsx`, when `handleResinClick` fires, also pass the sculptor name back to the parent. Either:

1. Extend `SelectionState` to include `sculptorAlias?: string`
2. OR add an `onResinSelected?: (resin: ResinResult) => void` callback

Then in the parent:
```typescript
onResinSelected={(resin) => setSculptor(resin.sculptor_alias)}
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task BF-5: "Suggest Entry to Database" Feature

**Problem:** Users can't find their model in the 10,500+ reference database and want to suggest additions. Currently the "Can't find it?" button just switches to manual entry, but the data is lost.

**What to build:**

The `database_suggestions` table is created in migration 020 (Task BF-3).

### Server Action

**File:** `src/app/actions/suggestions.ts` (new file)

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";

export async function submitSuggestion(data: {
    suggestionType: "mold" | "release" | "resin";
    name: string;
    details?: string;
}): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    const { error } = await supabase.from("database_suggestions").insert({
        submitted_by: user.id,
        suggestion_type: data.suggestionType,
        name: data.name,
        details: data.details || null,
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
}

// Admin: get all pending suggestions
export async function getPendingSuggestions(): Promise<unknown[]> {
    const supabase = await createClient();
    const { data } = await supabase
        .from("database_suggestions")
        .select("*, users(alias_name)")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
    return data || [];
}

// Admin: approve/reject
export async function reviewSuggestion(
    id: string,
    status: "approved" | "rejected",
    adminNotes?: string
): Promise<{ success: boolean }> {
    const supabase = await createClient();
    const { error } = await supabase
        .from("database_suggestions")
        .update({ status, admin_notes: adminNotes || null })
        .eq("id", id);
    return { success: !error };
}
```

### UI Integration

In `UnifiedReferenceSearch.tsx`, the "Can't find it?" buttons already exist (lines ~418-435 and ~474-491). Instead of just calling `onCustomEntry`, also show a toast or mini-modal: "We'll send a suggestion to the admin to add this to the database."

Modify the `onCustomEntry` callback in the parent (add-horse page) to also call `submitSuggestion()` as a fire-and-forget:

```typescript
onCustomEntry={(term) => {
    // Switch to manual entry mode
    setManualMode(true);
    // Also submit as suggestion (fire-and-forget)
    submitSuggestion({
        suggestionType: tab === "resin" ? "resin" : "mold",
        name: term,
    }).catch(() => {});
    // Show a subtle toast
    setToast("📬 Suggestion sent to admin! We'll add it to the database.");
}}
```

### Admin Panel Integration

Add a "Database Suggestions" section to `/admin` page showing pending suggestions with approve/reject buttons.

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task BF-6: Resin Search — Match Model Number Too

**Problem:** User reports resin names don't match well. While the backend already uses `%${q}%` (contains match), the search might miss results because it doesn't search `model_number` for molds/releases.

**What to fix:**

**File:** `src/app/actions/reference.ts`

In `searchReferencesAction`, update the mold search to also match `model_number` in releases:

```typescript
// Current release search:
.or(`release_name.ilike.%${q}%,color_description.ilike.%${q}%`)

// Updated to also search model_number:
.or(`release_name.ilike.%${q}%,color_description.ilike.%${q}%,model_number.ilike.%${q}%`)
```

Also consider adding `model_number` matching for the resin search:
```typescript
// Resin search — also match sculptor_alias fragments
.or(`resin_name.ilike.%${q}%,sculptor_alias.ilike.%${q}%`)
```
This already matches on sculptor_alias fragments. Verify that partial sculptor names work (e.g., searching "Moon" matches "Moonstone Studios").

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

# 🟢 Priority: Nice-to-Have

## Task BF-7: Commit & Push

```
cd c:\Project Equispace\model-horse-hub && cmd /c "git add -A && git commit -m "feat: photo lightbox, finishing artist, edition info, suggest to DB, edit save fix" 2>&1"
```

Then push:

```
cd c:\Project Equispace\model-horse-hub && cmd /c "git push origin main 2>&1"
```
