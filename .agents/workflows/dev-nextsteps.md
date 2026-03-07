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
# OPTION 5: PHOTO SHOWS OVERHAUL + PLATFORM GAPS
# ═══════════════════════════════════════

# 🔴 Priority: Critical (Trust & Functionality)

## ✅ Task PS-1: Self-Voting Guard (completed)

**Problem:** Users can vote for their OWN show entries. `voteForEntry()` in `src/app/actions/shows.ts` checks if the user already voted, but never checks if the entry belongs to the voter. This destroys credibility in any contest.

**What to fix:**

**File:** `src/app/actions/shows.ts` — function `voteForEntry()`

After the existing auth check (`if (!user)`), add an ownership check BEFORE the existing vote logic:

```typescript
// Check if user is trying to vote for their own entry
const { data: entryData } = await supabase
    .from("show_entries")
    .select("user_id")
    .eq("id", entryId)
    .single();

if (!entryData) return { success: false, error: "Entry not found." };
if ((entryData as { user_id: string }).user_id === user.id) {
    return { success: false, error: "You can't vote for your own entry." };
}
```

Also update the `VoteButton.tsx` component to display the error message from the server action if one is returned, instead of silently failing.

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## ✅ Task PS-2: End Date in Create Show Form + Display (completed)

**Problem:** The `CreateShowForm.tsx` has no date picker, so shows are created without deadlines. The `end_at` column exists in the DB and the `createPhotoShow()` action accepts `endAt`, but the UI never sends it.

**What to fix:**

### 1. Add date picker to CreateShowForm

**File:** `src/components/CreateShowForm.tsx`

Add an `endAt` state field and a date/time input:

```tsx
const [endAt, setEndAt] = useState("");
```

Add a form group after the description textarea:

```tsx
<div className="form-group">
    <label className="form-label">Entries Close (optional)</label>
    <input
        type="datetime-local"
        className="form-input"
        value={endAt}
        onChange={(e) => setEndAt(e.target.value)}
    />
    <p style={{ fontSize: "calc(0.75rem * var(--font-scale))", color: "var(--color-text-muted)", marginTop: "4px" }}>
        Leave blank for no deadline. Show will stay open until manually closed.
    </p>
</div>
```

Pass `endAt` to the action:

```tsx
const result = await createPhotoShow({
    title: title.trim(),
    theme: theme.trim() || undefined,
    description: description.trim() || undefined,
    endAt: endAt || undefined,  // ADD THIS
});
```

### 2. Display deadline on show listing

**File:** `src/app/shows/page.tsx`

In the show card footer, add the deadline display:

```tsx
{show.endAt && (
    <span>
        ⏰ {new Date(show.endAt) > new Date()
            ? `Closes ${new Date(show.endAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
            : "Entries closed"
        }
    </span>
)}
```

### 3. Display deadline on show detail page

**File:** `src/app/shows/[id]/page.tsx`

In the hero section, add below the description:

```tsx
{show.endAt && (
    <p className="community-hero-subtitle" style={{
        color: new Date(show.endAt) > new Date() ? "var(--color-accent, #f59e0b)" : "var(--color-text-muted)"
    }}>
        ⏰ {new Date(show.endAt) > new Date()
            ? `Entries close: ${new Date(show.endAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}`
            : "Entries are closed"
        }
    </p>
)}
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## ✅ Task PS-3: Auto-Close Expired Shows (completed)

**Problem:** Even if `end_at` is set, shows stay "open" forever. Nothing checks the deadline.

**What to build:**

### 1. Server-side check in `getPhotoShows()`

**File:** `src/app/actions/shows.ts` — function `getPhotoShows()`

After fetching shows, add a check that auto-transitions expired shows:

```typescript
// Auto-close shows past their end date
const now = new Date().toISOString();
const expiredShows = shows.filter(
    (s: { id: string; status: string; end_at: string | null }) =>
        s.status === "open" && s.end_at && new Date(s.end_at) < new Date()
);

if (expiredShows.length > 0) {
    // Use service role to update status (RLS may block user-level updates)
    const admin = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    for (const expired of expiredShows) {
        await admin.from("photo_shows")
            .update({ status: "judging" })
            .eq("id", (expired as { id: string }).id);
    }
}
```

This runs lazily whenever anyone loads the shows page — no cron needed.

### 2. Also check in `enterShow()`

**File:** `src/app/actions/shows.ts` — function `enterShow()`

The function already checks `show.status !== "open"`. Add an additional deadline check:

```typescript
// Also check deadline
const showData = show as { status: string; end_at: string | null };
if (showData.end_at && new Date(showData.end_at) < new Date()) {
    return { success: false, error: "This show's entry deadline has passed." };
}
```

Update the select query in `enterShow()` to also fetch `end_at`:

```typescript
.select("status, end_at")
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## ✅ Task PS-4: Admin Show Management (completed)

**Problem:** Admin can CREATE shows from `/admin` but can't change status, update end dates, or manage existing shows.

**What to build:**

### 1. Server actions for show management

**File:** `src/app/actions/shows.ts`

Add these admin actions:

```typescript
/**
 * Admin: Update show status.
 */
export async function updateShowStatus(
    showId: string,
    newStatus: "open" | "judging" | "closed"
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.email?.toLowerCase() !== process.env.ADMIN_EMAIL?.toLowerCase()) {
        return { success: false, error: "Unauthorized." };
    }

    const admin = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await admin.from("photo_shows")
        .update({ status: newStatus })
        .eq("id", showId);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

/**
 * Admin: Delete a show.
 */
export async function deleteShow(
    showId: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.email?.toLowerCase() !== process.env.ADMIN_EMAIL?.toLowerCase()) {
        return { success: false, error: "Unauthorized." };
    }

    const admin = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await admin.from("photo_shows").delete().eq("id", showId);
    if (error) return { success: false, error: error.message };
    return { success: true };
}
```

### 2. Admin show list component

**File:** `src/components/AdminShowManager.tsx` (new file)

Create a client component that:
- Receives an array of shows `{ id, title, status, endAt, entryCount }`
- Displays each show in a row with:
  - Title + status badge
  - Entry count
  - A `<select>` to change status (open/judging/closed)
  - A "Delete" button with confirmation
- Calls `updateShowStatus()` or `deleteShow()` on change
- Uses `router.refresh()` after mutations

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateShowStatus, deleteShow } from "@/app/actions/shows";

interface AdminShow {
    id: string;
    title: string;
    status: string;
    endAt: string | null;
    entryCount: number;
}

export default function AdminShowManager({ shows }: { shows: AdminShow[] }) {
    const router = useRouter();
    const [busy, setBusy] = useState<string | null>(null);

    const handleStatusChange = async (showId: string, newStatus: string) => {
        setBusy(showId);
        await updateShowStatus(showId, newStatus as "open" | "judging" | "closed");
        router.refresh();
        setBusy(null);
    };

    const handleDelete = async (showId: string, title: string) => {
        if (!confirm(`Delete "${title}" and all its entries? This cannot be undone.`)) return;
        setBusy(showId);
        await deleteShow(showId);
        router.refresh();
        setBusy(null);
    };

    if (shows.length === 0) {
        return <p style={{ color: "var(--color-text-muted)" }}>No shows yet. Create one above.</p>;
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
            {shows.map((show) => (
                <div key={show.id} className="card" style={{ padding: "var(--space-md)", display: "flex", alignItems: "center", gap: "var(--space-md)", flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: "200px" }}>
                        <div style={{ fontWeight: 600 }}>{show.title}</div>
                        <div style={{ fontSize: "calc(0.75rem * var(--font-scale))", color: "var(--color-text-muted)" }}>
                            🐴 {show.entryCount} entries
                            {show.endAt && <> · ⏰ {new Date(show.endAt).toLocaleDateString()}</>}
                        </div>
                    </div>
                    <select
                        value={show.status}
                        onChange={(e) => handleStatusChange(show.id, e.target.value)}
                        className="form-input"
                        style={{ width: "auto", minWidth: "120px" }}
                        disabled={busy === show.id}
                    >
                        <option value="open">🟢 Open</option>
                        <option value="judging">🟡 Judging</option>
                        <option value="closed">🔴 Closed</option>
                    </select>
                    <button
                        className="btn btn-ghost"
                        onClick={() => handleDelete(show.id, show.title)}
                        disabled={busy === show.id}
                        style={{ color: "var(--color-error, #ef4444)", fontSize: "calc(0.8rem * var(--font-scale))" }}
                    >
                        🗑 Delete
                    </button>
                </div>
            ))}
        </div>
    );
}
```

### 3. Wire into admin page

**File:** `src/app/admin/page.tsx`

After the "Create Photo Show" section, add a "Manage Shows" section. Fetch all shows with `getPhotoShows()` and pass them to the new component:

```tsx
import AdminShowManager from "@/components/AdminShowManager";
import { getPhotoShows } from "@/app/actions/shows";

// ... in the AdminPage function body:
const allShows = await getPhotoShows();

// ... in the JSX, after the Create Photo Show section:
<div className="admin-section">
    <h2 className="admin-section-title">
        🎛️ Manage Shows
        <span className="admin-section-count">{allShows.length} total</span>
    </h2>
    <AdminShowManager shows={allShows.map(s => ({
        id: s.id,
        title: s.title,
        status: s.status,
        endAt: s.endAt,
        entryCount: s.entryCount,
    }))} />
</div>
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## ✅ Task PS-5: Winner Display on Closed Shows (completed)

**Problem:** When a show status is "closed", entries look exactly the same as an open show. No winners, no podium, no urgency.

**What to fix:**

**File:** `src/app/shows/[id]/page.tsx`

Wrap the entries grid in conditional rendering based on show status:

### For closed shows — add winner podium:

```tsx
{show.status === "closed" && entries.length > 0 && (
    <div className="show-winners animate-fade-in-up" style={{
        textAlign: "center",
        padding: "var(--space-xl)",
        marginBottom: "var(--space-lg)",
    }}>
        <h2 style={{ fontSize: "calc(1.3rem * var(--font-scale))", marginBottom: "var(--space-lg)" }}>
            🏆 <span className="text-gradient">Results</span>
        </h2>
        <div style={{ display: "flex", justifyContent: "center", gap: "var(--space-xl)", flexWrap: "wrap" }}>
            {entries.slice(0, 3).map((entry, i) => {
                const medals = ["🥇", "🥈", "🥉"];
                const labels = ["1st Place", "2nd Place", "3rd Place"];
                return (
                    <div key={entry.id} style={{ textAlign: "center", minWidth: "120px" }}>
                        <div style={{ fontSize: "2.5rem" }}>{medals[i]}</div>
                        {entry.thumbnailUrl && (
                            <div className="show-entry-thumb" style={{ width: "80px", height: "80px", margin: "var(--space-sm) auto" }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={entry.thumbnailUrl} alt={entry.horseName} />
                            </div>
                        )}
                        <div style={{ fontWeight: 600, fontSize: "calc(0.9rem * var(--font-scale))" }}>
                            {entry.horseName}
                        </div>
                        <div style={{ color: "var(--color-text-muted)", fontSize: "calc(0.75rem * var(--font-scale))" }}>
                            by @{entry.ownerAlias} · {entry.votes} vote{entry.votes !== 1 ? "s" : ""}
                        </div>
                        <div style={{ fontWeight: 700, color: "var(--color-accent, #f59e0b)", fontSize: "calc(0.8rem * var(--font-scale))" }}>
                            {labels[i]}
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
)}
```

### For judging shows — add a banner:

```tsx
{show.status === "judging" && (
    <div className="card animate-fade-in-up" style={{
        textAlign: "center",
        padding: "var(--space-lg)",
        marginBottom: "var(--space-lg)",
        background: "rgba(245, 158, 11, 0.1)",
        border: "1px solid rgba(245, 158, 11, 0.3)",
    }}>
        <div style={{ fontSize: "2rem" }}>🟡</div>
        <h3>Judging in Progress</h3>
        <p style={{ color: "var(--color-text-muted)" }}>Voting is closed. Results will be announced soon!</p>
    </div>
)}
```

### Disable voting on non-open shows:

The `VoteButton` should be disabled when the show is not open. Pass `disabled` prop:

```tsx
<VoteButton
    entryId={entry.id}
    initialVotes={entry.votes}
    initialHasVoted={entry.hasVoted}
    disabled={show.status !== "open"}
/>
```

Update `VoteButton.tsx` to accept and honor an optional `disabled?: boolean` prop, greying out the button and preventing clicks.

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

# 🟡 Priority: Medium

## ✅ Task PS-6: Entry Limit Per User (completed)

**Problem:** One user can enter every horse they own into a single show. Most photo shows cap entries at 1-3 per person.

**What to fix:**

**File:** `src/app/actions/shows.ts` — function `enterShow()`

After verifying the horse is public, add an entry count check:

```typescript
// Check entry limit (max 3 per user per show)
const { count: existingEntries } = await supabase
    .from("show_entries")
    .select("id", { count: "exact", head: true })
    .eq("show_id", showId)
    .eq("user_id", user.id);

if ((existingEntries ?? 0) >= 3) {
    return { success: false, error: "Maximum 3 entries per show." };
}
```

**File:** `src/components/ShowEntryForm.tsx`

Display the error message from the action if the limit is hit. Also consider showing "X/3 entries used" as a hint.

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## ✅ Task PS-7: Withdraw Entry Button (completed)

**Problem:** RLS policy allows users to delete their own entries, but there's no UI button to do so.

**What to build:**

### 1. Server action

**File:** `src/app/actions/shows.ts`

```typescript
/**
 * Remove your own entry from a show.
 */
export async function withdrawEntry(
    entryId: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not logged in." };

    // Verify ownership
    const { data: entry } = await supabase
        .from("show_entries")
        .select("user_id, show_id, votes")
        .eq("id", entryId)
        .single();

    if (!entry || (entry as { user_id: string }).user_id !== user.id) {
        return { success: false, error: "Not your entry." };
    }

    const { error } = await supabase
        .from("show_entries")
        .delete()
        .eq("id", entryId);

    if (error) return { success: false, error: error.message };
    return { success: true };
}
```

### 2. UI button on show detail page

**File:** `src/app/shows/[id]/page.tsx`

In the entries grid, when the entry belongs to the current user AND the show is still "open", show a small "Withdraw" button:

```tsx
{entry.ownerId === user.id && show.status === "open" && (
    <WithdrawButton entryId={entry.id} />
)}
```

### 3. Create the WithdrawButton component

**File:** `src/components/WithdrawButton.tsx` (new file)

A small client component that calls `withdrawEntry()` with a confirm dialog, then refreshes the page.

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { withdrawEntry } from "@/app/actions/shows";

export default function WithdrawButton({ entryId }: { entryId: string }) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);

    const handleWithdraw = async () => {
        if (!confirm("Remove your entry from this show?")) return;
        setBusy(true);
        await withdrawEntry(entryId);
        router.refresh();
    };

    return (
        <button
            className="btn btn-ghost"
            onClick={handleWithdraw}
            disabled={busy}
            style={{ fontSize: "calc(0.7rem * var(--font-scale))", padding: "2px 8px", color: "var(--color-error, #ef4444)" }}
            title="Withdraw your entry"
        >
            {busy ? "…" : "✕ Withdraw"}
        </button>
    );
}
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## ✅ Task PS-8: Dashboard Unread Messages Indicator (completed)

**Problem:** The dashboard analytics cards show model count, value, and show placings — but not unread messages. Users don't know they have messages until they click Inbox.

**What to fix:**

**File:** `src/app/dashboard/page.tsx`

The page already fetches the user. Add a query for unread message count:

```typescript
// Fetch unread message count
const { data: unreadMsgs } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .neq("sender_id", user.id)
    .eq("is_read", false)
    .in("conversation_id", /* conversations where user is buyer or seller */);
```

**Simpler approach:** Just count unread messages in conversations where the user participates. You can do a two-step:

```typescript
const { data: userConvos } = await supabase
    .from("conversations")
    .select("id")
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`);
const convoIds = (userConvos ?? []).map((c: { id: string }) => c.id);

let unreadCount = 0;
if (convoIds.length > 0) {
    const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .neq("sender_id", user.id)
        .eq("is_read", false)
        .in("conversation_id", convoIds);
    unreadCount = count ?? 0;
}
```

Add an analytics card for it:

```tsx
{unreadCount > 0 && (
    <Link href="/inbox" className="analytics-card" style={{ textDecoration: "none", cursor: "pointer" }}>
        <div className="analytics-icon">✉️</div>
        <div className="analytics-value">{unreadCount}</div>
        <div className="analytics-label">Unread Messages</div>
    </Link>
)}
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## ✅ Task PS-9: Profile "For Sale" Count Badge (completed)

**Problem:** When viewing someone's profile, you can't tell at a glance how many models they have for sale. You have to scroll through all horses.

**What to fix:**

**File:** `src/app/profile/[alias_name]/page.tsx`

The page already fetches all horses. Count how many have `trade_status` of "For Sale" or "Open to Offers":

```typescript
const forSaleCount = profileHorses.filter(
    (h) => h.trade_status === "For Sale" || h.trade_status === "Open to Offers"
).length;
```

Display it in the profile stats section (where follower/following counts are):

```tsx
{forSaleCount > 0 && (
    <div className="profile-stat">
        <span className="profile-stat-number">{forSaleCount}</span>
        <span className="profile-stat-label">For Sale/Trade</span>
    </div>
)}
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

# 🟢 Priority: Nice-to-Have

## ✅ Task PS-10: Vote Notifications (completed)

**Problem:** When someone votes for your show entry, you receive no notification. This would drive engagement back to the show page.

**What to fix:**

**File:** `src/app/actions/shows.ts` — in the `voteForEntry()` function

After a successful vote (NOT unvote), create a notification for the entry owner:

```typescript
// Notify entry owner of new vote
if (!existing) {
    // We already fetched entryData above (from self-voting guard)
    const entryOwnerId = (entryData as { user_id: string }).user_id;
    if (entryOwnerId !== user.id) {
        // Get voter alias
        const { data: voter } = await supabase
            .from("users")
            .select("alias_name")
            .eq("id", user.id)
            .single();
        const voterAlias = (voter as { alias_name: string } | null)?.alias_name || "Someone";

        // Get show info for the link
        const { data: showEntry } = await supabase
            .from("show_entries")
            .select("show_id")
            .eq("id", entryId)
            .single();

        await supabase.from("notifications").insert({
            user_id: entryOwnerId,
            type: "show_vote",
            message: `@${voterAlias} voted for your show entry!`,
            link: showEntry ? `/shows/${(showEntry as { show_id: string }).show_id}` : "/shows",
        });
    }
}
```

**File:** `src/components/NotificationList.tsx`

Handle the `show_vote` notification type with a 📸 icon.

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task PS-11: Commit & Push Photo Shows Overhaul

After all PS tasks above are complete:

```
cd c:\Project Equispace\model-horse-hub && cmd /c "git add -A && git commit -m "feat: photo shows overhaul - deadlines, winners, admin mgmt, self-vote guard, entry limits" 2>&1"
```

Then push:

```
cd c:\Project Equispace\model-horse-hub && cmd /c "git push origin main 2>&1"
```
