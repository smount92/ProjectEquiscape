---
description: Beta Feedback Sprint 1 — Critical bugs and quick wins. Edit redirect, watermark double-@, Show Lineup double-entry, WIP condition lock, vault trade checkbox, passport class names, Packer/Passport parity.
---

# Beta Feedback Sprint 1 — Critical Bugs & Quick Wins

> **Source:** Beta Feedback Round 2 (June 2026), triaged by Architect Agent
> **Scope:** 8 targeted bug fixes and UX corrections. No new features, no schema changes (except vault `is_trade`).
> **Estimated effort:** 1–2 days

**MANDATORY:** Read `.agents/MASTER_BLUEPRINT.md` first. All Iron Laws apply.

// turbo-all

---

## Pre-Flight Check

Verify the build is clean before starting:

```powershell
cd "c:\Project Equispace\model-horse-hub" && cmd /c "npx next build 2>&1"
```

Check recent git state:

```powershell
cd "c:\Project Equispace\model-horse-hub" && git log --oneline -5
```

After confirming a clean build, proceed task by task. Run `npx next build` after every task.

---

## Fix 1: After Edit → Return to Horse Page (not Dashboard)

**Problem:** After editing a horse in `/stable/[id]/edit`, the user is redirected to `/dashboard` instead of back to the horse's own page (`/stable/[id]`).

**File:** `src/app/stable/[id]/edit/page.tsx`

Search for the `router.push` or redirect that sends the user to `/dashboard` after a successful save. It will be triggered inside the `handleSubmit` success path.

**Change:** Replace the redirect destination from `/dashboard` to `/stable/${horseId}` where `horseId` is the horse's `id` from the URL params (already available as `params.id` in the page component).

```ts
// ❌ CURRENT (approximate):
router.push("/dashboard");

// ✅ FIX:
router.push(`/stable/${params.id}`);
```

> [!NOTE]
> The edit page already has `params.id` available from the dynamic route — no extra fetch needed.

**Validation:**
1. Edit any horse → change a field → click Save
2. Confirm you land on `/stable/[that-horse-id]` not `/dashboard`

```powershell
cd "c:\Project Equispace\model-horse-hub" && cmd /c "npx next build 2>&1"
```

---

## Fix 2: Watermark Double "@@" Bug

**Problem:** The watermark text is built as `` `© @${aliasName}` `` in `imageCompression.ts`. If the user's `aliasName` is already stored with a leading `@` (e.g. `@JaneDoe`), the result renders as `© @@JaneDoe`.

**File:** `src/lib/utils/imageCompression.ts`
**Line:** 203

```ts
// ❌ CURRENT (line 203):
const text = `© @${aliasName} — ModelHorseHub`;

// ✅ FIX — strip any existing leading @ before prepending:
const cleanAlias = aliasName.replace(/^@+/, "");
const text = `© @${cleanAlias} — ModelHorseHub`;
```

**Validation:**
1. In Settings, confirm your alias is stored with or without `@`
2. Upload a photo with watermarking enabled
3. Confirm the watermark shows `© @YourAlias — ModelHorseHub` with exactly one `@`

```powershell
cd "c:\Project Equispace\model-horse-hub" && cmd /c "npx next build 2>&1"
```

---

## Fix 3: WIP Life Stage → Condition Grade Becomes N/A

**Problem:** When a horse's `life_stage` is set to `Work in Progress` (WIP), the condition grade field is still editable and required. But a WIP horse hasn't been finished — grading its condition doesn't make sense. The field should be hidden or locked to "N/A" when WIP is selected.

**File:** `src/app/stable/[id]/edit/page.tsx`

**Step 3.1 — Find the condition grade field in the edit form.** It is controlled by `conditionGrade` / `setConditionGrade` state and rendered as a `<select>` or `<Input>` in the form.

**Step 3.2 — Add conditional logic:**

When `lifeStage === "Work in Progress"`, automatically set `conditionGrade` to `""` (empty/none) and disable the field:

```tsx
// Add a useEffect or inline logic:
// When lifeStage changes to WIP, clear condition grade
useEffect(() => {
  if (lifeStage === "Work in Progress") {
    setConditionGrade("");
  }
}, [lifeStage]);
```

**Step 3.3 — In the JSX, add a disabled state and helper text:**

```tsx
// Wrap the condition grade field:
<div className={lifeStage === "Work in Progress" ? "opacity-40 pointer-events-none" : ""}>
  {/* existing condition grade select/input */}
  {lifeStage === "Work in Progress" && (
    <p className="text-xs text-muted-foreground mt-1">
      Condition grade is not applicable for Work in Progress horses.
    </p>
  )}
</div>
```

**Step 3.4 — Also check the Add Horse form** (`src/app/add-horse/page.tsx`) for the same condition grade field and apply the same WIP lock logic there.

**Step 3.5 — Server action guard** (`src/app/actions/horse.ts`):

In `updateHorseAction`, find where `condition_grade` is set. It already has `isModel ? conditionGrade : null` — add a WIP check:

```ts
// ❌ CURRENT (approximate):
condition_grade: isModel ? conditionGrade : null,

// ✅ FIX:
condition_grade: isModel && lifeStage !== "Work in Progress" ? conditionGrade || null : null,
```

**Validation:**
1. Edit a horse → select "Work in Progress" as Life Stage
2. Confirm condition grade field grays out / becomes disabled
3. Save → confirm `condition_grade` is `null` in the database for that horse
4. Switch back to "Completed" → condition grade field becomes active again

```powershell
cd "c:\Project Equispace\model-horse-hub" && cmd /c "npx next build 2>&1"
```

---

## Fix 4: Financial Vault — "Was a Trade" Checkbox

**Problem:** Collectors who acquired a horse via trade (no cash exchanged) have no way to record this. The purchase price field is misleading when the horse was a trade.

This fix has two parts: a migration (new column) and a UI update.

### 4.1 — Migration: Add `is_trade` to `financial_vault`

Create `supabase/migrations/115_vault_is_trade.sql`:

```sql
-- Migration 115: Add is_trade flag to financial_vault
-- Marks a horse as acquired via trade (no cash value)

ALTER TABLE financial_vault
  ADD COLUMN IF NOT EXISTS is_trade BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN financial_vault.is_trade IS 'True when the horse was acquired via trade with no cash exchanged.';
```

Apply via Supabase SQL editor.

### 4.2 — Update TypeScript types

**File:** `src/lib/types/database.generated.ts`

Find the `financial_vault` Row/Insert/Update type blocks and add:
```ts
is_trade: boolean
```
to the Row type, and:
```ts
is_trade?: boolean
```
to Insert and Update types.

Also update `src/lib/types/database.ts` if there is a manual `FinancialVault` interface — add `isTrade: boolean`.

### 4.3 — Update Server Action

**File:** `src/app/actions/horse.ts`

In the vault update/create logic, allow `isTrade` in the payload:

```ts
// In the vault upsert block, add:
if (typeof vaultData.isTrade === "boolean") {
  vaultPayload.is_trade = vaultData.isTrade;
}
```

### 4.4 — Update Financial Vault UI

**File:** Find the Vault UI component (likely `VaultReveal.tsx`, `FinancialVaultForm.tsx`, or inline in the add/edit horse form).

Add a checkbox for "Was a Trade":

```tsx
<label className="flex items-center gap-2 text-sm">
  <input
    type="checkbox"
    id="vault-is-trade"
    checked={isTrade}
    onChange={(e) => setIsTrade(e.target.checked)}
    className="rounded border-input"
  />
  <span>Acquired via trade (no cash exchanged)</span>
</label>

{/* When isTrade is true, dim the price fields */}
<div className={isTrade ? "opacity-40 pointer-events-none" : ""}>
  {/* Purchase Price field */}
  {/* Estimated Value field */}
</div>
{isTrade && (
  <p className="text-xs text-muted-foreground">
    Price fields are disabled for trade acquisitions.
  </p>
)}
```

**Validation:**
1. Edit a horse → open Financial Vault → check "Was a Trade"
2. Confirm price fields dim/disable
3. Save → confirm `is_trade = true` in Supabase `financial_vault` table
4. Re-open → confirm checkbox is still checked

```powershell
cd "c:\Project Equispace\model-horse-hub" && cmd /c "npx next build 2>&1"
```

---

## Fix 5: Show Lineup — Double-Entry Bug on Re-Open

**Problem:** When a user saves their winnings in Show Lineup (formerly Show Packer), closes, and reopens the string, saving again creates duplicate `show_records` entries.

**Root cause:** `batchRecordResults()` in `src/app/actions/shows.ts` (lines 650–694) uses a raw `.insert()` with no duplicate check. If called twice for the same horse + show + class combination, it inserts duplicate records.

**File:** `src/app/actions/shows.ts`

**Fix — add a deduplication check before insert:**

```ts
// In batchRecordResults(), before the insert block (around line 678):

// ✅ FIX — check for existing records and skip duplicates
const dedupedInserts = [];
for (const r of validRecords) {
  const { data: existing } = await supabase
    .from("show_records")
    .select("id")
    .eq("horse_id", r.horseId)
    .eq("show_name", r.showName)
    .eq("user_id", user.id)
    // Use class_name if it exists, or fall back to division
    .maybeSingle();

  if (!existing) {
    dedupedInserts.push({
      horse_id: r.horseId,
      user_id: user.id,
      show_name: r.showName,
      show_date: r.showDate,
      division: r.division,
      class_name: r.className,       // ← include class_name
      placing: r.placing,
      ribbon_color: r.ribbonColor,
      verification_tier: "self_reported",
    });
  }
}

if (dedupedInserts.length === 0) {
  return { success: true, count: 0 };
}

const { error } = await supabase.from("show_records").insert(dedupedInserts);
```

> [!WARNING]
> The dedup query above checks `horse_id + show_name + user_id`. This may be too broad if a horse is entered in multiple classes at the same show. The proper dedup key should be `horse_id + show_name + class_name`. Review `show_records` schema to confirm `class_name` column exists. If it does not, note it for Sprint 2 (Show System Overhaul) which adds class-level fields.

**Also fix: Show Lineup UI should mark entries as "already saved"**

In `ShowStringManager.tsx`, after a successful `batchRecordResults()` call, set a local state flag `hasSaved = true` and show a banner: "✅ Results saved. Re-saving will skip already-recorded entries."

**Validation:**
1. Open Show Lineup → add entries → click Save Results
2. Close and reopen the same string
3. Click Save Results again
4. Open Supabase → check `show_records` table → confirm NO duplicate rows

```powershell
cd "c:\Project Equispace\model-horse-hub" && cmd /c "npx next build 2>&1"
```

---

## Fix 6: Show Lineup — Ribbon Color / Place Duplicate Field Audit

**Problem:** Users report "two spots for the same thing" — the Show Lineup appears to have both a `ribbon_color` and a `placing` (or similar) field that capture overlapping information.

**Investigation steps:**

1. Open `src/components/ShowStringManager.tsx` (or the Show Lineup entry form component)
2. Find all input fields related to ribbon color, place/placing, and award
3. Check `show_records` schema columns: `ribbon_color`, `placing`, `award_category` — these are three separate fields, but the UI may be exposing all three in a confusing way

**Expected resolution:**

The fields serve different purposes:
- `placing` → numeric/label place: 1st, 2nd, Champion, Reserve, etc.
- `ribbon_color` → the physical ribbon color: Blue, Red, Yellow, etc.
- `award_category` → the type of award: Breed, Color, Workmanship, etc.

**Fix:** In the Show Lineup entry form, restructure the layout so these fields are clearly labeled and visually grouped:

```
[ CLASS NAME          ]
[ PLACING    ▼       ]   (1st, 2nd, 3rd, Champion, Reserve, etc.)
[ RIBBON COLOR ▼    ]   (Blue, Red, Yellow, etc.)
[ AWARD TYPE ▼      ]   (optional: Breed, Color, Workmanship)
```

If there are literally two inputs that write to the same field (e.g., two separate `ribbonColor` dropdowns or a `place` text box AND a `placing` dropdown), consolidate to one.

**Check the `batchRecordResults` payload** — if `className` is missing from the insert (currently the action signature has `className` but it maps to nothing in the insert object on line 678–687), add it:

```ts
// ❌ CURRENT insert object (lines 678–687) — className is NOT written to DB:
const inserts = validRecords.map(r => ({
  horse_id: r.horseId,
  user_id: user.id,
  show_name: r.showName,
  show_date: r.showDate,
  division: r.division,
  placing: r.placing,
  ribbon_color: r.ribbonColor,
  verification_tier: "self_reported",
}));

// ✅ FIX — add class_name if the column exists in show_records:
const inserts = validRecords.map(r => ({
  horse_id: r.horseId,
  user_id: user.id,
  show_name: r.showName,
  show_date: r.showDate,
  division: r.division,
  class_name: r.className || null,   // ← was being collected but not saved!
  placing: r.placing,
  ribbon_color: r.ribbonColor,
  verification_tier: "self_reported",
}));
```

> [!IMPORTANT]
> Check migration history to confirm `class_name` column exists on `show_records`. If it does not, this is a Sprint 2 schema task. Do NOT add it ad-hoc here — note it and move on.

**Validation:**
1. Open Show Lineup → enter a result with placing AND ribbon color
2. Confirm both fields save correctly and appear on the horse's Passport
3. Confirm there are no duplicate or overlapping inputs in the form

```powershell
cd "c:\Project Equispace\model-horse-hub" && cmd /c "npx next build 2>&1"
```

---

## Fix 7: Passport — Class Names Missing from Winnings Display

**Problem:** On the Public Passport (`/community/[id]`), the show winnings section does not display the class name, only the division and placing. Users see "1st Place" but not "1st Place — Western Pleasure."

**Investigation:**

1. Find the show records display component — likely `ShowRecordTimeline.tsx` or inline in `src/app/community/[id]/page.tsx`
2. Check what fields are being fetched from `show_records` in the server query
3. Confirm `class_name` (or equivalent) is in the SELECT

**File:** `src/app/community/[id]/page.tsx` (or the server action that fetches horse data for the passport)

Find the `show_records` query. It currently likely selects:
`show_name, show_date, placing, ribbon_color, division, is_nan`

**Fix — add `class_name` to the select:**
```ts
.select("show_name, show_date, placing, ribbon_color, division, class_name, is_nan, notes, show_location, award_category, competition_level, show_date_text, judge_notes")
```

**Also update the display component** to render `class_name` when present:

```tsx
// In the show record display:
<span className="font-medium">{record.placing}</span>
{record.className && (
  <span className="text-muted-foreground"> — {record.className}</span>
)}
{record.division && (
  <span className="text-xs text-muted-foreground"> ({record.division})</span>
)}
```

**Also apply the same fix to the private Stable Passport** (`src/app/stable/[id]/page.tsx`) — owners should see class names too.

**Validation:**
1. Add a show record with a class name via Show Lineup
2. Navigate to the horse's public Passport → confirm class name appears
3. Navigate to the horse's private Stable page → confirm class name appears there too

```powershell
cd "c:\Project Equispace\model-horse-hub" && cmd /c "npx next build 2>&1"
```

---

## Fix 8: Parity Audit — Passport Winnings vs. Show Lineup Fields

**Problem:** The Passport page's show record entry form (used to add winnings directly to a horse's record from the Stable page) has MORE fields than the Show Lineup's `batchRecordResults` flow. This creates confusion — users see fields on the passport they can't fill from Show Lineup.

**Investigation:**

1. Find the show record entry form used on the private Stable page (`src/app/stable/[id]/page.tsx` or `ShowRecordForm.tsx`)
2. List all fields it exposes to the user
3. Compare to the Show Lineup entry form fields in `ShowStringManager.tsx`
4. Identify any fields present in the Passport form but absent from Show Lineup

**Common culprits to check:**
- `award_category` (Breed, Color, Workmanship)
- `competition_level` (Open, Novice, Youth)
- `show_location`
- `section_name`
- `show_date_text` (fuzzy date)
- `judge_notes`
- `is_nan` checkbox
- `notes` (free text)

**Fix — for each field present in the Passport form but absent in Show Lineup:**

Add it to the Show Lineup's per-entry row. Fields that make sense at the show level (not per-class) can go in a "Show Details" section at the top of the string (show name, date, location). Per-class fields (placing, ribbon, class name, award category) go on each entry row.

**The goal:** A user who logs winnings via Show Lineup and a user who logs via the Passport form should produce an identical `show_records` row. No field should be exclusive to one path.

> [!NOTE]
> Some fields may intentionally be "advanced" and only in the Passport form. If a field is rarely needed (e.g., `section_name`), it is acceptable to put it behind an "Advanced" toggle in Show Lineup rather than adding clutter to the main row. Document which fields you defer to the advanced toggle.

**Validation:**
1. Add a show record via Show Lineup with all available fields filled
2. Add a show record via the Passport form with all available fields filled
3. Compare the two rows in Supabase `show_records` — they should have the same fields populated
4. No field should be `null` in one path and filled in the other (unless intentionally deferred)

```powershell
cd "c:\Project Equispace\model-horse-hub" && cmd /c "npx next build 2>&1"
```

---

## Final Build Gate & Commit

All 8 fixes must pass a clean build:

```powershell
cd "c:\Project Equispace\model-horse-hub" && cmd /c "npx next build 2>&1"
```

Then commit:

```powershell
cd "c:\Project Equispace\model-horse-hub" && git add -A && git commit -m "fix(sprint1): edit redirect, watermark @@, WIP condition lock, vault is_trade, Show Lineup double-entry, ribbon/place audit, passport class names, parity fix" && git push
```

---

## Update dev-nextsteps.md

After all fixes are applied and committed, add the following entry to `dev-nextsteps.md` under `# 🔴 Priority: Critical`:

```markdown
## ✅ Task BF2-S1: Beta Feedback Sprint 1 — Critical Bugs — DONE (YYYY-MM-DD)

**Workflow:** `.agents/workflows/beta-feedback-sprint1.md`
**Fixes applied:**
1. ✅ Edit horse → redirects to `/stable/[id]` (not `/dashboard`)
2. ✅ Watermark `@@` bug — `aliasName.replace(/^@+/, "")` in `imageCompression.ts`
3. ✅ WIP life stage → condition grade field locked/hidden
4. ✅ Financial Vault → `is_trade` checkbox (migration 115) — dims price fields when checked
5. ✅ Show Lineup double-entry — `batchRecordResults()` deduplicates before insert
6. ✅ Show Lineup ribbon/place duplicate field audit — consolidated and labeled correctly
7. ✅ Passport — `class_name` added to show records SELECT and display (public + private)
8. ✅ Parity audit — Show Lineup and Passport form now produce identical `show_records` rows
**Status:** ✅ COMPLETE — 0 errors, build clean
```

---

## Notes for Sprint 2

The following items surfaced during Sprint 1 investigation that belong in **Sprint 2 (Show System Overhaul)**:

- If `class_name` column does NOT exist on `show_records` — needs migration in Sprint 2
- Show Lineup rename from "Live Show Packer" → "Show Lineup" (all nav, titles, breadcrumbs, action comments) — Sprint 2 task
- Champ / Reserve / Regional Qualifier checkboxes on `show_records` — Sprint 2 schema task
- Division-level judge field — Sprint 2
