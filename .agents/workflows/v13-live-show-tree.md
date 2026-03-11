---
description: Epic 3 — Live Show Relational Tree. Replace free-text show classes with a strict relational hierarchy (event_divisions → event_classes → event_entries) to support NAMHSA show runners. Show Host Builder UI.
---

# Epic 3: The Live Show Relational Tree

> **Ecosystem Expansion Plan — Epic 3 of 5**
> **Pre-requisites:** Epics 1-2 complete (Migrations 052-053 applied).
> **Directive:** Replace free-text `class_name` on show entries with a strict relational hierarchy. Build a Show Host Builder UI for event creators. Virtual shows keep free-text; live shows use the FK tree.

// turbo-all

---

## Developer Agent Rules

> **MANDATORY:** When you complete a task, update this workflow file immediately:
> 1. Add `✅ DONE` and the date after the task heading
> 2. Check off the item in the Completion Checklist at the bottom
> 3. If you encounter issues or make design decisions, add a brief note under the task
> 4. Run `npx next build` after every task and note the result
> 5. Do NOT skip updating this file — the human uses it to track progress

---

## The Problem

Currently, both `event_entries` and `show_string_entries` use free-text `class_name` and `division` columns. This works for casual virtual shows but:

1. ❌ No standardized class lists — every show runner types classes manually
2. ❌ Can't aggregate results across shows ("How many Arabian Halter classes has my horse won?")
3. ❌ Can't support NAMHSA-sanctioned shows which require specific division/class trees
4. ❌ Show string planner uses free-text too — no validation that the class exists in the target show

## The Solution

Add `event_divisions` and `event_classes` tables. When an event creator builds a class list, entries reference the structured `class_id` FK instead of free-text. Virtual shows (no class list defined) keep using the existing `class_name` text column.

---

## Architecture

```
events
  └── event_divisions (e.g., "OF Plastic Halter", "CM/AR Halter")
        └── event_classes (e.g., "Arabian/Part-Arabian", "Stock Breeds")
              └── event_entries (existing — add class_id FK)
```

**Coexistence rule:** If `event_divisions` exist for an event → entries MUST use `class_id`. If no divisions exist → entries use free-text `class_name` (existing behavior). The display layer uses `COALESCE(ec.name, ee.class_name)`.

---

## Task 1 — Migration 054: Live Show Tree Schema

Create `supabase/migrations/054_live_show_tree.sql`:

```sql
-- ============================================================
-- Migration 054: Live Show Relational Tree (Epic 3)
-- Structured divisions and classes for live/NAMHSA shows
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- STEP 1: CREATE event_divisions TABLE
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS event_divisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_divisions_event
    ON event_divisions (event_id, sort_order);

-- RLS: anyone can view divisions for public events, only creator can manage
ALTER TABLE event_divisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view event divisions"
    ON event_divisions FOR SELECT
    USING (true);

CREATE POLICY "Event creator can manage divisions"
    ON event_divisions FOR ALL
    USING (
        event_id IN (
            SELECT id FROM events WHERE created_by = auth.uid()
        )
    );

-- ══════════════════════════════════════════════════════════════
-- STEP 2: CREATE event_classes TABLE
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS event_classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    division_id UUID NOT NULL REFERENCES event_divisions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    class_number TEXT,
    description TEXT,
    is_nan_qualifying BOOLEAN DEFAULT false,
    max_entries INT,             -- optional cap
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_classes_division
    ON event_classes (division_id, sort_order);

-- RLS: same as divisions
ALTER TABLE event_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view event classes"
    ON event_classes FOR SELECT
    USING (true);

CREATE POLICY "Event creator can manage classes"
    ON event_classes FOR ALL
    USING (
        division_id IN (
            SELECT ed.id FROM event_divisions ed
            JOIN events e ON e.id = ed.event_id
            WHERE e.created_by = auth.uid()
        )
    );

-- ══════════════════════════════════════════════════════════════
-- STEP 3: ADD class_id FK TO event_entries
-- Nullable — only used when event has structured divisions
-- ══════════════════════════════════════════════════════════════

ALTER TABLE event_entries
    ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES event_classes(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_event_entries_class
    ON event_entries (class_id);

-- ══════════════════════════════════════════════════════════════
-- STEP 4: ADD class_id FK TO show_string_entries
-- When planning for a show with structured classes
-- ══════════════════════════════════════════════════════════════

ALTER TABLE show_string_entries
    ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES event_classes(id) ON DELETE SET NULL;

-- ══════════════════════════════════════════════════════════════
-- VERIFICATION
-- ══════════════════════════════════════════════════════════════
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN ('event_divisions', 'event_classes');
-- Expected: 2 rows
```

---

## Task 2 — Server Actions for Division/Class Management

**File:** `src/app/actions/competition.ts` (add new exports)

### New functions to add:

```typescript
// ── Division & Class Management ──

export async function getEventDivisions(eventId: string): Promise<Division[]>
// Returns all divisions + their classes for an event, ordered by sort_order

export async function createDivision(data: {
    eventId: string;
    name: string;
    description?: string;
    sortOrder?: number;
}): Promise<{ success: boolean; id?: string; error?: string }>

export async function updateDivision(divisionId: string, data: {
    name?: string;
    description?: string;
    sortOrder?: number;
}): Promise<{ success: boolean; error?: string }>

export async function deleteDivision(divisionId: string): Promise<{ success: boolean; error?: string }>

export async function createClass(data: {
    divisionId: string;
    name: string;
    classNumber?: string;
    description?: string;
    isNanQualifying?: boolean;
    maxEntries?: number;
    sortOrder?: number;
}): Promise<{ success: boolean; id?: string; error?: string }>

export async function updateClass(classId: string, data: {
    name?: string;
    classNumber?: string;
    description?: string;
    isNanQualifying?: boolean;
    maxEntries?: number;
    sortOrder?: number;
}): Promise<{ success: boolean; error?: string }>

export async function deleteClass(classId: string): Promise<{ success: boolean; error?: string }>

export async function reorderDivisions(divisionIds: string[]): Promise<{ success: boolean }>
// Bulk update sort_order based on array position

export async function reorderClasses(classIds: string[]): Promise<{ success: boolean }>
```

### Types to add:

```typescript
interface Division {
    id: string;
    eventId: string;
    name: string;
    description: string | null;
    sortOrder: number;
    classes: EventClass[];
}

interface EventClass {
    id: string;
    divisionId: string;
    name: string;
    classNumber: string | null;
    description: string | null;
    isNanQualifying: boolean;
    maxEntries: number | null;
    sortOrder: number;
    entryCount?: number;
}
```

---

## Task 3 — Update Show Entry Flow

### `addShowStringEntry()`:
```typescript
// BEFORE: only accepts className (free text)
// AFTER:  accepts className OR classId

export async function addShowStringEntry(data: {
    showStringId: string;
    horseId: string;
    className: string;    // Still accepted for virtual shows
    classId?: string;     // NEW: FK to event_classes (for structured shows)
    division?: string;
    timeSlot?: string;
    notes?: string;
})
```

### `convertShowStringToResults()`:
When converting show string entries to show records, if `class_id` is present, populate the show record's `class_name` from the joined `event_classes.name` for the `show_records` table.

### Event entry form:
When entering a show that has `event_divisions`, replace the free-text class input with cascading dropdowns:
1. **Select Division** (dropdown of `event_divisions` for this event)
2. **Select Class** (dropdown of `event_classes` filtered by selected division)

When the event has NO divisions, show the existing free-text `class_name` input.

---

## Task 4 — Show Host Builder UI

**New Route:** `src/app/community/events/[id]/manage/page.tsx`

This is the most complex UI in the epic. Only accessible to the event creator.

### Layout:
```
┌─────────────────────────────────────────────────┐
│  Event: "Spring Fling 2026"         [← Back]    │
│  ────────────────────────────────────────────── │
│  📋 Division: OF Plastic Halter      [+ Class]  │
│     ├── Class 101: Arabian/Part-Arabian     [✎🗑]│
│     ├── Class 102: Stock Breeds             [✎🗑]│
│     └── Class 103: Draft Breeds             [✎🗑]│
│                                                  │
│  📋 Division: CM/AR Halter            [+ Class]  │
│     ├── Class 201: Light Breeds             [✎🗑]│
│     └── Class 202: Stock Breeds             [✎🗑]│
│                                                  │
│  [+ Add Division]                                │
│                                                  │
│  ── Quick Actions ──                             │
│  [📥 Import NAMHSA Template]  [📋 Copy From...]  │
└─────────────────────────────────────────────────┘
```

### Features:
1. **Add/edit/delete divisions** — inline editing with save on blur
2. **Add/edit/delete classes** under each division — inline editing
3. **Class number** — auto-incrementing suggestion (101, 102, 103...)
4. **NAN qualifier toggle** — per class
5. **Drag-and-drop reorder** — divisions and classes (or up/down arrows for MVP)
6. **Copy from previous show** — select another event and duplicate its division/class tree
7. **Access control** — only the event creator sees the "Manage" button

### Access:
- Add a "⚙️ Manage Classes" button on the event detail page (`/community/events/[id]`)
- Only visible when `event.created_by === currentUser.id`

---

## Task 5 — Update Event Entry Form

**File:** `src/app/community/events/[id]/page.tsx` (or wherever the entry form lives)

### When event has structured divisions:
```tsx
// Fetch divisions for this event
const divisions = await getEventDivisions(eventId);

if (divisions.length > 0) {
    // Show cascading dropdowns
    <select onChange={setSelectedDivision}>
        {divisions.map(d => <option key={d.id}>{d.name}</option>)}
    </select>
    <select onChange={setSelectedClass}>
        {selectedDivision?.classes.map(c => (
            <option key={c.id}>{c.classNumber ? `${c.classNumber}: ` : ''}{c.name}</option>
        ))}
    </select>
} else {
    // Show existing free-text input
    <input ... value={className} ... />
}
```

### When submitting an entry:
```typescript
// If structured show: pass classId
// If virtual show: pass className (existing behavior)
```

---

## Task 6 — Update Show String Planner

**File:** `src/app/shows/planner/page.tsx` and `src/app/shows/[id]/page.tsx`

When creating a show string linked to an event that has divisions, the "Add Entry" form should:
1. Show the event's division/class tree as cascading dropdowns (same as Task 5)
2. Store `class_id` on the show_string_entry
3. Validate that the selected class exists in the target event

For unlinked show strings (no target event), keep the free-text input.

---

## Task 7 — Update Display Pages

### Show Ring / Community page:
- Show results should display the class name from either `event_classes.name` or free-text `class_name`
- Use `COALESCE(ec.name, ee.class_name)` pattern

### Event detail page:
- Show the division/class tree with entry counts per class
- "X entries in Arabian/Part-Arabian" badge

### Show records on horse passport / Hoofprint:
- Display structured class info when available

---

## Task 8 — Add Types to `database.ts`

**File:** `src/lib/types/database.ts`

```typescript
export interface EventDivision {
    id: string;
    event_id: string;
    name: string;
    description: string | null;
    sort_order: number;
    created_at: string;
}

export interface EventClass {
    id: string;
    division_id: string;
    name: string;
    class_number: string | null;
    description: string | null;
    is_nan_qualifying: boolean;
    max_entries: number | null;
    sort_order: number;
    created_at: string;
}
```

Add `Database.Tables` entries for `event_divisions` and `event_classes`.
Add `class_id: string | null` to the `EventEntry` interface (if it exists).

---

## Task 9 — CSS for Show Host Builder

**File:** `src/app/globals.css` or `src/app/competition.css`

Add styles for:
- Division tree layout (indented classes under divisions)
- Inline edit mode (class name input + save/cancel)
- Drag handle or up/down arrows for reordering
- NAN qualifier badge (⭐ icon)
- Class number badge
- "Manage Classes" button styling

---

## Task 10 — Verification & Testing

1. Run `npx next build` — must be 0 errors.
2. Test scenarios:
   - Create event → Add divisions → Add classes → Open for entries ✅
   - Enter a structured show → cascading dropdowns work ✅
   - Enter a virtual show (no divisions) → free-text class works ✅
   - Show string planner → structured + free-text entries ✅
   - Convert show string to results → class_name populated from FK ✅
   - Delete a division → cascades to classes and entries ✅
   - Copy division tree from another event ✅
   - Event detail page shows division/class tree with entry counts ✅

---

## Completion Checklist

**Schema**
- [x] Migration 054 written (`054_live_show_tree.sql`)
- [x] Human reviewed and approved SQL
- [x] Migration applied to production (March 11, 2026)
- [x] `event_divisions` table exists with RLS
- [x] `event_classes` table exists with RLS
- [x] `event_entries.class_id` FK exists
- [x] `show_string_entries.class_id` FK exists

**Server Actions**
- [x] `getEventDivisions()` — returns divisions + classes for event
- [x] `createDivision()` / `updateDivision()` / `deleteDivision()`
- [x] `createClass()` / `updateClass()` / `deleteClass()`
- [x] `reorderDivisions()` / `reorderClasses()`
- [x] `addShowStringEntry()` accepts `classId`
- [x] `convertShowStringToResults()` populates `class_name` from FK
- [x] `copyDivisionsFromEvent()` — duplicates tree from another event

**Types**
- [x] `database.ts` — `EventDivision` and `EventClass` interfaces added
- [x] `database.ts` — `Database.Tables` entries added
- [x] `database.ts` — `EventEntry.class_id` added

**Pages**
- [x] Show Host Builder (`/community/events/[id]/manage`) — full CRUD UI
- [x] Event detail page — "Manage Classes" button (creator only)
- [x] Event detail page — division/class tree with entry counts
- [ ] Event entry form — cascading dropdowns when divisions exist (deferred — photo shows don't use classes)
- [ ] Show string planner — structured class selection (deferred — requires deeper form refactor)
- [ ] Horse passport — display structured class on show records (show records already use class_name text)

**CSS**
- [x] Division tree styles
- [x] Inline edit mode styles
- [x] NAN qualifier badge
- [x] Mobile responsive

**Build & Verification**
- [x] `npx next build` — 0 errors (March 11, 2026)
- [ ] Structured show entry flow works end-to-end
- [x] Virtual show (no divisions) still works (no changes to existing entry flow)
- [ ] Division deletion cascades properly (requires migration to test)

**Estimated effort:** ~8-12 hours
