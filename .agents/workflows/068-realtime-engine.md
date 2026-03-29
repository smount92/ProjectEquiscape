---
description: Real-Time DMs & Notification Engine — Supabase Realtime for chat, replace polling with push for notifications
---

# Real-Time DMs & Notification Engine

> **Constraint:** Supabase Pro Plan gives us 500 concurrent Realtime connections. The chat system already uses Realtime (confirmed in `ChatThread.tsx`). The notification bell still polls every 60 seconds — this wastes bandwidth and adds latency.
> **Last Updated:** 2026-03-29
> **Status:** ✅ COMPLETE (2026-03-29)
> **Commit:** `abae116`
> **Prerequisite:** None — standalone feature
> **Current State:** All polling eliminated. `ChatThread.tsx`, `NotificationBell.tsx`, and `Header.tsx` all use Supabase Realtime push.

// turbo-all

---

# ═══════════════════════════════════════
# PHASE 1: Audit Current Realtime Usage
# ═══════════════════════════════════════

## Step 1.1 — Confirm ChatThread is already real-time

**Target File:** `src/components/ChatThread.tsx` (lines 46–86)

✅ **Already implemented correctly:**
- Subscribes to `postgres_changes` → `INSERT` on `messages` table filtered by `conversation_id`
- Calls `supabase.removeChannel(channel)` on component unmount
- Uses optimistic updates for sent messages

**No changes needed here.** Document this as "complete" in the audit.

## Step 1.2 — Audit Header.tsx polling

**Target File:** `src/components/Header.tsx` (lines 138–142)

Current pattern:
```ts
const interval = setInterval(() => fetchHeaderInfo(), 30000);
```

This polls the server action `getHeaderData()` every 30 seconds for ALL authenticated users. This is expensive at scale — 100 users = 200 requests/minute.

**This will be replaced in Phase 2.**

## Step 1.3 — Audit NotificationBell.tsx polling

**Target File:** `src/components/NotificationBell.tsx` (lines 30–65)

Current pattern:
- `setInterval(fetchCount, 60_000)` — polls every 60 seconds
- Page Visibility API — stops polling when tab is hidden, resumes immediately on visibility
- Fetches `supabase.from("notifications").select("id", { count: "exact", head: true })`

> ⚡ This is already well-optimized with visibility detection. We'll upgrade it to Realtime for instant push.

---

# ═══════════════════════════════════════
# PHASE 2: Notification Bell → Realtime Push
# ═══════════════════════════════════════

## Step 2.1 — Replace polling with Realtime subscription

**Target File:** `src/components/NotificationBell.tsx`

Replace the entire `useEffect` (lines 26–65) with a Realtime-based approach:

```tsx
useEffect(() => {
    // Initial fetch on mount
    fetchCount();

    let userId: string | null = null;

    const setupRealtime = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        userId = user.id;

        // Subscribe to new notifications for this user
        const channel = supabase
            .channel(`notifications-${user.id}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "notifications",
                    filter: `user_id=eq.${user.id}`,
                },
                () => {
                    // Instantly bump unread count
                    setUnreadCount((prev) => prev + 1);
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "notifications",
                    filter: `user_id=eq.${user.id}`,
                },
                (payload) => {
                    // If a notification was marked as read, re-fetch the exact count
                    if (payload.new && (payload.new as { is_read: boolean }).is_read) {
                        fetchCount();
                    }
                }
            )
            .subscribe();

        // Re-fetch on tab visibility (catches reads from other tabs/devices)
        const handleVisibility = () => {
            if (document.visibilityState === "visible") {
                fetchCount();
            }
        };
        document.addEventListener("visibilitychange", handleVisibility);

        return () => {
            supabase.removeChannel(channel);
            document.removeEventListener("visibilitychange", handleVisibility);
        };
    };

    const cleanup = setupRealtime();

    return () => {
        cleanup.then((fn) => fn?.());
    };
}, [supabase, fetchCount]);
```

**Key differences from the old approach:**
- No `setInterval` — zero polling overhead
- Instant unread count bump on INSERT
- Re-fetch on UPDATE (when user reads notifications on another device)
- Page Visibility API retained as a safety net for cross-device sync

## Step 2.2 — Remove Header.tsx polling interval

**Target File:** `src/components/Header.tsx` (lines 138–142)

The Header currently polls `fetchHeaderInfo()` every 30 seconds. Since the notification bell now uses Realtime, we can reduce this to a Page Visibility API fetch only:

**Find:**
```ts
useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => fetchHeaderInfo(), 30000);
    return () => clearInterval(interval);
}, [user, fetchHeaderInfo]);
```

**Replace with:**
```ts
useEffect(() => {
    if (!user) return;
    const handleVisibility = () => {
        if (document.visibilityState === "visible") {
            fetchHeaderInfo();
        }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
}, [user, fetchHeaderInfo]);
```

This eliminates ~2 server requests per minute per user while still refreshing the header data when the user returns to the tab.

## Verify Phase 2

```
cmd /c "npx next build 2>&1 | findstr /C:error /C:Error /C:compiled"
```

```
cmd /c "npx vitest run 2>&1"
```

Check that:
- [ ] NotificationBell subscribes to Realtime channel
- [ ] NotificationBell calls `removeChannel` on unmount
- [ ] Header no longer uses `setInterval`
- [ ] Unread badge updates instantly when a notification is inserted
- [ ] Build passes
- [ ] All tests pass

---

# ═══════════════════════════════════════
# PHASE 3: Inbox Unread Count → Realtime
# ═══════════════════════════════════════

## Step 3.1 — Add Realtime to inbox unread badge in Header

The Header's inbox icon shows an unread count badge sourced from `getHeaderData()`. Since we've removed the 30-second poll, the unread message count won't update until the user switches tabs.

**Target File:** `src/components/Header.tsx`

Add a secondary Realtime channel for unread messages. Subscribe to `messages` table where `sender_id != currentUserId`:

```tsx
// Inside the main auth useEffect (approximately line 106):
// After fetchHeaderInfo(), subscribe to new messages:

const messageChannel = supabase
    .channel("inbox-unread")
    .on(
        "postgres_changes",
        {
            event: "INSERT",
            schema: "public",
            table: "messages",
        },
        (payload) => {
            const msg = payload.new as { sender_id: string };
            // Only bump if message is FROM someone else
            if (msg.sender_id !== user.id) {
                setUnreadCount((prev) => prev + 1);
            }
        }
    )
    .subscribe();

// In cleanup:
return () => {
    subscription.unsubscribe();
    supabase.removeChannel(messageChannel);
};
```

> **Scaling note:** This subscribes to ALL message inserts without a filter. For the free Supabase plan we'd need a filter, but on Pro with 500 concurrent connections this is fine for Open Beta scale.

## Verify Phase 3

```
cmd /c "npx next build 2>&1 | findstr /C:error /C:Error /C:compiled"
```

Check that:
- [ ] Inbox unread badge updates instantly when a new DM arrives
- [ ] Channel is cleaned up on unmount
- [ ] No duplicate channels created on re-renders
- [ ] Build passes

---

## Commit

```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "feat: realtime engine — notification push, inbox push, remove all polling intervals"
```
