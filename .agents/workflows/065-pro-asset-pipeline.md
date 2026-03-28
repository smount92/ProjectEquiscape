---
description: Pro-Tier Asset Pipeline — dual-encode thumbnails, tier-gated quality, grid optimization for zero-cost image compute
---

# The Pro-Tier Asset Pipeline & Zero-Cost Thumbnails

> **Constraint:** MHH does NOT pay for Vercel Image Optimization or Supabase Image Transformations. ALL image processing happens client-side via HTML5 Canvas before upload.
> **Last Updated:** 2026-03-28
> **Prerequisite:** None — standalone feature
> **Affected Files:** `src/lib/utils/imageCompression.ts`, `src/app/actions/horse.ts`, `src/components/StableGrid.tsx`, `src/components/ShowRingGrid.tsx`, `src/components/DiscoverGrid.tsx`, `src/app/add-horse/page.tsx`, `src/app/stable/[id]/edit/page.tsx`

// turbo-all

---

# ═══════════════════════════════════════
# PHASE 1: Dual-Encode Compression Engine
# ═══════════════════════════════════════

## Step 1.1 — Add tier-aware compression config

**Target File:** `src/lib/utils/imageCompression.ts`

Replace the hardcoded constants at the top of the file:

```ts
// CURRENT (lines 7-9):
const MAX_DIMENSION = 1000;
const QUALITY = 0.7;
const MAX_FILE_SIZE_MB = 5;
```

With a tier-aware config:

```ts
export type UserTier = "free" | "pro" | "studio";

interface CompressionConfig {
    maxDimension: number;
    quality: number;
}

const TIER_CONFIG: Record<UserTier, CompressionConfig> = {
    free:   { maxDimension: 1000, quality: 0.70 },
    pro:    { maxDimension: 2500, quality: 0.92 },
    studio: { maxDimension: 2500, quality: 0.95 },
};

const THUMB_DIMENSION = 400;
const THUMB_QUALITY = 0.60;
const MAX_FILE_SIZE_MB = 10; // Bumped for Pro tier high-res
```

## Step 1.2 — Refactor `compressImage` to accept tier

**Target File:** `src/lib/utils/imageCompression.ts`

Update the `compressImage` function signature:

```ts
export async function compressImage(file: File, tier: UserTier = "free"): Promise<File> {
```

Inside the function, replace the hardcoded `MAX_DIMENSION` and `QUALITY` references with:

```ts
const config = TIER_CONFIG[tier];
// Use config.maxDimension instead of MAX_DIMENSION
// Use config.quality instead of QUALITY
```

Also update `compressImageWithWatermark` to accept tier:

```ts
export async function compressImageWithWatermark(file: File, aliasName: string, tier: UserTier = "free"): Promise<File> {
```

## Step 1.3 — Add `generateThumbnail` function

**Target File:** `src/lib/utils/imageCompression.ts`

Add a new exported function below `compressImage`:

```ts
/**
 * Generate a 400px micro-thumbnail (WebP) for grid views.
 * This runs client-side — zero server compute cost.
 */
export async function generateThumbnail(file: File): Promise<File> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let { width, height } = img;

                // Scale down to THUMB_DIMENSION
                if (width > height) {
                    height = Math.round((height * THUMB_DIMENSION) / width);
                    width = THUMB_DIMENSION;
                } else {
                    width = Math.round((width * THUMB_DIMENSION) / height);
                    height = THUMB_DIMENSION;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                if (!ctx) { resolve(file); return; }

                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (!blob) { resolve(file); return; }
                        // Append _thumb suffix before extension
                        const thumbName = file.name.replace(/\.[^.]+$/, "_thumb.webp");
                        resolve(new File([blob], thumbName, {
                            type: "image/webp",
                            lastModified: Date.now(),
                        }));
                    },
                    "image/webp",
                    THUMB_QUALITY
                );
            };
            img.onerror = () => reject(new Error("Failed to load image for thumbnail"));
        };
        reader.onerror = () => reject(new Error("Failed to read file for thumbnail"));
    });
}
```

## Step 1.4 — Update `validateImageFile` max size

**Target File:** `src/lib/utils/imageCompression.ts`

Update `MAX_FILE_SIZE_MB` reference in `validateImageFile` (line 80) — it already references the constant, so the bump to 10MB in Step 1.1 propagates automatically. Verify this.

## Verify Phase 1

```
cmd /c "npx tsc --noEmit 2>&1 | findstr /C:error"
```

Check that:
- [ ] `compressImage` accepts optional `tier` parameter
- [ ] `generateThumbnail` exports correctly
- [ ] No TypeScript errors

---

# ═══════════════════════════════════════
# PHASE 2: Dual Upload in Server Actions
# ═══════════════════════════════════════

## Step 2.1 — Update `addHorse` page to generate both files

**Target File:** `src/app/add-horse/page.tsx`

Find where `compressImage` is called. Modify to also call `generateThumbnail`:

```ts
import { compressImage, generateThumbnail } from "@/lib/utils/imageCompression";

// When user selects an image:
const compressed = await compressImage(file, userTier);
const thumbnail = await generateThumbnail(file);

// Pass both to the FormData
formData.append("image", compressed);
formData.append("thumbnail", thumbnail);
```

> **Note:** The `userTier` value should come from the page's server component props or a client-side hook. Check how `getUserTier()` is currently used and wire it through.

## Step 2.2 — Update `horse.ts` server action to upload both

**Target File:** `src/app/actions/horse.ts`

In the image upload section, after uploading the main image, also upload the thumbnail:

```ts
// Upload main image (existing logic)
const mainPath = `${userId}/${horseId}/${fileName}`;
await supabase.storage.from("horse-images").upload(mainPath, mainImage);

// Upload thumbnail alongside it
const thumbFile = formData.get("thumbnail") as File | null;
if (thumbFile) {
    const thumbPath = `${userId}/${horseId}/${thumbFile.name}`; // *_thumb.webp
    await supabase.storage.from("horse-images").upload(thumbPath, thumbFile);
}
```

## Step 2.3 — Apply same pattern to edit-horse page

**Target File:** `src/app/stable/[id]/edit/page.tsx`

Mirror the changes from Step 2.1 — when a user replaces a photo, generate both files.

## Verify Phase 2

```
cmd /c "npx next build 2>&1 | findstr /C:error /C:Error /C:compiled"
```

Check that:
- [ ] Both main image and `_thumb.webp` are uploaded to Supabase Storage
- [ ] Existing horses without thumbnails still display correctly (graceful fallback)

---

# ═══════════════════════════════════════
# PHASE 3: Grid Optimization — Serve Thumbnails
# ═══════════════════════════════════════

## Step 3.1 — Create a thumbnail URL helper

**Target File:** `src/lib/utils/imageUrl.ts` (NEW FILE)

```ts
/**
 * Given a Supabase Storage public URL for a horse image,
 * return the corresponding _thumb.webp URL.
 * Falls back to the original URL if the path can't be transformed.
 */
export function getThumbUrl(originalUrl: string): string {
    // Replace the file extension with _thumb.webp
    // e.g., .../photo1.webp → .../photo1_thumb.webp
    return originalUrl.replace(/\.[^.]+$/, "_thumb.webp");
}
```

## Step 3.2 — Update grid components to use thumbnails

**Target Files:**
- `src/components/StableGrid.tsx`
- `src/components/ShowRingGrid.tsx`
- `src/components/DiscoverGrid.tsx`

For each grid component, import the helper and use it for the `<img>` src:

```tsx
import { getThumbUrl } from "@/lib/utils/imageUrl";

// In the card rendering:
<img
    src={getThumbUrl(horse.imageUrl)}
    onError={(e) => {
        // Fallback to full-res if thumb doesn't exist (older uploads)
        (e.target as HTMLImageElement).src = horse.imageUrl;
    }}
    alt={horse.customName}
    loading="lazy"
/>
```

## Step 3.3 — Detail pages keep full-res

**Important:** The `src/app/stable/[id]/page.tsx` detail view, `PassportGallery.tsx`, and `PhotoLightbox.tsx` should continue using the full-resolution image URL. Do NOT change these — thumbnails are grid-only.

## Verify Phase 3

```
cmd /c "npx next build 2>&1 | findstr /C:error /C:Error /C:compiled"
```

```
cmd /c "npx vitest run 2>&1"
```

Check that:
- [ ] Grid views request `_thumb.webp` paths
- [ ] `onError` fallback works for horses uploaded before thumbnails existed
- [ ] Detail/passport pages still show full-res
- [ ] All tests pass
- [ ] Build passes cleanly

---

## Commit

```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "feat: pro-tier asset pipeline — dual-encode thumbnails, tier-gated quality, grid optimization"
```
