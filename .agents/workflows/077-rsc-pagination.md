---
description: RSC Whale Pagination — Paginate /profile and /community/groups to cap initial payloads at 24 items
---

# 077 — Strict Pagination for RSC "Whale" Payloads

> **The Problem:** Vercel telemetry shows `/profile/[alias_name]` taking 2300ms and consuming ~400MB serverless memory. A user with 600+ horses loads ALL horse records into the React Server Component, serializing every card + signed URL into the HTML response. `/community/groups/[slug]` loads ALL group posts (unbounded) via `getPosts()`.
> **Root Cause:** Profile page (`line 182-194`) queries `user_horses` with no `.range()` or `.limit()`. Groups page (`line 31-32`) calls `getPosts()` with no limit override. The `getPosts` action defaults to 25 posts, but those 25 posts include all replies (unbounded `includeReplies: true`).
> **Objective:** Cap initial RSC payloads to 24 items. Create Server Actions for `loadMoreHorses` and `loadMorePosts` that the client calls on demand via IntersectionObserver or "Load More" button.

// turbo-all

---

## Task 1: Paginate the Profile Page Horse Grid

**File:** `src/app/profile/[alias_name]/page.tsx`

### 1.1 Current state (lines 182-194) — UNBOUNDED QUERY

```ts
const { data: rawHorses } = await supabase
    .from("user_horses")
    .select(`
        id, custom_name, finish_type, condition_grade, created_at, trade_status, listing_price, marketplace_notes,
        user_collections(name),
        catalog_items:catalog_id(title, maker, item_type),
        horse_images(image_url, angle_profile)
    `)
    .eq("owner_id", profileUser.id)
    .eq("visibility", "public")
    .order("created_at", { ascending: false });
    // ❌ No .range() — loads ALL public horses for the user
```

### 1.2 Add `.range(0, 23)` to initial fetch

```ts
const PAGE_SIZE = 24;

const { data: rawHorses, count: publicHorseCount } = await supabase
    .from("user_horses")
    .select(`
        id, custom_name, finish_type, condition_grade, created_at, trade_status, listing_price, marketplace_notes,
        user_collections(name),
        catalog_items:catalog_id(title, maker, item_type),
        horse_images(image_url, angle_profile)
    `, { count: "exact" })
    .eq("owner_id", profileUser.id)
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .range(0, PAGE_SIZE - 1);
```

**Changes:**
- Added `{ count: "exact" }` to get total count without fetching all rows
- Added `.range(0, 23)` to limit initial payload to 24 horses
- `publicHorseCount` tells the client how many total items exist for "Load More" logic

### 1.3 Pass pagination metadata to the client

After the existing `profileCards` construction, add:

```ts
const hasMoreHorses = (publicHorseCount ?? 0) > PAGE_SIZE;
```

Pass this to the JSX and add a `LoadMoreButton` component.

### 1.4 Update the profile grid JSX (around line 446)

```tsx
{/* Grid */}
{profileCards.length === 0 ? (
    {/* ... existing empty state ... */}
) : (
    <>
        <div className="grid-cols-[repeat(auto-fill,minmax(300px,1fr))] animate-fade-in-up grid gap-6">
            {profileCards.map((horse) => (
                {/* ... existing card JSX ... */}
            ))}
        </div>
        {hasMoreHorses && (
            <ProfileLoadMore
                userId={profileUser.id}
                initialOffset={PAGE_SIZE}
                totalCount={publicHorseCount ?? 0}
            />
        )}
    </>
)}
```

### Validation Checklist
- [ ] Initial RSC query uses `.range(0, 23)` — max 24 horses in initial HTML
- [ ] `{ count: "exact" }` fetches total without loading all rows
- [ ] Profile page renders first 24 horses instantly
- [ ] "Load More" or IntersectionObserver appends next batch

---

## Task 2: Create `loadMoreProfileHorses` Server Action

**File:** `src/app/actions/profile.ts` (NEW FILE or add to existing)

```ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { getPublicImageUrls } from "@/lib/utils/storage";

const PAGE_SIZE = 24;

export interface ProfileHorseCard {
    id: string;
    customName: string;
    finishType: string;
    conditionGrade: string;
    createdAt: string;
    refName: string;
    thumbnailUrl: string | null;
    collectionName: string | null;
    tradeStatus: string;
    listingPrice: number | null;
    marketplaceNotes: string | null;
}

export async function loadMoreProfileHorses(
    userId: string,
    offset: number
): Promise<{ horses: ProfileHorseCard[]; hasMore: boolean }> {
    const supabase = await createClient();

    const { data: rawHorses, count } = await supabase
        .from("user_horses")
        .select(`
            id, custom_name, finish_type, condition_grade, created_at, trade_status, listing_price, marketplace_notes,
            user_collections(name),
            catalog_items:catalog_id(title, maker, item_type),
            horse_images(image_url, angle_profile)
        `, { count: "exact" })
        .eq("owner_id", userId)
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

    const horses = rawHorses ?? [];

    // Generate signed URLs for thumbnails
    const thumbnailUrls: string[] = [];
    horses.forEach((horse) => {
        const thumb = horse.horse_images?.find((img) => img.angle_profile === "Primary_Thumbnail");
        const first = horse.horse_images?.[0];
        const url = thumb?.image_url || first?.image_url;
        if (url) thumbnailUrls.push(url);
    });
    const signedUrlMap = getPublicImageUrls(thumbnailUrls);

    const cards: ProfileHorseCard[] = horses.map((horse) => {
        const thumb = horse.horse_images?.find((img) => img.angle_profile === "Primary_Thumbnail");
        const firstImage = horse.horse_images?.[0];
        const imageUrl = thumb?.image_url || firstImage?.image_url;
        const signedUrl = imageUrl ? signedUrlMap.get(imageUrl) : undefined;

        return {
            id: horse.id,
            customName: horse.custom_name,
            finishType: horse.finish_type ?? "OF",
            conditionGrade: horse.condition_grade ?? "",
            createdAt: horse.created_at,
            refName: horse.catalog_items
                ? `${horse.catalog_items.maker} ${horse.catalog_items.title}`
                : "Unlisted Mold",
            thumbnailUrl: signedUrl || null,
            collectionName: horse.user_collections?.name || null,
            tradeStatus: horse.trade_status || "Not for Sale",
            listingPrice: horse.listing_price ?? null,
            marketplaceNotes: horse.marketplace_notes || null,
        };
    });

    return {
        horses: cards,
        hasMore: (count ?? 0) > offset + PAGE_SIZE,
    };
}
```

### Validation Checklist
- [ ] Server Action accepts `userId` and `offset` parameters
- [ ] Returns `{ horses: ProfileHorseCard[], hasMore: boolean }`
- [ ] Uses `.range(offset, offset + PAGE_SIZE - 1)` for pagination
- [ ] Generates signed URLs for the batch (not all horses)
- [ ] Does NOT accept any client-side filtering as a substitute for DB pagination

---

## Task 3: Create `ProfileLoadMore` Client Component

**File:** `src/components/ProfileLoadMore.tsx` (NEW FILE)

```tsx
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { loadMoreProfileHorses, type ProfileHorseCard } from "@/app/actions/profile";

interface Props {
    userId: string;
    initialOffset: number;
    totalCount: number;
}

export default function ProfileLoadMore({ userId, initialOffset, totalCount }: Props) {
    const [horses, setHorses] = useState<ProfileHorseCard[]>([]);
    const [offset, setOffset] = useState(initialOffset);
    const [hasMore, setHasMore] = useState(true);
    const [isPending, startTransition] = useTransition();

    const loadMore = () => {
        startTransition(async () => {
            const result = await loadMoreProfileHorses(userId, offset);
            setHorses(prev => [...prev, ...result.horses]);
            setOffset(prev => prev + result.horses.length);
            setHasMore(result.hasMore);
        });
    };

    return (
        <>
            {/* Render loaded horses in same grid format */}
            {horses.length > 0 && (
                <div className="grid-cols-[repeat(auto-fill,minmax(300px,1fr))] grid gap-6">
                    {horses.map((horse) => (
                        <Link
                            key={horse.id}
                            href={`/community/${horse.id}`}
                            className="border-stone-200 text-stone-900 flex flex-col overflow-hidden rounded-lg border bg-stone-50 no-underline transition-all"
                        >
                            {/* Render card matching the profile page pattern */}
                            <div className="relative">
                                {horse.thumbnailUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={horse.thumbnailUrl} alt={horse.customName} loading="lazy" className="w-full object-cover" />
                                ) : (
                                    <div className="flex flex-col items-center justify-center bg-stone-100 px-4 py-8">
                                        <span className="text-4xl">🐴</span>
                                        <span className="mt-1 text-sm text-stone-500">No photo</span>
                                    </div>
                                )}
                            </div>
                            <div className="p-4">
                                <div className="text-sm font-semibold text-stone-900">{horse.customName}</div>
                                <div className="mt-0.5 text-xs text-stone-600">{horse.refName}</div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {/* Load More button */}
            {hasMore && (
                <div className="mt-8 flex justify-center">
                    <button
                        onClick={loadMore}
                        disabled={isPending}
                        className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-transparent px-8 py-2 text-sm font-semibold text-stone-600 no-underline transition-all disabled:opacity-50"
                    >
                        {isPending ? "Loading..." : `Load More (${totalCount - offset} remaining)`}
                    </button>
                </div>
            )}
        </>
    );
}
```

> **Alternative:** Replace the "Load More" button with an `IntersectionObserver` that auto-loads when the user scrolls to the bottom. Either approach is acceptable — the "Load More" button is simpler and avoids infinite scroll UX issues.

### Validation Checklist
- [ ] Component calls Server Action on button click (not on mount)
- [ ] Grid layout matches the initial SSR grid
- [ ] Button disables during loading (via `useTransition`)
- [ ] Shows remaining count to give user context
- [ ] Horse cards link to correct detail pages

---

## Task 4: Paginate Group Posts

**File:** `src/app/community/groups/[slug]/page.tsx`

### 4.1 Current state (line 31-32) — Unbounded post fetch

```ts
const [posts, channels] = await Promise.all([
    group.isMember ? getPosts({ groupId: group.id }, { includeReplies: true }) : Promise.resolve([]),
    // ...
]);
```

The `getPosts` function defaults to `limit: 25` (line 354 in `posts.ts`). This is already a reasonable initial load. **However**, `includeReplies: true` fetches ALL replies for those 25 posts (unbounded JOIN on `posts` via `parent_id`).

### 4.2 Limit reply depth

**File:** `src/app/actions/posts.ts` (around line 401-428)

In the `includeReplies` block, add a limit:

```ts
// BEFORE (line 402-406):
const { data: replies } = await supabase
    .from("posts")
    .select("id, author_id, content, parent_id, likes_count, created_at, users!posts_author_id_fkey(alias_name)")
    .in("parent_id", postIds)
    .order("created_at", { ascending: true });

// AFTER — cap at 5 replies per post initially:
const { data: replies } = await supabase
    .from("posts")
    .select("id, author_id, content, parent_id, likes_count, created_at, users!posts_author_id_fkey(alias_name)")
    .in("parent_id", postIds)
    .order("created_at", { ascending: true })
    .limit(100); // Global cap: 5 replies × 20 posts = 100 max
```

### 4.3 Add cursor-based pagination to GroupDetailClient

The `GroupDetailClient` component should already support `cursor` (the `getPosts` action accepts `cursor` and `limit` options). Verify that the client uses these for "Load More" functionality.

If `GroupDetailClient` currently loads all posts on mount without client-side pagination:

```tsx
// In GroupDetailClient, add a "Load More" button:
const [posts, setPosts] = useState(initialPosts);
const [cursor, setCursor] = useState(
    initialPosts.length > 0
        ? initialPosts[initialPosts.length - 1].createdAt
        : null
);
const [hasMore, setHasMore] = useState(initialPosts.length >= 25);

const loadMore = async () => {
    if (!cursor) return;
    const morePosts = await getPosts(
        { groupId: group.id },
        { limit: 25, cursor, includeReplies: true }
    );
    setPosts(prev => [...prev, ...morePosts]);
    setCursor(morePosts.length > 0 ? morePosts[morePosts.length - 1].createdAt : null);
    setHasMore(morePosts.length >= 25);
};
```

### Validation Checklist
- [ ] Group page initial fetch limited to 25 posts (already via getPosts default)
- [ ] Reply fetch capped at 100 total (5 per post × 20 posts)
- [ ] "Load More" uses cursor-based pagination (no offset skipping)
- [ ] GroupDetailClient does NOT re-fetch all posts on mount

---

## Task 5: Dashboard Is Already Paginated — Verify

**File:** `src/app/dashboard/page.tsx`

### 5.1 Current state

The dashboard already uses `.range(offset, offset + HORSES_PER_PAGE - 1)` (line 119) with `HORSES_PER_PAGE = 48` and page-based navigation. **No change needed.**

**Verify:**
- [ ] `HORSES_PER_PAGE = 48` — reasonable (48 cards fit 4×12 grid)
- [ ] Page links use `/dashboard?page=N` pattern
- [ ] Total horse count uses `{ count: "exact" }` without fetching all rows (line 103)
- [ ] `allHorsesSummary` (line 100-106) fetches only `id, collection_id, catalog_id` for aggregation — lightweight

**Potential issue:** Line 100-106 fetches ALL horse `id`s for vault value computation:
```ts
supabase.from("user_horses").select("id, collection_id, catalog_items:catalog_id(title, maker, item_type)", { count: "exact" })
```

For a user with 600 horses, this fetches 600 rows of `{id, collection_id, catalog_items}`. This is **lightweight** (no images, no large columns) but could be optimized later with an RPC. **Not a blocker for this sprint.**

### Validation Checklist
- [ ] Dashboard uses `.range()` on the horse card query ✅
- [ ] Page-based pagination via `?page=N` parameter ✅
- [ ] Summary query is lightweight (no image URLs) ✅

---

## 🛑 HUMAN VERIFICATION GATE 🛑

**Stop execution. Test the profile page performance:**

1. Navigate to a profile with 100+ horses (e.g., beta tester's profile)
2. **Before fix:** Full page render time ~2000ms+, scrollbar appears instantly with all horses
3. **After fix:** Page renders in <500ms, first 24 horses shown, "Load More" button at bottom
4. Click "Load More" — next 24 horses append smoothly
5. Check Vercel Functions tab — memory usage should drop from ~400MB to <100MB

**Test group posts:**
1. Navigate to a group with 50+ posts
2. First 25 posts load instantly, "Load More" button appears
3. Click Load More — next 25 append without page reload

Await human input: "Phase 077 Verified. Proceed."

---

## Build Gate

Run `npx next build` (via `cmd /c "npx next build 2>&1"`) and confirm 0 errors before marking complete.
