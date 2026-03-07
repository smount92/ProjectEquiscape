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
# OPTION 4: COLLECTOR POLISH — Daily-Use UX
# ═══════════════════════════════════════

# 🔴 Priority: Critical (Daily-Use Blockers)

## ✅ Task CP-1: Stable Sort Options (completed)

**Problem:** The Dashboard stable grid (StableGrid component) only has a search bar — no sort. Collectors with 100+ models need to sort by name, date added, condition, or value.

**What to build:**

**File:** `src/components/StableGrid.tsx`

1. Add a sort state next to the existing search state:

```tsx
const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name-az" | "name-za" | "condition">("newest");
```

2. Add a sort dropdown next to the SearchBar:

```tsx
<div style={{ display: "flex", gap: "var(--space-md)", alignItems: "center", flexWrap: "wrap" }}>
    <div style={{ flex: 1, minWidth: "200px" }}>
        <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search your stable by name, mold, release, or sculptor…"
            id="stable-search-bar"
        />
    </div>
    <select
        value={sortBy}
        onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
        className="form-input"
        style={{ width: "auto", minWidth: "160px", fontSize: "calc(var(--font-size-sm) * var(--font-scale))" }}
        id="stable-sort"
        aria-label="Sort your stable"
    >
        <option value="newest">🕐 Newest First</option>
        <option value="oldest">🕐 Oldest First</option>
        <option value="name-az">🔤 Name A→Z</option>
        <option value="name-za">🔤 Name Z→A</option>
        <option value="condition">⭐ By Condition</option>
    </select>
</div>
```

3. Apply the sort in the `filteredCards` useMemo, AFTER the existing search filter:

```tsx
// Sort
const CONDITION_ORDER = ["Mint", "Near Mint", "Excellent", "Very Good", "Good", "Fair", "Poor", "Play Grade"];

let sorted = [...filtered];
if (sortBy === "oldest") {
    sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
} else if (sortBy === "name-az") {
    sorted.sort((a, b) => a.customName.localeCompare(b.customName));
} else if (sortBy === "name-za") {
    sorted.sort((a, b) => b.customName.localeCompare(a.customName));
} else if (sortBy === "condition") {
    sorted.sort((a, b) => {
        const aIdx = CONDITION_ORDER.indexOf(a.conditionGrade);
        const bIdx = CONDITION_ORDER.indexOf(b.conditionGrade);
        return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
    });
}
// "newest" is the default server order — no re-sort needed

return sorted;
```

Make sure to rename the existing `filteredCards` to use a two-step approach: filter first, then sort.

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## ✅ Task CP-2: Scale Filter on Show Ring (completed)

**Problem:** The Show Ring `ShowRingFilters` component has filters for Finish Type, Trade Status, and Manufacturer — but NOT Scale. Model horse collectors think in scales: Traditional, Classic, Stablemate, Paddock Pal, etc.

**What to build:**

**File:** `src/components/ShowRingFilters.tsx`

1. Add `scale` to the `FilterState` interface:

```tsx
export interface FilterState {
    finishType: string | null;
    tradeStatus: string | null;
    manufacturer: string | null;
    scale: string | null;  // ADD THIS
    sortBy: "newest" | "oldest" | "most-favorited";
}
```

2. Add a scale prop and dropdown to the filter bar. Accept a `scales` prop (array of unique scale strings extracted from data):

```tsx
<select value={filters.scale ?? ""} onChange={(e) => onChange({ ...filters, scale: e.target.value || null })} className="form-input" style={{ width: "auto", minWidth: "140px" }} id="filter-scale" aria-label="Filter by scale">
    <option value="">All Scales</option>
    {scales.map((s) => <option key={s} value={s}>{s}</option>)}
</select>
```

**File:** `src/components/ShowRingGrid.tsx`

3. Extract unique scales from data (like `manufacturers` is already extracted):

```tsx
const scales = useMemo(() => {
    const set = new Set<string>();
    communityCards.forEach((h) => {
        if (h.scale) set.add(h.scale);
    });
    return [...set].sort();
}, [communityCards]);
```

4. You'll need to pass `scale` through from the community page data. Check `CommunityCardData` in ShowRingGrid.tsx — it may need a `scale: string | null` field. If it's not there, add it and populate it from the community page's query (the `reference_molds(... scale ...)` join already exists).

5. Add the filter logic in `filteredCards`:

```tsx
if (filters.scale) {
    cards = cards.filter((h) => h.scale === filters.scale);
}
```

6. Initialize `scale: null` in the filter state default.

7. Pass `scales` to ShowRingFilters component.

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## ✅ Task CP-3: Photo Thumbnails in Show Entries (completed)

**Problem:** The virtual photo show entries (`src/app/shows/[id]/page.tsx`) show only horse name and owner — no photos. A *photo show* needs photos.

**What to build:**

**File:** `src/app/actions/shows.ts`

1. Find the `getShowEntries` function. It fetches entries but needs to also fetch the primary thumbnail for each entered horse. Modify the query to join `horse_images`:

```sql
user_horses!inner(id, custom_name, finish_type, owner_id, users!inner(alias_name), horse_images(image_url, angle_profile))
```

2. Extract the Primary_Thumbnail (or first image) for each entry and include it in the return value.

3. Generate signed URLs for the thumbnails using `getSignedImageUrls`.

**File:** `src/app/shows/[id]/page.tsx`

4. Display the thumbnail in each entry card. Add an image element to `.show-entry-card`:

```tsx
{entry.thumbnailUrl && (
    <div className="show-entry-thumb">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={entry.thumbnailUrl} alt={entry.horseName} loading="lazy" />
    </div>
)}
```

**File:** `src/app/globals.css`

5. Add CSS for the thumbnail:

```css
.show-entry-thumb {
    width: 64px;
    height: 64px;
    border-radius: var(--radius-md);
    overflow: hidden;
    flex-shrink: 0;
}
.show-entry-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}
```

6. Make the `.show-entry-card` a flex row with the thumb on the left.

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## ✅ Task CP-4: Profile Bio Field (completed — migration needed)

**Problem:** User profiles have no bio/about section. Collectors want to say "I've been collecting since 1998, I focus on Traditionals, I show NAN regularly."

**What to build:**

### 1. Database migration: `supabase/migrations/017_user_bio.sql`

```sql
-- Add bio field to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT NULL;

COMMENT ON COLUMN users.bio IS 'Public bio/about text for the collector profile. Max 500 chars enforced at app layer.';
```

**IMPORTANT:** The agent must pause and ask the user to run this migration in the Supabase SQL Editor before proceeding.

### 2. Display on profile: `src/app/profile/[alias_name]/page.tsx`

The page already fetches user data. Add `bio` to the select query. Then display it below the alias:

```tsx
{profileUser.bio && (
    <p className="profile-bio" style={{
        color: "var(--color-text-muted)",
        fontSize: "calc(var(--font-size-sm) * var(--font-scale))",
        maxWidth: "480px",
        lineHeight: 1.5,
        marginTop: "var(--space-sm)",
    }}>
        {profileUser.bio}
    </p>
)}
```

### 3. Edit bio from own profile

When viewing your OWN profile (`isOwnProfile` flag already exists in the page), show an "Edit Bio" button that opens an inline text area:

- Create a small client component `src/components/EditBioButton.tsx`
- It shows a pencil icon button when not editing
- On click, it reveals a textarea (max 500 chars) with Save/Cancel buttons
- Save calls a server action that updates `users.bio` where `id = auth.uid()`
- Add the server action to `src/app/actions/social.ts` or a new `src/app/actions/profile.ts`:

```typescript
export async function updateBio(bio: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const trimmed = bio.trim().slice(0, 500);
    await supabase.from("users").update({ bio: trimmed }).eq("id", user.id);
    revalidatePath(`/profile`);
}
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

# 🟡 Priority: Medium

## ✅ Task CP-5: "See More from Seller" Link on Passport (completed)

**Problem:** When viewing a public passport (`/community/[id]`), there's no link to see the seller's other horses. Collectors who find a good seller want to browse everything they have.

**What to build:**

**File:** `src/app/community/[id]/page.tsx`

The page already fetches `owner_id` and the owner's `alias_name`. Add a link below the owner display:

```tsx
<Link
    href={`/profile/${encodeURIComponent(ownerAlias)}`}
    className="btn btn-ghost"
    style={{ fontSize: "calc(var(--font-size-sm) * var(--font-scale))", marginTop: "var(--space-sm)" }}
    id="see-more-seller"
>
    👤 See all models from @{ownerAlias} →
</Link>
```

Place this in the sidebar section, near/below the owner alias display. Verify it only shows when the viewer is NOT the owner (you wouldn't "see more from yourself").

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## ✅ Task CP-6: Release Years in Reference Search (already existed)

**Problem:** The add-horse reference search (`WizardMoldSearch` or similar component) doesn't show release years in results. Collectors often know "I have the 1995 palomino" but not the official release name.

**What to build:**

Find the reference search component that queries `reference_releases`. The search results dropdown should already show `release_name` and `model_number`. Add `release_year_start` and `release_year_end` to the display:

```tsx
{release.release_year_start && (
    <span style={{ opacity: 0.6, fontSize: "calc(0.75rem * var(--font-scale))" }}>
        {" "}({release.release_year_start}{release.release_year_end && release.release_year_end !== release.release_year_start ? `–${release.release_year_end}` : ""})
    </span>
)}
```

Also ensure the search query is already fetching `release_year_start, release_year_end` from the reference_releases table. If not, add those columns to the select.

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## ✅ Task CP-7: Mark All Notifications Read (already existed)

**Problem:** The notifications page (`NotificationList` component) has individual mark-as-read but no "Mark All Read" button.

**What to build:**

### 1. Server action: `src/app/actions/notifications.ts`

Add a `markAllNotificationsRead` function:

```typescript
export async function markAllNotificationsRead() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

    revalidatePath("/notifications");
}
```

### 2. Client component update: `src/components/NotificationList.tsx`

Add a "Mark All Read" button at the top of the notification list, only visible when there are unread notifications:

```tsx
{unreadCount > 0 && (
    <button
        className="btn btn-ghost"
        onClick={async () => {
            await markAllNotificationsRead();
            router.refresh();
        }}
        style={{ marginBottom: "var(--space-md)" }}
        id="mark-all-read"
    >
        ✓ Mark All Read ({unreadCount})
    </button>
)}
```

Import the action and compute `unreadCount` from the notifications prop.

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## ✅ Task CP-8: "New" Badge on Show Ring Cards (completed)

**Problem:** When users return to the Show Ring, they can't tell which horses are new since their last visit.

**What to build:**

**File:** `src/components/ShowRingGrid.tsx`

Add a "NEW" badge to cards where `createdAt` is within the last 48 hours:

```tsx
{(Date.now() - new Date(horse.createdAt).getTime()) < 48 * 60 * 60 * 1000 && (
    <span className="new-badge">NEW</span>
)}
```

**File:** `src/app/globals.css`

```css
.new-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    background: var(--color-accent, #f59e0b);
    color: #000;
    font-size: 0.65rem;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 999px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    z-index: 2;
    animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
}
```

Place the badge inside `.horse-card-image` (which already has `position: relative`).

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

# 🟢 Priority: Nice-to-Have

## Task CP-9: Activity Feed Event Thumbnails

**Problem:** Feed events like "User added a new horse" or "User favorited a horse" are text-only. Visual feeds drive significantly more engagement.

**What to build:**

**File:** `src/app/actions/activity.ts`

The `getActivityFeed` function currently returns events with `horseId` and `horseName`. Add a thumbnail by joining `horse_images` in the query:

1. After fetching activity events, collect all `horse_id` values
2. Batch-fetch primary thumbnails for those horses:

```typescript
const horseIds = events.filter(e => e.horse_id).map(e => e.horse_id);
const { data: thumbs } = await supabase
    .from("horse_images")
    .select("horse_id, image_url")
    .in("horse_id", horseIds)
    .eq("angle_profile", "Primary_Thumbnail");
```

3. Generate signed URLs and include `thumbnailUrl` in the return type

**File:** `src/components/ActivityFeed.tsx`

4. Display the thumbnail next to the event text:

```tsx
{item.thumbnailUrl && (
    <div className="feed-item-thumb">
        <img src={item.thumbnailUrl} alt="" loading="lazy" />
    </div>
)}
```

5. Add CSS for a small 48x48 rounded thumbnail on the left of each feed item.

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task CP-10: Wishlist Match Notifications

**Problem:** The Matchmaker finds For Sale horses matching your wishlist, but ONLY when you visit the Wishlist page. Collectors want to be notified: "A horse matching your wishlist just went For Sale!"

**What to build:**

**File:** `src/app/actions/horse-events.ts`

In the `notifyHorsePublic` function (or wherever trade_status changes are processed), add wishlist match checking:

1. When a horse is marked "For Sale" or "Open to Offers", query `user_wishlists` for any user who has that `mold_id` or `release_id` on their wishlist
2. For each match, create a notification:

```typescript
// Check for wishlist matches
if (tradeStatus === "For Sale" || tradeStatus === "Open to Offers") {
    const { data: wishlistMatches } = await supabase
        .from("user_wishlists")
        .select("user_id")
        .or(`mold_id.eq.${moldId},release_id.eq.${releaseId}`)
        .neq("user_id", ownerId); // Don't notify the seller

    for (const match of wishlistMatches ?? []) {
        await supabase.from("notifications").insert({
            user_id: match.user_id,
            type: "wishlist_match",
            message: `A ${horseName} matching your wishlist is now ${tradeStatus}!`,
            link: `/community/${horseId}`,
        });
    }
}
```

**File:** `src/components/NotificationList.tsx`

3. Handle the `wishlist_match` notification type with a ❤️‍🔥 icon.

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task CP-11: Commit & Push Collector Polish

After all CP tasks above are complete:

```
cd c:\Project Equispace\model-horse-hub && cmd /c "git add -A && git commit -m "polish: stable sort, scale filter, show thumbs, bio, seller link, notif mark-all, new badges" 2>&1"
```

Then push:

```
cd c:\Project Equispace\model-horse-hub && cmd /c "git push origin main 2>&1"
```
