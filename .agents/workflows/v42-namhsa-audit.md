---
description: V42 NAMHSA Partnership Alignment — Task 1 of 2. Gap analysis audit against what we already have vs what NAMHSA needs.
---

# V42 Task 1 — NAMHSA Partnership Alignment Audit

> **MANDATORY:** Read `.agents/MASTER_BLUEPRINT.md` and `.agents/MASTER_SUPABASE.md` first. All Iron Laws and guardrails apply.
> **Partnership Language:** "MHH is a digital tool that partners with NAMHSA to reduce paperwork and improve the showing experience. NAMHSA remains the official sanctioning body."
> **Constraint:** This task produces ONLY documentation (`.md` files). No code or migrations.

// turbo-all

---

## Step 1: Read Source Material

```
View file: .agents\MASTER_BLUEPRINT.md               ← Iron Laws + NAMHSA Readiness Checklist
View file: .agents\MASTER_SUPABASE.md                ← Schema (events, event_entries, show_records, event_classes)
View file: src\lib\constants\showTemplates.ts         ← 3 NAMHSA-style templates (38 classes across 10 divisions)
View file: src\app\actions\competition.ts             ← NAN tracking, Show Packer, Division/Class CRUD, conflict detection
View file: src\components\NanDashboardWidget.tsx      ← NAN qualification dashboard (green/yellow/pink cards)
View file: src\components\ShowRecordForm.tsx           ← NAN checkbox + card type/year on show records
View file: src\components\ShowEntryForm.tsx            ← isNanQualifying badge on class selector
```

---

## Step 2: Create `.agents/docs/namhsa-alignment-audit.md`

Create the file with this structure:

### Section 1: What We Already Solve Perfectly

Audit the codebase and document which NAMHSA needs are **fully met**. The developer should verify each claim by checking the code:

| NAMHSA Need | MHH Feature | Status | Code Location |
|-------------|------------|--------|---------------|
| Breed-based halter class structure | 3 show templates (Standard Halter, Performance, Collectibility) with 38 classes across 10 divisions | ✅ Done | `src/lib/constants/showTemplates.ts` |
| 1-click class list from official divisions | NAMHSA template selector on event creation page | ✅ Done | `src/app/community/events/create/page.tsx:100` |
| NAN qualifying flag on classes | `is_nan_qualifying` boolean on `event_classes` table | ✅ Done | `competition.ts:605`, migration 095 |
| NAN card tracking (green/yellow/pink) | `nan_card_type`, `nan_year` columns on `show_records` | ✅ Done | `competition.ts:57-89` |
| NAN dashboard for collectors | `NanDashboardWidget` shows per-horse cards with color coding | ✅ Done | `src/components/NanDashboardWidget.tsx` |
| NAN achievement toggle on show records | Checkbox + card type selector on `ShowRecordForm` | ✅ Done | `ShowRecordForm.tsx:244-250` |
| Division → Class hierarchy | `event_divisions` → `event_classes` FK structure with sort_order | ✅ Done | `competition.ts:540-620` |
| Class capacity limits | `max_entries` on `event_classes` | ✅ Done | `competition.ts:712` |
| Scale-restricted classes | `allowed_scales` array on `event_classes` | ✅ Done | `competition.ts:714` |
| Blind voting (photo shows) | `is_virtual_show` + vote system with hidden horse ownership | ✅ Done | Digital County Fair epic |
| Visual judging UI (ribbon stamping) | Framer Motion ribbon stamp interface | ✅ Done | Digital County Fair Phase 5 |
| Expert judge assignments | Judge role system with precedence over community votes | ✅ Done | migration 095 |
| Show results & podium display | `ShowResultsView` unified component | ✅ Done | Digital County Fair Phase 4 |
| Show tags PDF (exhibitor + host) | `ShowTags.tsx` @react-pdf/renderer with QR codes | ✅ Done | migration 103-104 |
| Live show packer | Show Strings + Entries + conflict detection | ✅ Done | `competition.ts:232-521` |
| Ring/time conflict detection | `detectConflicts()` checks same horse/time and handler conflicts | ✅ Done | `competition.ts:468-521` |
| Copy division tree between events | `copyDivisionsFromEvent()` | ✅ Done | `competition.ts:797+` |
| Convert show string results to records | `convertShowStringToResults()` with NAN card auto-assignment | ✅ Done | `competition.ts:398-466` |
| Show record verification by judges | `verifyShowRecord()` with host_verified tier | ✅ Done | `competition.ts:199-230` |

### Section 2: Partial Alignment (Needs Polish)

These features exist but need refinement for a NAMHSA partnership pitch:

| Feature | Current State | Gap | Effort |
|---------|--------------|-----|--------|
| NAN card 4-year validation window | `nan_year` tracked but no expiry enforcement | NAN cards earned in 2022 should expire in 2026. Need validation check in `getNanDashboard()` | 🟢 Low |
| NAN card transfers with horse | Horse transfer system exists (`horse_transfers`) but doesn't explicitly carry NAN records | NAN cards are on `show_records` table which has `horse_id` FK — they'll transfer with horse IF we include the query. Verify `v_horse_hoofprint` includes NAN records | 🟢 Low |
| Regional structure surfacing | `groups` table has `region` column, `regional_club` group type exists (`src/lib/constants/groups.ts:3`) | Need to map the 11 official NAMHSA regions as preset options on Discover + Group creation | 🟡 Medium |
| "NAMHSA Sanctioned" badge on events | `sanctioning_body` column exists on `show_records` but not on `events` table | Add `sanctioning_body` to `events` table, display badge on event cards | 🟡 Medium |

### Section 3: True Gaps (Features to Build)

| Feature | Description | Effort | Priority |
|---------|------------|--------|----------|
| Public shareable show results page | `/shows/[event_id]/results` — public page showing all placements by class/division. Currently results are only visible inside the event detail page for members | 🟡 Medium | 🔴 High (pitch demo) |
| Results export to NAMHSA format | CSV export of show results in NAMHSA's expected format (exhibitor, horse, class, placement) | 🟢 Low | 🔴 High (pitch demo) |
| Merit Award tracking stub | NAMHSA Merit Awards (Regional, National) — simple badge/flag on show records. No complex logic needed for MVP, just tracking | 🟢 Low | 🟡 Medium |
| Judge COI checker | Prevent judge from judging their own models or models they've owned in the past 12 months. Check `horse_ownership_history` | 🟡 Medium | 🟡 Medium |
| Show application portal | "Apply for NAMHSA Sanction" toggle on event creation with packet upload. This is aspirational — NAMHSA may want to manage this on their end | 🔴 High | 🟢 Low (deferred) |

### Section 4: Partnership Opportunities (What to Pitch)

| Opportunity | Value to NAMHSA | Our Role |
|-------------|----------------|----------|
| Digital NAN card tracking | Eliminates paper NAN card records for collectors. NAMHSA still issues official cards — we track the digital bookkeeping | Tool provider |
| Results reporting | Hosts can auto-generate NAMHSA-formatted results CSVs after shows close | Paperwork reducer |
| Regional rep visibility | NAMHSA regional reps can view (read-only) show activity in their region via MHH groups | Information layer |
| Class list standardization | Our templates use real NAMHSA division/class structures. Show hosts get 1-click setup instead of manual spreadsheets | Time saver |
| Offline show packer | Show entrants can plan their string + detect conflicts before arriving at the show. Works offline at fairgrounds | Convenience tool |
| Exhibitor show tags | Professional PDF show tags with QR codes. Replaces handwritten tags | Quality upgrade |

### Section 5: Partnership Language Guide

Include this language guide that must be used in all NAMHSA-facing UI and communications:

| ✅ Say This | ❌ Never Say This |
|------------|------------------|
| "MHH partners with NAMHSA" | "MHH replaces NAMHSA" |
| "Digital tools for show hosts" | "Better than NAMHSA's system" |
| "NAMHSA-compatible templates" | "Official NAMHSA platform" |
| "Reduce admin paperwork" | "Automate NAMHSA governance" |
| "Track NAN cards digitally" | "Official NAN card issuer" |
| "View-only dashboard for reps" | "Rep management portal" |

---

## Step 3: Self-Verification

- [ ] All 5 sections present in the audit document
- [ ] Every "✅ Done" claim has a code location reference that is verifiable
- [ ] Effort estimates are realistic (🟢 Low = <1 day, 🟡 Medium = 1-3 days, 🔴 High = 1+ week)
- [ ] Partnership language is positive and never implies replacement
- [ ] No code was modified — only `.md` file created

---

## 🛑 HUMAN VERIFICATION GATE 🛑

Present the completed audit for human review. Wait for approval before proceeding to V42 Task 2.
