---
description: Friendly Photo URLs — short, permanent, preview-rich share links for individual horse photos. Enables social sharing on Blab, Facebook, Instagram with OG preview cards. Migration 112 + new /photo/[slug] route.
---

# Friendly Photo URLs & Social Preview Cards

> **Context:** Collectors want to share individual horse photos on Blab, Facebook groups, Instagram, and email. Current public URLs are raw Supabase Storage paths — 150+ chars, no preview metadata. This is pure delight work that fits the open polish window.
> **Objective:** Deliver short share links (`modelhorsehub.com/photo/abc123`) with instant OG preview cards, while preserving all existing security and zero breakage.

**MANDATORY:** Read `.agents/MASTER_BLUEPRINT.md` first. All Iron Laws apply.

// turbo-all

---

## Pre-Flight: Codebase Reality Check

The original blueprint made several assumptions. Here is the **corrected** state based on codebase analysis:

| Blueprint Claim | Actual State | Impact |
|----------------|-------------|--------|
| Migration 111 available | ❌ Migration 111 is `chat_attachments_bucket.sql` | **Use 112** |
| `imageUrl.ts` exists at `src/lib/utils/` | ✅ Exists — contains `getThumbUrl()` for thumbnail URL generation. `storage.ts` has public URL helpers. | **Add friendly URL helper to `storage.ts`** |
| `horse_images` RLS allows anon SELECT | ❌ RLS policy is `TO authenticated` only — social crawlers (Facebook, Twitter, Discord) get zero rows | **CRITICAL: Must update RLS in migration 112** |
| `horse_images` has no `short_slug` column | ✅ Correct — only has `id, horse_id, image_url, angle_profile, sort_order, uploaded_at` | Migration needed |
| `sharp` available as dependency | ✅ Available via next/sharp (v0.34.5) — already used in `insurance-report.ts` | Can use for thumbs |
| No `generateMetadata` on `/stable/[id]` | ✅ Correct — stable page has no OG metadata export | Opportunity |
| `ExplorerLayout` exists | ✅ Used across 35+ pages | Use for photo route |
| `ShareButton` exists | ✅ Copies `window.location.href` + Web Share API. Uses `title` + `text` props. | Extend with `url` prop |
| `PhotoLightbox` exists | ✅ Client-side portal with keyboard nav | Add share button |
| `RichEmbed` exists | ✅ Parses `/community/{uuid}` for horse embed cards | Extend for `/photo/` |
| `horse-images` bucket is PUBLIC | ✅ Confirmed in `storage.ts` line 3 | No signed URLs needed for thumbnails |

---

## Phase 1: Database Migration (Migration 112) (~5 min)

### 1.1 Create Migration File

**File:** `supabase/migrations/112_photo_short_slugs.sql`

```sql
-- Migration 112: Friendly Photo URLs
-- Adds short_slug to horse_images for shareable /photo/xxx links
-- Also widens RLS to allow anon SELECT for social preview crawlers

-- ═══════════════════════════════════════════════════════════════
-- PART A: Schema Changes
-- ═══════════════════════════════════════════════════════════════

-- Add short_slug column (nullable to allow gradual backfill)
ALTER TABLE horse_images
  ADD COLUMN IF NOT EXISTS short_slug TEXT UNIQUE;

-- Index for fast lookup on the /photo/[slug] route
CREATE INDEX IF NOT EXISTS idx_horse_images_short_slug
  ON horse_images(short_slug) WHERE short_slug IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- PART B: RLS — Allow anon read access for public, non-deleted horses
-- CRITICAL: Without this, social platform crawlers (Facebook, Twitter,
-- Discord, Blab) cannot fetch OG metadata from /photo/[slug] pages.
-- The crawlers hit our route as anon users with no auth token.
-- ═══════════════════════════════════════════════════════════════

-- Widen horse_images SELECT: authenticated OR (anon + public horse + not deleted)
DROP POLICY IF EXISTS "horse_images_select" ON horse_images;
CREATE POLICY "horse_images_select"
  ON horse_images FOR SELECT
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM user_horses
      WHERE user_horses.id = horse_images.horse_id
        AND (
          user_horses.owner_id = (SELECT auth.uid())
          OR (user_horses.is_public = true AND user_horses.deleted_at IS NULL)
        )
    )
  );

-- Widen user_horses SELECT: anon can see public, non-deleted horses
-- (Required for the join in getPhotoBySlug to work for anon crawlers)
DROP POLICY IF EXISTS "user_horses_select" ON user_horses;
CREATE POLICY "user_horses_select"
  ON user_horses FOR SELECT
  TO authenticated, anon
  USING (
    (SELECT auth.uid()) = owner_id
    OR (is_public = true AND deleted_at IS NULL)
  );

-- ═══════════════════════════════════════════════════════════════
-- PART C: Slug Generation
-- ═══════════════════════════════════════════════════════════════

-- Backfill RPC: generates 8-char URL-safe slugs for all existing images
CREATE OR REPLACE FUNCTION backfill_photo_short_slugs()
RETURNS integer AS $$
DECLARE
  rec RECORD;
  new_slug TEXT;
  updated_count INTEGER := 0;
BEGIN
  FOR rec IN SELECT id FROM horse_images WHERE short_slug IS NULL
  LOOP
    -- Generate 8-char URL-safe slug (no +, /, =)
    new_slug := replace(replace(replace(
      encode(gen_random_bytes(6), 'base64'),
      '+', ''), '/', ''), '=', '');
    new_slug := left(new_slug, 8);

    BEGIN
      UPDATE horse_images SET short_slug = new_slug WHERE id = rec.id;
      updated_count := updated_count + 1;
    EXCEPTION WHEN unique_violation THEN
      new_slug := replace(replace(replace(
        encode(gen_random_bytes(6), 'base64'),
        '+', ''), '/', ''), '=', '');
      new_slug := left(new_slug, 8);
      UPDATE horse_images SET short_slug = new_slug WHERE id = rec.id;
      updated_count := updated_count + 1;
    END;
  END LOOP;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Trigger: auto-assign slug on new image INSERT
CREATE OR REPLACE FUNCTION trg_horse_images_slug()
RETURNS trigger AS $$
BEGIN
  IF NEW.short_slug IS NULL THEN
    NEW.short_slug := replace(replace(replace(
      encode(gen_random_bytes(6), 'base64'),
      '+', ''), '/', ''), '=', '');
    NEW.short_slug := left(NEW.short_slug, 8);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_horse_images_auto_slug
  BEFORE INSERT ON horse_images
  FOR EACH ROW EXECUTE FUNCTION trg_horse_images_slug();
```

### 1.2 Apply & Backfill

1. Apply migration via Supabase SQL editor (or `supabase db push`)
2. Run backfill: `SELECT backfill_photo_short_slugs();`
3. Verify slugs: `SELECT count(*) FROM horse_images WHERE short_slug IS NOT NULL;` — should match total row count
4. Spot-check: `SELECT short_slug, horse_id FROM horse_images LIMIT 5;`

### 1.3 Verify RLS for Anon Access (CRITICAL)

Run these queries in the SQL editor to confirm anon users can read public horse photos:

```sql
-- Test: Simulate anon access to a public horse's images
-- Pick a known public horse:
SELECT hi.short_slug, hi.image_url, uh.custom_name, uh.is_public
FROM horse_images hi
JOIN user_horses uh ON uh.id = hi.horse_id
WHERE uh.is_public = true AND uh.deleted_at IS NULL
LIMIT 3;

-- Verify the RLS policy allows this for anon role:
-- (In Supabase SQL editor, switch to "anon" role or use a test with no auth token)
```

> [!CAUTION]
> If the anon SELECT returns zero rows, social crawlers CANNOT generate preview cards. The entire feature is broken. Debug the RLS policy before proceeding.

### 1.4 Regenerate TypeScript Types

```powershell
npx supabase gen types typescript --project-id <PROJECT_ID> > src/lib/types/database.generated.ts
```

Verify `horse_images.Row` now includes `short_slug: string | null`.

---

## Phase 2: Core Helpers (~10 min)

### 2.1 Add friendly URL helpers to `src/lib/utils/storage.ts`

Append to the end of the existing file (do NOT modify existing functions):

```ts
// ═══════════════════════════════════════════════════════════════
// Friendly Photo URL Helpers
// ═══════════════════════════════════════════════════════════════

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://modelhorsehub.com";

/**
 * Generate a short, permanent, preview-rich share URL for a horse photo.
 * Example: https://modelhorsehub.com/photo/AbC12xyz
 */
export function getFriendlyPhotoUrl(shortSlug: string): string {
  return `${APP_URL}/photo/${shortSlug}`;
}
```

### 2.2 Add `getPhotoBySlug()` server action

**File:** `src/app/actions/photos.ts` (NEW)

```ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { getPublicImageUrl } from "@/lib/utils/storage";

export interface PhotoDetail {
  imageId: string;
  shortSlug: string;
  imageUrl: string;        // full public URL
  angleProfile: string;
  horseId: string;
  horseName: string;
  ownerAlias: string;
  ownerAvatarUrl: string | null;
  catalogRef: string | null;  // "Breyer — Silver" or null
  finishType: string | null;
}

/**
 * Look up a photo by its short_slug for the /photo/[slug] route.
 * Returns null if not found or horse is soft-deleted.
 */
export async function getPhotoBySlug(slug: string): Promise<PhotoDetail | null> {
  const supabase = await createClient();

  const { data: image } = await supabase
    .from("horse_images")
    .select(`
      id, short_slug, image_url, angle_profile, horse_id,
      user_horses!inner(
        custom_name, finish_type, deleted_at, owner_id, visibility,
        catalog_items:catalog_id(title, maker),
        users:owner_id(alias_name, avatar_url)
      )
    `)
    .eq("short_slug", slug)
    .maybeSingle();

  if (!image) return null;

  // Type the joined data
  const horse = image.user_horses as unknown as {
    custom_name: string;
    finish_type: string | null;
    deleted_at: string | null;
    owner_id: string;
    visibility: string;
    catalog_items: { title: string; maker: string } | null;
    users: { alias_name: string; avatar_url: string | null } | null;
  };

  // Don't expose deleted or private horses
  if (horse.deleted_at) return null;
  if (horse.visibility === "private") return null;

  return {
    imageId: image.id,
    shortSlug: image.short_slug!,
    imageUrl: getPublicImageUrl(image.image_url),
    angleProfile: image.angle_profile,
    horseId: image.horse_id,
    horseName: horse.custom_name,
    ownerAlias: horse.users?.alias_name || "Collector",
    ownerAvatarUrl: horse.users?.avatar_url || null,
    catalogRef: horse.catalog_items
      ? `${horse.catalog_items.maker} — ${horse.catalog_items.title}`
      : null,
    finishType: horse.finish_type,
  };
}
```

---

## Phase 3: Photo Detail Route with OG Metadata (~15 min)

### 3.1 Create `/photo/[slug]/page.tsx`

**File:** `src/app/photo/[slug]/page.tsx`

This is a **server component** using `ExplorerLayout`. It generates rich OG/Twitter metadata for social preview cards.

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getPhotoBySlug } from "@/app/actions/photos";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import PhotoShareView from "@/components/PhotoShareView";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const photo = await getPhotoBySlug(slug);

  if (!photo) {
    return { title: "Photo Not Found — Model Horse Hub" };
  }

  const title = `${photo.horseName} — Model Horse Hub`;
  const description = photo.catalogRef
    ? `${photo.horseName} (${photo.catalogRef}) — shared by ${photo.ownerAlias} on Model Horse Hub`
    : `${photo.horseName} — shared by ${photo.ownerAlias} on Model Horse Hub`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: photo.imageUrl, width: 800, height: 600, alt: photo.horseName }],
      type: "article",
      siteName: "Model Horse Hub",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [photo.imageUrl],
    },
  };
}

export default async function PhotoPage({ params }: Props) {
  const { slug } = await params;
  const photo = await getPhotoBySlug(slug);

  if (!photo) {
    notFound();
  }

  return (
    <ExplorerLayout title={photo.horseName} description="Shared photo">
      <PhotoShareView photo={photo} />
    </ExplorerLayout>
  );
}
```

### 3.2 Create `PhotoShareView` client component

**File:** `src/components/PhotoShareView.tsx`

```tsx
"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import type { PhotoDetail } from "@/app/actions/photos";
import { getFriendlyPhotoUrl } from "@/lib/utils/storage";

interface PhotoShareViewProps {
  photo: PhotoDetail;
}

export default function PhotoShareView({ photo }: PhotoShareViewProps) {
  const [copied, setCopied] = useState(false);
  const shareUrl = getFriendlyPhotoUrl(photo.shortSlug);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = shareUrl;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }, [shareUrl]);

  const handleNativeShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: photo.horseName,
          text: photo.catalogRef
            ? `${photo.horseName} (${photo.catalogRef})`
            : photo.horseName,
          url: shareUrl,
        });
      } catch { /* user cancelled */ }
    } else {
      handleCopyLink();
    }
  }, [photo, shareUrl, handleCopyLink]);

  return (
    <div className="mx-auto max-w-3xl">
      {/* Breadcrumb */}
      <nav className="text-muted mb-6 flex items-center gap-2 text-sm" aria-label="Breadcrumb">
        <Link href="/discover">Discover</Link>
        <span aria-hidden="true">/</span>
        <Link href={`/community/${photo.horseId}`}>{photo.horseName}</Link>
        <span aria-hidden="true">/</span>
        <span>Photo</span>
      </nav>

      {/* Main Photo — uses warm-parchment design tokens, NOT hardcoded hex */}
      <div className="overflow-hidden rounded-2xl border border-edge bg-card shadow-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.imageUrl}
          alt={`${photo.horseName} — ${photo.angleProfile}`}
          className="w-full object-contain"
          style={{ maxHeight: "70vh" }}
        />

        {/* Info bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-edge px-6 py-4">
          <div>
            <h1 className="text-ink text-lg font-bold">{photo.horseName}</h1>
            {photo.catalogRef && (
              <p className="text-muted text-sm">{photo.catalogRef}</p>
            )}
            <p className="text-muted text-xs mt-1">
              Shared by <strong>{photo.ownerAlias}</strong>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleNativeShare}
              className="inline-flex min-h-[36px] cursor-pointer items-center gap-2 rounded-md
                         border border-edge bg-card px-4 py-2 text-sm font-semibold
                         text-ink transition-all hover:bg-parchment"
              title="Share this photo"
            >
              📤 Share
            </button>
            <button
              onClick={handleCopyLink}
              className="inline-flex min-h-[36px] cursor-pointer items-center gap-2 rounded-md
                         border border-edge bg-card px-4 py-2 text-sm font-semibold
                         text-ink transition-all hover:bg-parchment"
              title="Copy link"
            >
              {copied ? "✅ Copied!" : "🔗 Copy Link"}
            </button>
            <Link
              href={`/community/${photo.horseId}`}
              className="inline-flex min-h-[36px] items-center gap-2 rounded-md border-0
                         bg-forest px-4 py-2 text-sm font-semibold text-white no-underline
                         shadow-sm transition-all hover:opacity-90"
            >
              View Passport →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 3.3 Build Gate

```powershell
cmd /c "npx next build 2>&1"
```

---

## Phase 4: Extend ShareButton with Custom URL Support (~5 min)

### 4.1 Update `ShareButton.tsx`

**File:** `src/components/ShareButton.tsx`

Add an optional `url` prop so callers can pass a specific friendly URL instead of defaulting to `window.location.href`:

In the interface (line 5-14), add:
```ts
/** Override the URL to share (default: current page URL) */
url?: string;
```

In `handleShare` (line 21), change:
```ts
const url = props.url || window.location.href;
```

And add `url` to the `useCallback` dependency array.

### 4.2 Add Share Button to PhotoLightbox

**File:** `src/components/PhotoLightbox.tsx`

Add a Share icon button in the bottom bar area (near the counter/label, line 101-112).

The lightbox takes `images[]` — to support this, add an optional `shareSlug?: string` to each image:

```ts
interface PhotoLightboxProps {
  images: { url: string; label?: string; shareSlug?: string }[];
  initialIndex: number;
  onClose: () => void;
}
```

Then render a share button when `shareSlug` is present:

```tsx
{current.shareSlug && (
  <button
    className="fixed bottom-4 right-4 z-[1001] flex items-center gap-2
               rounded-full bg-white/20 px-4 py-2 text-sm text-white
               backdrop-blur transition-colors hover:bg-white/30"
    onClick={(e) => {
      e.stopPropagation();
      const url = `${window.location.origin}/photo/${current.shareSlug}`;
      navigator.clipboard.writeText(url).then(() => {
        // Brief visual feedback
      });
    }}
    aria-label="Copy share link"
  >
    🔗 Share
  </button>
)}
```

---

## Phase 5: Surface Integration (~15 min)

### 5.1 PassportGallery — Pass `shortSlug` to Lightbox

**File:** `src/components/PassportGallery.tsx`

Update `GalleryImage` interface (line 6-9):
```ts
interface GalleryImage {
  signedUrl: string;
  angle_profile: string;
  shortSlug?: string | null;  // NEW
}
```

Update lightbox image mapping (line 55-58):
```ts
const lightboxImages = images.map((img) => ({
  url: img.signedUrl,
  label: ANGLE_LABELS[img.angle_profile] || img.angle_profile,
  shareSlug: img.shortSlug || undefined,  // NEW
}));
```

### 5.2 Stable Page — Fetch & Pass `short_slug`

**File:** `src/app/stable/[id]/page.tsx`

In the horse_images query (line 109-110), add `short_slug`:
```ts
.select("id, image_url, angle_profile, uploaded_at, short_slug")
```

In `galleryImages` mapping (line 127-131), add:
```ts
shortSlug: img.short_slug || null,
```

### 5.3 Community Page — Same Pattern

**File:** `src/app/community/[id]/page.tsx`

Add `short_slug` to the `horse_images` select and pass to `PassportGallery`.

### 5.4 RichEmbed — Support `/photo/` URLs

**File:** `src/components/RichEmbed.tsx`

Update the regex (line 10) to also match photo URLs:

```ts
const HORSE_URL_RE = /\/(community|photo)\/([0-9a-zA-Z-]+)/i;
```

For `/photo/` matches, the dev should:
1. Look up the photo by slug to get `horseId`
2. Use the same embed card pattern with the photo's thumbnail

> [!IMPORTANT]
> This is a nice-to-have. The photo route already has full OG metadata, so social platforms will render previews from the `/photo/[slug]` page itself. RichEmbed enhancement can be deferred if time is tight.

### 5.5 Build Gate

```powershell
cmd /c "npx next build 2>&1"
```

---

## Phase 6: StableGrid & DiscoverGrid Integration (MANDATORY) (~15 min)

> [!IMPORTANT]
> These are the **highest-visibility surfaces** in the app — users spend 80% of their time here. Share links MUST surface where they matter most. This is **not optional**.

### 6.1 StableGrid.tsx — Add `primarySlug` to Card Data + Share Action

**File:** `src/components/StableGrid.tsx`

The grid already imports `getThumbUrl` from `@/lib/utils/imageUrl`. The `HorseCardData` interface (line 10-25) needs a new field:

```ts
interface HorseCardData {
  // ... existing fields ...
  primarySlug: string | null;  // NEW — short_slug of the Primary_Thumbnail image
}
```

**Dashboard query update** (`src/app/dashboard/page.tsx`):

The dashboard already fetches `horse_images(image_url, angle_profile)` to build thumbnails. Add `short_slug` to that join:

```ts
horse_images(image_url, angle_profile, short_slug)
```

When building `HorseCardData`, extract the Primary_Thumbnail's slug:

```ts
const primaryImg = horse.horse_images?.find(
  (img) => img.angle_profile === "Primary_Thumbnail"
);
primarySlug: primaryImg?.short_slug || horse.horse_images?.[0]?.short_slug || null,
```

Add a share button overlay to the card (inside `cardContent`, after the badge row):

```tsx
{horse.primarySlug && (
  <button
    onClick={(e) => {
      e.preventDefault();
      e.stopPropagation();
      const url = `${window.location.origin}/photo/${horse.primarySlug}`;
      navigator.clipboard.writeText(url);
      // TODO: Brief toast or icon change
    }}
    className="mt-2 inline-flex items-center gap-1 rounded-md border border-edge
               bg-card px-2 py-1 text-xs font-medium text-muted
               transition-all hover:bg-parchment hover:text-ink"
    title="Copy shareable photo link"
  >
    🔗 Share Photo
  </button>
)}
```

### 6.2 DiscoverGrid.tsx — Same Pattern

**File:** `src/components/DiscoverGrid.tsx`

Apply the same `primarySlug` field and share action. The discover query (in `src/app/actions/community.ts`) already fetches `horse_images` for thumbnails — add `short_slug` to the select.

> [!WARNING]
> The share button should ONLY appear for **public** horses (which all discover horses are by definition). The `getPhotoBySlug` server action double-checks `visibility !== "private"` and `deleted_at IS NULL`, so the route is safe even if a slug leaks.

### 6.3 Profile Page Horses — Same Pattern

**File:** `src/app/actions/profile.ts` + `src/app/profile/[alias_name]/page.tsx`

The profile page horse cards also show thumbnails. Add `short_slug` to the `horse_images` join and pass to the grid.

### 6.4 Build Gate

```powershell
cmd /c "npx next build 2>&1"
```

---

## Phase 7: Validation (~10 min)

### 7.1 Full Build

```powershell
cmd /c "npx next build 2>&1"
```

### 7.2 Playwright Device Matrix (if available)

```powershell
cmd /c "npx playwright test e2e/device-layout.spec.ts 2>&1"
```

### 7.3 Manual Tests

1. **New upload → slug assigned:** Add a horse with photos → verify `short_slug` is populated in DB (trigger auto-assigns)
2. **Photo route renders:** Navigate to `/photo/{slug}` → full-bleed photo with horse name, owner alias, and catalog reference
3. **404 works:** Navigate to `/photo/nonexistent` → proper 404 page
4. **Private horse blocked:** Set a horse to `visibility: private` → `/photo/{slug}` returns 404
5. **Deleted horse blocked:** Soft-delete a horse → `/photo/{slug}` returns 404
6. **OG preview:** Paste the friendly URL into Facebook debugger (https://developers.facebook.com/tools/debug/) → preview card renders with horse name, thumbnail, description
7. **Copy link works:** Click "Copy Link" on photo detail page → clipboard contains `modelhorsehub.com/photo/AbC12xyz`
8. **Lightbox share:** Open lightbox from gallery → "Share" button copies friendly URL
9. **Web Share API (mobile):** On iOS/Android, "Share" button opens native share sheet
10. **Old URLs unbroken:** Existing Supabase public URLs still load images

### 7.4 Anon RLS Verification (CRITICAL)

11. **Social crawler test:** Open a browser in incognito (no auth), navigate to `/photo/{slug}` of a public horse → page renders with photo, name, and owner
12. **Private horse stays private:** Navigate to `/photo/{slug}` of a private horse in incognito → 404
13. **Deleted horse stays hidden:** Navigate to `/photo/{slug}` of a soft-deleted horse in incognito → 404

### 7.5 Backward Compatibility

- `getPublicImageUrl()` unchanged ✅
- `getPublicImageUrls()` unchanged ✅
- `extractStoragePath()` unchanged ✅
- `horse-images` storage bucket RLS unchanged (only DB table RLS updated) ✅
- No changes to `horse.ts` upload flow (slug auto-assigned by DB trigger) ✅
- Existing authenticated-only queries still work (policy is `TO authenticated, anon` which is strictly wider) ✅

---

## Update Documentation

### `dev-nextsteps.md` — Add:

```markdown
## ✅ Task P-1: Friendly Photo URLs & Social Preview Cards — DONE (YYYY-MM-DD)
- ✅ Migration 112: `short_slug` column + unique index + auto-assign trigger
- ✅ Backfill: all existing horse_images rows have slugs
- ✅ `/photo/[slug]` route with OG/Twitter metadata for social previews
- ✅ `PhotoShareView` client component with copy/share buttons
- ✅ `ShareButton` extended with optional `url` prop
- ✅ `PhotoLightbox` share button when `shareSlug` available
- ✅ `PassportGallery` passes `shortSlug` to lightbox
- ✅ Build clean, 0 errors
```

### `MASTER_SUPABASE.md` — Add to horse_images documentation:

```markdown
| `short_slug` | text | Unique, auto-assigned 8-char URL-safe slug. Used for `/photo/[slug]` friendly share URLs. Auto-generated by `trg_horse_images_auto_slug` trigger on INSERT. |
```

---

## Files Modified Summary

| File | Change |
|------|--------|
| `supabase/migrations/112_photo_short_slugs.sql` | NEW — migration + backfill RPC + auto-slug trigger + **RLS widened for anon** |
| `src/lib/utils/storage.ts` | ADD `getFriendlyPhotoUrl()` helper |
| `src/app/actions/photos.ts` | NEW — `getPhotoBySlug()` server action |
| `src/app/photo/[slug]/page.tsx` | NEW — photo detail route with `generateMetadata` |
| `src/components/PhotoShareView.tsx` | NEW — photo display + share UI (uses `border-edge`, `bg-card`, `text-ink`, `text-muted`, `bg-parchment`, `bg-forest` tokens) |
| `src/components/ShareButton.tsx` | ADD optional `url` prop |
| `src/components/PhotoLightbox.tsx` | ADD `shareSlug` + share button |
| `src/components/PassportGallery.tsx` | ADD `shortSlug` to interface + lightbox |
| `src/app/stable/[id]/page.tsx` | ADD `short_slug` to horse_images query |
| `src/app/community/[id]/page.tsx` | ADD `short_slug` to horse_images query |
| `src/components/StableGrid.tsx` | ADD `primarySlug` to `HorseCardData` + share button on cards |
| `src/components/DiscoverGrid.tsx` | ADD `primarySlug` + share button on cards |
| `src/app/dashboard/page.tsx` | ADD `short_slug` to horse_images join |
| `src/app/actions/community.ts` | ADD `short_slug` to horse_images join |
| `src/app/actions/profile.ts` | ADD `short_slug` to horse_images join |

**Estimated effort:** ~2 hours
**Risk:** Low — additive only (new column, new route, new component). RLS change is strictly wider (adds `anon` to existing `authenticated`). Zero changes to existing upload, storage, or delete flows.
