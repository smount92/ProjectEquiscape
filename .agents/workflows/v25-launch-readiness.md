---
description: "V25 Launch Readiness Sprint — WebSocket black hole fix, Art Studio missing link, expired transfer auto-unpark, expert-judged shows, community moderation flagging. 5 directives."
---

# V25 Launch Readiness Sprint

> **Philosophy:** Ship-ready means no silent failures. Every edge case handled.
> **Estimated effort:** 6–8 hours across 5 tasks.
> **Pre-requisite:** V24 complete. Build passing. Migration 063 deployed.

---

## Task 1: The WebSocket Black Hole

**Goal:** The `NotificationBell` opens a Supabase Realtime WebSocket channel for every mounted instance. On Vercel serverless, this is a connection pool black hole — each page navigation creates a new channel that may never cleanly close. Replace with 60-second polling. Keep Realtime only in `ChatThread` where it's scoped to a single active conversation.

**Files to modify:**
- `src/components/NotificationBell.tsx` (87 lines total — full rewrite of useEffect)

### Step 1.1 — Rewrite to polling

Replace the entire `useEffect` block (lines 26–58) with interval polling:

```typescript
    useEffect(() => {
        fetchCount();

        // Poll every 60 seconds instead of Realtime WebSocket
        const interval = setInterval(fetchCount, 60_000);
        return () => clearInterval(interval);
    }, [fetchCount]);
```

This removes:
- The `supabase.channel("notifications-bell")` creation
- The `.on("postgres_changes", ...)` listener
- The `.subscribe()` call
- The cleanup `supabase.removeChannel(channel)`
- The async IIFE inside useEffect

### Step 1.2 — Verify

```bash
npx next build
```

Expected: 0 errors. NotificationBell refreshes count every 60s via polling. No Realtime connection opened.

---

## Task 2: The Art Studio "Missing Link"

**Goal:** The commission system has no way for a client to say "I'm sending you THIS model to paint." And if the artist creates a commissioned horse from scratch, there's no way to link it before delivery — breaking the WIP-to-Hoofprint pipeline. Fix both sides.

**Files to modify:**
- `src/components/CommissionRequestForm.tsx` — add horse picker for client
- `src/app/actions/art-studio.ts` — `createCommission()` (line 353) — accept `horseId`
- `src/app/studio/commission/[id]/page.tsx` — add "Link Horse" UI for artist

### Step 2.1 — Add `horseId` to `createCommission()`

Open `src/app/actions/art-studio.ts`. Update the function signature (line 354):

```typescript
export async function createCommission(data: {
    artistId: string;
    commissionType: string;
    description: string;
    referenceImages?: string[];
    budget?: number;
    horseId?: string;           // ← ADD: client's send-in model
}): Promise<{ success: boolean; commissionId?: string; error?: string }> {
```

In the `.insert()` call (around line 385), add:
```typescript
            horse_id: data.horseId || null,
```

### Step 2.2 — Add horse picker to CommissionRequestForm

Open `src/components/CommissionRequestForm.tsx`. Add imports and state:

```typescript
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
```

Add state for horse selection:
```typescript
    const [horses, setHorses] = useState<{ id: string; name: string }[]>([]);
    const [selectedHorseId, setSelectedHorseId] = useState<string>("");
```

Add a useEffect to load the user's stable:
```typescript
    useEffect(() => {
        const supabase = createClient();
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase
                .from("user_horses")
                .select("id, custom_name")
                .eq("owner_id", user.id)
                .order("custom_name")
                .limit(200);
            if (data) {
                setHorses((data as { id: string; custom_name: string }[]).map(h => ({
                    id: h.id,
                    name: h.custom_name,
                })));
            }
        })();
    }, []);
```

Add a form group before the Description field (after the Commission Type select):
```tsx
            <div className="form-group">
                <label className="form-label">Link a Horse (optional)</label>
                <select
                    className="form-input"
                    value={selectedHorseId}
                    onChange={e => setSelectedHorseId(e.target.value)}
                >
                    <option value="">No horse — artist will create or I'll send one later</option>
                    {horses.map(h => (
                        <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                </select>
                <span className="form-hint">
                    Select the model you're sending in for this commission.
                </span>
            </div>
```

Update the `handleSubmit` call to pass the horse:
```typescript
        const result = await createCommission({
            artistId: artist.userId,
            commissionType,
            description: description.trim(),
            budget: budget ? parseFloat(budget) : undefined,
            horseId: selectedHorseId || undefined,
        });
```

### Step 2.3 — Add "Link Horse" UI for artist on commission detail page

Open `src/app/studio/commission/[id]/page.tsx`. This is a server component.

Create a new client component `src/components/LinkHorseToCommission.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LinkHorseToCommission({
    commissionId,
}: {
    commissionId: string;
}) {
    const [horses, setHorses] = useState<{ id: string; name: string }[]>([]);
    const [selectedHorseId, setSelectedHorseId] = useState("");
    const [saving, setSaving] = useState(false);
    const [done, setDone] = useState(false);

    useEffect(() => {
        const supabase = createClient();
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase
                .from("user_horses")
                .select("id, custom_name")
                .eq("owner_id", user.id)
                .order("custom_name")
                .limit(200);
            if (data) {
                setHorses((data as { id: string; custom_name: string }[]).map(h => ({
                    id: h.id,
                    name: h.custom_name,
                })));
            }
        })();
    }, []);

    const handleLink = async () => {
        if (!selectedHorseId) return;
        setSaving(true);
        const { linkHorseToCommission } = await import("@/app/actions/art-studio");
        const result = await linkHorseToCommission(commissionId, selectedHorseId);
        if (result.success) {
            setDone(true);
        }
        setSaving(false);
    };

    if (done) {
        return (
            <div className="getting-started-tip" style={{ marginBottom: "var(--space-lg)" }}>
                ✅ Horse linked! WIP photos will appear on its Hoofprint™ upon delivery.
            </div>
        );
    }

    return (
        <div className="card" style={{ padding: "var(--space-lg)", marginBottom: "var(--space-lg)" }}>
            <h3 style={{ marginBottom: "var(--space-sm)" }}>🔗 Link a Horse from Your Stable</h3>
            <p style={{ fontSize: "calc(var(--font-size-sm) * var(--font-scale))", color: "var(--color-text-muted)", marginBottom: "var(--space-md)" }}>
                Link a horse so WIP photos are added to its Hoofprint™ when this commission is delivered.
            </p>
            <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center" }}>
                <select
                    className="form-input"
                    value={selectedHorseId}
                    onChange={e => setSelectedHorseId(e.target.value)}
                    style={{ flex: 1 }}
                >
                    <option value="">Select a horse…</option>
                    {horses.map(h => (
                        <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                </select>
                <button
                    className="btn btn-primary btn-sm"
                    onClick={handleLink}
                    disabled={!selectedHorseId || saving}
                >
                    {saving ? "…" : "Link"}
                </button>
            </div>
        </div>
    );
}
```

### Step 2.4 — Create `linkHorseToCommission` server action

In `src/app/actions/art-studio.ts`, add a new function:

```typescript
/** Artist links a horse to a commission (for WIP→Hoofprint pipeline) */
export async function linkHorseToCommission(
    commissionId: string,
    horseId: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    // Verify user is the artist on this commission
    const { data: commission } = await supabase
        .from("commissions")
        .select("artist_id")
        .eq("id", commissionId)
        .single();

    if (!commission || (commission as { artist_id: string }).artist_id !== user.id) {
        return { success: false, error: "Only the artist can link a horse." };
    }

    const { error } = await supabase
        .from("commissions")
        .update({ horse_id: horseId })
        .eq("id", commissionId);

    if (error) return { success: false, error: error.message };

    revalidatePath(`/studio/commission/${commissionId}`);
    return { success: true };
}
```

### Step 2.5 — Render LinkHorse on commission detail

In `src/app/studio/commission/[id]/page.tsx`, import and render the component when `horse_id` is null AND the current user is the artist:

```typescript
import LinkHorseToCommission from "@/components/LinkHorseToCommission";
```

In the render section (after the status badge area), add:
```tsx
{!commission.horseId && isArtist && (
    <LinkHorseToCommission commissionId={commission.id} />
)}
```

You'll need to determine `isArtist` by comparing `commission.artistId === user.id` from the auth fetch already in this page.

### Step 2.6 — Verify

```bash
npx next build
```

Expected: 0 errors. Commission request form shows horse picker. Commission detail page shows "Link Horse" block for artist when no horse linked.

---

## Task 3: Expired Transfer Auto-Unpark

**Goal:** When a parked horse's PIN expires, the horse stays in `life_stage = 'parked'` forever — a zombie. The `getParkedHorseByPin()` TypeScript function and the `claim_parked_horse_atomic` RPC both check expiration but only expire the transfer row, not the horse. Fix both to also revert `life_stage` and create a system post.

**Files to modify:**
- `src/app/actions/parked-export.ts` — `getParkedHorseByPin()` (line ~195)
- NEW migration: `supabase/migrations/064_expired_transfer_unpark.sql`

### Step 3.1 — Fix `getParkedHorseByPin()` 

In `src/app/actions/parked-export.ts`, find the expiration check (around line 195):

**FROM:**
```typescript
        if (new Date(t.expires_at) < new Date()) {
            await admin.from("horse_transfers").update({ status: "expired" }).eq("id", t.id);
            return { success: false, error: "This claim PIN has expired." };
        }
```

**TO:**
```typescript
        if (new Date(t.expires_at) < new Date()) {
            // Expire the transfer AND revert the horse
            await admin.from("horse_transfers").update({ status: "expired" }).eq("id", t.id);
            await admin.from("user_horses").update({ life_stage: "completed" }).eq("id", t.horse_id);

            // System note about expired transfer
            try {
                await admin.from("posts").insert({
                    author_id: t.sender_id,
                    horse_id: t.horse_id,
                    content: "⏰ Parked transfer expired. Horse has been automatically unparked and returned to your stable.",
                });
            } catch { /* best effort */ }

            return { success: false, error: "This claim PIN has expired." };
        }
```

### Step 3.2 — Fix `claim_parked_horse_atomic` RPC

Create `supabase/migrations/064_expired_transfer_unpark.sql`:

```sql
-- ============================================================
-- Migration 064: Expired Transfer Auto-Unpark
-- When a parked horse PIN expires, revert life_stage
-- ============================================================

CREATE OR REPLACE FUNCTION claim_parked_horse_atomic(p_pin TEXT, p_claimant_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_transfer RECORD; v_horse RECORD; v_sender_alias TEXT; v_receiver_alias TEXT; v_thumb TEXT;
BEGIN
    SELECT * INTO v_transfer FROM horse_transfers
    WHERE claim_pin = upper(trim(p_pin)) AND status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid PIN.');
    END IF;

    IF v_transfer.expires_at < now() THEN
        -- Expire transfer AND revert horse life_stage
        UPDATE horse_transfers SET status = 'expired' WHERE id = v_transfer.id;
        UPDATE user_horses SET life_stage = 'completed' WHERE id = v_transfer.horse_id;

        -- System note
        INSERT INTO posts (author_id, horse_id, content)
        VALUES (v_transfer.sender_id, v_transfer.horse_id,
                '⏰ Parked transfer expired. Horse automatically unparked.');

        RETURN jsonb_build_object('success', false, 'error', 'Expired PIN.');
    END IF;

    IF v_transfer.sender_id = p_claimant_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot claim your own horse.');
    END IF;

    SELECT * INTO v_horse FROM user_horses WHERE id = v_transfer.horse_id;
    SELECT alias_name INTO v_sender_alias FROM users WHERE id = v_transfer.sender_id;
    SELECT alias_name INTO v_receiver_alias FROM users WHERE id = p_claimant_id;
    SELECT image_url INTO v_thumb FROM horse_images
        WHERE horse_id = v_transfer.horse_id AND angle_profile = 'Primary_Thumbnail' LIMIT 1;

    UPDATE horse_ownership_history
    SET released_at = now(), horse_name = v_horse.custom_name, horse_thumbnail = v_thumb
    WHERE horse_id = v_transfer.horse_id AND owner_id = v_transfer.sender_id AND released_at IS NULL;

    INSERT INTO horse_ownership_history (horse_id, owner_id, owner_alias, acquisition_type, sale_price, is_price_public, notes)
    VALUES (v_transfer.horse_id, p_claimant_id, v_receiver_alias, v_transfer.acquisition_type, v_transfer.sale_price, v_transfer.is_price_public, 'Claimed via CoA PIN');

    UPDATE user_horses SET owner_id = p_claimant_id, collection_id = NULL, life_stage = 'completed'
    WHERE id = v_transfer.horse_id;

    UPDATE horse_transfers SET status = 'claimed', claimed_by = p_claimant_id, claimed_at = now()
    WHERE id = v_transfer.id;

    UPDATE financial_vault SET purchase_price = NULL, estimated_current_value = NULL, insurance_notes = NULL, purchase_date = NULL
    WHERE horse_id = v_transfer.horse_id;

    RETURN jsonb_build_object(
        'success', true,
        'horse_id', v_transfer.horse_id,
        'horse_name', v_horse.custom_name,
        'sender_id', v_transfer.sender_id,
        'sender_alias', v_sender_alias,
        'receiver_alias', v_receiver_alias,
        'sale_price', v_transfer.sale_price
    );
END;
$$;
```

### Step 3.3 — Verify

```bash
npx next build
```

Expected: 0 errors. Expired PINs now revert `life_stage` and leave a post.

---

## Task 4: Expert-Judged Shows

**Goal:** Currently all shows use community voting. For live shows and NAMHSA events, a verified judge should be able to manually assign placings instead of tallying votes. Add a `judging_method` column and build the UI to support both modes.

**Files to modify:**
- NEW migration: `supabase/migrations/065_expert_judged_shows.sql`
- `src/app/community/events/create/page.tsx` — add judging method toggle
- `src/app/actions/events.ts` — `createEvent()` — accept `judgingMethod`
- `src/app/community/events/[id]/page.tsx` — conditionally hide vote buttons or show placing UI
- NEW component: `src/components/AssignPlacings.tsx`

### Step 4.1 — Create migration

Create `supabase/migrations/065_expert_judged_shows.sql`:

```sql
-- ============================================================
-- Migration 065: Expert-Judged Shows
-- Shows can use community voting or expert judge placings
-- ============================================================

ALTER TABLE events
    ADD COLUMN IF NOT EXISTS judging_method TEXT DEFAULT 'community_vote'
    CHECK (judging_method IN ('community_vote', 'expert_judge'));
```

### Step 4.2 — Update `createEvent()` to accept `judgingMethod`

Open `src/app/actions/events.ts`. Find `createEvent()`. Add `judgingMethod?: string` to the parameters and include it in the insert:

```typescript
    judgingMethod?: "community_vote" | "expert_judge";
```

In the `.insert()` call:
```typescript
        judging_method: data.judgingMethod || "community_vote",
```

### Step 4.3 — Add toggle to Create Event form

Open `src/app/community/events/create/page.tsx`. Add state:

```typescript
    const [judgingMethod, setJudgingMethod] = useState<"community_vote" | "expert_judge">("community_vote");
```

Add a form group after the Event Type dropdown (around line 73):

```tsx
            <div className="form-group">
                <label className="form-label">Judging Method</label>
                <div style={{ display: "flex", gap: "var(--space-md)" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)", cursor: "pointer" }}>
                        <input
                            type="radio"
                            name="judgingMethod"
                            value="community_vote"
                            checked={judgingMethod === "community_vote"}
                            onChange={() => setJudgingMethod("community_vote")}
                        />
                        🗳️ Community Vote
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)", cursor: "pointer" }}>
                        <input
                            type="radio"
                            name="judgingMethod"
                            value="expert_judge"
                            checked={judgingMethod === "expert_judge"}
                            onChange={() => setJudgingMethod("expert_judge")}
                        />
                        🏅 Expert Judge
                    </label>
                </div>
                <span className="form-hint">
                    {judgingMethod === "community_vote"
                        ? "Attendees can vote on entries."
                        : "Only the event creator (or assigned judge) can assign placings."}
                </span>
            </div>
```

Pass `judgingMethod` in the `createEvent()` call:
```typescript
            judgingMethod,
```

### Step 4.4 — Create `AssignPlacings` component

Create `src/components/AssignPlacings.tsx`:

```typescript
"use client";

import { useState } from "react";

interface Entry {
    id: string;
    horseName: string;
    ownerAlias: string;
    placing?: string;
}

export default function AssignPlacings({
    entries,
    onSave,
}: {
    entries: Entry[];
    onSave: (placings: { entryId: string; placing: string }[]) => Promise<void>;
}) {
    const [placings, setPlacings] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        const data = Object.entries(placings)
            .filter(([, v]) => v)
            .map(([entryId, placing]) => ({ entryId, placing }));
        await onSave(data);
        setSaving(false);
    };

    return (
        <div className="card" style={{ padding: "var(--space-lg)" }}>
            <h3 style={{ marginBottom: "var(--space-md)" }}>🏅 Assign Placings</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                {entries.map(entry => (
                    <div key={entry.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                        <span style={{ flex: 1 }}>
                            <strong>{entry.horseName}</strong>
                            <span style={{ color: "var(--color-text-muted)", marginLeft: "var(--space-xs)" }}>
                                by {entry.ownerAlias}
                            </span>
                        </span>
                        <select
                            className="form-input"
                            style={{ width: 120 }}
                            value={placings[entry.id] || ""}
                            onChange={e => setPlacings(prev => ({ ...prev, [entry.id]: e.target.value }))}
                        >
                            <option value="">—</option>
                            <option value="1st">🥇 1st</option>
                            <option value="2nd">🥈 2nd</option>
                            <option value="3rd">🥉 3rd</option>
                            <option value="HM">HM</option>
                            <option value="Reserve">Reserve</option>
                        </select>
                    </div>
                ))}
            </div>
            <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving}
                style={{ marginTop: "var(--space-lg)", width: "100%" }}
            >
                {saving ? "Saving…" : "💾 Save Placings"}
            </button>
        </div>
    );
}
```

### Step 4.5 — Conditionally hide vote buttons

In the event detail page (`src/app/community/events/[id]/page.tsx`), fetch the `judging_method` column from the event query. Then:

1. If `judging_method === "expert_judge"`, do NOT render any `VoteButton` or voting UI for regular users
2. If `judging_method === "expert_judge"` AND `user.id === event.created_by`, render `<AssignPlacings />` instead
3. If `judging_method === "community_vote"` (default), keep current behavior

### Step 4.6 — Verify

```bash
npx next build
```

---

## Task 5: Community Moderation (Flagging)

**Goal:** Users need a way to report inappropriate content. Admins need a moderation queue. Without this, the platform has no content moderation before launch.

**Files to modify:**
- NEW migration: `supabase/migrations/066_user_reports.sql`
- NEW server action: `src/app/actions/moderation.ts`
- NEW component: `src/components/ReportButton.tsx`
- `src/app/admin/page.tsx` — add reports section

### Step 5.1 — Create migration

Create `supabase/migrations/066_user_reports.sql`:

```sql
-- ============================================================
-- Migration 066: Community Moderation — User Reports
-- ============================================================

CREATE TABLE IF NOT EXISTS user_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reporter_id UUID NOT NULL REFERENCES auth.users(id),
    target_type TEXT NOT NULL CHECK (target_type IN ('post', 'horse', 'user', 'comment', 'message')),
    target_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    details TEXT,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'dismissed', 'actioned')),
    admin_notes TEXT,
    resolved_by UUID REFERENCES auth.users(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: reporters can see their own reports, admins see all
ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert reports"
    ON user_reports FOR INSERT TO authenticated
    WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "Users can see own reports"
    ON user_reports FOR SELECT TO authenticated
    USING (reporter_id = auth.uid());

-- Index for admin dashboard
CREATE INDEX idx_user_reports_status ON user_reports (status, created_at DESC);
CREATE INDEX idx_user_reports_target ON user_reports (target_type, target_id);

-- Prevent duplicate reports from same user on same target
CREATE UNIQUE INDEX idx_user_reports_unique
    ON user_reports (reporter_id, target_type, target_id)
    WHERE status = 'open';
```

### Step 5.2 — Create `moderation.ts` server action

Create `src/app/actions/moderation.ts`:

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { checkRateLimit } from "@/lib/utils/rateLimit";

// ============================================================
// COMMUNITY MODERATION — Server Actions
// ============================================================

const REPORT_REASONS = [
    "Spam or scam",
    "Harassment or bullying",
    "Inappropriate content",
    "Fake listing or misrepresentation",
    "Copyright violation",
    "Other",
] as const;

export { REPORT_REASONS };

export interface Report {
    id: string;
    reporterId: string;
    reporterAlias: string;
    targetType: string;
    targetId: string;
    reason: string;
    details: string | null;
    status: string;
    adminNotes: string | null;
    createdAt: string;
}

/** Submit a report (rate-limited: 10/hour) */
export async function submitReport(data: {
    targetType: "post" | "horse" | "user" | "comment" | "message";
    targetId: string;
    reason: string;
    details?: string;
}): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    // Rate limit
    const rl = await checkRateLimit(`report:${user.id}`, 10, 3600);
    if (!rl.allowed) return { success: false, error: "Too many reports. Please try again later." };

    // Can't report yourself
    if (data.targetType === "user" && data.targetId === user.id) {
        return { success: false, error: "You cannot report yourself." };
    }

    const { error } = await supabase.from("user_reports").insert({
        reporter_id: user.id,
        target_type: data.targetType,
        target_id: data.targetId,
        reason: data.reason,
        details: data.details?.trim() || null,
    });

    if (error) {
        if (error.code === "23505") return { success: false, error: "You've already reported this." };
        return { success: false, error: error.message };
    }

    return { success: true };
}

/** Admin: get open reports */
export async function getOpenReports(): Promise<Report[]> {
    const admin = getAdminClient();

    const { data } = await admin
        .from("user_reports")
        .select("*, users!user_reports_reporter_id_fkey(alias_name)")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(50);

    if (!data || data.length === 0) return [];

    return (data as Record<string, unknown>[]).map(r => ({
        id: r.id as string,
        reporterId: r.reporter_id as string,
        reporterAlias: (r as { users?: { alias_name: string } | null }).users?.alias_name || "Unknown",
        targetType: r.target_type as string,
        targetId: r.target_id as string,
        reason: r.reason as string,
        details: r.details as string | null,
        status: r.status as string,
        adminNotes: r.admin_notes as string | null,
        createdAt: r.created_at as string,
    }));
}

/** Admin: dismiss a report */
export async function dismissReport(
    reportId: string,
    notes?: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    const admin = getAdminClient();
    const { error } = await admin
        .from("user_reports")
        .update({
            status: "dismissed",
            admin_notes: notes || "Dismissed — no action needed.",
            resolved_by: user.id,
            resolved_at: new Date().toISOString(),
        })
        .eq("id", reportId);

    if (error) return { success: false, error: error.message };
    revalidatePath("/admin");
    return { success: true };
}

/** Admin: action a report (mark as handled) */
export async function actionReport(
    reportId: string,
    notes: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    const admin = getAdminClient();
    const { error } = await admin
        .from("user_reports")
        .update({
            status: "actioned",
            admin_notes: notes,
            resolved_by: user.id,
            resolved_at: new Date().toISOString(),
        })
        .eq("id", reportId);

    if (error) return { success: false, error: error.message };
    revalidatePath("/admin");
    return { success: true };
}
```

### Step 5.3 — Create `ReportButton` component

Create `src/components/ReportButton.tsx`:

```typescript
"use client";

import { useState } from "react";
import { submitReport, REPORT_REASONS } from "@/app/actions/moderation";

export default function ReportButton({
    targetType,
    targetId,
}: {
    targetType: "post" | "horse" | "user" | "comment" | "message";
    targetId: string;
}) {
    const [showForm, setShowForm] = useState(false);
    const [reason, setReason] = useState("");
    const [details, setDetails] = useState("");
    const [saving, setSaving] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async () => {
        if (!reason) return;
        setSaving(true);
        setError("");
        const result = await submitReport({
            targetType,
            targetId,
            reason,
            details: details.trim() || undefined,
        });
        if (result.success) {
            setDone(true);
        } else {
            setError(result.error || "Failed to submit report.");
        }
        setSaving(false);
    };

    if (done) {
        return (
            <span style={{ fontSize: "calc(var(--font-size-xs) * var(--font-scale))", color: "var(--color-text-muted)" }}>
                ✅ Reported
            </span>
        );
    }

    if (!showForm) {
        return (
            <button
                className="btn-ghost"
                onClick={() => setShowForm(true)}
                style={{
                    fontSize: "calc(var(--font-size-xs) * var(--font-scale))",
                    color: "var(--color-text-muted)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "var(--space-xs)",
                }}
                title="Report"
            >
                🚩 Report
            </button>
        );
    }

    return (
        <div className="card" style={{ padding: "var(--space-md)", marginTop: "var(--space-sm)" }}>
            <select
                className="form-input"
                value={reason}
                onChange={e => setReason(e.target.value)}
                style={{ marginBottom: "var(--space-sm)", fontSize: "calc(var(--font-size-sm) * var(--font-scale))" }}
            >
                <option value="">Select a reason…</option>
                {REPORT_REASONS.map(r => (
                    <option key={r} value={r}>{r}</option>
                ))}
            </select>
            <textarea
                className="form-input"
                placeholder="Additional details (optional)"
                value={details}
                onChange={e => setDetails(e.target.value)}
                rows={2}
                maxLength={500}
                style={{ marginBottom: "var(--space-sm)", fontSize: "calc(var(--font-size-sm) * var(--font-scale))" }}
            />
            {error && <p style={{ color: "#ef4444", fontSize: "calc(var(--font-size-xs) * var(--font-scale))", marginBottom: "var(--space-xs)" }}>{error}</p>}
            <div style={{ display: "flex", gap: "var(--space-xs)" }}>
                <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={saving || !reason}>
                    {saving ? "…" : "Submit Report"}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
        </div>
    );
}
```

### Step 5.4 — Add ReportButton to UI surfaces

**Post cards:** In each post/comment rendering component, add `<ReportButton targetType="post" targetId={post.id} />` in the post footer/actions area.

**Public Passport:** In `src/app/community/[id]/page.tsx`, add `<ReportButton targetType="horse" targetId={horse.id} />` near the share button.

**Chat header:** In `src/components/ChatThread.tsx`, add `<ReportButton targetType="user" targetId={otherUserId} />` in the chat header area.

### Step 5.5 — Add reports section to admin page

Open `src/app/admin/page.tsx`. Import and fetch reports:

```typescript
import { getOpenReports } from "@/app/actions/moderation";
```

In the data fetching section:
```typescript
const reports = await getOpenReports();
```

Add a new section after the existing metrics:
```tsx
<div className="admin-section">
    <h2 className="admin-section-title">
        🚩 Open Reports
        <span className="admin-section-count">{reports.length}</span>
    </h2>
    {reports.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)" }}>No open reports. 🎉</p>
    ) : (
        reports.map(report => (
            <div key={report.id} className="admin-message" style={{ marginBottom: "var(--space-sm)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-xs)" }}>
                    <strong>{report.reason}</strong>
                    <span style={{ fontSize: "calc(var(--font-size-xs) * var(--font-scale))", color: "var(--color-text-muted)" }}>
                        {report.targetType} · {new Date(report.createdAt).toLocaleDateString()}
                    </span>
                </div>
                <p style={{ fontSize: "calc(var(--font-size-sm) * var(--font-scale))", marginBottom: "var(--space-xs)" }}>
                    Reported by: {report.reporterAlias} · Target: {report.targetId.slice(0, 8)}…
                </p>
                {report.details && (
                    <p style={{ fontSize: "calc(var(--font-size-sm) * var(--font-scale))", color: "var(--color-text-muted)" }}>
                        {report.details}
                    </p>
                )}
                {/* Admin action buttons rendered by a client component */}
            </div>
        ))
    )}
</div>
```

Create a client component `src/components/ReportActions.tsx` for the dismiss/action buttons:

```typescript
"use client";

import { useState } from "react";
import { dismissReport, actionReport } from "@/app/actions/moderation";
import { useRouter } from "next/navigation";

export default function ReportActions({ reportId }: { reportId: string }) {
    const router = useRouter();
    const [saving, setSaving] = useState(false);

    const handleDismiss = async () => {
        setSaving(true);
        await dismissReport(reportId);
        router.refresh();
    };

    const handleAction = async () => {
        const notes = prompt("Admin notes (what action was taken):");
        if (!notes) return;
        setSaving(true);
        await actionReport(reportId, notes);
        router.refresh();
    };

    return (
        <div style={{ display: "flex", gap: "var(--space-xs)", marginTop: "var(--space-xs)" }}>
            <button className="btn btn-ghost btn-sm" onClick={handleDismiss} disabled={saving}>
                ✅ Dismiss
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleAction} disabled={saving} style={{ background: "#ef4444" }}>
                ⚡ Take Action
            </button>
        </div>
    );
}
```

### Step 5.6 — Verify

```bash
npx next build
```

Expected: 0 errors. Report button appears on posts, passport, and chat. Admin page shows open reports with dismiss/action buttons.

---

## Verification Checklist

After all 5 tasks are done:

- [ ] `npx next build` — 0 errors
- [ ] Task 1: NotificationBell uses `setInterval(60s)` — no Realtime channel
- [ ] Task 2: CommissionRequestForm has horse picker dropdown
- [ ] Task 2: `createCommission()` accepts optional `horseId`
- [ ] Task 2: Commission detail shows "Link Horse" for artist when `horse_id` is null
- [ ] Task 2: `linkHorseToCommission` action exists in `art-studio.ts`
- [ ] Task 3: `getParkedHorseByPin()` reverts `life_stage` on expiry
- [ ] Task 3: Migration 064 updates `claim_parked_horse_atomic` RPC with life_stage revert
- [ ] Task 4: Migration 065 adds `judging_method` to `events`
- [ ] Task 4: Create Event form has Community Vote / Expert Judge radio toggle
- [ ] Task 4: `AssignPlacings` component exists
- [ ] Task 5: Migration 066 creates `user_reports` table with RLS
- [ ] Task 5: `submitReport()`, `getOpenReports()`, `dismissReport()`, `actionReport()` actions exist
- [ ] Task 5: `ReportButton` component exists and renders on posts, passport, chat
- [ ] Task 5: Admin page shows open reports with dismiss/action buttons

## Status Tracker

| Task | Description | Status | Date |
|------|-------------|--------|------|
| 1 | WebSocket black hole (NotificationBell polling) | ✅ DONE | 2026-03-13 |
| 2 | Art Studio missing link (horse picker + link UI) | ✅ DONE | 2026-03-13 |
| 3 | Expired transfer auto-unpark | ✅ DONE | 2026-03-13 |
| 4 | Expert-judged shows | ✅ DONE | 2026-03-13 |
| 5 | Community moderation (flagging + admin queue) | ✅ DONE | 2026-03-13 |
