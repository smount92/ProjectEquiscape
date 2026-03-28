---
description: Pro-Tier Asset Pipeline — dual-encode thumbnails, tier-gated quality, grid optimization for zero-cost image compute
---

# The Pro-Tier Asset Pipeline & Zero-Cost Thumbnails

> **Constraint:** MHH does NOT pay for Vercel Image Optimization or Supabase Image Transformations. ALL image processing happens client-side via HTML5 Canvas before upload.
> **Last Updated:** 2026-03-28
> **Status:** ✅ COMPLETE (2026-03-28)
> **Commit:** `57a78a3`
> **Prerequisite:** None — standalone feature
> **Affected Files:** `src/lib/utils/imageCompression.ts`, `src/lib/utils/imageUrl.ts` (NEW), `src/components/StableGrid.tsx`, `src/components/ShowRingGrid.tsx`, `src/app/add-horse/page.tsx`, `src/app/stable/[id]/edit/page.tsx`

// turbo-all

---

# ═══════════════════════════════════════
# PHASE 1: Dual-Encode Compression Engine ✅ DONE
# ═══════════════════════════════════════

## Step 1.1 — Add tier-aware compression config ✅

**Target File:** `src/lib/utils/imageCompression.ts`

Replaced hardcoded constants with tier-aware config:

```ts
export type UserTier = "free" | "pro" | "studio";

const TIER_CONFIG: Record<UserTier, CompressionConfig> = {
    free:   { maxDimension: 1000, quality: 0.70 },
    pro:    { maxDimension: 2500, quality: 0.92 },
    studio: { maxDimension: 2500, quality: 0.95 },
};

const THUMB_DIMENSION = 400;
const THUMB_QUALITY = 0.60;
const MAX_FILE_SIZE_MB = 10; // Bumped for Pro tier high-res
```

## Step 1.2 — Refactor `compressImage` to accept tier ✅

Both `compressImage` and `compressImageWithWatermark` now accept `tier: UserTier = "free"` as a parameter.

## Step 1.3 — Add `generateThumbnail` function ✅

New exported function: `generateThumbnail(file: File): Promise<File>` — 400px WebP thumbnail at 0.60 quality.

## Step 1.4 — Update `validateImageFile` max size ✅

MAX_FILE_SIZE_MB bumped from 5 to 10 — propagates automatically through the constant.

## Verify Phase 1 ✅

- [x] `compressImage` accepts optional `tier` parameter
- [x] `generateThumbnail` exports correctly
- [x] No TypeScript errors

---

# ═══════════════════════════════════════
# PHASE 2: Dual Upload in Server Actions ✅ DONE
# ═══════════════════════════════════════

## Step 2.1 — Update `addHorse` page to generate both files ✅

**Implementation note:** User tier is read client-side from `supabase.auth.getUser().app_metadata.tier` — no new server action needed. The original workflow suggested passing tier through FormData to a server action, but since image uploads happen client-side (direct-to-Supabase-Storage), we read the tier from the JWT directly in the client component.

## Step 2.2 — Upload thumbnail alongside main image ✅

**Implementation note:** The original workflow suggested modifying `horse.ts` server action, but image uploads are browser-direct (not through server actions). Thumbnail upload happens in the same client-side loop as main image upload — a `_thumb.webp` file is uploaded to the same storage path with the `_thumb` suffix appended before `.webp`.

## Step 2.3 — Apply same pattern to edit-horse page ✅

Mirrored the same changes — tier from JWT, thumbnail generation for new uploads.

## Verify Phase 2 ✅

- [x] Both main image and `_thumb.webp` are uploaded to Supabase Storage
- [x] Existing horses without thumbnails still display correctly (graceful fallback via `onError`)

---

# ═══════════════════════════════════════
# PHASE 3: Grid Optimization — Serve Thumbnails ✅ DONE
# ═══════════════════════════════════════

## Step 3.1 — Create a thumbnail URL helper ✅

**New File:** `src/lib/utils/imageUrl.ts`

```ts
export function getThumbUrl(originalUrl: string): string {
    return originalUrl.replace(/\.[^.]+$/, "_thumb.webp");
}
```

## Step 3.2 — Update grid components to use thumbnails ✅

**Updated:**
- `src/components/StableGrid.tsx` — uses `getThumbUrl()` with `onError` fallback
- `src/components/ShowRingGrid.tsx` — uses `getThumbUrl()` with `onError` fallback

**NOT updated (intentional):**
- `src/components/DiscoverGrid.tsx` — renders user avatars, not horse images. No thumbnails needed.

## Step 3.3 — Detail pages keep full-res ✅

Confirmed: `src/app/stable/[id]/page.tsx`, `PassportGallery.tsx`, and `PhotoLightbox.tsx` remain unchanged — full-res only.

## Verify Phase 3 ✅

- [x] Grid views request `_thumb.webp` paths
- [x] `onError` fallback works for horses uploaded before thumbnails existed
- [x] Detail/passport pages still show full-res
- [x] All tests pass (245/245)
- [x] Build passes cleanly (`npx next build` exit 0)

---

## Commit ✅

Committed as `57a78a3`: `feat: pro-tier asset pipeline - dual-encode thumbnails, tier-gated quality, grid optimization`
