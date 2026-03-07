---
description: Implement the Hoofprint™ feature — Living Model Horse Provenance. A permanent digital identity that follows a model horse through its lifecycle across owners.
---

# 🐾 Hoofprint™ — Living Model Horse Provenance

> **What is Hoofprint?** Every physical model horse gets a permanent digital identity. Its full history — who owned it, what was done to it, every photo from blank resin to finished custom — follows it from owner to owner, forever. Like a fingerprint, but for model horses.
> **Convention:** Mark items ✅ when done. Run `npm run build` after each task.

// turbo-all

## Pre-flight

Verify the current build is clean:

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

# ═══════════════════════════════════════
# PHASE 1: FOUNDATION — Database + Timeline UI
# ═══════════════════════════════════════

## Task HF-1: Database Migration

**What:** Create 3 new tables + add `life_stage` column to `user_horses`. Also a `horse_transfers` table for the transfer code system.

**IMPORTANT:** After creating this file, STOP and tell the user to run it in the Supabase SQL Editor. Wait for confirmation before proceeding.

**File:** `supabase/migrations/018_hoofprint.sql`

```sql
-- ============================================================
-- Migration 018: Hoofprint™ — Living Model Horse Provenance
-- ============================================================

-- ── 1. Life Stage on user_horses ──
ALTER TABLE user_horses
  ADD COLUMN IF NOT EXISTS life_stage TEXT DEFAULT 'completed'
  CHECK (life_stage IN ('blank', 'in_progress', 'completed', 'for_sale'));

COMMENT ON COLUMN user_horses.life_stage IS 'Current life stage of the model: blank resin, WIP, completed, or listed for sale.';

-- ── 2. Horse Timeline (The Hoofprint Log) ──
CREATE TABLE IF NOT EXISTS horse_timeline (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  horse_id      UUID NOT NULL REFERENCES user_horses(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id),
  event_type    TEXT NOT NULL CHECK (event_type IN (
    'acquired',
    'stage_update',
    'customization',
    'photo_update',
    'show_result',
    'listed',
    'sold',
    'transferred',
    'note'
  )),
  title         TEXT NOT NULL,
  description   TEXT,
  event_date    DATE DEFAULT CURRENT_DATE,
  metadata      JSONB DEFAULT '{}',
  is_public     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE horse_timeline ENABLE ROW LEVEL SECURITY;

-- Anyone can see public timeline entries on public horses
CREATE POLICY "View public timeline entries"
  ON horse_timeline FOR SELECT TO authenticated
  USING (
    is_public = true
    AND EXISTS (
      SELECT 1 FROM user_horses h WHERE h.id = horse_timeline.horse_id AND h.is_public = true
    )
  );

-- Owner can see all their own entries (including private)
CREATE POLICY "Owner views all own timeline"
  ON horse_timeline FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Owner can insert entries for their own horses
CREATE POLICY "Owner adds timeline entries"
  ON horse_timeline FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM user_horses h WHERE h.id = horse_timeline.horse_id AND h.owner_id = auth.uid()
    )
  );

-- Owner can update their own entries
CREATE POLICY "Owner updates own timeline"
  ON horse_timeline FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Owner can delete their own entries
CREATE POLICY "Owner deletes own timeline"
  ON horse_timeline FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_horse_timeline_horse ON horse_timeline (horse_id, event_date DESC, created_at DESC);
CREATE INDEX idx_horse_timeline_user ON horse_timeline (user_id);

-- ── 3. Ownership History (Chain of Custody) ──
CREATE TABLE IF NOT EXISTS horse_ownership_history (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  horse_id          UUID NOT NULL REFERENCES user_horses(id) ON DELETE CASCADE,
  owner_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_alias       TEXT NOT NULL,
  acquired_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at       TIMESTAMPTZ,
  acquisition_type  TEXT NOT NULL DEFAULT 'original' CHECK (acquisition_type IN (
    'original', 'purchase', 'trade', 'gift', 'transfer'
  )),
  sale_price        DECIMAL(10,2),
  is_price_public   BOOLEAN DEFAULT false,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE horse_ownership_history ENABLE ROW LEVEL SECURITY;

-- Anyone can view ownership history on public horses
CREATE POLICY "View ownership history on public horses"
  ON horse_ownership_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_horses h WHERE h.id = horse_ownership_history.horse_id AND h.is_public = true
    )
  );

-- Owner can view on private horses
CREATE POLICY "Owner views own ownership history"
  ON horse_ownership_history FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);

-- Insert handled by service role during transfers (no direct user insert policy needed)

CREATE INDEX idx_ownership_history_horse ON horse_ownership_history (horse_id, acquired_at);
CREATE INDEX idx_ownership_history_owner ON horse_ownership_history (owner_id);

-- ── 4. Photo Stages ──
CREATE TABLE IF NOT EXISTS horse_photo_stages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  horse_id    UUID NOT NULL REFERENCES user_horses(id) ON DELETE CASCADE,
  image_id    UUID NOT NULL REFERENCES horse_images(id) ON DELETE CASCADE,
  stage       TEXT NOT NULL CHECK (stage IN (
    'blank', 'in_progress', 'completed', 'for_sale', 'archive'
  )),
  stage_label TEXT,
  tagged_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE horse_photo_stages ENABLE ROW LEVEL SECURITY;

-- Mirrors horse visibility
CREATE POLICY "View photo stages on public horses"
  ON horse_photo_stages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_horses h WHERE h.id = horse_photo_stages.horse_id AND h.is_public = true
    )
  );

CREATE POLICY "Owner views own photo stages"
  ON horse_photo_stages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_horses h WHERE h.id = horse_photo_stages.horse_id AND h.owner_id = auth.uid()
    )
  );

CREATE POLICY "Owner manages photo stages"
  ON horse_photo_stages FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_horses h WHERE h.id = horse_photo_stages.horse_id AND h.owner_id = auth.uid()
    )
  );

CREATE POLICY "Owner deletes photo stages"
  ON horse_photo_stages FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_horses h WHERE h.id = horse_photo_stages.horse_id AND h.owner_id = auth.uid()
    )
  );

CREATE UNIQUE INDEX idx_photo_stages_unique ON horse_photo_stages (image_id);
CREATE INDEX idx_photo_stages_horse ON horse_photo_stages (horse_id, stage);

-- ── 5. Transfer Codes (Pending Transfers) ──
CREATE TABLE IF NOT EXISTS horse_transfers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  horse_id        UUID NOT NULL REFERENCES user_horses(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES auth.users(id),
  transfer_code   TEXT NOT NULL UNIQUE,
  acquisition_type TEXT NOT NULL DEFAULT 'purchase' CHECK (acquisition_type IN (
    'purchase', 'trade', 'gift', 'transfer'
  )),
  sale_price      DECIMAL(10,2),
  is_price_public BOOLEAN DEFAULT false,
  notes           TEXT,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '48 hours'),
  claimed_by      UUID REFERENCES auth.users(id),
  claimed_at      TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'expired', 'cancelled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE horse_transfers ENABLE ROW LEVEL SECURITY;

-- Sender can view their own transfers
CREATE POLICY "Sender views own transfers"
  ON horse_transfers FOR SELECT TO authenticated
  USING (auth.uid() = sender_id);

-- Anyone can look up by transfer code (needed for claiming)
CREATE POLICY "Lookup by transfer code"
  ON horse_transfers FOR SELECT TO authenticated
  USING (status = 'pending');

-- Sender can create transfers for horses they own
CREATE POLICY "Owner creates transfer"
  ON horse_transfers FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM user_horses h WHERE h.id = horse_transfers.horse_id AND h.owner_id = auth.uid()
    )
  );

-- Sender can cancel
CREATE POLICY "Sender cancels transfer"
  ON horse_transfers FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

CREATE INDEX idx_transfers_code ON horse_transfers (transfer_code) WHERE status = 'pending';
CREATE INDEX idx_transfers_sender ON horse_transfers (sender_id);
```

### Verify migration file was created:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "dir supabase\migrations\018_hoofprint.sql 2>&1"
```

**⚠️ STOP HERE** — Ask the user to run this migration in the Supabase SQL Editor. Do NOT proceed until they confirm success.

---

## Task HF-2: Hoofprint Server Actions

**What:** Create the core server actions for timeline CRUD, ownership history viewing, and the "initial Hoofprint" auto-creation when a horse is added.

**File:** `src/app/actions/hoofprint.ts` (new file)

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ============================================================
// HOOFPRINT™ — Living Model Horse Provenance Actions
// ============================================================

// ── Types ──

export interface TimelineEvent {
    id: string;
    eventType: string;
    title: string;
    description: string | null;
    eventDate: string | null;
    metadata: Record<string, unknown>;
    isPublic: boolean;
    createdAt: string;
    userAlias: string;
    userId: string;
}

export interface OwnershipRecord {
    id: string;
    ownerAlias: string;
    ownerId: string | null;
    acquiredAt: string;
    releasedAt: string | null;
    acquisitionType: string;
    salePrice: number | null;
    isPricePublic: boolean;
    notes: string | null;
}

// ── Get Timeline ──

export async function getHoofprint(horseId: string): Promise<{
    timeline: TimelineEvent[];
    ownershipChain: OwnershipRecord[];
    lifeStage: string;
}> {
    const supabase = await createClient();

    // Fetch timeline events
    const { data: rawTimeline } = await supabase
        .from("horse_timeline")
        .select("id, event_type, title, description, event_date, metadata, is_public, created_at, user_id")
        .eq("horse_id", horseId)
        .order("event_date", { ascending: false, nullsFirst: false });

    const events = (rawTimeline ?? []) as {
        id: string; event_type: string; title: string; description: string | null;
        event_date: string | null; metadata: Record<string, unknown>; is_public: boolean;
        created_at: string; user_id: string;
    }[];

    // Batch fetch user aliases
    const userIds = [...new Set(events.map(e => e.user_id))];
    const aliasMap = new Map<string, string>();
    if (userIds.length > 0) {
        const { data: users } = await supabase
            .from("users")
            .select("id, alias_name")
            .in("id", userIds);
        (users ?? []).forEach((u: { id: string; alias_name: string }) => {
            aliasMap.set(u.id, u.alias_name);
        });
    }

    const timeline: TimelineEvent[] = events.map(e => ({
        id: e.id,
        eventType: e.event_type,
        title: e.title,
        description: e.description,
        eventDate: e.event_date,
        metadata: e.metadata || {},
        isPublic: e.is_public,
        createdAt: e.created_at,
        userAlias: aliasMap.get(e.user_id) || "Unknown",
        userId: e.user_id,
    }));

    // Fetch ownership chain
    const { data: rawOwnership } = await supabase
        .from("horse_ownership_history")
        .select("id, owner_alias, owner_id, acquired_at, released_at, acquisition_type, sale_price, is_price_public, notes")
        .eq("horse_id", horseId)
        .order("acquired_at", { ascending: true });

    const ownershipChain: OwnershipRecord[] = (rawOwnership ?? []).map((o: {
        id: string; owner_alias: string; owner_id: string | null; acquired_at: string;
        released_at: string | null; acquisition_type: string; sale_price: number | null;
        is_price_public: boolean; notes: string | null;
    }) => ({
        id: o.id,
        ownerAlias: o.owner_alias,
        ownerId: o.owner_id,
        acquiredAt: o.acquired_at,
        releasedAt: o.released_at,
        acquisitionType: o.acquisition_type,
        salePrice: o.is_price_public ? o.sale_price : null,
        isPricePublic: o.is_price_public,
        notes: o.notes,
    }));

    // Fetch life stage
    const { data: horse } = await supabase
        .from("user_horses")
        .select("life_stage")
        .eq("id", horseId)
        .single();

    return {
        timeline,
        ownershipChain,
        lifeStage: (horse as { life_stage: string } | null)?.life_stage || "completed",
    };
}

// ── Add Timeline Event ──

export async function addTimelineEvent(data: {
    horseId: string;
    eventType: string;
    title: string;
    description?: string;
    eventDate?: string;
    metadata?: Record<string, unknown>;
    isPublic?: boolean;
}): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    const { error } = await supabase.from("horse_timeline").insert({
        horse_id: data.horseId,
        user_id: user.id,
        event_type: data.eventType,
        title: data.title,
        description: data.description || null,
        event_date: data.eventDate || new Date().toISOString().split("T")[0],
        metadata: data.metadata || {},
        is_public: data.isPublic ?? true,
    });

    if (error) return { success: false, error: error.message };
    revalidatePath(`/stable/${data.horseId}`);
    revalidatePath(`/community/${data.horseId}`);
    return { success: true };
}

// ── Delete Timeline Event ──

export async function deleteTimelineEvent(eventId: string, horseId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { error } = await supabase
        .from("horse_timeline")
        .delete()
        .eq("id", eventId);

    if (error) return { success: false, error: error.message };
    revalidatePath(`/stable/${horseId}`);
    revalidatePath(`/community/${horseId}`);
    return { success: true };
}

// ── Update Life Stage ──

export async function updateLifeStage(
    horseId: string,
    newStage: "blank" | "in_progress" | "completed" | "for_sale"
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    // Get current stage for timeline entry
    const { data: horse } = await supabase
        .from("user_horses")
        .select("life_stage, custom_name")
        .eq("id", horseId)
        .eq("owner_id", user.id)
        .single();

    if (!horse) return { success: false, error: "Horse not found." };
    const current = (horse as { life_stage: string }).life_stage;
    const horseName = (horse as { custom_name: string }).custom_name;

    if (current === newStage) return { success: true };

    // Update the horse
    const { error } = await supabase
        .from("user_horses")
        .update({ life_stage: newStage })
        .eq("id", horseId)
        .eq("owner_id", user.id);

    if (error) return { success: false, error: error.message };

    // Create timeline event
    const stageLabels: Record<string, string> = {
        blank: "Blank / Unpainted",
        in_progress: "Work in Progress",
        completed: "Completed",
        for_sale: "Listed for Sale",
    };

    await supabase.from("horse_timeline").insert({
        horse_id: horseId,
        user_id: user.id,
        event_type: "stage_update",
        title: `Stage: ${stageLabels[newStage] || newStage}`,
        description: `${horseName} moved from ${stageLabels[current] || current} to ${stageLabels[newStage] || newStage}.`,
        metadata: { from_stage: current, to_stage: newStage },
    });

    revalidatePath(`/stable/${horseId}`);
    revalidatePath(`/community/${horseId}`);
    return { success: true };
}

// ── Initialize Hoofprint (called when adding a horse) ──

export async function initializeHoofprint(data: {
    horseId: string;
    horseName: string;
    lifeStage?: string;
    acquisitionNotes?: string;
}): Promise<void> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get user alias
    const { data: profile } = await supabase
        .from("users")
        .select("alias_name")
        .eq("id", user.id)
        .single();
    const alias = (profile as { alias_name: string } | null)?.alias_name || "Unknown";

    // Create initial ownership record
    await supabase.from("horse_ownership_history").insert({
        horse_id: data.horseId,
        owner_id: user.id,
        owner_alias: alias,
        acquisition_type: "original",
        notes: data.acquisitionNotes || null,
    });

    // Create initial timeline event
    await supabase.from("horse_timeline").insert({
        horse_id: data.horseId,
        user_id: user.id,
        event_type: "acquired",
        title: `Added to ${alias}'s stable`,
        description: `${data.horseName} was registered on Model Horse Hub.`,
        metadata: { life_stage: data.lifeStage || "completed" },
    });
}
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task HF-3: Hoofprint Timeline Component

**What:** Create a visual timeline component that displays the Hoofprint on the horse passport page.

**File:** `src/components/HoofprintTimeline.tsx` (new file)

Build a client component that:
- Receives `timeline: TimelineEvent[]`, `ownershipChain: OwnershipRecord[]`, `lifeStage: string`, `horseId: string`, `isOwner: boolean`
- Displays a vertical timeline with event icons based on `eventType`:
  - `acquired` → 🏠
  - `stage_update` → 🎨
  - `customization` → ✂️
  - `photo_update` → 📸
  - `show_result` → 🏆
  - `listed` → 💲
  - `sold` → 🤝
  - `transferred` → 📦
  - `note` → 📝
- Each event shows: icon, title, date, description (expandable), who created it
- Shows ownership chain as a header section with owner badges
- Shows current life stage badge at the top
- If `isOwner`, shows an "Add Event" button that opens a form with:
  - Event type dropdown
  - Title (text)
  - Description (textarea, optional)
  - Date picker
  - Public/Private toggle
- If `isOwner`, shows a "Change Stage" dropdown (blank → in_progress → completed → for_sale)
- Includes delete button (🗑) on owner's own events

**CSS to add to `src/app/globals.css`:**

```css
/* ===== Hoofprint Timeline ===== */
.hoofprint-section {
    margin-top: var(--space-xl);
}

.hoofprint-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-lg);
    flex-wrap: wrap;
    gap: var(--space-md);
}

.hoofprint-title {
    font-size: calc(1.2rem * var(--font-scale));
    font-weight: 700;
}

.hoofprint-stage-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: 999px;
    font-size: calc(0.75rem * var(--font-scale));
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.stage-blank { background: rgba(156, 163, 175, 0.2); color: #9ca3af; }
.stage-in_progress { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
.stage-completed { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
.stage-for_sale { background: rgba(59, 130, 246, 0.2); color: #3b82f6; }

.ownership-chain {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex-wrap: wrap;
    margin-bottom: var(--space-lg);
    padding: var(--space-md);
    border-radius: var(--radius-lg);
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
}

.ownership-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: var(--radius-md);
    background: rgba(255, 255, 255, 0.06);
    font-size: calc(0.8rem * var(--font-scale));
    text-decoration: none;
    color: var(--color-text);
    transition: background 0.2s;
}
.ownership-link:hover { background: rgba(255, 255, 255, 0.1); }
.ownership-link.current { border: 1px solid var(--color-accent, #f59e0b); }

.ownership-arrow {
    color: var(--color-text-muted);
    font-size: 0.8rem;
}

.timeline-list {
    position: relative;
    padding-left: 32px;
}

.timeline-list::before {
    content: "";
    position: absolute;
    left: 11px;
    top: 0;
    bottom: 0;
    width: 2px;
    background: rgba(255, 255, 255, 0.08);
}

.timeline-event {
    position: relative;
    padding-bottom: var(--space-lg);
}

.timeline-event-dot {
    position: absolute;
    left: -32px;
    top: 2px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--color-bg-card, #1a1a2e);
    border: 2px solid rgba(255, 255, 255, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    z-index: 1;
}

.timeline-event-title {
    font-weight: 600;
    font-size: calc(0.9rem * var(--font-scale));
}

.timeline-event-meta {
    font-size: calc(0.75rem * var(--font-scale));
    color: var(--color-text-muted);
    margin-top: 2px;
}

.timeline-event-desc {
    font-size: calc(0.8rem * var(--font-scale));
    color: var(--color-text-muted);
    margin-top: var(--space-xs);
    line-height: 1.5;
}

.timeline-add-form {
    padding: var(--space-md);
    border-radius: var(--radius-lg);
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    margin-bottom: var(--space-lg);
}
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task HF-4: Wire Hoofprint into Horse Passport

**What:** Add the Hoofprint timeline to the private horse passport page.

**File:** `src/app/stable/[id]/page.tsx`

1. Import `getHoofprint` from `@/app/actions/hoofprint`
2. Import `HoofprintTimeline` component
3. After fetching pedigree data, call `getHoofprint(horseId)`:

```typescript
const { timeline, ownershipChain, lifeStage } = await getHoofprint(horseId);
```

4. Add the component to the JSX, AFTER the Pedigree Card and BEFORE the Financial Vault:

```tsx
{/* 🐾 Hoofprint™ Timeline */}
<HoofprintTimeline
    horseId={horseId}
    timeline={timeline}
    ownershipChain={ownershipChain}
    lifeStage={lifeStage}
    isOwner={true}
/>
```

5. Also add it to the public community passport (`src/app/community/[id]/page.tsx`), but with `isOwner={false}`:

```tsx
<HoofprintTimeline
    horseId={horseId}
    timeline={timeline}
    ownershipChain={ownershipChain}
    lifeStage={lifeStage}
    isOwner={false}
/>
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task HF-5: Initialize Hoofprint on Horse Creation

**What:** When a user adds a new horse via the add-horse form, automatically create the initial Hoofprint (ownership record + timeline event).

**File:** `src/app/add-horse/page.tsx`

Find the success handler after the horse is inserted. After the existing `notifyHorsePublic()` call, add:

```typescript
import { initializeHoofprint } from "@/app/actions/hoofprint";

// After horse is successfully created:
await initializeHoofprint({
    horseId,
    horseName: customName.trim(),
    lifeStage: "completed",  // or get from form if life stage selector exists
});
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task HF-6: Commit Phase 1

```
cd c:\Project Equispace\model-horse-hub && cmd /c "git add -A && git commit -m "feat: Hoofprint Phase 1 - timeline, ownership chain, life stages" 2>&1"
```

---

# ═══════════════════════════════════════
# PHASE 2: LIFE STAGES & PHOTO TAGGING
# ═══════════════════════════════════════

## Task HF-7: Life Stage Selector on Add/Edit Forms

**What:** Add a "Life Stage" dropdown to the add-horse form (Step 2 or 3) and the edit-horse form.

**Options to display:**
- 🎨 Blank / Unpainted
- 🔧 Work in Progress
- ✅ Completed
- 💲 For Sale

**File:** `src/app/add-horse/page.tsx`

Add a `<select>` for `lifeStage` state in the details step. Default to "completed".

**File:** `src/app/stable/[id]/edit/page.tsx`

Add `life_stage` to the fields fetched in `loadHorse()`. Add a select dropdown in the form. On save, include `life_stage` in the update query.

When life stage changes on the edit form, call `updateLifeStage()` to auto-create a timeline event.

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task HF-8: Photo Stage Tagging

**What:** When uploading photos, tag them with the current life stage. Display stage labels in the passport gallery.

**File:** `src/app/add-horse/page.tsx` and `src/app/stable/[id]/edit/page.tsx`

After each image upload succeeds (when the `horse_images` row is created), also insert a `horse_photo_stages` row:

```typescript
await supabase.from("horse_photo_stages").insert({
    horse_id: horseId,
    image_id: imageRecord.id,
    stage: lifeStage,  // current life stage of the horse
});
```

**File:** `src/components/PassportGallery.tsx`

Update to accept an optional `photoStages` map. Display a small stage label on each photo thumbnail:

```tsx
{stage && (
    <span className={`hoofprint-stage-badge stage-${stage}`}>
        {stageLabel}
    </span>
)}
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task HF-9: Commit Phase 2

```
cd c:\Project Equispace\model-horse-hub && cmd /c "git add -A && git commit -m "feat: Hoofprint Phase 2 - life stages, photo tagging" 2>&1"
```

---

# ═══════════════════════════════════════
# PHASE 3: OWNERSHIP TRANSFER
# ═══════════════════════════════════════

## Task HF-10: Transfer Server Actions

**What:** Create server actions for generating transfer codes and claiming horses.

**File:** `src/app/actions/hoofprint.ts` (append to existing file)

Add these functions:

### `generateTransferCode()`
- Validates user owns the horse
- Generates a 6-character alphanumeric code (uppercase, no ambiguous chars like 0/O)
- Inserts into `horse_transfers` with 48h expiry
- Returns the code

### `claimTransfer()`
- Takes a transfer code
- Validates code exists and is not expired
- Uses SERVICE ROLE to:
  1. Close sender's ownership record (`released_at = now()`)
  2. Create receiver's ownership record
  3. Update `user_horses.owner_id` to the claimant
  4. Create timeline events for both sender and receiver
  5. Mark transfer as claimed
  6. Reset `collection_id` to null (new owner organizes their way)
  7. Keep horse public status and photos intact

### `cancelTransfer()`
- Validates sender owns the transfer
- Marks as cancelled

### `getMyPendingTransfers()`
- Returns all pending outgoing transfers for the current user

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task HF-11: Transfer UI — Initiate Transfer

**What:** Add a "Transfer Ownership" button to the private passport page. When clicked, shows a modal where the owner can:
- Choose transfer type (Sale, Trade, Gift)
- Optionally enter sale price
- Check "Show price publicly" toggle
- Add notes
- Click "Generate Transfer Code"
- See the 6-char code with a copy button
- See expiration countdown

**File:** `src/components/TransferModal.tsx` (new file)

Client component with modal pattern matching the existing `DeleteHorseModal.tsx` style.

**File:** `src/app/stable/[id]/page.tsx`

Add `<TransferModal>` next to the existing Edit and Delete buttons in the passport actions section.

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task HF-12: Transfer UI — Claim Page

**What:** Create a page where buyers can enter a transfer code to claim a horse.

**File:** `src/app/claim/page.tsx` (new route)

- Text input for the 6-character code
- "Claim" button
- On success: shows the horse name, seller, and redirects to the new passport
- On error: shows appropriate message (expired, invalid, already your horse, etc.)
- Add a link to this page from the Header nav (or at least from the Dashboard)

**File:** `src/app/claim/page.tsx` should be a client component using the `claimTransfer()` action.

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task HF-13: Hoofprint Page (Public Report)

**What:** A dedicated page showing the full Hoofprint report for a horse.

**File:** `src/app/community/[id]/hoofprint/page.tsx` (new route)

- Full ownership chain with dates
- Complete timeline
- Photo gallery organized by life stage (tabbed or grouped)
- Show records
- Pedigree info
- A branded header: "🐾 Hoofprint™ Report"
- Share button

**Link to this page** from the community passport with a prominent CTA:

```tsx
<Link href={`/community/${horseId}/hoofprint`} className="btn btn-ghost">
    🐾 View Full Hoofprint
</Link>
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task HF-14: Commit Phase 3

```
cd c:\Project Equispace\model-horse-hub && cmd /c "git add -A && git commit -m "feat: Hoofprint Phase 3 - ownership transfer, claim codes, public report" 2>&1"
```

---

# ═══════════════════════════════════════
# PHASE 4: INTEGRATION & POLISH
# ═══════════════════════════════════════

## Task HF-15: Auto-Create Timeline Events

**What:** Wire existing actions to auto-create Hoofprint timeline events.

**When a user adds a show record** (`src/app/actions/provenance.ts` → `addShowRecord`):
- Create a timeline event with type `show_result`

**When a user changes trade status** (edit horse form):
- If set to "For Sale" or "Open to Offers", create a `listed` event

**When a user adds customization logs** (if wired up, or new):
- Create a `customization` event

Use fire-and-forget pattern (try/catch, non-blocking).

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task HF-16: Hoofprint Badge on Show Ring

**What:** Show a "🐾 Hoofprint" badge on Show Ring cards for horses that have timeline history (indicating verified provenance).

**File:** `src/app/community/page.tsx`

When building community cards, count timeline events per horse (batch query):

```typescript
const { data: hoofprintCounts } = await supabase
    .from("horse_timeline")
    .select("horse_id")
    .in("horse_id", horseIds);
```

Build a count map and pass `hoofprintCount` to the card data.

**File:** `src/components/ShowRingGrid.tsx`

Display badge when count > 0:

```tsx
{horse.hoofprintCount > 0 && (
    <span className="hoofprint-badge">🐾 Hoofprint</span>
)}
```

**CSS:**
```css
.hoofprint-badge {
    font-size: 0.65rem;
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
    font-weight: 600;
}
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task HF-17: Add "Claim Horse" to Navigation

**What:** Add a "📦 Claim" link to the header navigation so buyers can easily find the claim page.

**File:** `src/components/Header.tsx`

Add between the Inbox and Notifications links:

```tsx
<Link href="/claim" className="header-nav-link" onClick={closeMobileMenu}>
    📦 Claim
</Link>
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task HF-18: Final Commit & Push

```
cd c:\Project Equispace\model-horse-hub && cmd /c "git add -A && git commit -m "feat: Hoofprint Phase 4 - auto-events, badges, claim nav, polish" 2>&1"
```

Then push:

```
cd c:\Project Equispace\model-horse-hub && cmd /c "git push origin main 2>&1"
```
