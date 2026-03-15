---
description: V29 Advanced Competition Engine — Event Editing, Judge Assignments, Class-Linked Entry Flow, and Expert Judging Panel enhancements. Builds on existing V13/V25 competition foundation.
---

# V29 Advanced Competition Engine

> **Source:** Research agent report "V12 Advanced Competition Engine"
> **Context:** Beta testing revealed the show system needs upgrades for NAMHSA-style professional shows. The research agent proposed Event Editing, Judges, Class Lists, and Expert Judging. After analysis, most of the schema and backend already exist from V8 (Competition Engine), V13 (Live Show Tree), and V25 (Expert-Judged Shows).
> **Pre-requisites:** V28 Beta Feedback Sprint complete. Clean build. Current migration: 075.

// turbo-all

---

## Developer Agent Rules

> **MANDATORY:** When you complete a task, update this workflow file immediately:
> 1. Add `✅ DONE` and the date after the task heading
> 2. Run `npx next build` after every task and note the result

---

# ═══════════════════════════════════════
# RESEARCH AGENT GAP ANALYSIS
# ═══════════════════════════════════════

The research agent wrote this report against a much older version of the codebase ("V12").
Below is a feature-by-feature analysis of what's already built vs. what's genuinely missing.

## Already Implemented ✅

| Feature | Implementation | Migration |
|---------|---------------|-----------|
| `event_divisions` table | `054_live_show_tree.sql` | Full schema + RLS |
| `event_classes` table | `054_live_show_tree.sql` | Full schema + RLS, links to divisions |
| `event_entries.class_id` column | `054_live_show_tree.sql` | FK to `event_classes` |
| `events.judging_method` column | `065_expert_judged_shows.sql` | `community_vote` or `expert_judge` |
| `createDivision()` server action | `src/app/actions/competition.ts:634` | ✅ |
| `createClass()` server action | `src/app/actions/competition.ts:706` | ✅ |
| `getEventDivisions()` server action | `src/app/actions/competition.ts:574` | Returns nested divisions→classes |
| `deleteDivision()`, `deleteClass()` | `src/app/actions/competition.ts` | ✅ |
| `updateDivision()`, `updateClass()` | `src/app/actions/competition.ts` | ✅ |
| `reorderDivisions()`, `reorderClasses()` | `src/app/actions/competition.ts` | ✅ |
| `copyDivisionsFromEvent()` | `src/app/actions/competition.ts` | ✅ |
| Manage Event page (`/community/events/[id]/manage`) | Full class list builder UI | 464 lines |
| `saveExpertPlacings()` server action | `src/app/actions/shows.ts:502` | ✅ |
| `ExpertJudgingPanel.tsx` component | `src/components/ExpertJudgingPanel.tsx` | 142 lines |
| `ShowEntryForm.tsx` component | `src/components/ShowEntryForm.tsx` | 74 lines |
| `createEvent()` with `judgingMethod` | `src/app/actions/events.ts:41` | ✅ |

## Genuinely Missing ❌

| Feature | Gap | Priority |
|---------|-----|----------|
| **`event_judges` table** | No table exists — expert judges are by-host-only, not assignable | 🔴 High |
| **`updateEvent()` action** | No edit function — events are create-only with no edit capability | 🔴 High |
| **Judge assignment actions** | `addEventJudge()`, `removeEventJudge()`, `getEventJudges()` | 🔴 High |
| **Event manage: Edit Details tab** | Manage page only has Class List Builder — no edit form for event metadata | 🔴 High |
| **Event manage: Judges tab** | No judge assignment UI | 🟡 Medium |
| **ShowEntryForm: class dropdown** | Form uses only horse picker — no class selection from structured class list | 🟡 Medium |
| **ExpertJudgingPanel: class filtering** | Panel shows ALL entries flat — no per-class judging view | 🟡 Medium |
| **ExpertJudgingPanel: expanded placings** | Only has 1st/2nd/3rd/HM — missing 4th/5th/6th/Champ/Reserve from hobby spec | 🟡 Medium |
| **Show record generation** | `saveExpertPlacings` writes to `event_entries` but doesn't auto-create `show_records` for winners | 🟡 Medium |

---

# ═══════════════════════════════════════
# IMPLEMENTATION PLAN
# ═══════════════════════════════════════

# Phase 1: Database Migration

## Task 1.1 — Migration 076: Event Judges Table

Create `supabase/migrations/076_event_judges.sql`:

```sql
-- ============================================================
-- Migration 076: Event Judges
-- Allows event creators to assign expert judges by user
-- ============================================================

CREATE TABLE IF NOT EXISTS event_judges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(event_id, user_id)
);

ALTER TABLE event_judges ENABLE ROW LEVEL SECURITY;

-- Anyone can see who's judging
CREATE POLICY "Anyone can view event judges"
    ON event_judges FOR SELECT TO authenticated USING (true);

-- Only the event creator can manage judges
CREATE POLICY "Event creator manages judges"
    ON event_judges FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM events e
        WHERE e.id = event_judges.event_id
        AND e.created_by = (SELECT auth.uid())
    ));

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_event_judges_event ON event_judges(event_id);
CREATE INDEX IF NOT EXISTS idx_event_judges_user ON event_judges(user_id);
```

**Action:** Write this file, then apply via the Supabase SQL Editor.

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

# Phase 2: Server Actions

## Task 2.1 — Add updateEvent() to events.ts

**File:** `src/app/actions/events.ts`

Add a new `updateEvent()` function. The creator should be able to update:
- `name`, `description`
- `starts_at`, `ends_at`, `timezone`, `is_all_day`
- `is_virtual`, `location_name`, `location_address`, `virtual_url`, `region`
- `judging_method`

```typescript
export async function updateEvent(
    eventId: string,
    data: {
        name?: string;
        description?: string;
        startsAt?: string;
        endsAt?: string;
        timezone?: string;
        isAllDay?: boolean;
        isVirtual?: boolean;
        locationName?: string;
        locationAddress?: string;
        region?: string;
        virtualUrl?: string;
        judgingMethod?: "community_vote" | "expert_judge";
    }
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    // Verify ownership
    const { data: event } = await supabase
        .from("events")
        .select("created_by")
        .eq("id", eventId)
        .single();

    if (!event || (event as { created_by: string }).created_by !== user.id) {
        return { success: false, error: "Not authorized — only the event creator can edit." };
    }

    const updates: Record<string, unknown> = {};
    if (data.name !== undefined) updates.name = data.name.trim();
    if (data.description !== undefined) updates.description = data.description.trim() || null;
    if (data.startsAt !== undefined) updates.starts_at = data.startsAt;
    if (data.endsAt !== undefined) updates.ends_at = data.endsAt || null;
    if (data.timezone !== undefined) updates.timezone = data.timezone;
    if (data.isAllDay !== undefined) updates.is_all_day = data.isAllDay;
    if (data.isVirtual !== undefined) updates.is_virtual = data.isVirtual;
    if (data.locationName !== undefined) updates.location_name = data.locationName.trim() || null;
    if (data.locationAddress !== undefined) updates.location_address = data.locationAddress.trim() || null;
    if (data.region !== undefined) updates.region = data.region || null;
    if (data.virtualUrl !== undefined) updates.virtual_url = data.virtualUrl.trim() || null;
    if (data.judgingMethod !== undefined) updates.judging_method = data.judgingMethod;

    if (Object.keys(updates).length === 0) return { success: true };

    const { error } = await supabase
        .from("events")
        .update(updates)
        .eq("id", eventId);

    if (error) return { success: false, error: error.message };

    revalidatePath(`/community/events/${eventId}`);
    revalidatePath(`/community/events/${eventId}/manage`);
    return { success: true };
}
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

## Task 2.2 — Add Judge Management Actions to events.ts

**File:** `src/app/actions/events.ts`

Add three new functions:

```typescript
/**
 * Get all judges assigned to an event.
 */
export async function getEventJudges(eventId: string): Promise<{
    id: string;
    userId: string;
    aliasName: string;
    avatarUrl: string | null;
}[]> {
    const supabase = await createClient();

    const { data } = await supabase
        .from("event_judges")
        .select("id, user_id, users!inner(alias_name, avatar_url)")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });

    if (!data) return [];

    return data.map((j: Record<string, unknown>) => {
        const user = j.users as { alias_name: string; avatar_url: string | null } | null;
        return {
            id: j.id as string,
            userId: j.user_id as string,
            aliasName: user?.alias_name || "Unknown",
            avatarUrl: user?.avatar_url || null,
        };
    });
}

/**
 * Add a user as a judge to an event. Looks up by alias_name.
 */
export async function addEventJudge(
    eventId: string,
    userAlias: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    // Verify ownership
    const { data: event } = await supabase
        .from("events")
        .select("created_by")
        .eq("id", eventId)
        .single();

    if (!event || (event as { created_by: string }).created_by !== user.id) {
        return { success: false, error: "Only the event creator can assign judges." };
    }

    // Look up judge by alias
    const { data: judgeUser } = await supabase
        .from("users")
        .select("id")
        .eq("alias_name", userAlias.trim())
        .maybeSingle();

    if (!judgeUser) return { success: false, error: `User "${userAlias}" not found.` };

    // Can't assign yourself as judge when you're the host? (optional — you may allow it)
    // Insert
    const { error } = await supabase
        .from("event_judges")
        .insert({
            event_id: eventId,
            user_id: (judgeUser as { id: string }).id,
        });

    if (error) {
        if (error.code === "23505") return { success: false, error: "This user is already a judge." };
        return { success: false, error: error.message };
    }

    revalidatePath(`/community/events/${eventId}/manage`);
    return { success: true };
}

/**
 * Remove a judge from an event.
 */
export async function removeEventJudge(
    judgeId: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    // Fetch the judge record to verify the event ownership
    const { data: judge } = await supabase
        .from("event_judges")
        .select("event_id")
        .eq("id", judgeId)
        .single();

    if (!judge) return { success: false, error: "Judge record not found." };

    const eventId = (judge as { event_id: string }).event_id;

    const { data: event } = await supabase
        .from("events")
        .select("created_by")
        .eq("id", eventId)
        .single();

    if (!event || (event as { created_by: string }).created_by !== user.id) {
        return { success: false, error: "Only the event creator can remove judges." };
    }

    const { error } = await supabase
        .from("event_judges")
        .delete()
        .eq("id", judgeId);

    if (error) return { success: false, error: error.message };

    revalidatePath(`/community/events/${eventId}/manage`);
    return { success: true };
}
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

## Task 2.3 — Update ShowEntryForm to Accept Class Selection

**File:** `src/components/ShowEntryForm.tsx`

Currently the form only picks a horse. Upgrade it to:

1. Accept an optional `classes` prop: `{ id: string; name: string; divisionName: string }[]`
2. If classes exist, show a grouped `<select>` with `<optgroup label={divisionName}>` containing `<option value={classId}>className</option>`
3. If no classes, stay with current behavior (horse-only entry)
4. Pass the selected `classId` to `enterShow()`

```typescript
interface ShowEntryFormProps {
    showId: string;
    userHorses: { id: string; name: string }[];
    classes?: { id: string; name: string; divisionName: string }[];
}
```

Update `enterShow()` in `src/app/actions/shows.ts` to accept an optional `classId` parameter and save it to `event_entries.class_id`.

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

## Task 2.4 — Enhance saveExpertPlacings to Generate Show Records

**File:** `src/app/actions/shows.ts`

Currently `saveExpertPlacings()` writes placings to `event_entries` but does NOT auto-create `show_records`. After saving placings, for each entry that received a placing:

1. Look up the entry's `horse_id` and `user_id` (owner of the horse)
2. Get the event's `name` and `starts_at` date
3. Insert a `show_records` row with:
   - `horse_id`, `user_id`
   - `show_name` = event name
   - `show_date` = event starts_at date
   - `placing` = the assigned placing
   - `ribbon_color` = map placings to ribbons (1st→Blue, 2nd→Red, 3rd→Yellow, HM→Green, Champ→Grand Champion, Reserve→Reserve Grand Champion)
   - `is_nan` = false (NAN status is tracked separately)
   - `notes` = "Auto-generated from expert judging"

Use `upsert` on `(horse_id, show_name, placing)` or check for duplicates to prevent re-runs from creating multiples.

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

# Phase 3: Manage Event Page Enhancements

## Task 3.1 — Add Edit Details Tab to Manage Page

**File:** `src/app/community/events/[id]/manage/page.tsx`

The manage page currently is purely a Class List Builder. Add a tab system with:

1. **📝 Edit Details** tab — Form to update event name, description, dates, location, virtual URL, and judging method toggle
2. **📋 Class List** tab — The existing class list builder (current page content)
3. **🧑‍⚖️ Judges** tab — Judge assignment UI (only visible when `judging_method === "expert_judge"`)

For the tab system, use simple state-driven tabs:

```typescript
const [activeTab, setActiveTab] = useState<"details" | "classes" | "judges">("classes");
```

### Edit Details Tab:

- Load the current event data on mount
- Pre-fill form fields (name, description, starts_at, ends_at, location, etc.)
- Include a `judging_method` toggle (radio buttons or segmented control)
- Save button calls `updateEvent()`
- Show success/error feedback

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

## Task 3.2 — Add Judges Tab to Manage Page

**File:** `src/app/community/events/[id]/manage/page.tsx`

### Judges Tab (visible when `judging_method === "expert_judge"`):

- Text input to search/type a user alias
- "Add Judge" button that calls `addEventJudge(eventId, alias)`
- List of current judges with alias, avatar, and "Remove" button
- Load judges on mount via `getEventJudges(eventId)`
- Show success/error feedback

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

# Phase 4: Expert Judging Panel Enhancements

## Task 4.1 — Add Class Filtering to ExpertJudgingPanel

**File:** `src/components/ExpertJudgingPanel.tsx`

Currently the panel shows ALL entries as a flat list. Upgrade:

1. Accept a `classes` prop: `{ id: string; name: string; divisionName: string }[]`
2. If classes exist, add a class selector dropdown at the top
3. Filter displayed entries by the selected class
4. Show entries grouped: "Currently judging: {Division} > {Class}"

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

## Task 4.2 — Expand Placing Options in ExpertJudgingPanel

**File:** `src/components/ExpertJudgingPanel.tsx`

Update `PLACING_OPTIONS` to include all standard hobby placings:

```typescript
const PLACING_OPTIONS = [
    { value: "", label: "—" },
    { value: "1st", label: "🥇 1st" },
    { value: "2nd", label: "🥈 2nd" },
    { value: "3rd", label: "🥉 3rd" },
    { value: "4th", label: "4th" },
    { value: "5th", label: "5th" },
    { value: "6th", label: "6th" },
    { value: "HM", label: "🎗️ HM" },
    { value: "Champion", label: "🏆 Champ" },
    { value: "Reserve Champion", label: "🥈 Reserve" },
    { value: "Grand Champion", label: "🏆 Grand" },
    { value: "Reserve Grand Champion", label: "🥈 Reserve Grand" },
    { value: "Top 3", label: "🏅 Top 3" },
    { value: "Top 5", label: "🏅 Top 5" },
    { value: "Top 10", label: "🏅 Top 10" },
];
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

## Task 4.3 — Allow Assigned Judges to Access the Panel

**File:** `src/app/community/events/[id]/page.tsx` (or wherever ExpertJudgingPanel is rendered)

Currently only the event host sees the panel. Update the visibility check:

```typescript
// Show expert judging if user is host OR is in event_judges
const isHost = event.createdBy === user?.id;
const isJudge = eventJudges.some(j => j.userId === user?.id);
const showJudgingPanel = isExpertJudged && (isHost || isJudge) && show.status === "closed";
```

Fetch judges via `getEventJudges(eventId)` on the page.

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

# Phase 5: TypeScript Types Update

## Task 5.1 — Update database.ts

**File:** `src/lib/types/database.ts`

Add the `EventJudge` interface:

```typescript
export interface EventJudge {
    id: string;
    event_id: string;
    user_id: string;
    created_at: string;
}
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

# Phase 6: Final Verification

## Task 6.1 — Full Build

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

Must return 0 errors.

## Task 6.2 — Manual Testing Checklist

- [ ] **Edit Event:** Go to a test event's manage page. Verify the "Edit Details" tab lets you change the name, dates, and toggle judging method. Save and verify changes persist.
- [ ] **Assign Judge:** Toggle judging method to "Expert Judge". Go to Judges tab. Type a user alias and assign them. Verify they appear in the list. Remove them. Verify removal.
- [ ] **Class-linked Entry:** For an event with a class list, verify the entry form shows a grouped dropdown instead of free-text. Select a class and enter a horse.
- [ ] **Expert Judging per Class:** As the host, open the expert judging panel. Select a class from the dropdown. Verify only entries in that class are shown. Assign placings including 4th, 5th, 6th, Champion, Reserve.
- [ ] **Show Record Generation:** After saving expert placings, verify show records auto-appear on the winning horses' Hoofprint timelines.
- [ ] **Judge Access:** Assign another user as judge. Log in as that user. Verify they see the expert judging panel.

## Task 6.3 — Commit & Push

```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "V29: Advanced Competition Engine — event editing, judge assignments, class-linked entries, enhanced expert judging" && git push
```

---

# ═══════════════════════════════════════
# SIGN-OFF CHECKLIST
# ═══════════════════════════════════════

- [ ] Migration 076 (event_judges) created and applied
- [ ] `updateEvent()` server action implemented
- [ ] Judge CRUD actions (add/remove/get) implemented
- [ ] ShowEntryForm upgraded with class dropdown
- [ ] `saveExpertPlacings()` auto-generates show_records
- [ ] Manage page has 3 tabs (Edit Details, Class List, Judges)
- [ ] ExpertJudgingPanel has class filter and expanded placings
- [ ] Assigned judges can access the judging panel
- [ ] EventJudge type in database.ts
- [ ] Build passes with 0 errors
- [ ] Committed and pushed
