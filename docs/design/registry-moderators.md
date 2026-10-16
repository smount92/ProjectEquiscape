# Registry moderators: design

Ticket: MHH-031 (absorbs the old "curation workbench" goal; feeds MHH-064 Phase 2, "stewards per area").
Status: **design, awaiting the owner's answers** (section 8). No code, no migration yet.
Written 2026-10-15 from the owner's request of the same day.

Rulings this design respects: admin is for the operator only, so moderators get their own tools (Q6). A rank skips the queue, not the rules (Q5). Never delete a row a horse points at (hard rule 3). Better product for members first; never risk live data.

---

## 1. The problem and the goal

**The Registry is the product.** Every correction, new release and merge waits for one person: the owner.

What the queue looks like today (read 2026-10-15 with the public key):

| Measure | Number |
|---|---|
| Suggestions approved by a person | 723 |
| Suggestions auto-applied (Silver/Gold curators) | 333 |
| Suggestions waiting right now | 0 |
| Typical wait for a decision (median) | about 30 minutes |
| Slowest 1 in 10 waited longer than | about 7 hours |
| Suggestions per week, late Sept to mid Oct | 240 to 290 |
| Members who have ever contributed | about 21; about 11 at Silver or above, about 5 at Gold (counts include the owner's own account if he suggests) |

So the queue is not slow. **The cost is the owner's time**: about 150 decisions a week by hand, plus merges and repairs only he can do. Weekly volume jumped from about 10 to about 250 in late September and has stayed there.

**The goal.** A few trusted members who can do what the owner does in the Registry, with tools for fixing many rows at once, and every change recorded, checked and undoable. The owner stops being the only pair of hands and becomes the one who sets the rules and watches the record.

---

## 2. Roles

| | Member | Silver curator (10+ approved) | Gold curator (50+) | **Registry moderator** | Owner (admin) |
|---|---|---|---|---|---|
| Suggest changes | yes | yes | yes | yes | yes |
| Own corrections apply at once | no | facts only, checked | any field, checked | yes, directly | yes |
| Add molds, releases, resins directly | no | no | no | **yes** | yes |
| Approve, reject, revert others' suggestions | no | no | no | **yes** (never their own) | yes |
| Re-file a release under a mold | no | no | no | **yes** | yes |
| Merge duplicates | report only | report only | report only | **yes, with a second look** (Q6) | yes |
| Bulk edit many rows | no | no | no | **yes, up to a size limit** | yes |
| Delete a catalog row | no | no | no | **no** | merge only |
| Add a new scale, run type or material | no | no | no | **no**: asks the owner (these live in code, `src/lib/catalog/taxonomy.ts`) | yes |
| Members, horses, shows, market, billing, admin pages | no | no | no | **no** | yes |
| Appoint or remove moderators | no | no | no | no | **yes** |

A curator rank is earned automatically by a count. A moderator seat is **granted by the owner** and can be taken back.

---

## 3. Becoming a moderator

### Who may apply (recommended; see Q1)

- 25 or more approved suggestions,
- an account at least 60 days old,
- nothing of theirs reverted in the last 90 days,
- not suspended.

The Apply button only appears for members who qualify, and only while a seat is open.

### What they write

Three questions: which parts of the Registry they know well (makers and scales, e.g. "Breyer Traditional", "artist resins"); why they want to help; about how many hours a month they can give (no quota). Their record is attached automatically: approved, rejected and reverted counts, the makers they edit most, when they joined. Only the applicant and the owner see the application.

### How seats open: the queue rule

The owner's rule, made concrete and explainable:

> **A seat opens when, for 7 days in a row, the typical suggestion waited more than 2 days for a decision, or more than 40 suggestions had been waiting over 3 days.**

- Measured once a day. Suggestions rejected within an hour as junk don't count, so flooding the queue can't open a seat.
- After a seat opens, no new seat for 30 days, so the new moderator can settle in.
- **Cap: 6 seats** (Q4); there are 11 Silver-or-above contributors today.
- Seats never close because the queue is quiet. A freed seat (stepped down, rested too long, removed) is refilled only when the rule fires again.
- The rule is shown in plain words: "2 of 2 seats filled. A seat opens when suggestions wait more than 2 days."

**One honest problem.** At today's 30-minute median wait this rule never fires, because the owner keeps up by spending the hours himself. So: **two founding seats now**, picked by the owner from applicants, and the rule for every seat after (Q2).

### Who decides

The owner, always: Accept or Decline with a note. A declined member may reapply after 90 days. Eligible members get one notification when a seat opens.

### Term, rest, stepping down, removal

- **Term**: 12 months, renewed by the owner with one click (Q8).
- **Resting**: 60 days with no moderator action pauses the powers; one click brings them back. After 90 days resting, the seat returns to the pool.
- **Stepping down**: one button, any time. Their changes stay.
- **Removal**: the owner, one click, private reason. Powers stop on the next request, because the role is checked on every action.

---

## 4. The moderator workspace: the Registry Desk

A new page, **`/catalog/desk`**, linked from the Registry room only for moderators and the owner. It is not part of `/admin`. It looks like the admin console (same layout, same tab pattern) but holds only Registry tools.

Tabs: **Queue · Edit · Merge · Needs attention · History · Guide**

### Queue

```
┌ Queue ─────────────────────────────── 14 waiting · oldest 6 h ┐
│ [Corrections 9] [New entries 3] [Duplicates 2] [Auto-applied]  │
├────────────────────────────────────────────────────────────────┤
│ ▸ @Maple  Run type: Regular Run → Special Run    "Lady Phase"  │
│   Release #1234 · under mold: Lady Phase (Traditional)         │
│   Reason: "JAH 2004 lists it as an SR of 1,500"                │
│   [A]pprove  [E]dit then approve  [R]eject…  [S]econd look     │
│ ▸ @Bay  New release under "Stock Horse Stallion"   …           │
└────────────────────────────────────────────────────────────────┘
```

- **Edit then approve**: fix a typo and approve, instead of rejecting good work over a capital letter. The member sees what changed.
- **Auto-applied**: what Silver and Gold curators changed in the last 7 days, with one-click revert.
- A rejection always carries a note. Nobody decides their own suggestion.
- Opening an item claims it ("under review") for 30 minutes, so two moderators don't collide. (This also closes gap G12: the admin queue loads only `pending` today.)

### Edit (bulk edit)

The heart of the request: many changes to many rows, constructively. Five steps, always in this order.

```
1 SELECT ─ Maker [Breyer ▾] Scale [Classic (1:12) ▾] Type [Release ▾]
           Run type [is empty ▾]  Text [ "Arabian" ]     → 38 rows
           ☑ select all 38   (cap: 500 rows per batch)

2 CHANGE ─ [Set field ▾] Run type → [Special Run ▾]
           other operations: replace text · clear field · capitalize
           first letter · move words from title to notes · re-file
           under mold [pick mold] (scale follows the mold)

3 PREVIEW ─────────────────────────────────────────────────────
   Title                        Mold (its own)        Run type
   Arabian Mare (1998)          Classic Arabian Mare  —  → Special Run
   Arabian Stallion             Classic Arabian Stal. —  → Special Run
   ░ Arabian Foal               Classic Arabian Foal  Special Run (no change)
   ✖ Desert Arabian             (none)                refused: not a release
   36 will change · 1 unchanged · 1 refused   [untick any row]

4 NOTE ── Why (shown in the public history): [ ............ ]

5 APPLY ─ [Apply 36 changes]  or, over 25 rows: [Ask for a second look]
```

- Every row shows **its own mold**, never a parent from the view (DECISIONS: never edit a row from a view that shows it under another parent).
- Values pass the same checks as every write: `normalizeFactValue` and `vocabularyProblem` (`src/lib/catalog/corrections.ts`) plus Gold's identity rules. Scale, run type and material are pickers, never free text.
- The batch applies in **one transaction**: all or nothing.
- Each row is **expect-guarded**: it changes only if it still holds what the preview showed; otherwise it is skipped and listed. A bulk edit is a repair script with a screen.
- **One batch = one history entry** ("Set run type to Special Run on 36 Classic Arabian releases: reason ..."), with each row's before and after kept behind it.
- **Undo the whole batch** for 30 days, same expect-guard.

### Merge

The admin merge card and duplicate sweeper, rebuilt: two entries side by side, what moves (horses, want lists, releases, suggestions, history), choose the keeper, merge. Old addresses forward (`catalog_slug_history`, 233). Each merge needs a second look (Q6) and becomes **undoable** (section 5).

### Needs attention

Work lists computed from the live Registry, the same checks as `scripts/catalog-delta/registry_health.mjs`, which today only the owner runs by hand:

| List | Rows today (health scan, 2026-10-15) |
|---|---|
| Releases with no mold (orphans) | 399 |
| Releases under a mold of a different scale | 99 |
| Molds with no releases | 168 |
| Identical releases on the same mold | 15 |
| Releases whose typed mold name disagrees with their mold | 14 |
| Maker or artist names one or two letters apart | 12 pairs |
| Titles ending in punctuation / starting lowercase / starting with a model number | 272 / 65 / 49 |
| Years stored as text | 1,664 |

Each item opens Edit or Merge with the rows preselected; "I'm on it" claims it for a day. Lists are cached an hour and cleared by tag when a batch applies. Resins with no scale are left off (Q26).

### History

All moderator work, newest first, filterable by moderator, batch or entry. Each line has Undo (within 30 days) and "Looks right", a check-off by another moderator after the fact.

### Keyboard

`J`/`K` next/previous · `A` approve · `E` edit then approve · `R` reject · `S` second look · `X` select, `Shift+X` range · `/` filter · `M` merge pair · `?` help. Every key also has a button.

---

## 5. Safety

A moderator's change is reviewed by nobody before it goes live. So every guard sits in the write itself, not in the screen.

| Guard | How |
|---|---|
| **One writer** | `src/lib/catalog/write.ts` (new) is the only code that writes `catalog_items`: suggestions, merges, moderator edits and batches all call it. Today writes sit in `catalog-suggestions.ts`, `merge.ts` and `admin.ts` (DECISIONS: single owner). |
| **Format and vocabulary checks** | `normalizeFactValue`, `vocabularyProblem` and Gold's identity checks on every value; the database CHECKs from 233 behind them. |
| **Role check on every action** | `requireRegistryModerator()` (new, `src/lib/auth.ts`) reads the moderator's status each request. A hidden button is not permission. |
| **No deleting** | Moderators can't delete. Linked rows can't be deleted anyway (233, `ON DELETE RESTRICT`). |
| **History with a name** | Every change shows who did it and in what role. **Found while researching:** today `applyApprovedSuggestion` (`catalog-suggestions.ts`) stores the *contributor* as `approved_by`, not the reviewer. Fix before anyone else approves. |
| **Undo** | Single edits: the existing expect-guarded revert. Batches: whole-batch undo. Merges: the removed entry and its moved links are saved first, so a merge can be reversed for 30 days (today a merge deletes the row for good). |
| **Second look** | Merges and batches over 25 rows wait for another moderator or the owner. Nobody confirms their own. |
| **Limits** | Per moderator per day: 300 single edits, 10 batches, 20 merges; 500 rows per batch. Existing `checkRateLimit` (`src/lib/utils/rateLimit.ts`). |
| **Speed alarm** | Over 100 rows changed by one moderator in an hour alerts the owner at once. |
| **Owner notifications** | Daily digest. At once: merges, batches over 25 rows, a moderator reverting another, any limit hit. (Today every suggestion notifies the owner; at 250 a week that is noise.) |
| **Addresses** | Maker changes and merges already forward old addresses (232/233). Nothing new. |
| **Suspension** | `requireAuth()` refuses a suspended account before any role check. |

---

## 6. Data model sketch

Migration numbers: **next free at build time** (235 at the earliest; Release 2 may take 235 to 237). Called N1 to N3 here. Each is re-runnable, probed in Admin › Ops, and the code works before it is pasted.

**N1: the role**
- `registry_moderators`: `user_id` (key, to `public.users`), `status` (`active`, `resting`, `stepped_down`, `removed`), `started_at`, `term_ends_at`, `last_action_at`, `removed_reason` (owner only), `created_at`, `updated_at`.
- `catalog_changelog`: add `actor_role` (`member`, `curator`, `moderator`, `owner`) and `batch_id`; widen `change_type` to include `batch`.
- A `registry_moderator` badge row.

**N2: batches and undo**
- `catalog_batches`: `id`, `created_by`, `kind` (`edit`, `add`, `refile`, `merge`, `undo`), `status` (`draft`, `awaiting_second_look`, `applied`, `undone`), `filter_description`, `note`, `row_count`, `second_look_by`, `applied_at`, `undone_at`, `undone_by`.
- `catalog_batch_rows`: `batch_id`, `catalog_item_id`, `before` and `after` (the fields touched), `outcome` (`applied`, `skipped_changed_since`, `refused`). For a merge: the removed row in full and the ids of every moved link.
- Two database functions, `apply_catalog_batch` and `undo_catalog_batch`: one transaction each, expect-guarded per row, callable **only by the service role** (revoked from members and anonymous visitors).

**N3: applications and seats**
- `registry_moderator_applications`: `user_id`, `answers`, `record_snapshot`, `status` (`submitted`, `accepted`, `declined`, `withdrawn`), `decided_at`, `owner_note`.
- `registry_seat_rounds`: when a seat opened, why (`founding`, `queue_wait`, `replacement`), the numbers that opened it, who filled it. Public, so the rule is visible.
- `registry_queue_daily`: one row a day (waiting count, median wait, count over 3 days), written by the existing daily 06:00 cron rather than a new one.

**Security (RLS).** `catalog_items` RLS is **not widened**; nobody writes it from the browser. Every write is a server action that checks the role, then uses the service role with a comment saying why. New tables: RLS on, no member writes; members read their own applications; anyone reads active moderators, seat rounds and batch summaries; private fields stay owner-only.

---

## 7. Phased build plan

Each phase is one release. A mock is approved before any new screen is built (Q3 ruling).

### Phase 1: two founding moderators, the queue and single edits

| Ticket | Acceptance |
|---|---|
| Role table + `requireRegistryModerator()` + owner grant/remove (N1) | Owner adds and removes a moderator from the admin Members tab; a removed moderator is refused on the next action; tests cover owner, active, resting, removed, suspended. |
| History records the real approver and role | `approved_by` is the reviewer; reverts show the real alias and role; existing rows untouched. |
| The one Registry writer (`src/lib/catalog/write.ts`) | Every `catalog_items` write goes through it; a test fails if another file writes the table. |
| Desk shell + Queue (approve, edit-then-approve, reject, revert, claim, auto-applied feed) | A moderator clears the queue without `/admin`; can't decide their own suggestion; the member's notification says "a Registry moderator". |
| Direct edit and add (mold, release, resin, re-file) | Same checks as Gold; refused values explain themselves; limits enforced. |
| Owner digest + immediate alerts | One digest a day; merges, big batches and limit hits notify at once. |
| Moderator guide (`docs/guides/registry-moderation.md`) and badge | Written in plain words; owner approves the text. |

**Ships opt-in:** only moderators see the Desk, so it is opt-in by nature. The owner uses it alone for a week first.

### Phase 2: many rows at once

| Ticket | Acceptance |
|---|---|
| Batches, apply and undo functions (N2) | A batch of 500 rows applies in one transaction; a row changed since preview is skipped and listed; undo restores only rows still holding the batch's value. |
| Bulk edit screen (select, change, preview, note, apply) | Every row shows its own mold; refused rows are red with a reason; over 25 rows requires a second look. |
| Merge in the Desk, with second look and unmerge | A merge can be reversed within 30 days with every horse and want list back on the original entry. |
| Needs attention lists | Same counts as `registry_health.mjs` on the same day; each item opens Edit or Merge preselected. |
| History tab + "Looks right" + keyboard keys | Every action reachable by key and by button. |

**Ships opt-in:** bulk edit appears as "Try bulk edit" for moderators after the owner has run it for a week.

### Phase 3: applications and seats

| Ticket | Acceptance |
|---|---|
| Queue snapshots + seat rounds (N3) | One row a day from the existing cron; the seat rule opens a seat by itself and records why. |
| Apply form and owner review | Only qualifying members see Apply; owner accepts or declines with a note; 90-day wait after a decline. |
| Terms, resting, stepping down | Automatic resting at 60 days; seat back to the pool at 90; renewal reminder a month before a term ends. |
| Public moderators page (if Q7 is public) | Lists moderators, seats filled, and the rule in words. |
| One Registry tool | The admin Catalog tab's queue, sweeper and merge card are removed and the owner uses the Desk (Q10). |

---

## 8. Open questions for the owner

Answer by number. **Bold** is the recommendation.

1. **Who may apply?** (a) Gold only, 50+ approved: about 5 people. **(b) 25+ approved, 60-day account, nothing reverted in 90 days: about 7.** (c) Silver, 10+: about 11.
2. **Founding seats now?** The queue rule won't fire while you clear it in minutes. **(a) Two founding seats now, you pick from applicants**, then the rule. (b) One. (c) None; wait for the rule.
3. **Seat rule numbers.** **(a) Median wait over 2 days, or 40+ waiting over 3 days, for 7 days in a row; 30-day pause between seats.** (b) Stricter: 4 days, 14 days in a row. (c) Add a load trigger too: more than 150 human decisions a week for 4 weeks.
4. **Maximum seats?** (a) 4. **(b) 6.** (c) 10.
5. **Do moderators' everyday edits need a second look first?** (a) Every edit. **(b) Only merges and batches over 25 rows; everything else is checked after the fact ("Looks right").** (c) Nothing.
6. **Can moderators merge without you?** (a) Only you approve merges. **(b) Another moderator or you must confirm each merge; merges are undoable for 30 days.** (c) Any moderator alone.
7. **Public or quiet?** **(a) Public: badge on profile, name and role in the Registry history.** (b) Quiet: history says "a Registry moderator".
8. **Term length?** (a) 6 months. **(b) 12 months, renewed with one click.** (c) No term, only the resting rule.
9. **Gold curator auto-approve once moderators exist?** **(a) Keep Silver and Gold as they are; moderators watch the auto-applied feed.** (b) Gold's identity changes (title, maker, scale) go to the moderator queue. (c) Retire auto-approve.
10. **Your own tools.** **(a) You use the Desk too; the admin Catalog tab is retired in Phase 3, so there is one queue.** (b) Keep both.
11. **Empty rows.** Can moderators remove a row with nothing linked (no horses, want lists or releases)? **(a) No: they flag it, you remove it.** (b) Yes, with a second look.
12. **Your notifications.** **(a) Daily digest, plus at once for merges, big batches and limit hits.** (b) Every action, as today.
13. **Names.** **(a) "Registry moderator" and "Registry Desk".** (b) "Registry steward" (MHH-064's word) and "Steward's Desk". (c) Your words.
14. **Artists moderating their own work.** **(a) Allowed, but they can't approve suggestions about their own pieces; another moderator does.** (b) No limit. (c) Can't edit their own pieces at all.
15. **Order of phases.** **(a) As written: founding seats first, applications in Phase 3.** (b) Applications in Phase 1, before any seat is filled.

---

## 9. Risks

| Risk | How it is handled |
|---|---|
| A moderator turns vandal, or their account is taken over | Daily limits, speed alarm, second look on merges and big batches, undo, one-click removal checked every request, suspension gate. |
| An honest mistake across hundreds of rows | Every row previewed, 500-row cap, whole-batch undo for 30 days. |
| Two moderators disagree | Claims; "changed since" rows are skipped, never overwritten; they talk on the suggestion's thread; you decide. |
| A merge can't be taken back | Snapshot before the merge; unmerge within 30 days. |
| The seat rule never fires, or too often | Founding seats now (Q2); every measurement and seat opening is recorded, so the numbers can be tuned with evidence. |
| Flooding the queue to open a seat | Junk rejected within an hour doesn't count; you approve every seat. |
| Members feel judged by peers | Rejections carry a note; members can ask you to look again; moderators follow a written guide. |
| Curators not picked feel passed over | Public criteria and rule; reapply after 90 days. |
| Moderators burn out or vanish | No quotas; resting after 60 days; stepping down is one button. |
| Cost and speed | No new cron; lists cached an hour, cleared by tag; batch cap keeps writes small. |
| Privacy | Applications and removal reasons are private to you; nothing personal in the repo or public history. |
| Live data | No migration rewrites Registry data; `catalog_items` RLS is unchanged; the 233 guards stay the last line of defence. |
