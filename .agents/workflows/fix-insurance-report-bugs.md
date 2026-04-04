---
description: Fix 3 confirmed/suspected Insurance Report bugs — deleted horses leak, blank photos, and stale collection counts. Critical user-facing issues from beta feedback.
---

# Fix: Insurance Report Bugs (3 Issues)

> **Context:** A beta user reported blank photo boxes, deleted horses appearing, and a collection count mismatch (13 shown vs 23 actual). Investigation confirmed 2 code bugs and 1 suspected cache issue.
> **Investigation:** See `.agents/docs/user-bug-report-investigation.md` for full root-cause analysis.

**MANDATORY:** Read `.agents/MASTER_BLUEPRINT.md` first. All Iron Laws apply.

// turbo-all

---

## Issue 1: Deleted Horses Appearing in Insurance Report [CONFIRMED BUG]

**Root cause:** Two queries are missing `.is("deleted_at", null)` — the client-side insurance report path includes soft-deleted horses (named `[Deleted]`).

### 1.1 Fix `getInsuranceReportData()` server action

**File:** `src/app/actions/insurance-report.ts`
**Lines:** 56–64

The horse query is missing the deleted_at filter:

```ts
// ❌ CURRENT (line 56-64):
let horseQuery = supabase
    .from("user_horses")
    .select(
        `id, custom_name, finish_type, condition_grade,
         catalog_items:catalog_id(title, maker, item_type),
         horse_images(image_url, angle_profile)`
    )
    .eq("owner_id", user.id)
    .order("custom_name");

// ✅ FIX — add .is("deleted_at", null) BEFORE .order():
let horseQuery = supabase
    .from("user_horses")
    .select(
        `id, custom_name, finish_type, condition_grade,
         catalog_items:catalog_id(title, maker, item_type),
         horse_images(image_url, angle_profile)`
    )
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .order("custom_name");
```

### 1.2 Fix `InsuranceReportButton` horse count query

**File:** `src/components/InsuranceReportButton.tsx`
**Lines:** 36–39

The OOM-warning horse count also includes deleted horses:

```ts
// ❌ CURRENT (line 36-39):
supabase
    .from("user_horses")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)

// ✅ FIX — add .is("deleted_at", null):
supabase
    .from("user_horses")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .is("deleted_at", null)
```

### 1.3 Verify the server-side API route is already safe

**File:** `src/app/api/insurance-report/route.ts`
**Line 24:** Already has `.is("deleted_at", null)` ✅ — no changes needed.

### 1.4 Validation

After applying fixes:
1. Add a test horse, record name
2. Delete it (soft-delete → `custom_name` becomes `[Deleted]`)
3. Generate Insurance Report via the dashboard button
4. Confirm `[Deleted]` horses do NOT appear in the PDF
5. Confirm horse count in picker modal matches dashboard count

```powershell
cmd /c "npx next build 2>&1"
```

Build must pass with 0 errors.

---

## Issue 2: Insurance Report Photos Are Blank [CONFIRMED BUG]

**Root cause (dual):**
1. The query uses `angle_profile === "Primary_Thumbnail"` but some horses may only have photos uploaded with different angles, resulting in no photo URL
2. `@react-pdf/renderer`'s `<Image>` component may silently fail fetching cross-origin Supabase Storage URLs when generating PDF client-side

### 2.1 Fix photo fallback in `getInsuranceReportData()`

**File:** `src/app/actions/insurance-report.ts`
**Lines:** 107–115

Currently looks ONLY for `Primary_Thumbnail`, with a weak fallback:

```ts
// ❌ CURRENT (line 108-111):
const thumb = horse.horse_images?.find(
    (img) => img.angle_profile === "Primary_Thumbnail"
);
const imageUrl = thumb?.image_url || horse.horse_images?.[0]?.image_url;
```

This works IF the PostgREST embedded join returns data. But the join syntax `horse_images(image_url, angle_profile)` returns an array. Verify that `horse_images` array is populated. If the fallback hits `horse.horse_images?.[0]`, that should catch any angle. **This part looks structurally correct.**

**The real problem is likely in the PDF renderer.** The `getPublicImageUrl()` function generates URLs like:
```
https://<project>.supabase.co/storage/v1/object/public/horse-images/<user_id>/<filename>
```

When `@react-pdf/renderer` tries to fetch these during `pdf().toBlob()` in the browser, [CORS restrictions can cause silent failures](https://github.com/diegomura/react-pdf/issues). The `<Image>` component renders as an empty box.

### 2.2 Convert photos to base64 before PDF generation

**File:** `src/app/actions/insurance-report.ts`

Replace the simple URL mapping with actual base64 conversion:

```ts
// After the signedUrlMap is built (line 106-115), convert to base64:
const base64Map = new Map<string, string>();

for (const [horseId, publicUrl] of signedUrlMap.entries()) {
    try {
        const response = await fetch(publicUrl);
        if (response.ok) {
            const buffer = await response.arrayBuffer();
            const base64 = Buffer.from(buffer).toString("base64");
            const contentType = response.headers.get("content-type") || "image/jpeg";
            base64Map.set(horseId, `data:${contentType};base64,${base64}`);
        }
    } catch {
        // Skip — horse will get placeholder emoji
    }
}
```

Then in the `reportHorses.push()` block (line 137), use `base64Map` instead:

```ts
photoUrl: base64Map.get(horse.id) || null,
```

> [!WARNING]
> **Performance concern:** This fetches every image server-side. For large collections, this could be slow. Mitigate with:
> - Limit to the first 50 horses with photos (pagination already exists for collection scoping)
> - Add a timeout per image fetch (3 seconds)
> - Use `Promise.allSettled` for parallel fetching (batch of 10 at a time)

### 2.3 Batch-parallel implementation with timeout

Replace the sequential loop with parallel fetching:

```ts
// Batch-parallel base64 conversion (10 at a time, 3s timeout per image)
const base64Map = new Map<string, string>();
const entries = Array.from(signedUrlMap.entries());

for (let i = 0; i < entries.length; i += 10) {
    const batch = entries.slice(i, i + 10);
    const results = await Promise.allSettled(
        batch.map(async ([horseId, publicUrl]) => {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);
            try {
                const response = await fetch(publicUrl, { signal: controller.signal });
                clearTimeout(timeout);
                if (response.ok) {
                    const buffer = await response.arrayBuffer();
                    const base64 = Buffer.from(buffer).toString("base64");
                    const contentType = response.headers.get("content-type") || "image/jpeg";
                    return { horseId, data: `data:${contentType};base64,${base64}` };
                }
                return null;
            } catch {
                clearTimeout(timeout);
                return null;
            }
        })
    );

    for (const result of results) {
        if (result.status === "fulfilled" && result.value) {
            base64Map.set(result.value.horseId, result.value.data);
        }
    }
}
```

### 2.4 Also fix the server-side PDF route (secondary path)

**File:** `src/app/api/insurance-report/route.ts`
**Lines:** 35–44

The server-side route passes raw Supabase URLs to `thumbnailMap`. Since `renderToBuffer` runs on the server (Node.js), CORS isn't an issue here — but the URLs might still fail if the bucket requires auth or the URL is malformed.

Check: The `horse-images` bucket is documented as PUBLIC for reads (see `storage.ts` line 3). Server-side `<Image>` should work with public URLs. **BUT** the route queries images separately and stores `image_url` directly — it does NOT run through `getPublicImageUrl()`:

```ts
// Line 36-41 — stores raw image_url from DB:
const { data: images } = await supabase
    .from("horse_images")
    .select("horse_id, image_url")
    .in("horse_id", horseIds)
    .eq("angle_profile", "Primary_Thumbnail");
```

**Issue:** `image_url` in the database is the FULL Supabase public URL (set during `finalizeHorseImages` on line 441 of `horse.ts`). This should work for server-side rendering. **No fix needed for the server path**, but add a fallback for non-Primary_Thumbnail angles:

```ts
// ✅ FIX — Also try any angle if Primary_Thumbnail missing:
const { data: images } = await supabase
    .from("horse_images")
    .select("horse_id, image_url, angle_profile")
    .in("horse_id", horseIds.length > 0 ? horseIds : ["__none__"]);

// Build thumbnail map with Primary_Thumbnail preferred, any angle as fallback
const thumbnailMap = new Map<string, string>();
(images || []).forEach((img: { horse_id: string; image_url: string; angle_profile: string }) => {
    if (!thumbnailMap.has(img.horse_id) || img.angle_profile === "Primary_Thumbnail") {
        thumbnailMap.set(img.horse_id, img.image_url);
    }
});
```

### 2.5 Validation

1. Add a horse with photos but NO `Primary_Thumbnail` angle (e.g., only `Left_Profile`)
2. Generate Insurance Report
3. Confirm photo appears (not placeholder emoji)
4. Generate for a horse WITH `Primary_Thumbnail` — still works
5. Generate for 10+ horses — confirm parallel fetch completes in reasonable time

```powershell
cmd /c "npx next build 2>&1"
```

---

## Issue 3: Collection Count Mismatch [SUSPECTED CACHE ISSUE]

**Root cause hypothesis:** Next.js ISR/server component cache shows stale counts after batch operations.

### 3.1 Audit revalidation paths

Check all places where horses are added/deleted and ensure `revalidatePath("/dashboard")` is called:

| Action | File | Revalidates? |
|--------|------|-------------|
| `createHorseRecord()` | `horse.ts:372` | ✅ `/dashboard` |
| `deleteHorse()` | `horse.ts:92` | ✅ `/dashboard` |
| `bulkDeleteHorses()` | `horse.ts:593` | ✅ `/dashboard` |
| `quickAddHorse()` | `horse.ts:650` | ✅ `/dashboard` |
| `bulkUpdateHorses()` | `horse.ts:518` | ✅ `/dashboard` |

All paths revalidate. **The code is correct.**

### 3.2 Add revalidateTag for stronger cache busting

**File:** `src/app/actions/horse.ts`

In `createHorseRecord()` (line 372-373), the revalidation already calls both:
```ts
revalidatePath("/dashboard");
revalidateTag("public_horses", "max");
```

### 3.3 Add force-refresh on collection filter change

**File:** `src/components/DashboardShell.tsx`

When the user clicks a collection folder, check if the component uses client-side filtering (which could show stale counts) or triggers a fresh server request. If client-side:

- Ensure the collection count display uses the server-provided `collectionCounts` map (confirmed on `page.tsx` lines 180-186)
- Verify this count is recalculated on every server render (it is — it iterates `allHorsesSummary`)

### 3.4 Plausible explanation for the user

The user added 23 horses, but the page may have cached the count at 13 (before the batch was complete). A hard refresh (`Ctrl+Shift+R`) would show the correct count. The collection detail page fetches fresh data, hence showing the correct 23.

### 3.5 Defensive fix: No-cache header on dashboard

**File:** `src/app/dashboard/page.tsx`

Add at the top of the file to prevent aggressive caching:

```ts
export const dynamic = "force-dynamic";
```

This ensures the dashboard always fetches fresh data on every visit. Since it's a private authenticated page, this is the correct behavior anyway.

### 3.6 Validation

1. Add 5 horses to a collection rapidly (within 10 seconds)
2. Navigate to dashboard — count should show correct total immediately
3. Delete 2 horses, navigate back — count should decrease immediately
4. No stale counts on any interaction

---

## Final Build Gate

```powershell
cmd /c "npx next build 2>&1"
```

**All 3 fixes must pass clean build.**

### Files modified summary:

| File | Change |
|------|--------|
| `src/app/actions/insurance-report.ts` | Add `.is("deleted_at", null)` + base64 photo conversion |
| `src/components/InsuranceReportButton.tsx` | Add `.is("deleted_at", null)` to count query |
| `src/app/api/insurance-report/route.ts` | Fallback to any image angle (not only Primary_Thumbnail) |
| `src/app/dashboard/page.tsx` | Add `export const dynamic = "force-dynamic"` |

### Update dev-nextsteps.md

After all fixes are applied, add to `dev-nextsteps.md`:

```markdown
## ✅ Task H-1: Insurance Report Bug Fixes — DONE (YYYY-MM-DD)
- ✅ Deleted horses filtered from client-side insurance report path
- ✅ Photo fallback: any angle accepted (not only Primary_Thumbnail)
- ✅ Base64 conversion: photos now embedded inline (bypasses CORS)
- ✅ Dashboard force-dynamic: prevents stale collection counts
- ✅ Build clean, 0 errors
```
