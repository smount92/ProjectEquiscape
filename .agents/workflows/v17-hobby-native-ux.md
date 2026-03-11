---
description: V17 Hobby-Native UX Deep Dives — Binder View, Bulk Operations, Rapid Intake, Photo Reorder, Unlisted Privacy, OpenGraph Previews, Rich Embeds, Batch Show Results, Ring Conflict UI, Group Registries. The UX Manifesto applied across 3 pillars in 3 phases.
---

# V17: Hobby-Native UX Deep Dives

> **Master Blueprint:** `docs/v16_master_blueprint.md` — Epic 2
> **Pre-requisites:** V16 Integrity Sprint complete (Migration 056 applied).
> **Manifesto:** Every UI must pass the "Is this proper for a model horse collector?" test.
> **Total:** 10 features across 3 Deep Dives, split into 3 phases.

// turbo-all

---

## Developer Agent Rules

> **MANDATORY:** When you complete a task, update this workflow file immediately:
> 1. Add `✅ DONE` and the date after the task heading
> 2. Check off the item in the Completion Checklist at the bottom
> 3. Run `npx next build` after every task
> 4. This is a UX sprint — aesthetics matter. No bare HTML or default inputs.

---

## The Hobby-Native UX Manifesto (Reference)

Before coding, internalize these rules:

1. **Super-Collector Density:** 800 Breyers ≠ 80 pages of cards. Offer a Binder/Ledger view.
2. **Conga Line, Not Tax Form:** Adding a horse should be 1 step (catalog → finish/condition → done), not 4.
3. **LSQ Photography Standard:** Photo upload should map to the physical horse (silhouettes, not generic dropzones).
4. **Context-Aware Provenance:** Hoofprint = premium certificate, not a Jira history. NAN cards = ribbon badges.
5. **Hobby Vocabulary:** PPD, TP, Body Quality, LPU — not generic jargon.

---

# Phase 1: The Collection Pillar (Deep Dive A)

> Focus: Dashboard & intake — the flows collectors use 90% of the time.

---

## Task 2A.1 — The Binder View (StableLedger)

**Goal:** Add a toggle on the Dashboard to switch between `StableGrid` (Gallery — current) and `StableLedger` (high-density table).

### Step 1: Create `StableLedger.tsx`

**File:** `src/components/StableLedger.tsx`

A sortable, compact table with these columns:
- **Photo** — tiny 40×40 thumbnail
- **Name** — linked to `/stable/{id}`
- **Reference** — catalog mold/resin name
- **Finish** — badge (OF/CM/CL/UC/AR/RA)
- **Condition** — text
- **Collection** — folder name
- **Trade Status** — For Sale / Not for Sale / Open to Offers
- **Value** — from financial_vault (owner-only, private)
- **Added** — relative date

### Step 2: Row features
- **Inline edit** — clicking the Condition or Trade Status cell opens a mini dropdown, saves via `updateHorseAction`
- **Sort** — click column headers to sort by name, date, finish, etc.
- **Compact rows** — 12-15 visible without scrolling on a typical screen
- **Hover highlight** — row highlight on hover, click navigates to passport

### Step 3: Dashboard toggle

**File:** `src/app/dashboard/page.tsx`

Add a view toggle above the grid:
```tsx
<div className="view-toggle">
    <button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")}>
        🖼️ Gallery
    </button>
    <button className={view === "ledger" ? "active" : ""} onClick={() => setView("ledger")}>
        📋 Ledger
    </button>
</div>
```

### Step 4: Persist preference
Store view preference in `localStorage` so it persists across visits.

### CSS:
```css
.stable-ledger { /* Compact table with sticky header */ }
.stable-ledger th { /* Sortable header with arrow indicators */ }
.stable-ledger td { /* Dense rows, no wrapping */ }
.view-toggle { /* Pill-shaped toggle buttons */ }
```

---

## Task 2A.2 — Bulk Operations (Select Mode)

**Goal:** Let users select multiple horses and apply batch actions.

### Step 1: Add "Select Mode" toggle to Dashboard
When activated, each horse card/row gets a checkbox. A floating action bar appears at the bottom.

### Step 2: Floating Action Bar
```
┌──────────────────────────────────────────────────────┐
│ ✅ 12 selected  │ [Move to Collection ▾] [Trade Status ▾] [🗑️ Delete] │ [Cancel] │
└──────────────────────────────────────────────────────┘
```

### Step 3: Server actions
**File:** `src/app/actions/horse.ts`

```typescript
export async function bulkUpdateHorses(horseIds: string[], updates: {
    collectionId?: string | null;
    tradeStatus?: string;
}): Promise<{ success: boolean; count?: number; error?: string }>

export async function bulkDeleteHorses(horseIds: string[]): Promise<{ success: boolean; count?: number; error?: string }>
```

Both must verify ownership of ALL horses before executing.

### Step 4: Confirmation modal for delete
"Are you sure you want to delete 12 items? This cannot be undone."

---

## Task 2A.3 — Frictionless Intake (Rapid Add)

**Goal:** Reduce Add Horse from a 4-step wizard to a 1-step form for common cases.

### New Route: `/add-horse/quick`

```
┌─────────────────────────────────────────────────────────────┐
│  ⚡ Quick Add                                                │
│  ──────────────────────────────────────────────────────────  │
│  🔍 [Search catalog: "Breyer Classic Black Beauty"]          │
│     → Selected: Breyer Classic — Black Beauty (Plastic Mold) │
│                                                              │
│  Finish: [OF ▾]  Condition: [Mint ▾]  Collection: [Breyers ▾]│
│                                                              │
│  [Add to Stable]  [+ Duplicate as New Finish]                │
│  ──────────────────────────────────────────────────────────  │
│  Recently added:                                             │
│  ✅ Black Beauty (OF, Mint) — added 5s ago                   │
│  ✅ Black Beauty (CM, Good) — added 20s ago                  │
└─────────────────────────────────────────────────────────────┘
```

### Key features:
1. **Single-screen** — catalog search + finish + condition on one page
2. **Auto-name** — defaults `custom_name` to catalog item title
3. **"Duplicate to New"** — pre-fills the form again with same catalog item, different finish
4. **Success log** — shows what was just added without navigating away
5. **Full form link** — "Need photos or more details? Use the full intake form →"

### Server action:
```typescript
export async function quickAddHorse(data: {
    catalogId: string;
    finishType: string;
    conditionGrade: string;
    collectionId?: string;
}): Promise<{ success: boolean; horseId?: string; horseName?: string; error?: string }>
```

---

## Task 2A.4 — Photo Reordering

**Goal:** Drag-and-drop photo reordering on the Edit Horse form.

### Current state:
- LSQ Photo Suite has 5 fixed angle slots + extra detail photos
- To change order, user must delete and re-upload

### Implementation:
1. Use HTML5 Drag & Drop API for extra_detail photos (no library needed)
2. When user drops a photo at a new position, call:
   ```typescript
   export async function reorderHorseImages(
       horseId: string,
       imageIds: string[]
   ): Promise<{ success: boolean; error?: string }>
   ```
3. This updates a `sort_order` column on `horse_images`. If `sort_order` doesn't exist, add it via migration.
4. LSQ angle slots (Near-Side, Off-Side, etc.) have fixed positions — they can be swapped but the angles are reassigned.

---

# Phase 2: The Sharing & Social Pillar (Deep Dive B)

---

## Task 2B.1 — Granular Privacy (Unlisted Mode)

**Goal:** Add an "Unlisted" visibility option between Public and Private.

### Schema:
**File:** `supabase/migrations/057_unlisted_privacy.sql` (if needed)

Option A — reuse `is_public`:
- `is_public = true` → Public (Show Ring)
- `is_public = false` → Private (only owner)
- New: `visibility` column: `'public' | 'private' | 'unlisted'`

Option B — add `visibility` TEXT column and migrate:
```sql
ALTER TABLE user_horses ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('public', 'private', 'unlisted'));
UPDATE user_horses SET visibility = CASE WHEN is_public THEN 'public' ELSE 'private' END;
```

### UI:
Replace the Public/Private toggle on Add Horse and Edit Horse with a 3-option selector:
```
🌐 Public — Visible in the Show Ring
🔗 Unlisted — Anyone with the link can see it
🔒 Private — Only you can see it
```

### Show Ring query:
Change `is_public = true` to `visibility = 'public'` everywhere.

### Secure share link:
For unlisted horses, the URL `/community/{id}` works — but the horse doesn't appear in search or the Show Ring grid.

---

## Task 2B.2 — OpenGraph Previews

**Goal:** When someone shares a horse passport URL on iMessage/Facebook/Discord, show a rich preview card.

### Current state:
`generateMetadata` exists on `/community/[id]` but only returns `title` and `description`. No `openGraph` images.

### Enhancement:

```typescript
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const supabase = await createClient();

    const { data: horse } = await supabase
        .from("user_horses")
        .select("custom_name, finish_type, condition_grade, catalog_items:catalog_id(title, maker)")
        .eq("id", id)
        .eq("is_public", true)
        .single();

    if (!horse) {
        return { title: "Horse Not Found" };
    }

    // Get primary thumbnail
    const { data: img } = await supabase
        .from("horse_images")
        .select("image_url")
        .eq("horse_id", id)
        .eq("angle_profile", "Primary_Thumbnail")
        .single();

    const imageUrl = img?.image_url
        ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${img.image_url}`
        : null;

    const h = horse as any;
    const title = `${h.custom_name} — Model Horse Hub`;
    const description = h.catalog_items
        ? `${h.catalog_items.maker} ${h.catalog_items.title} · ${h.finish_type} · ${h.condition_grade}`
        : `${h.finish_type} · ${h.condition_grade}`;

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            images: imageUrl ? [{ url: imageUrl, width: 800, height: 600, alt: h.custom_name }] : [],
            type: "article",
        },
        twitter: {
            card: imageUrl ? "summary_large_image" : "summary",
            title,
            description,
            images: imageUrl ? [imageUrl] : [],
        },
    };
}
```

> **Note:** OpenGraph images must be publicly accessible URLs. If images are in private storage (signed URLs), we'll need to either serve them through a public route or generate OG images using `next/og`.

---

## Task 2B.3 — Rich Media Embeds in Feed Posts

**Goal:** Let users embed a horse passport link inside a text post, and render an inline preview card.

### Implementation:
1. When composing a post, if text contains `/community/{uuid}`, detect it
2. After submission, render an inline preview card in the feed:
   ```
   ┌───────────────────────────────────┐
   │ [📷 Photo] Black Beauty           │
   │ Breyer Classic · OF · Mint        │
   │ View Passport →                   │
   └───────────────────────────────────┘
   ```
3. Server action to fetch embed data: `getHorseEmbedPreview(horseId: string)`
4. Render in post display component when URL pattern matches

### Lower priority — requires existing feed/post infrastructure.

---

# Phase 3: The Groups & Events Pillar (Deep Dive C)

---

## Task 2C.1 — Post-Show Batch Results Grid

**Goal:** After a live show, enter results for an entire show string in a single grid/form.

### New Route: `/shows/planner/[id]/results`

```
┌──────────────────────────────────────────────────────────────┐
│  📋 Post-Show Results — Spring Fling 2026                     │
│  ──────────────────────────────────────────────────────────── │
│  Class          │ Horse         │ Placing │ NAN? │ Judge Note │
│  ───────────────│───────────────│─────────│──────│────────────│
│  Arabian Halter │ Midnight Star │ [1st ▾] │ [☑]  │ [        ] │
│  Stock Halter   │ Blue Roan     │ [3rd ▾] │ [☐]  │ [Very nice]│
│  Cust. Workmansh│ Silver Moon   │ [NP  ▾] │ [☐]  │ [        ] │
│  ──────────────────────────────────────────────────────────── │
│  [💾 Save All Results]                                        │
└──────────────────────────────────────────────────────────────┘
```

### Key features:
- All entries from the show string pre-populated
- Tab-through inputs (Placing → NAN checkbox → Judge Note → next row)
- Placing options: 1st-10th, HM, Grand Champion, Reserve Champion, NP (No Placement)
- NAN checkbox auto-sets `is_nan_qualifying = true` + `nan_card_type = 'performance'` (configurable)
- Single "Save All Results" button calls `convertShowStringToResults()` with all entries
- Success state: "🎉 23 results recorded! NAN cards updated."

---

## Task 2C.2 — Ring Conflict UI

**Goal:** Show string planner visually shows time-block conflicts.

### Enhancement to `/shows/planner`:
1. When entries have `time_slot` values, display as a timeline/matrix:
   ```
   9:00 AM  │ [Arabian Halter: Midnight Star] [Stock Halter: Blue Roan]
   10:00 AM │ [Performance: Silver Moon]       ⚠️ [Arabian Halter: Midnight Star]
   ```
2. Conflicts (same horse, same time slot) highlighted in red with tooltip
3. Use existing `detectConflicts()` server action — render the results visually
4. CSS for time-block grid + conflict highlighting

### Lower priority — functional without visual conflict display.

---

## Task 2C.3 — Group Registries

**Goal:** Groups can maintain an official registry where members submit horses for certification.

### New tables (migration):
```sql
CREATE TABLE group_registries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    requirements TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE registry_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registry_id UUID NOT NULL REFERENCES group_registries(id) ON DELETE CASCADE,
    horse_id UUID NOT NULL REFERENCES user_horses(id) ON DELETE CASCADE,
    submitted_by UUID NOT NULL REFERENCES auth.users(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewer_notes TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(registry_id, horse_id)
);
```

### UI:
- Group admin creates a registry with name + requirements
- Members submit horses via a "Submit to Registry" button
- Admin approves/rejects with notes
- Approved horses get a certification badge on their passport

### Lower priority — requires existing groups infrastructure.

---

## Completion Checklist

### Phase 1: Collection Pillar
- [x] `StableLedger.tsx` — high-density table with sortable columns, 40x40 thumbnails, finish badges, vault values
- [x] `DashboardShell.tsx` — wraps StableGrid + StableLedger with view toggle
- [x] Dashboard view toggle (Gallery/Ledger) with localStorage persistence
- [x] `bulkUpdateHorses()` + `bulkDeleteHorses()` server actions (ownership verified)
- [ ] Bulk Operations UI — select mode + floating action bar (server actions ready, UI deferred)
- [x] Quick Add route (`/add-horse/quick`) with "Duplicate to New" + success log
- [x] `quickAddHorse()` server action (auto-names from catalog)
- [x] Quick Add link added to dashboard header
- [ ] Photo reordering (deferred — needs `sort_order` column migration)
- [ ] `reorderHorseImages()` server action (deferred)

### Phase 2: Sharing & Social Pillar
- [ ] `visibility` column migration (public/private/unlisted) — needs migration
- [ ] 3-option visibility selector on Add + Edit forms (depends on migration)
- [ ] Show Ring query updated to filter `visibility = 'public'`
- [x] OpenGraph metadata with images on `/community/[id]` — full `og:image`, `og:title`, `og:description`
- [x] Twitter card metadata (`summary_large_image` when photo exists)
- [ ] Rich media embed preview in feed posts (lower priority)

### Phase 3: Groups & Events Pillar
- [ ] Post-Show Results Grid (`/shows/planner/[id]/results`)
- [ ] Tab-through input UX with NAN rollup
- [ ] Ring Conflict visual timeline (lower priority)
- [ ] Group Registries — schema + UI (lower priority)

### Build & Verification
- [x] `npx next build` — 0 errors (March 11, 2026)
- [x] `/add-horse/quick` route registered
- [ ] Dashboard toggle works (Gallery ↔ Ledger) — visual check needed
- [ ] Quick Add flow tested (catalog → finish → done in <10 seconds)
- [ ] OpenGraph preview tested (share URL to Discord/iMessage)

**Estimated effort:** ~12-16 hours across 3 phases

