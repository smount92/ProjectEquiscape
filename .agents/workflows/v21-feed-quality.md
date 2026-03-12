---
description: "Phase 6 Epic 3 — Feed Quality & Serverless Integrity. Opt-in watermarking, no-photo-no-feed rules, and after() safety. 3 tasks across settings, image pipeline, and activity events."
---

# Phase 6 — Epic 3: Feed Quality & Serverless Integrity

> **Master Blueprint:** `docs/Phase6_Master_Blueprint.md` — Epic 3
> **Philosophy:** "Right, not fast." Protect collector photos, maintain a curated feed, guarantee background tasks complete.
> **The Problem:** (A) High-end collector photos are stolen/reposted with no attribution. (B) Horses with 0 photos + CSV imports pollute the Activity Feed with empty cards. (C) Fire-and-forget promises are killed by Vercel's serverless runtime.
> **Current State:** Task 3.3 (serverless safety) was partially addressed in V16 Integrity Sprint. Tasks 3.1 and 3.2 are greenfield.

// turbo-all

---

## Developer Agent Rules

> **MANDATORY:**
> 1. Add `✅ DONE` and the date after each task heading when complete
> 2. Run `npx next build` after every task
> 3. Task 3.1 requires a database migration — create `059_watermark_setting.sql`
> 4. Task 3.3 requires auditing ALL server action files — use grep to find violations
> 5. Do NOT modify the image compression quality or max dimensions — only add watermark logic

---

## Pre-Flight: Existing Infrastructure

| System | File | Status |
|---|---|---|
| Image compression | `src/lib/utils/imageCompression.ts` | ✅ Exists — uses HTML5 Canvas, outputs WebP at 0.7 quality, max 1000px |
| Activity events | `src/app/actions/activity.ts` | ✅ Exists — `createActivityEvent()` writes to `activity_events` table |
| Horse public notifications | `src/app/actions/horse-events.ts` | ✅ Exists — `notifyHorsePublic()` fires `new_horse` event and wishlist matches |
| User settings | `src/app/actions/settings.ts` | ✅ Exists — `getProfile()`, `updateProfile()`, notification prefs |
| CSV batch import | `src/app/stable/import/` | ✅ Exists — uses `batch_import_horses` RPC |
| Settings UI | `src/app/settings/page.tsx` | ✅ Exists |

---

## Task 1 — Opt-In Client-Side Watermarking

### Step 1: Database migration — add watermark preference

Create `supabase/migrations/059_feed_quality.sql`:

```sql
-- ══════════════════════════════════════════════════════════════
-- Migration 059: Feed Quality & Integrity
-- Watermark setting, feed quality controls
-- ══════════════════════════════════════════════════════════════

-- Add watermark preference to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS watermark_photos BOOLEAN DEFAULT false;
```

### Step 2: Update settings server actions

In `src/app/actions/settings.ts`:

1. Add `watermark_photos` to the `getProfile()` SELECT + return type
2. Add `watermarkPhotos?: boolean` to `updateProfile()` parameters, include in update payload

```typescript
// In getProfile() — add to select string:
.select("alias_name, bio, avatar_url, notification_prefs, default_horse_public, watermark_photos")

// In return object:
watermarkPhotos: d.watermark_photos ?? false,

// In updateProfile() — add to update payload:
if (data.watermarkPhotos !== undefined) updateData.watermark_photos = data.watermarkPhotos;
```

### Step 3: Update Settings UI

In `src/app/settings/page.tsx`, add a toggle in the preferences section:

```tsx
<div className="form-group">
    <label className="form-label">📸 Photo Watermarking</label>
    <label style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", cursor: "pointer" }}>
        <input
            type="checkbox"
            checked={watermarkPhotos}
            onChange={e => setWatermarkPhotos(e.target.checked)}
        />
        <span>Add a subtle watermark to uploaded photos</span>
    </label>
    <span className="form-hint">
        Adds "© @{aliasName} — ModelHorseHub" in the corner of your photos before upload.
        Does not affect previously uploaded photos.
    </span>
</div>
```

### Step 4: Update imageCompression.ts with watermark support

In `src/lib/utils/imageCompression.ts`, add a new exported function:

```typescript
export async function compressImageWithWatermark(
    file: File,
    aliasName: string
): Promise<File> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let { width, height } = img;

                // Scale down if larger than MAX_DIMENSION
                if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
                    if (width > height) {
                        height = Math.round((height * MAX_DIMENSION) / width);
                        width = MAX_DIMENSION;
                    } else {
                        width = Math.round((width * MAX_DIMENSION) / height);
                        height = MAX_DIMENSION;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                if (!ctx) { resolve(file); return; }

                ctx.drawImage(img, 0, 0, width, height);

                // ── WATERMARK ──
                const text = `© @${aliasName} — ModelHorseHub`;
                const fontSize = Math.max(12, Math.floor(width * 0.02));
                ctx.font = `${fontSize}px Inter, sans-serif`;
                ctx.textAlign = "right";
                ctx.textBaseline = "bottom";

                // Semi-transparent background
                const textMetrics = ctx.measureText(text);
                const padding = 6;
                const bgX = width - textMetrics.width - padding * 3;
                const bgY = height - fontSize - padding * 3;
                ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
                ctx.fillRect(bgX, bgY, textMetrics.width + padding * 2, fontSize + padding * 2);

                // White text
                ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
                ctx.fillText(text, width - padding * 2, height - padding * 2);

                canvas.toBlob(
                    (blob) => {
                        if (!blob) { resolve(file); return; }
                        resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), {
                            type: "image/webp",
                            lastModified: Date.now(),
                        }));
                    },
                    "image/webp",
                    QUALITY
                );
            };
            img.onerror = () => reject(new Error("Failed to load image"));
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
    });
}
```

### Step 5: Wire watermarking into Add Horse and Edit Horse forms

In `src/app/add-horse/page.tsx` and `src/app/stable/[id]/edit/page.tsx`:

1. Fetch the user's `watermarkPhotos` preference (from getProfile or a dedicated flag)
2. Before uploading each photo, check the preference:

```typescript
import { compressImage, compressImageWithWatermark } from "@/lib/utils/imageCompression";

// In the upload loop:
const compressed = watermarkPhotos
    ? await compressImageWithWatermark(file, aliasName)
    : await compressImage(file);
```

### Step 6: Build and verify

1. `npx next build` — 0 errors
2. Manual test: Enable watermarking in settings, upload a photo, verify the watermark text appears in the bottom-right corner
3. Verify the watermark is tasteful (semi-transparent, doesn't obscure the horse)

---

## Task 2 — "No Photo, No Feed" Rules

### Step 1: Update notifyHorsePublic — Rule A

In `src/app/actions/horse-events.ts`, add a guard at the top of `notifyHorsePublic`:

```typescript
export async function notifyHorsePublic(data: {
    userId: string;
    horseId: string;
    horseName: string;
    finishType: string;
    tradeStatus?: string;
    catalogId?: string | null;
    photoCount?: number;  // ← ADD THIS PARAMETER
}): Promise<void> {
    // Rule A: No photo, no feed
    if (!data.photoCount || data.photoCount === 0) {
        return; // Silently skip — don't pollute the feed
    }

    // ...existing createActivityEvent call...
}
```

### Step 2: Update callers of notifyHorsePublic

In `src/app/add-horse/page.tsx` (~line 354) and `src/app/stable/[id]/edit/page.tsx` (~line 392):

Pass the photo count to the function call:

```typescript
notifyHorsePublic({
    userId: user.id,
    horseId: horseId,
    horseName: name,
    finishType: finishType,
    tradeStatus: tradeStatus,
    catalogId: catalogId,
    photoCount: uploadedPhotos.length,  // ← ADD THIS
});
```

### Step 3: Update CSV Batch Import — Rule B

In the batch import page (`src/app/stable/import/` or the relevant component):

1. Add a toggle checkbox to the import form:

```tsx
<label style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", cursor: "pointer" }}>
    <input
        type="checkbox"
        checked={publishToFeed}
        onChange={e => setPublishToFeed(e.target.checked)}
    />
    <span>Publish imported models to the community feed</span>
</label>
<span className="form-hint">
    Models without photos will be excluded regardless of this setting.
</span>
```

2. Default `publishToFeed` to `false`
3. After the batch import RPC succeeds:
   - If `publishToFeed` is `true`, loop through imported horses and call `notifyHorsePublic` for each that has `photoCount > 0`
   - If `publishToFeed` is `false`, skip ALL feed notifications

### Step 4: Build and verify

1. `npx next build` — 0 errors
2. Manual test: Add a horse with 0 photos, make it public → verify NO feed event created
3. Manual test: Batch import → verify the toggle exists and defaults to off

---

## Task 3 — Serverless Execution Safety (after() Audit)

### Step 1: Audit all server actions for fire-and-forget patterns

Search for patterns that indicate un-awaited async work:

```bash
# Find all fire-and-forget patterns
grep -rn "// Fire-and-forget\|// Best effort\|// Non-blocking\|\.then(" src/app/actions/
grep -rn "notifyHorsePublic\|createActivityEvent\|createNotification\|sendNewMessageNotification" src/app/actions/
```

### Step 2: Identify which files already use after()

```bash
grep -rn "import.*after.*next/server\|after(" src/app/actions/
```

If V16 already wrapped everything in `after()`, verify and mark done. If not, proceed:

### Step 3: Wrap all background tasks in after()

For every server action that calls `createActivityEvent`, `createNotification`, `sendNewMessageNotification`, or `notifyHorsePublic` as a non-blocking side effect, wrap it:

```typescript
import { after } from "next/server";

// BEFORE (fire-and-forget — DANGEROUS):
createActivityEvent({ ... }); // Promise not awaited!

// AFTER (safe — runs after response):
after(async () => {
    await createActivityEvent({ ... });
});
```

**Files to audit:**
1. `horse-events.ts` — `notifyHorsePublic` calls
2. `horse.ts` — any activity logging
3. `messaging.ts` — `sendNewMessageNotification` calls
4. `groups.ts` — post/channel notifications
5. `art-studio.ts` — commission notifications
6. `competition.ts` — show results events
7. `parked-export.ts` — transfer notifications
8. `posts.ts` — activity events on post creation
9. `follows.ts` — follow notifications
10. `likes.ts` — like notifications

### Step 4: Verify no window.location.href redirects in server components

```bash
grep -rn "window.location" src/app/
```

The V16 sprint should have removed the problematic hard redirect in the edit page. Verify it's gone.

### Step 5: Build and verify

1. `npx next build` — 0 errors
2. All `after()` imports resolve correctly

---

## Completion Checklist

**Task 1 — Opt-In Watermarking**
- [ ] Migration 059 created with `watermark_photos` column
- [ ] `getProfile()` returns `watermarkPhotos`
- [ ] `updateProfile()` accepts `watermarkPhotos`
- [ ] Settings UI toggle added
- [ ] `compressImageWithWatermark()` function created
- [ ] Add Horse form uses watermark if enabled
- [ ] Edit Horse form uses watermark if enabled
- [ ] Watermark is tasteful and semi-transparent
- [ ] `npx next build` passes

**Task 2 — No Photo, No Feed**
- [ ] `notifyHorsePublic()` accepts `photoCount` parameter
- [ ] Guard: `photoCount === 0` → skip activity event
- [ ] Add Horse form passes `photoCount`
- [ ] Edit Horse form passes `photoCount`
- [ ] CSV Import has `publishToFeed` toggle (defaults to false)
- [ ] CSV Import respects the toggle
- [ ] `npx next build` passes

**Task 3 — Serverless Safety**
- [ ] All 10+ action files audited for fire-and-forget patterns
- [ ] All background tasks wrapped in `after()`
- [ ] No `window.location.href` in server contexts
- [ ] `npx next build` passes

**Estimated effort:** ~4-6 hours across 3 tasks
