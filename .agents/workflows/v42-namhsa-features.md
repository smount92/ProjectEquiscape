---
description: V42 NAMHSA Partnership Features — Task 2 of 2. Build the 4 partnership-reinforcing feature epics and pitch deliverables.
---

# V42 Task 2 — Partnership-First Feature Blueprint & Pitch Deliverables

> **MANDATORY:** Read `.agents/MASTER_BLUEPRINT.md` and `.agents/MASTER_SUPABASE.md` first. All Iron Laws and guardrails apply.
> **Prerequisite:** `.agents/docs/namhsa-alignment-audit.md` must exist (Task 1 complete).
> **Partnership Language:** "MHH is a digital tool that partners with NAMHSA. NAMHSA remains the official sanctioning body."

// turbo-all

---

## Step 1: Read Prerequisites

```
View file: .agents\MASTER_BLUEPRINT.md
View file: .agents\MASTER_SUPABASE.md
View file: .agents\docs\namhsa-alignment-audit.md     ← Task 1 gap analysis (must be approved)
View file: src\app\actions\competition.ts              ← NAN logic, show records, divisions
View file: src\lib\constants\showTemplates.ts           ← Current templates
```

---

## EPIC 1: Digital NAN Card System Polish (High Impact — ~2 days)

**Partnership value:** "We help collectors track their NAN card progress digitally. NAMHSA still issues the official physical cards."

### 1.1 Add 4-year expiry validation to NAN dashboard

**File:** `src/app/actions/competition.ts` → `getNanDashboard()`

Currently the dashboard shows all NAN cards regardless of age. NAN cards expire after 4 years per NAMHSA rules.

```ts
// In getNanDashboard(), after building qualifications:
const currentYear = new Date().getFullYear();
// Filter: only show cards from last 4 years (NAMHSA rule)
const validQualifications = qualifications.filter(q => currentYear - q.year <= 3);
```

Also update `NanDashboardWidget.tsx` to show expired cards in a greyed-out state:
```tsx
{q.year < currentYear - 3 && (
    <span className="text-xs text-stone-400 line-through">
        Expired ({q.year})
    </span>
)}
```

### 1.2 Verify NAN records transfer with horse

**File:** `src/app/actions/competition.ts` → `getNanQualifications()`

NAN card records are stored on `show_records` with `horse_id` FK. When a horse is transferred via `claim_transfer_atomic`, the `horse_id` owner changes but `show_records` stay linked to the horse (not the user). 

**Verification task:** Confirm that `getNanQualifications(horseId)` returns NAN records regardless of who owns the horse. The query filters by `horse_id` (line 63), not `user_id` — so this should already work. **Write a test to confirm.**

### 1.3 Add NAN export CSV

**File:** `src/app/actions/competition.ts` (new function)

```ts
export async function exportNanCards(): Promise<{ csv: string }> {
    // Returns CSV: Horse Name, NAN Year, Card Type (Green/Yellow/Pink), Show Name, Placement, Class
    // Sorted by year DESC, then horse name
}
```

**File:** `src/app/api/export/nan-cards/route.ts` (new API route)

Simple CSV download endpoint that calls the server action and returns `Content-Type: text/csv`.

### Validation Checklist
- [ ] NAN dashboard shows 4-year validation window
- [ ] Expired cards are visually distinguished (greyed out)
- [ ] NAN records stay with horse after transfer
- [ ] CSV export generates valid file with correct headers
- [ ] Partnership language: "Track your NAN progress digitally — official cards are issued by NAMHSA"

---

## EPIC 2: Public Show Results Page (High Impact — ~2 days)

**Partnership value:** "Show hosts can share results with a public link. Makes NAMHSA shows more visible."

### 2.1 Create `/shows/[eventId]/results` page

**File:** `src/app/shows/[eventId]/results/page.tsx` (NEW PAGE)

This is a **public page** (no auth required) that displays:
- Event name, date, host, type badge
- Results grouped by Division → Class
- Each class shows: 1st through 5th place (or however many placed)
- For each placing: Horse name, Owner alias, Placement text
- "NAMHSA Sanctioned" badge if `events.sanctioning_body = 'namhsa'`
- Footer: "Show results managed by Model Horse Hub in partnership with NAMHSA"

**Important:** This page does NOT require login. It's meant to be shareable via link.

### 2.2 Create `getPublicShowResults()` server action

**File:** `src/app/actions/competition.ts` (new function)

```ts
export async function getPublicShowResults(eventId: string): Promise<{
    event: { name: string; date: string; host: string; type: string; isSanctioned: boolean };
    divisions: {
        name: string;
        classes: {
            name: string;
            classNumber: string | null;
            results: { placement: string; horseName: string; ownerAlias: string }[];
        }[];
    }[];
} | null>
```

This action should:
- Fetch event + host alias (no auth check — public page)
- Fetch divisions + classes
- Fetch entries with placements, joined to `user_horses.custom_name` and `users.alias_name`
- Only return entries that have a non-null `placement`
- Return null if event doesn't exist

### 2.3 Results export CSV

Add a "Download Results CSV" button on the results page:
```
Event, Date, Division, Class #, Class, Placement, Horse, Owner
"NAMHSA Regional 2026", "2026-04-15", "Light Breeds", "101", "Arabian", "1st", "Desert Storm", "@collector_jane"
```

### 2.4 Add og:image metadata for social sharing

In the results page `generateMetadata()`:
```ts
return {
    title: `${event.name} Results — Model Horse Hub`,
    description: `View results from ${event.name}. ${totalEntries} entries across ${totalClasses} classes.`,
    openGraph: { title, description },
};
```

### Validation Checklist
- [ ] `/shows/[eventId]/results` renders without auth
- [ ] Results grouped by Division → Class with placements
- [ ] CSV download works
- [ ] "NAMHSA Sanctioned" badge shows when applicable
- [ ] Partnership footer present
- [ ] OG metadata generates correct title/description

---

## EPIC 3: NAMHSA Region & Sanctioning Polish (~1 day)

**Partnership value:** "We surface your 11 regions so collectors can find local shows and groups."

### 3.1 Add NAMHSA region constants

**File:** `src/lib/constants/namhsa.ts` (NEW FILE)

```ts
export const NAMHSA_REGIONS = [
    { key: "northeast", label: "Northeast", states: "CT, MA, ME, NH, RI, VT" },
    { key: "mid_atlantic", label: "Mid-Atlantic", states: "DC, DE, MD, NJ, NY, PA" },
    { key: "southeast", label: "Southeast", states: "AL, FL, GA, KY, MS, NC, SC, TN, VA, WV" },
    { key: "great_lakes", label: "Great Lakes", states: "IL, IN, MI, OH, WI" },
    { key: "south_central", label: "South Central", states: "AR, LA, MO, OK, TX" },
    { key: "north_central", label: "North Central", states: "IA, KS, MN, NE, ND, SD" },
    { key: "mountain", label: "Mountain", states: "CO, MT, NM, UT, WY" },
    { key: "pacific_northwest", label: "Pacific Northwest", states: "AK, ID, OR, WA" },
    { key: "pacific_southwest", label: "Pacific Southwest", states: "AZ, CA, HI, NV" },
    { key: "canada_east", label: "Canada East", states: "ON, QC, Atlantic Provinces" },
    { key: "canada_west", label: "Canada West", states: "AB, BC, MB, SK" },
] as const;

export type NamhsaRegion = typeof NAMHSA_REGIONS[number]["key"];
```

### 3.2 Surface `sanctioning_body` on events (NO MIGRATION NEEDED)

> **Audit correction:** `sanctioning_body` **already exists** on the `events` table from migration 046. No schema change needed — only UI work.

### 3.3 Surface regions on event creation

**File:** `src/app/community/events/create/page.tsx`

Add a region dropdown (using `NAMHSA_REGIONS`) when creating a show-type event. Pre-populate from the group's region if applicable.

### 3.4 Surface regions on Discover page

The Discover page already has user cards — add a filter or badge showing which NAMHSA region collectors are in. Use the `users.region` or infer from the groups they've joined.

### Validation Checklist
- [ ] `NAMHSA_REGIONS` constant has all 11 regions
- [ ] Migration 111 adds `sanctioning_body` to `events`
- [ ] Event creation allows setting "NAMHSA Sanctioned" toggle
- [ ] Region filter available on Discover or Groups
- [ ] Partnership language: "Find local shows and groups in your NAMHSA region"

---

## EPIC 4: Judge COI Checker (~1 day)

**Partnership value:** "We help show hosts maintain fairness. Judges are automatically flagged if they have a conflict of interest."

### 4.1 Create `checkJudgeCOI()` function

**File:** `src/app/actions/competition.ts` (new function)

```ts
export async function checkJudgeCOI(
    judgeUserId: string,
    eventId: string
): Promise<{ hasConflict: boolean; conflicts: string[] }>
```

Check these conflict conditions:
1. **Owns a horse entered in this event** — check `event_entries.user_id = judgeUserId` for this event
2. **Used to own a horse entered in this event (last 12 months)** — check `horse_ownership_history` for horses in this event that the judge previously owned
3. **Is the show host** — check `events.created_by = judgeUserId`

Return a list of human-readable conflict descriptions.

### 4.2 Surface COI warning in judging UI

When a host assigns a judge to an event, show a warning if `checkJudgeCOI()` returns conflicts:

```tsx
{coiResult.hasConflict && (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
        ⚠️ <strong>Potential Conflict of Interest:</strong>
        <ul>
            {coiResult.conflicts.map((c, i) => <li key={i}>{c}</li>)}
        </ul>
        <p className="mt-2 text-xs text-amber-600">
            This is a warning only — the host can still proceed. NAMHSA rules require disclosure of COI.
        </p>
    </div>
)}
```

### Validation Checklist
- [ ] COI checker catches: own horse, previously owned horse, is host
- [ ] Warning is advisory (not blocking) — respects that hosts make final decisions
- [ ] 12-month lookback on ownership history
- [ ] Partnership language: "Helping maintain show fairness per NAMHSA guidelines"

---

## EPIC 5: Platform-Verified Show Records — Trust Tiers (~1.5 days)

**Partnership value:** "Records from MHH-hosted shows carry platform verification that can't be forged. NAMHSA can distinguish between typed-in claims and digitally proven results."

### 5.1 Formalize `verification_tier` values

The `verification_tier` column already exists on `show_records` (nullable TEXT). Currently only `null` or `host_verified`. Formalize into 3 tiers:

| Tier | Badge | How Created |
|------|-------|-------------|
| `self_reported` | 📝 Self-Reported | Default when user adds via `ShowRecordForm` |
| `host_verified` | ✅ Host Verified | Judge/admin clicks "Verify" via `verifyShowRecord()` |
| `platform_generated` | 🛡️ MHH Verified | Competition engine creates record (show close or `convertShowStringToResults()`) |

### 5.2 Auto-set `platform_generated` on engine-created records

**File:** `src/app/actions/competition.ts` → `convertShowStringToResults()`

When the competition engine creates show records (show closing, converting show strings), set `verification_tier = 'platform_generated'`.

**File:** `src/app/actions/shows.ts` → show close action

When a show is closed and results are finalized, any auto-generated `show_records` should get `platform_generated`.

### 5.3 Set `self_reported` as default for manual records

**File:** `src/app/actions/competition.ts` → `addShowRecord()`

Explicitly set `verification_tier = 'self_reported'` on manually added records (currently `null`).

### 5.4 Display trust badges in UI

**Files:** Horse passport, hoofprint timeline, show record cards

Show visual badges based on `verification_tier`:
- `platform_generated` → 🛡️ green shield badge "MHH Verified"
- `host_verified` → ✅ blue checkmark badge "Host Verified"
- `self_reported` / `null` → 📝 grey badge "Self-Reported"

### Validation Checklist
- [ ] Engine-created records get `verification_tier = 'platform_generated'`
- [ ] Manual records get `verification_tier = 'self_reported'`
- [ ] Visual badges render correctly on horse passports and hoofprint timeline
- [ ] Public results page shows verification tier on each record
- [ ] No migration needed — column already exists

---

## Step 2: Create Pitch Summary Document

**File:** `.agents/docs/namhsa-pitch-deck-summary.md` (NEW FILE)

### Structure:

```markdown
# How MHH Partners with NAMHSA
> A one-page summary for the NAMHSA VP meeting

## Our Role
MHH is a digital toolsuite that makes the showing experience better for
hosts, judges, and exhibitors. We don't replace any NAMHSA process — we
automate the paperwork so people can focus on the horses.

## What We Already Built (Live Today)
- 🏆 1-click NAMHSA class templates (Standard Halter, Performance, Collectibility)
- 📋 NAN card digital tracking (green/yellow/pink) with 4-year validation
- 🏷️ Professional show tags PDF with QR codes
- 🧳 Live Show Packer with ring conflict detection
- 🎯 Blind voting + visual judging for photo shows
- 👨‍⚖️ Expert judge assignments with COI checking
- 📊 Public shareable show results pages
- 📥 Results export in NAMHSA-compatible CSV format

## Live Demo Script (10 minutes)
1. Create a show → apply "Standard Halter (NAMHSA Style)" template (30 seconds)
2. Open entries → enter 3 horses → show NAN qualifying badge
3. Judge the show → stamp ribbons → close → view results page
4. Download show tags PDF → show QR code
5. Open NAN Dashboard → show green/yellow/pink cards → export CSV
6. Show the Live Show Packer → demonstrate conflict detection

## 6-Week Roadmap
| Week | Deliverable |
|------|-------------|
| 1-2 | Public results page + CSV export + NAN 4-year validation |
| 3 | NAMHSA region constants + sanctioning badge on events |
| 4 | Judge COI checker + advisory warnings |
| 5 | Polish pass: mobile judging, offline show packer stress test |
| 6 | NAMHSA VP demo, collect feedback, define Phase 2 scope |

## What We Will Never Do
- Replace NAMHSA's governance, voting, or membership system
- Issue official NAN cards (we only track digital bookkeeping)
- Charge NAMHSA or its members for basic features
- Claim to be "the official NAMHSA platform"

## Contact
[Your Name] — [email] — modelhorsehub.com
```

---

## Step 3: Self-Verification

After creating both files:

1. **Alignment audit exists:** `.agents/docs/namhsa-alignment-audit.md`
2. **Pitch summary exists:** `.agents/docs/namhsa-pitch-deck-summary.md`
3. **All 4 epics have clear code targets and validation checklists**
4. **Partnership language is explicit** in every UI description
5. **No code was modified** — only `.md` files created (Epics 1-4 are **plans**, not implementations)
6. Run `cmd /c "npx next build 2>&1"` — confirm clean (trivially green since no code changed)

---

## Step 4: Update `dev-nextsteps.md`

Add V42 to the current queue:

```markdown
## Task C-1: V42 NAMHSA Partnership Sprint — FEATURE FREEZE on unrelated work

**Planning Doc:** `.agents/docs/v41_master-doc-consolidation.md`
**Audit:** `.agents/docs/namhsa-alignment-audit.md`
**Workflows:**
1. `.agents/workflows/v42-namhsa-audit.md` — Gap analysis (documentation only)
2. `.agents/workflows/v42-namhsa-features.md` — 4 feature epics + pitch deliverables
**Epic execution order:** Epic 2 (public results, highest pitch demo impact) → Epic 1 (NAN polish) → Epic 3 (regions) → Epic 4 (COI)
**Status:** Not started
```

---

## 🛑 HUMAN VERIFICATION GATE 🛑

Present the completed feature blueprint and pitch summary for human review. **No code changes until human approves all 4 epics.**

After human approval, the execution order is:
1. **Epic 2** (Public Results Page) — highest pitch demo impact
2. **Epic 5** (Platform-Verified Show Records) — trust differentiator for NAMHSA
3. **Epic 1** (NAN Card Polish) — directly demonstrates digital partnership
4. **Epic 3** (Regions + Sanctioning) — visual partnership markers
5. **Epic 4** (Judge COI) — fairness tooling
