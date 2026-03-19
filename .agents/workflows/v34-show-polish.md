---
description: V34 Showing System Polish & Realism Sprint — entry preview, results podium, judging integrity, cron transitions, and test coverage
---

# V34: Showing System Polish & Realism Sprint

> **Goal:** Make virtual photo shows feel like a legitimate, enjoyable part of the model horse hobby — not just a database feature  
> **Target audience:** NAMHSA-style competitors, regional club members, photo-show regulars  
> **Time-box:** 7–14 working days  
> **Guiding Principle:** Every change should answer: "Would this make me more likely to enter / judge / host shows instead of Facebook groups?"  
> **No regressions in:** existing voting / judging / closing flows

// turbo-all

---

## Pre-flight

1. Verify the build is clean:

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

2. Check recent git history:

```
cd c:\Project Equispace\model-horse-hub && git log --oneline -10
```

3. Read the current show infrastructure for full context:

```
View file: c:\Project Equispace\model-horse-hub\docs\architecture\show-infrastructure.md
```

4. Familiarize yourself with the key source files:

| File | Purpose |
|------|---------|
| `src/components/ShowEntryForm.tsx` (298 lines) | Entry form — horse select, photo picker, caption, submit |
| `src/components/ExpertJudgingPanel.tsx` (221 lines) | Expert judge placing assignment UI |
| `src/app/actions/shows.ts` (744 lines) | All show server actions — enter, vote, close, create, withdraw, expert placings |
| `src/app/actions/competition.ts` (898 lines) | NAN tracking, show strings, division/class CRUD |
| `src/app/shows/[id]/page.tsx` (406 lines) | Show detail page — hero, entry form, results podium, grid, discussion |
| `src/app/shows/page.tsx` | Show listing page |
| `src/app/api/cron/refresh-market/route.ts` (61 lines) | Existing cron pattern — auth via `CRON_SECRET` header |
| `supabase/migrations/092_supabase_linter_fixes.sql` (lines 371-448) | `close_virtual_show()` RPC — current implementation |

---

## Phase 1 — Entry Experience (3–5 days)

### Objective
Remove hesitation at entry time → make collectors confident their horse will look great to judges.

---

### Task 1.1: Entry Photo Preview Modal

**File:** `src/components/ShowEntryForm.tsx`

**What to build:**
After the user selects a photo and enters a caption, show a **"👁 Preview"** button alongside the **"🐴 Enter Show"** button. Clicking it opens a portal-rendered modal that shows:

1. The selected photo rendered at the **same aspect ratio (4:3)** and size used in the entries grid (`.show-entry-thumb` styling)
2. The caption rendered below in italics
3. The horse name and selected class (if any) displayed above
4. A subtle label: "This is what judges & voters will see"
5. Two CTA buttons: **"✅ Looks Good — Submit Entry"** (calls `handleSubmit`) and **"← Choose Different Photo"** (closes modal)

**Implementation details:**
- Add `import { createPortal } from "react-dom"` — the modal MUST use `createPortal(overlay, document.body)` to avoid CSS containment issues (established project convention)
- Add a `showPreview` boolean state
- The preview modal should reuse the existing `.modal-overlay` and `.modal-content` CSS classes from `globals.css`
- The preview photo should use `object-fit: cover` with `aspect-ratio: 4/3` to match show grid rendering
- The "Submit Entry" button inside the preview should call the existing `handleSubmit` function and close the modal on success

**CSS:** Add styles to `src/app/competition.css` (the existing competition-specific stylesheet):
```css
.show-preview-modal { /* ... styles */ }
.show-preview-photo { aspect-ratio: 4/3; object-fit: cover; border-radius: var(--radius-md); max-width: 400px; width: 100%; }
.show-preview-caption { font-style: italic; color: var(--color-text-secondary); margin-top: var(--space-sm); }
.show-preview-label { font-size: calc(0.75rem * var(--font-scale)); color: var(--color-text-muted); text-align: center; }
.show-preview-actions { display: flex; gap: var(--space-sm); justify-content: center; margin-top: var(--space-md); }
```

**Verification:**
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

### Task 1.2: Smart Class Browser / Filter UI

**File:** `src/components/ShowEntryForm.tsx`

**What to change:**
The current class selector is a flat `<select>` with `<optgroup>` dividers (lines 163–178). Replace it with a more guided experience:

1. **Searchable text input** above the class list — `type="text"` with `onChange` that filters classes by name (case-insensitive substring match)
2. **Scale match indicator:** When a horse is selected, fetch its scale from the `catalog_items` join. For each class with `allowed_scales`, show:
   - ✅ green checkmark if the horse's scale is in `allowed_scales`
   - ⚠️ yellow warning icon if scale doesn't match (with tooltip: "Your horse is [scale], this class requires [allowed_scales]")
   - No indicator if the class has no scale restriction
3. **Entry count display:** Each class option should show the current entry count (e.g., "Arabian Halter (3 entries)")
4. **NAN qualifying badge:** If a class has `is_nan_qualifying = true`, show a small "NAN" badge next to it

**Data requirements:**
- The `classes` prop already includes `id`, `name`, and `divisionName`
- You need to extend `ShowEntryFormProps` to accept `classDetails` with `allowedScales`, `isNanQualifying`, `maxEntries`, and `currentEntryCount`
- Pass this data from the show detail page (`src/app/shows/[id]/page.tsx`) where `getEventDivisions()` is already called (it returns `DivisionClass[]` with `allowedScales`, `isNanQualifying`, `maxEntries`, `entryCount`)

**Implementation:**
- Change the prop from `classes?: { id: string; name: string; divisionName: string }[]` to include the extra fields
- Update `src/app/shows/[id]/page.tsx` to pass the richer data
- The search input should use `useState<string>("")` for the filter term
- Filter logic: `classes.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))`
- Render as a scrollable list (`max-height: 240px; overflow-y: auto`) instead of a `<select>`, with radio-button-style selection
- Each item is a clickable `<button type="button">` with visual selected state

**CSS:** Add to `competition.css`:
```css
.class-browser { max-height: 240px; overflow-y: auto; border: 1px solid var(--color-border); border-radius: var(--radius-md); }
.class-browser-item { /* button styling with hover + selected state */ }
.class-browser-item.selected { background: rgba(var(--color-accent-rgb), 0.15); border-left: 3px solid var(--color-accent-primary); }
.class-nan-badge { /* small gold badge */ }
.class-scale-match { color: var(--color-success); }
.class-scale-warn { color: var(--color-warning); }
```

**Verification:**
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

### Task 1.3: Mobile Entry Quick Wins

**File:** `src/app/competition.css`

**What to change:**
1. **Larger touch targets on photo grid:** The `.show-entry-photo-btn` buttons need minimum 48×48px tap targets on mobile
2. **Better spacing:** Increase gap on `.show-entry-photo-grid` for mobile
3. **Responsive preview modal:** Ensure the preview modal from Task 1.1 is full-width on mobile with appropriate padding

**CSS additions to `competition.css`:**
```css
@media (max-width: 768px) {
  .show-entry-photo-btn { min-width: 72px; min-height: 72px; }
  .show-entry-photo-grid { gap: var(--space-sm); }
  .show-preview-photo { max-width: 100%; }
  .show-preview-actions { flex-direction: column; }
}
```

**Verification:**
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

### Phase 1 Checkpoint

Before proceeding to Phase 2, verify:
- [ ] Preview modal renders correctly with photo at 4:3 aspect ratio
- [ ] Preview "Submit Entry" button successfully submits and closes modal
- [ ] Class browser search filters correctly
- [ ] Scale match indicators display properly
- [ ] Mobile touch targets are ≥ 48px
- [ ] No regressions in existing entry flow

Commit:
```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "feat(V34/P1): entry preview modal, smart class browser, mobile touch targets"
```

---

## Phase 2 — Results & Victory Moment (3–5 days)

### Objective
Closing a show should feel like winning a ribbon — not reading a spreadsheet.

---

### Task 2.1: Dedicated Results View with Podium Layout

**File:** `src/app/shows/[id]/page.tsx`

**What to change:**
The current results display (lines 197–261) is a basic card with small thumbnails. Replace it with a **premium podium layout**:

1. **Podium section** (top 3): Three large cards side-by-side with:
   - Large photo (200×150 or larger, 4:3 ratio)
   - Ribbon color bar at top of each card (Blue for 1st, Red for 2nd, Yellow for 3rd — use CSS background-color)
   - Medal emoji + placing label
   - Horse name (linked to passport)
   - Owner name (linked to profile)
   - Caption in italics if present
   - For expert-judged shows: show the manual placing; for community vote: show vote count

2. **Champion/Reserve banners:** If any entry has `placing` of "Champion" or "Reserve Champion", render a hero banner above the podium with a gold/silver gradient border

3. **Full ranked list** below the podium: All entries in order with small thumbnails (the existing card layout can stay, but with ribbon color indicators)

4. **Ribbon color mapping** — reuse the same map from `saveExpertPlacings` in `shows.ts` (lines 677–692):
   ```
   1st → Blue, 2nd → Red, 3rd → Yellow, 4th → White, 5th → Pink, 6th → Green, HM → Green
   ```

**CSS additions to `competition.css`:**
```css
.results-podium { display: flex; justify-content: center; gap: var(--space-xl); flex-wrap: wrap; padding: var(--space-xl) 0; }
.podium-card { text-align: center; min-width: 180px; max-width: 240px; background: var(--color-surface); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-lg); }
.podium-ribbon { height: 4px; width: 100%; }
.podium-ribbon-blue { background: #2563eb; }
.podium-ribbon-red { background: #dc2626; }
.podium-ribbon-yellow { background: #eab308; }
.podium-photo { width: 100%; aspect-ratio: 4/3; object-fit: cover; }
.podium-card-first { transform: scale(1.1); z-index: 1; }
/* Champion banner */
.champion-banner { /* gradient gold border, centered, celebratory */ }
```

```css
@media (max-width: 768px) {
  .results-podium { flex-direction: column; align-items: center; }
  .podium-card-first { transform: none; }
}
```

**Verification:**
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

### Task 2.2: Personalized Show Result Notifications

**File:** `src/app/actions/shows.ts`

**What to change:**
The current `updateShowStatus` function (line 494–524) sends a **generic** notification to all entrants. Replace with **personalized** notifications that include the horse name and placing:

1. After the `close_virtual_show` RPC returns successfully, query `event_entries` with `placing` values
2. For each placed entry (1st–6th + HM + Champion/Reserve):
   - Send personalized notification: `"🏆 Congratulations! Your [Horse Name] took [Placing] in [Show Name]!"`
   - Include the appropriate medal emoji: 🥇 🥈 🥉 🏅 🎗️
3. For unplaced entries:
   - Send: `"📸 Results are in for \"[Show Name]\"! Thanks for entering."`

**Implementation details:**
- Query placed entries inside the `after()` callback (serverless-safe)
- Fetch horse names from `user_horses` joined with `event_entries`
- Use the existing `createNotification` pattern from `notifications.ts` — note: there is no exported `createNotification` function; use direct `admin.from("notifications").insert(...)` as the existing code already does (line 409)
- Set notification `type` to `"show_result"`

**Verification:**
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

### Task 2.3: Personal Show History Widget

**File:** New component: `src/components/ShowHistoryWidget.tsx`

**What to build:**
A "Your Show Placings" card that can be rendered on the dashboard sidebar or a profile tab. It:

1. Queries `show_records` for the current user, grouped by year
2. Shows ribbon icon counts per year (e.g., "2026: 🥇×2 🥈×1 🥉×3")
3. Links to the horse's hoofprint page for each record
4. Shows total shows entered / total ribbons won

**Data source:**
Create a new server action in `src/app/actions/shows.ts`:

```ts
/** Get show history summary for the current user */
export async function getShowHistory(): Promise<{
    years: { year: number; records: { horseName: string; horseId: string; showName: string; placing: string; ribbonColor: string | null }[] }[];
    totalShows: number;
    totalRibbons: number;
}> {
    // Query show_records for user, group by year
}
```

**Component details:**
- `"use client"` component
- Compact card design matching the existing dashboard sidebar widgets
- Collapsible year sections (default: current year expanded)
- Use CSS Module: `ShowHistoryWidget.module.css`
- Ribbon emoji mapping: 🥇 (Blue/1st), 🥈 (Red/2nd), 🥉 (Yellow/3rd), 🎗️ (HM), 🏆 (Champion)

**Integration point:**
Add the widget to `src/app/dashboard/page.tsx` in the sidebar section (after the NAN dashboard widget).

```
View file: src/app/dashboard/page.tsx
```

Pass the data from the server component page → client component widget.

**Verification:**
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

### Phase 2 Checkpoint

- [ ] Podium layout renders with large photos and ribbon colors
- [ ] Champion/Reserve banners display correctly
- [ ] Personalized notifications sent on show close
- [ ] Show history widget renders on dashboard
- [ ] Mobile podium stacks vertically
- [ ] No regressions in existing results display

Commit:
```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "feat(V34/P2): results podium, personalized notifications, show history widget"
```

---

## Phase 3 — Judging Integrity & Reliability Fixes (2–4 days)

### Objective
Eliminate edge cases that would make serious competitors distrust the platform.

---

### Task 3.1: Fix Expert Judging Precedence in `close_virtual_show()`

**File:** New migration: `supabase/migrations/095_show_polish.sql`

**The problem:**
The `close_virtual_show()` RPC (migration 092, lines 371–448) **always** ranks entries by `votes_count` and assigns 1st/2nd/3rd based on vote order. For expert-judged shows (`judging_method = 'expert_judge'`), placings are manually assigned via `saveExpertPlacings()` BEFORE closing. The RPC then **overwrites** those manual placings with vote-based rankings.

**The fix:**
Modify the `close_virtual_show()` RPC to:
1. Check if the event has `judging_method = 'expert_judge'`
2. If YES: skip the vote-based ranking loop entirely. Only use the pre-existing `placing` values from `event_entries` (set by `saveExpertPlacings()`). Generate `show_records` from those existing placings.
3. If NO (community_vote): proceed with the existing vote-based ranking logic.

**New RPC body:**
```sql
CREATE OR REPLACE FUNCTION public.close_virtual_show(p_event_id UUID, p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_event RECORD;
  v_entry RECORD;
  v_rank INTEGER := 0;
  v_records_created INTEGER := 0;
  v_total_entries INTEGER;
  v_judging_method TEXT;
BEGIN
  SELECT id, name, created_by, event_type, show_status, starts_at, judging_method
  INTO v_event FROM public.events WHERE id = p_event_id;

  IF v_event IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found');
  END IF;
  IF v_event.created_by != p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the event creator can close the show');
  END IF;
  IF v_event.show_status = 'closed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already closed');
  END IF;

  v_judging_method := COALESCE(v_event.judging_method, 'community_vote');

  UPDATE public.events SET show_status = 'closed' WHERE id = p_event_id;

  SELECT count(*) INTO v_total_entries
  FROM public.event_entries WHERE event_id = p_event_id AND entry_type = 'entered';

  IF v_judging_method = 'expert_judge' THEN
    -- EXPERT-JUDGED: use pre-assigned placings from saveExpertPlacings()
    -- Only generate show_records for entries that already have a placing
    FOR v_entry IN
      SELECT ee.id, ee.horse_id, ee.user_id, ee.placing, ee.class_name
      FROM public.event_entries ee
      WHERE ee.event_id = p_event_id AND ee.entry_type = 'entered' AND ee.placing IS NOT NULL
    LOOP
      -- Check for existing show_record to avoid duplicates
      IF NOT EXISTS (
        SELECT 1 FROM public.show_records
        WHERE horse_id = v_entry.horse_id AND show_name = v_event.name AND placing = v_entry.placing
      ) THEN
        INSERT INTO public.show_records (
          horse_id, user_id, show_name, show_date, placing, division,
          show_type, class_name, total_entries, verification_tier
        ) VALUES (
          v_entry.horse_id, v_entry.user_id, v_event.name,
          v_event.starts_at::date, v_entry.placing, v_entry.class_name,
          'photo_mhh', v_entry.class_name, v_total_entries, 'mhh_auto'
        );
        v_records_created := v_records_created + 1;
      END IF;
    END LOOP;
  ELSE
    -- COMMUNITY VOTE: rank by votes, assign placings
    FOR v_entry IN
      SELECT ee.id, ee.horse_id, ee.user_id, ee.votes_count, ee.class_name
      FROM public.event_entries ee
      WHERE ee.event_id = p_event_id AND ee.entry_type = 'entered'
      ORDER BY ee.votes_count DESC, ee.created_at ASC
    LOOP
      v_rank := v_rank + 1;

      UPDATE public.event_entries SET placing =
        CASE v_rank
          WHEN 1 THEN '1st'
          WHEN 2 THEN '2nd'
          WHEN 3 THEN '3rd'
          ELSE v_rank || 'th'
        END
      WHERE id = v_entry.id;

      IF v_rank <= 10 THEN
        INSERT INTO public.show_records (
          horse_id, user_id, show_name, show_date, placing, division,
          show_type, class_name, total_entries, verification_tier
        ) VALUES (
          v_entry.horse_id, v_entry.user_id, v_event.name,
          v_event.starts_at::date,
          CASE v_rank
            WHEN 1 THEN '1st' WHEN 2 THEN '2nd' WHEN 3 THEN '3rd'
            ELSE v_rank || 'th'
          END,
          v_entry.class_name,
          'photo_mhh', v_entry.class_name, v_total_entries, 'mhh_auto'
        );
        v_records_created := v_records_created + 1;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'entries_ranked', CASE WHEN v_judging_method = 'expert_judge' THEN v_records_created ELSE v_rank END,
    'records_created', v_records_created,
    'judging_method', v_judging_method
  );
END;
$$;
```

**Also in the same migration, add the new show_records columns from Task 3.4:**
```sql
-- Enrich show_records for better NAMHSA paperwork support
ALTER TABLE show_records ADD COLUMN IF NOT EXISTS judge_notes TEXT;
COMMENT ON COLUMN show_records.judge_notes IS 'Private judge notes or critique for the entry.';

ALTER TABLE show_records ADD COLUMN IF NOT EXISTS total_class_entries INT;
COMMENT ON COLUMN show_records.total_class_entries IS 'Number of entries in this specific class (vs total show entries).';

ALTER TABLE show_records ADD COLUMN IF NOT EXISTS judge_user_id UUID REFERENCES auth.users(id);
COMMENT ON COLUMN show_records.judge_user_id IS 'The user who judged/placed this entry (for expert-judged shows).';
```

**Verification:**
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

### Task 3.2: Daily Auto-Transition Cron

**File:** New file: `src/app/api/cron/transition-shows/route.ts`

**What to build:**
A Vercel cron endpoint that automatically transitions shows from `open` → `judging` when their `ends_at` deadline has passed. The app already has lazy auto-transition logic in `getShowEntries()` (lines 129–137 of `shows.ts`) and in `getPhotoShows()` (lines 83–87), but these only fire when someone views the page. The cron ensures no show stays "open" forever.

**Implementation — follow the existing cron pattern from `src/app/api/cron/refresh-market/route.ts`:**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
    // 1. Verify CRON_SECRET (same pattern as refresh-market)
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const admin = getAdminClient();

        // 2. Find all shows past their deadline that are still "open"
        const { data: expiredShows, error } = await admin
            .from("events")
            .select("id, name")
            .eq("show_status", "open")
            .lt("ends_at", new Date().toISOString())
            .in("event_type", ["photo_show", "live_show"]);

        if (error) throw error;

        let transitioned = 0;
        for (const show of (expiredShows ?? [])) {
            // CAS guard: only update if still "open"
            const { error: updateError } = await admin
                .from("events")
                .update({ show_status: "judging" })
                .eq("id", show.id)
                .eq("show_status", "open");

            if (!updateError) transitioned++;
        }

        return NextResponse.json({
            success: true,
            transitioned,
            checkedAt: new Date().toISOString(),
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
```

**Update `vercel.json`** to add the new cron job:
```json
{
    "crons": [
        {
            "path": "/api/cron/refresh-market",
            "schedule": "0 6 * * *"
        },
        {
            "path": "/api/cron/transition-shows",
            "schedule": "0 */6 * * *"
        }
    ]
}
```

**Verification:**
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

### Task 3.3: Host Manual Placing Override (Post-Close Safety Net)

**File:** `src/app/actions/shows.ts`

**What to build:**
A new server action that allows the show creator (host) to override final placings even after a show is closed. This is the "admin safety net" for correcting obvious mistakes.

```ts
/** Override final placings for a closed or judging show (host only). */
export async function overrideFinalPlacings(
    eventId: string,
    placings: { entryId: string; placing: string }[]
): Promise<{ success: boolean; error?: string }>
```

**Implementation:**
1. Verify the caller is the event creator (not just admin — the host owns the show)
2. Allow the action when `show_status` is `'judging'` or `'closed'`
3. Update `event_entries.placing` for each entry
4. If the show is already closed (has `show_records`), also update the corresponding `show_records` entries
5. Log an audit note: update `show_records.notes` to append `"[Override by host on YYYY-MM-DD]"`
6. Revalidate the show detail page

**UI integration:**
In `src/app/shows/[id]/page.tsx`, add an **"Adjust Final Placings"** button visible to the creator when `show.status === 'judging' || show.status === 'closed'`. This button renders the `ExpertJudgingPanel` component (already built) for override purposes.

The `ExpertJudgingPanel` already calls `saveExpertPlacings()` which checks `judging_method === "expert_judge"`. The override button should instead call the new `overrideFinalPlacings()` action directly, bypassing the judging_method check.

**Option:** Create a thin wrapper component `OverridePlacingsPanel.tsx` that wraps `ExpertJudgingPanel` but submits to the new action.

**Verification:**
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

### Task 3.4: Enrich Show Records

**Note:** The migration SQL for this task is already included in Task 3.1's migration file (`095_show_polish.sql`). The columns are: `judge_notes`, `total_class_entries`, and `judge_user_id`.

**Server action changes:**
Update `saveExpertPlacings()` in `src/app/actions/shows.ts` to populate the new fields when inserting show_records:
- Set `judge_user_id` to the acting user's ID
- Set `total_class_entries` to the count of entries in the same `class_id`

**UI changes:**
In `ExpertJudgingPanel.tsx`, add an optional **"Judge Notes"** textarea per entry (collapsible, hidden by default). When saved, include the notes in the placings payload and store in `show_records.judge_notes`.

**Verification:**
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

### Phase 3 Checkpoint

- [ ] Expert-judged shows respect manual placings when closed (no vote-based override)
- [ ] Cron transitions expired open shows to judging
- [ ] Host can override placings post-close
- [ ] Show records include judge_notes and judge_user_id
- [ ] No regressions in community-vote show closing

Commit:
```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "feat(V34/P3): expert judging fix, cron transitions, host override, enriched show records"
```

---

## Phase 4 — Polish & Testing (2–3 days)

### Task 4.1: Vitest Unit Tests

**File:** `src/app/actions/__tests__/shows.test.ts` (new or extend existing)

Write Vitest tests covering:

1. **`enterShow()` validation edge cases:**
   - Scale mismatch → returns error
   - Max 3 entries per user → returns error on 4th
   - Show not open → returns error
   - Entry deadline passed → returns error
   - Horse not public → returns error

2. **Show close behavior:**
   - Community vote: entries ranked by votes_count
   - Expert judge: pre-assigned placings preserved (not overwritten)

3. **Cron transition logic:**
   - Shows past deadline transition from open → judging
   - Shows not past deadline remain open

Use the existing Supabase mock factory pattern from `src/__tests__/mocks/supabase.ts`.

```
View file: src/__tests__/mocks/supabase.ts
```

**Run tests:**
```
cd c:\Project Equispace\model-horse-hub && npx vitest run src/app/actions/__tests__/shows.test.ts
```

---

### Task 4.2: Playwright E2E Tests

**File:** `e2e/show-entry.spec.ts` (new)

Write Playwright E2E tests for critical flows:

1. **Enter show → preview photo → submit:**
   - Navigate to an open show
   - Select a horse
   - Select a photo
   - Click "Preview"
   - Verify preview modal shows photo + caption
   - Click "Submit" from preview
   - Verify success message

2. **Judge assigns placings → close → verify results:**
   - As show host, navigate to judging show
   - Assign placings via ExpertJudgingPanel
   - Close show
   - Verify results podium displays correct placings

3. **Mobile entry flow:**
   - Set viewport to 375×812
   - Complete entry flow
   - Verify touch targets and layout

**Run E2E:**
```
cd c:\Project Equispace\model-horse-hub && npx playwright test e2e/show-entry.spec.ts
```

---

### Task 4.3: Documentation Updates

1. **Update show infrastructure docs:**
   ```
   View file: c:\Project Equispace\model-horse-hub\docs\architecture\show-infrastructure.md
   ```
   Add sections for:
   - Entry preview modal flow
   - Smart class browser
   - Expert judging precedence fix
   - Cron auto-transition
   - Host override flow
   - Show history widget

2. **Update the master state report:**
   ```
   View file: c:\Project Equispace\model-horse-hub\.agents\docs\model_horse_hub_state_report.md
   ```
   Add V34 to the shipped features list.

3. **Update dev-nextsteps:**
   ```
   View file: c:\Project Equispace\model-horse-hub\.agents\workflows\dev-nextsteps.md
   ```
   Archive V34 as completed.

4. **Add JSDoc** to all new/modified server actions in `shows.ts`.

---

### Final Release Gates

- [ ] All new backend logic has Vitest unit tests
- [ ] Critical flows (entry → preview → results) pass E2E
- [ ] `npx next build` passes with 0 errors
- [ ] No visual regressions in show detail / results pages
- [ ] Manual smoke test: create show → enter 3 horses → vote → judge → close → verify records & notifications
- [ ] Documentation updated

**Final build:**
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

**Final commit & push:**
```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "feat(V34): showing system polish & realism sprint — entry preview, results podium, judging integrity, cron, tests" && git push
```

---

## Summary of All Deliverables

| # | Deliverable | Type | Files |
|---|---|---|---|
| 1.1 | Entry Photo Preview Modal | Component enhancement | `ShowEntryForm.tsx`, `competition.css` |
| 1.2 | Smart Class Browser | Component enhancement | `ShowEntryForm.tsx`, `shows/[id]/page.tsx`, `competition.css` |
| 1.3 | Mobile Entry Tweaks | CSS | `competition.css` |
| 2.1 | Results Podium Layout | Page enhancement | `shows/[id]/page.tsx`, `competition.css` |
| 2.2 | Personalized Notifications | Server action | `shows.ts` |
| 2.3 | Show History Widget | New component | `ShowHistoryWidget.tsx`, `ShowHistoryWidget.module.css`, `dashboard/page.tsx`, `shows.ts` |
| 3.1 | Expert Judging Fix | Migration + RPC | `095_show_polish.sql` |
| 3.2 | Cron Auto-Transition | New API route | `api/cron/transition-shows/route.ts`, `vercel.json` |
| 3.3 | Host Override Placings | Server action + UI | `shows.ts`, `shows/[id]/page.tsx` |
| 3.4 | Enriched Show Records | Migration + action | `095_show_polish.sql`, `shows.ts`, `ExpertJudgingPanel.tsx` |
| 4.1 | Vitest Tests | Tests | `__tests__/shows.test.ts` |
| 4.2 | Playwright E2E | Tests | `e2e/show-entry.spec.ts` |
| 4.3 | Documentation | Docs | Multiple `.md` files |
