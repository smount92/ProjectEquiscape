---
description: Realtime & Polling Avalanche — Consolidate Supabase Realtime channels, kill remount loops, enforce strict cleanup
---

# 075 — Defuse the Realtime & Polling Avalanche

> **The Problem:** `pg_stat_statements` shows 2.8M+ calls to `realtime.list_changes` and ~180K requests to notifications/messages/conversations. Components aggressively remount and re-subscribe to Realtime channels on every client-side navigation.
> **Root Cause:** Realtime channel subscriptions live inside per-component `useEffect` hooks (NotificationBell, Header, ChatThread). Each soft navigation remounts these components, creating duplicate subscriptions. The `supabase` client is recreated via `createClient()` on every render.
> **Objective:** Consolidate all Realtime channels into a single global provider, ensure strict cleanup, and eliminate redundant `getUser()` calls.

// turbo-all

---

## Task 1: Create a Shared Supabase Client Singleton

**Problem:** `createClient()` is called at the module scope in `Header.tsx` (line 90), `NotificationBell.tsx` (line 9), and `ChatThread.tsx`. Each call creates a new client instance, which means each component creates its own Realtime connection.

**File:** `src/lib/supabase/client.ts`

### 1.1 Verify the client is already a singleton

The browser `createClient()` exported from `@/lib/supabase/client` should already return a stable singleton reference (Supabase JS v2 caches the client). Verify:

```powershell
cmd /c "type src\lib\supabase\client.ts"
```

If `createClient()` calls `createBrowserClient()` with no special config, it returns the same instance. **No change needed** — this is just verification.

### 1.2 Verify useMemo or stable reference in components

**Header.tsx (line 90):** `const supabase = createClient();`

This is called inside the component body (not inside `useEffect`), which means React will re-execute it on every render. Since `createClient()` returns a singleton, the reference is stable. The `[supabase]` in `useEffect` dependency arrays (lines 88, 138, 176) will NOT cause re-subscription because the reference doesn't change.

**Verdict:** Safe — no change needed.

### Validation Checklist
- [ ] Verified `createClient()` returns a singleton
- [ ] Supabase client reference is stable across renders

---

## Task 2: Consolidate Realtime Channels into a Global Provider

### 2.1 Current state — 3 independent channel subscriptions

| Component | Channel Name | Event | Duplicate Risk |
|-----------|-------------|-------|---------------|
| `NotificationBell.tsx:37-67` | `notifications-{userId}` | INSERT/UPDATE on `notifications` | Re-subscribes on mount |
| `Header.tsx:145-162` | `inbox-unread` | INSERT on `messages` | Re-subscribes on mount |
| `ChatThread.tsx:50` | `chat-{conversationId}` | INSERT on `messages` for specific convo | Per-conversation (OK) |

**ChatThread** is correctly scoped to a specific conversation — it should stay local.
**NotificationBell** and **Header's inbox-unread** should be consolidated into a layout-level provider.

### 2.2 Create `NotificationProvider.tsx`

**File:** `src/lib/context/NotificationProvider.tsx` (NEW FILE)

```tsx
"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

interface NotificationContextType {
    unreadNotifications: number;
    unreadMessages: number;
    /** Call after marking notifications as read to decrement the counter */
    refreshNotificationCount: () => Promise<void>;
    /** Call after reading inbox to reset message count */
    refreshMessageCount: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
    unreadNotifications: 0,
    unreadMessages: 0,
    refreshNotificationCount: async () => {},
    refreshMessageCount: async () => {},
});

export function useNotifications() {
    return useContext(NotificationContext);
}

export function NotificationProvider({
    children,
    initialUnreadNotifications = 0,
    initialUnreadMessages = 0,
}: {
    children: ReactNode;
    initialUnreadNotifications?: number;
    initialUnreadMessages?: number;
}) {
    const [unreadNotifications, setUnreadNotifications] = useState(initialUnreadNotifications);
    const [unreadMessages, setUnreadMessages] = useState(initialUnreadMessages);
    const supabase = createClient();

    const fetchNotificationCount = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { count } = await supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("is_read", false);
        setUnreadNotifications(count ?? 0);
    }, [supabase]);

    const fetchMessageCount = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get conversation IDs first, then count unread messages
        const { data: convos } = await supabase
            .from("conversations")
            .select("id")
            .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`);

        if (!convos || convos.length === 0) {
            setUnreadMessages(0);
            return;
        }

        const convoIds = convos.map(c => c.id);
        const { count } = await supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .neq("sender_id", user.id)
            .eq("is_read", false)
            .in("conversation_id", convoIds);

        setUnreadMessages(count ?? 0);
    }, [supabase]);

    useEffect(() => {
        let cleanup: (() => void) | null = null;

        const setup = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Single channel for notification INSERTs/UPDATEs
            const notifChannel = supabase
                .channel(`global-notifications-${user.id}`)
                .on(
                    "postgres_changes",
                    { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
                    () => setUnreadNotifications(prev => prev + 1)
                )
                .on(
                    "postgres_changes",
                    { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
                    (payload) => {
                        if (payload.new && (payload.new as { is_read: boolean }).is_read) {
                            fetchNotificationCount(); // Re-fetch exact count after mark-read
                        }
                    }
                )
                .subscribe();

            // Single channel for incoming messages
            const msgChannel = supabase
                .channel(`global-inbox-${user.id}`)
                .on(
                    "postgres_changes",
                    { event: "INSERT", schema: "public", table: "messages" },
                    (payload) => {
                        const msg = payload.new as { sender_id: string };
                        if (msg.sender_id !== user.id) {
                            setUnreadMessages(prev => prev + 1);
                        }
                    }
                )
                .subscribe();

            // Visibility-based refresh (catches reads from other tabs)
            const handleVisibility = () => {
                if (document.visibilityState === "visible") {
                    fetchNotificationCount();
                    fetchMessageCount();
                }
            };
            document.addEventListener("visibilitychange", handleVisibility);

            cleanup = () => {
                supabase.removeChannel(notifChannel);
                supabase.removeChannel(msgChannel);
                document.removeEventListener("visibilitychange", handleVisibility);
            };
        };

        setup();
        return () => cleanup?.();
    }, [supabase, fetchNotificationCount, fetchMessageCount]);

    return (
        <NotificationContext.Provider
            value={{
                unreadNotifications,
                unreadMessages,
                refreshNotificationCount: fetchNotificationCount,
                refreshMessageCount: fetchMessageCount,
            }}
        >
            {children}
        </NotificationContext.Provider>
    );
}
```

### 2.3 Wire `NotificationProvider` into the root layout

**File:** `src/app/layout.tsx`

Wrap `<Header>` and children with `NotificationProvider`:

```tsx
// Add import:
import { NotificationProvider } from "@/lib/context/NotificationProvider";

// Inside <body>:
<SerwistProvider swUrl="/serwist/sw.js">
    <SimpleModeProvider>
        <ToastProvider>
            <NotificationProvider>
                <Header />
                <main>{children}</main>
                <Footer />
                <BackToTop />
                <CookieConsent />
                <OfflineIndicator />
            </NotificationProvider>
        </ToastProvider>
    </SimpleModeProvider>
</SerwistProvider>
```

### Validation Checklist
- [ ] `NotificationProvider.tsx` exists in `src/lib/context/`
- [ ] Provider is wrapped around `<Header>` and children in `layout.tsx`
- [ ] Only 2 Realtime channels are created globally (not per-component)

---

## Task 3: Refactor NotificationBell to Use the Provider

**File:** `src/components/NotificationBell.tsx`

### 3.1 Strip the local Realtime subscription

Remove the entire `useEffect` (lines 26-88) and the `fetchCount` callback (lines 11-24). Replace with the global hook.

**Target state:**
```tsx
"use client";

import Link from "next/link";
import { useNotifications } from "@/lib/context/NotificationProvider";

export default function NotificationBell() {
    const { unreadNotifications } = useNotifications();

    return (
        <Link
            href="/notifications"
            className="relative flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium whitespace-nowrap text-[var(--color-text-secondary)] no-underline transition-all"
            id="nav-notifications"
            title="Notifications"
        >
            <svg ...> {/* keep existing SVG */} </svg>
            {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1.5 h-4 min-w-[16px] animate-[notification-pop_0.3s_ease-out] rounded-lg bg-[#ef4444] px-1 text-center text-[10px] leading-4 font-bold text-white">
                    {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
            )}
        </Link>
    );
}
```

**What this eliminates:**
- `createClient()` call (line 9)
- `fetchCount` + `getUser()` callback (lines 11-24)  
- Full Realtime `channel('notifications-{userId}')` subscription (lines 36-67)
- `visibilitychange` listener (lines 70-79)

All of these now live in `NotificationProvider`.

### Validation Checklist
- [ ] `NotificationBell.tsx` no longer calls `createClient()`
- [ ] No `useEffect` in `NotificationBell` — it's a pure render component
- [ ] Unread badge still updates in real-time

---

## Task 4: Refactor Header to Use the Provider

**File:** `src/components/Header.tsx`

### 4.1 Remove the inbox-unread Realtime channel

Remove the second `useEffect` (lines 141-176) that creates the `inbox-unread` channel. Replace the local `unreadCount` state with the provider.

**Changes:**
1. Remove `const [unreadCount, setUnreadCount] = useState(0);` (line 75)
2. Import and use `useNotifications`:
   ```tsx
   import { useNotifications } from "@/lib/context/NotificationProvider";
   // Inside component:
   const { unreadMessages } = useNotifications();
   ```
3. Replace all `unreadCount` references with `unreadMessages`
4. Remove the entire `useEffect` block (lines 141-176) that creates `inbox-unread` channel
5. In `fetchHeaderInfo` (line 98), remove `setUnreadCount(data.unreadCount)` — the provider handles this now

### 4.2 Remove `getHeaderData()` unread count

**File:** `src/app/actions/header.ts`

Check if `getHeaderData()` queries unread counts. If it does, remove those queries — the client-side provider now handles unread tracking via Realtime.

> **Important:** Keep the remaining `getHeaderData()` fields (aliasName, avatarUrl, isAdmin, artistStudioSlug) — those are still needed for header UI.

### Validation Checklist
- [ ] Header no longer creates `inbox-unread` Realtime channel
- [ ] `unreadMessages` from provider is used for inbox badge
- [ ] Hamburger menu badge uses `unreadMessages` (currently line 296)
- [ ] Desktop inbox icon badge uses `unreadMessages` (currently line 412-414)
- [ ] No duplicate `getUser()` calls in Header

---

## Task 5: Verify ChatThread is Properly Scoped

**File:** `src/components/ChatThread.tsx`

### 5.1 Audit the existing pattern

ChatThread creates a `chat-{conversationId}` channel for per-conversation message streaming. This is **correctly scoped** and should NOT be consolidated — it only subscribes when a user is viewing a specific conversation.

**Verify:**
- [ ] Channel includes `conversationId` in the name (prevents duplicates)
- [ ] `useEffect` cleanup calls `supabase.removeChannel(channel)`
- [ ] Channel unsubscribes when component unmounts (navigating away from conversation)

### 5.2 Fix if cleanup is missing

If the cleanup function is missing or incomplete:
```tsx
useEffect(() => {
    const channel = supabase
        .channel(`chat-${conversationId}`)
        .on("postgres_changes", { ... }, callback)
        .subscribe();

    return () => {
        supabase.removeChannel(channel);  // ← MUST exist
    };
}, [conversationId, supabase]);
```

### Validation Checklist
- [ ] ChatThread channel is properly scoped to `conversationId`
- [ ] Cleanup function calls `removeChannel`
- [ ] No global channel creation in ChatThread

---

## Task 6: Eliminate Redundant `getUser()` Calls

### 6.1 Audit current call pattern

| Component | `getUser()` calls | Redundancy |
|-----------|-------------------|------------|
| `Header.tsx:108-109` | 1x in `initAuth` | Needed for auth state |
| `Header.tsx:141-142` | Implicit via `user` state check | OK (guarded) |
| `NotificationBell.tsx:13-15` | 1x in `fetchCount` | **ELIMINATED** (Task 3) |
| `NotificationBell.tsx:33` | 1x in `setupRealtime` | **ELIMINATED** (Task 3) |
| `NotificationProvider` | 1x in `setup` | Replaces 2x from NotificationBell |

**Net result:** 4 `getUser()` calls reduced to 2.

### 6.2 Add `revalidateOnFocus: false` pattern

For any remaining focus-based re-fetches, ensure they use a debounce or cooldown to prevent rapid re-fetching:

```tsx
// In NotificationProvider:
const lastFetchRef = useRef<number>(0);
const handleVisibility = () => {
    if (document.visibilityState === "visible") {
        const now = Date.now();
        if (now - lastFetchRef.current > 30_000) { // 30s cooldown
            lastFetchRef.current = now;
            fetchNotificationCount();
            fetchMessageCount();
        }
    }
};
```

### Validation Checklist
- [ ] `getUser()` is called max 2x on page load (Header + NotificationProvider)
- [ ] Visibility handler has 30s cooldown
- [ ] No polling loops remain

---

## 🛑 HUMAN VERIFICATION GATE 🛑

**Stop execution. Verify:**

1. Open Chrome DevTools → Network tab → filter by `realtime`
2. Navigate between pages (Dashboard → Shows → Feed → Dashboard)
3. **Expected:** Only 1-2 WebSocket connections remain stable across navigations
4. **Before fix:** Each navigation created new WebSocket connections
5. Check Supabase Dashboard → Realtime → Active connections — should show 2 per user (notifications + inbox)

Await human input: "Phase 075 Verified. Proceed."

---

## Build Gate

Run `npx next build` (via `cmd /c "npx next build 2>&1"`) and confirm 0 errors before marking complete.
