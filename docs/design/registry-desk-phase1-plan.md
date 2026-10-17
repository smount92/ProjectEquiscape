# Registry Desk, Phase 1: build plan

Written 2026-10-16 for Release 3, from the approved mock
(https://claude.ai/artifact/BQuj11HRaMuYDfEy8succo), the design in
`docs/design/registry-moderators.md` and the owner's rulings in
`docs/DECISIONS.md` (2026-10-16). Three work packages (A engine, B Desk,
C lists) build in parallel with **disjoint files**; merge order **A, C, B**.

## Owner answers taken (2026-10-16)

1. "Whole set in the title" shows as a **neutral note**, not a problem flag,
   until a moderator style rule replaces the DECISIONS line "Sets: one row per
   piece ... full roster in the title".
2. A rule takes effect at **3 agreements, the owner's counts**; the proposer
   doesn't count. Owner can veto at any time.
3. The **owner's merges need no second look** (the owner is the second look);
   still undoable.
4. Per-suggestion pings to the owner **stop once a moderator is active**; they
   move into the digest.
5. The digest is **in-app (bell), daily**, built inside the existing
   `refresh-market` cron step (06:00, under `withHeartbeat`). No email.
6. Limits per moderator per day: 300 edits (approvals count), 20 merge
   requests, **50 removals**, 10 rule proposals. **Owner exempt.** Speed
   alarm: more than 100 actions in an hour alerts the owner (once an hour).

Every field is editable (owner requirement): the Mold view is pick a mold,
click through its releases, full record below, edit, save.

## 1. Migrations (re-runnable, `-- NNN:` header, probe in `PENDING_MIGRATIONS`)

Rules for every new table: RLS on, **no policies** (service role only); at
most one foreign key to `public.users` per table, marked `-- embed-checked`;
every other "who" column a plain UUID. **No new foreign key to
`catalog_items` on `catalog_changelog`** (the `/catalog/changelog` embed of
`catalog_items(...)` would become ambiguous, PGRST201). Functions:
`SECURITY DEFINER`, `SET search_path = ''`, `REVOKE ALL ... FROM PUBLIC,
anon, authenticated`, `GRANT EXECUTE ... TO service_role`.

### 242_registry_moderators.sql (probe: column `registry_actions.actor_role`)

- `registry_moderators`: `user_id` UUID PK REFERENCES public.users ON DELETE
  CASCADE (embed-checked), `status` TEXT CHECK (active, resting,
  stepped_down, removed) DEFAULT active, `granted_by` UUID, `started_at`
  TIMESTAMPTZ DEFAULT now(), `term_ends_at` DEFAULT now() + 12 months,
  `last_action_at`, `removed_at`, `removed_reason` TEXT (<= 1000),
  `created_at`, `updated_at` (existing `trg_touch_updated_at`). Seed a
  `badges` row `registry_moderator` ON CONFLICT DO NOTHING.
- `registry_actions` (History): `id`, `kind` CHECK (edit, add, refile,
  approve, revert, merge, remove, undo), `status` CHECK (applied,
  awaiting_second_look, declined, undone, failed), `actor_id` REFERENCES
  public.users (embed-checked), `actor_role` CHECK (member, curator,
  moderator, owner), `catalog_item_id` UUID **no FK** (row may be archived),
  `item_title` TEXT snapshot, `related_item_id` UUID (merge keeper),
  `suggestion_id` REFERENCES catalog_suggestions ON DELETE SET NULL,
  `summary` TEXT NOT NULL, `note` TEXT, `row_count` INT DEFAULT 1 (Phase 2
  batches reuse it), `second_look_by`, `second_look_at`, `second_look_note`,
  `looks_right_by`, `looks_right_at`, `undone_by`, `undone_at`, `undo_of`
  REFERENCES registry_actions, `undo_until` DEFAULT now() + 30 days,
  `created_at`, `applied_at`. Indexes: (created_at desc), (actor_id,
  created_at), (catalog_item_id), partial on status = 'awaiting_second_look'.
- `registry_action_rows`: `id`, `action_id` REFERENCES registry_actions ON
  DELETE RESTRICT, `catalog_item_id` UUID, `before` JSONB, `after` JSONB (only
  touched columns and attribute keys), `outcome` CHECK (applied,
  skipped_changed_since, refused, restored), `created_at`.
- `catalog_changelog` gains `actor_role` TEXT (CHECK) and `action_id` UUID
  REFERENCES registry_actions ON DELETE SET NULL; widen `change_type` CHECK
  with merge, restore, revert. Existing rows untouched (null role reads
  "before roles").
- `catalog_suggestions` gains `claimed_by` UUID (no FK; it already links to
  auth.users), `claimed_until` TIMESTAMPTZ, `original_field_changes` JSONB
  (what the member sent, before edit-then-approve), `decided_role` TEXT
  CHECK. `status` keeps its values; a claim is the two columns, so the admin
  queue (pending + under_review) keeps working; `under_review` is used only
  while a duplicate's merge awaits a second look.

### 243_registry_merge_undo.sql (probe: column `catalog_removed_items.item_id`)

- `catalog_removed_items`: `id`, `item_id` UUID (no FK), `item` JSONB (full
  row **without** generated `sort_key`, `search_key`), `kind` CHECK
  (removed, merged), `merged_into` UUID, `reason` TEXT (3 to 1000),
  `action_id` REFERENCES registry_actions, `removed_by` REFERENCES
  public.users (embed-checked), `links` JSONB, `restore_until` DEFAULT now()
    - 30 days, `restored_at`, `restored_by`, `restored_slug`, `created_at`;
      unique partial index on (item_id) WHERE restored_at IS NULL.
- `registry_link_counts(p_item uuid) returns jsonb`: horses (including
  soft-deleted), want lists, children (`parent_id`), `id_suggestions`,
  pending suggestions, `catalog_sale_reports`, `catalog_price_signal_flags`.
- `registry_merge(p_keep, p_remove, p_action_id, p_actor, p_reason) returns
jsonb`, one transaction: lock both FOR UPDATE; save then delete the
  remover's want-list rows for members who already want the keeper
  (`links.wishlists_folded`); repoint with `UPDATE ... RETURNING id`,
  collecting ids: `user_horses.catalog_id`, `user_wishlists.catalog_id`,
  `id_suggestions.catalog_id`, `catalog_suggestions.catalog_item_id`,
  `catalog_changelog.catalog_item_id`, `catalog_items.parent_id`,
  `catalog_sale_reports.catalog_item_id`, `catalog_price_signal_flags`
  (rows clashing with the keeper's unique key folded like want lists),
  `catalog_slug_history.item_id` (collect keys); upsert the remover's
  address into slug history pointing at the keeper (`links.slug_added`);
  insert the archive row (kind merged); delete the remover; write a
  `registry_action_rows` row whose `before` is the full row.
  `links` = `{user_horses:[ids], user_wishlists:[ids], wishlists_folded:[rows],
id_suggestions, catalog_suggestions, catalog_changelog, children,
sale_reports, price_flags, price_flags_folded:[rows],
slug_history:[[maker_slug,slug]...], slug_added:[maker_slug,slug]}`.
  (This also fixes today's bug: the current merge cascade-deletes sale
  reports and price flags, member data, because `MERGE_REPOINTS` misses them.)
- `registry_unmerge(p_action_id, p_actor)`: refuse after 30 days or if
  undone; re-insert the row with the **same id** and an explicit column list
  (id, item_type, parent_id, title, maker, maker_slug, slug, scale,
  attributes, artist, manufacturer, created_at); if (maker_slug, slug) is now
  taken insert slug NULL (the 129 trigger gives a new address; the 233
  trigger drops its old forward); if the parent mold is gone, parent_id NULL
  (reported). Move links back **expect-guarded**: `UPDATE user_horses SET
catalog_id = p_remove WHERE id = ANY(ids) AND catalog_id = p_keep` (and the
  same for every list); members who re-linked since are left alone and
  counted. Re-insert folded want lists and price flags where no conflict;
  point slug keys back; mark the archive row restored and the action undone.
- `registry_remove(p_item, p_action_id, p_actor, p_reason)`: raise P0001
  message `linked` with the counts as DETAIL JSON if any count > 0; save the
  slug-history rows (they cascade); record the `catalog_changelog` ids and
  set their `catalog_item_id` NULL (the 091 FK has no ON DELETE and would
  block); record decided suggestion ids (they null themselves); archive;
  delete.
- `registry_restore(p_removed_id, p_actor)`: the reverse, same address rule.

**Removal = archive table**, not a `removed_at` column: a column would mean
filtering 74 files plus SECURITY DEFINER functions, the sitemap and
service-role readers, and removed rows would keep their addresses. Cost:
machine price rows (`catalog_price_signals`, `_history`, `_sweeps`) cascade
away and are re-collected; undo does not bring them back.

### 244_registry_rules_todo.sql (probe: column `registry_style_rules.status`)

- `registry_style_rules`: `id`, `title` (<= 140), `body` (<= 2000),
  `check_key` TEXT null (names a fix in `fixes.ts`; validated in code, no DB
  CHECK), `params` JSONB, `status` CHECK (proposed, in_effect, vetoed,
  withdrawn, retired), `proposed_by` REFERENCES public.users
  (embed-checked), `in_effect_at`, `vetoed_at`, `veto_note`, `retired_at`,
  `created_at`, `updated_at`.
- `registry_rule_votes`: `rule_id` ON DELETE CASCADE, `voter_id` REFERENCES
  public.users (embed-checked), `vote` CHECK (agree, disagree), `note`,
  `created_at`; PK (rule_id, voter_id).
- `registry_todo_claims`: `list_key`, `item_key`, `claimed_by` REFERENCES
  public.users (embed-checked), `claimed_until`, `done_at`, `created_at`;
  PK (list_key, item_key).
- `registry_digests`: `day` DATE PK, `sent_at`, `summary` JSONB (insert ON
  CONFLICT DO NOTHING = once a day).

### Before each is pasted (write.ts detects 42P01, PGRST205, PGRST202, 42883, 42703, PGRST204)

- No 242: only the owner passes the role check; history and claims skipped;
  changelog inserts retried without the new columns.
- No 243: the owner gets the old non-undoable merge (moved into write.ts);
  moderators see "Merging and removing open once the owner adds update 243."
- No 244: Rules, claims and digest say "Coming once update 244 is added."

## 2. Modules, actions, routes

### Package A (engine)

- `src/lib/auth.ts`: `type RegistryRole = "owner" | "moderator"`;
  `registryRoleOf(): Promise<{userId, alias, role} | null>` (never throws;
  for links); `requireRegistryModerator(): Promise<{supabase, user, role,
alias}>`: calls `requireAuth()` (suspension), ADMIN_EMAIL passes as owner,
  else needs an `active` row; memoised per request with `cache()`; throws
  `AuthError("The Registry Desk is for Registry moderators.")`.
- `src/lib/registry/types.ts`: `RegistryActor {userId, alias, role:
ActorRole}`, `ActionKind`, `ActionStatus`.
- `src/lib/catalog/write.ts` (`import "server-only"`), **the only writer** of
  `catalog_items` and `catalog_changelog`:
    - `validateChanges(row, changes)`: `normalizeFactValue`,
      `vocabularyProblem`/`canonicalVocabulary`, a new `fieldValueProblem(key,
value)` in `corrections.ts` (Silver + identity checks, in words); years
      via `parseYearRange`; `normalizeRunCount`, `isCatalogGender`,
      `normalizeCatalogBreed`; `item_type` in `CATALOG_CATEGORIES`;
      `parent_id` must be a `plastic_mold` other than itself, scale follows
      the mold; title and maker can't be emptied; an empty attribute deletes
      the key; attribute keys must exist on the row or in the field registry.
    - `updateItem(actor, {id, expectedUpdatedAt, changes, note?, suggestionId?,
kind})`: guarded `.eq("updated_at", expected)`; zero rows =
      `{code: "conflict", current}`.
    - `insertItem(actor, {payload, note?, suggestionId?}) -> {id}`.
    - `revertFields(actor, {itemId, fieldChanges, suggestionId, reason})`
      (today's expect-guard logic, moved).
    - `requestMerge(actor, {keepId, removeId, note, suggestionId?}) ->
{actionId, status}`: owner applies at once; moderator ->
      `awaiting_second_look`. `confirmMerge(actor, actionId)`,
      `declineMerge(actor, actionId, note)`: confirmer is never the requester.
    - `removeItem(actor, {id, reason})`: set-piece check first, then
      `registry_remove`.
    - `undoAction(actor, actionId, reason) -> {restored, drifted}`: edit,
      approve, refile = field guard (current must equal `after`); add =
      removal (refused if anything now links); merge = `registry_unmerge`;
      remove = `registry_restore`.
    - `linkCounts(id)`: DB counts plus set pieces (a mold: rows elsewhere whose
      roster names it, via `mentionsMold` and the linker's candidate query; a
      set piece: rows in the same set, `setLabel` + model number).
    - internal `recordAction`, `recordChange`, `legacyMerge`. Every write ends
      with `revalidateTag(CACHE_TAGS.referencePages, "max")`, checks limits,
      stamps `last_action_at`.
- `src/lib/catalog/suggestionApply.ts` (NOT "use server"):
  `applySuggestion(id, {reviewer: RegistryActor | null, edited?})` (today's
  `applyApprovedSuggestion` plus credit and badge bookkeeping);
  `decideSuggestion(...)` (status, `decided_role`, the member's notice:
  "approved by @alias, Registry moderator", with the diff when edited).
  Refuses when the reviewer wrote the suggestion, or is the piece's artist
  (`artist_profiles.studio_name` / `also_known_as` vs the row's artist or
  maker).
- `src/lib/registry/limits.ts`: the limits above via `checkRateLimit(endpoint,
max, 1440, "registry:" + userId)`; owner exempt; speed alarm.
- `src/lib/registry/alerts.ts`: `alertOwner(kind, text, link)`; at once for
  merges requested/applied, removals, limit hits, speed, one moderator
  undoing another.
- `src/app/actions/admin.ts` (owner only): `listRegistryModerators()`,
  `grantRegistryModerator(userId)` (upsert active, badge on),
  `removeRegistryModerator(userId, reason)` (badge off); probes for 242, 243
  **and 244** (C never touches admin.ts).
- `src/components/AdminMembersTab.tsx`: a moderators strip; Make moderator /
  Remove on member rows.
- `src/app/catalog/changelog/page.tsx`: entries with null `catalog_item_id`
  get no link (else `/catalog/null`).
- Owner per-suggestion pings stop once any moderator is active (answer 4).

### Package B (Desk shell, Queue, Mold view, editor)

- Routes: `src/app/catalog/desk/layout.tsx` (role check, `notFound()` for
  others; `ExplorerLayout noHeader`, `CatalogSubMasthead` "Registry Desk",
  `DeskTabs`), `page.tsx` (Queue), `mold/page.tsx` (picker),
  `mold/[id]/page.tsx?release=<id>`, `loading.tsx`.
- Actions `src/app/actions/registry-desk.ts` (every export calls
  `requireRegistryModerator()` first, returns `ActionResult`):
  `getQueue(tab: "corrections"|"additions"|"duplicates"|"auto_applied"|"second_looks")`,
  `claimSuggestion(id)` (30 min), `releaseClaim(id)`,
  `approveSuggestion(id, edited?, note?)`, `rejectSuggestion(id, reason)`
  (>= 5 chars); `searchMolds(term, {maker?, scale?})`, `getMoldView(moldId)`
  (the mold + **only** rows with `parent_id = moldId`; set rows filed under
  other molds are never fetched), `getItemForEdit(id)`, `saveItem({id,
updatedAt, changes})`, `addItem({parentId?, itemType, fields})`;
  `previewMerge(keepId, removeId)`, `requestMerge`, `confirmMerge`,
  `declineMerge`, `previewRemove(id)`, `removeItem(id, reason)`.
- Field registry `src/lib/catalog/editableFields.ts`: add `DESK_FIELDS` with
  `appliesTo: "release"|"mold"|"all"` and `group`:
  Identity (title, item_type, maker, artist, manufacturer, `parent_id` as
  "Re-file under mold" with a mold picker, scale); Release facts
  (model_number, color_description, years, run_type, `run_detail`,
  run_count, retail_price, `set_name`, mold_name, material); Sculpture for
  molds (sculptor, first year, breed, gender, material); Notes
  (registry_notes); Import details (`HIDDEN_ATTRIBUTES`, collapsed but
  editable); Everything else (the existing extras fallback); read-only (id,
  page address, created_at, updated_at). `buildDeskFields(item)`.
  `CATALOG_EDITABLE_FIELDS` unchanged (member form untouched).
- Components `src/components/desk/`: DeskTabs, DeskLink (in
  `CatalogMasthead.tsx`, only when `registryRoleOf()` returns a role),
  QueueList, QueueItemCard, EditThenApprove, MoldPicker, MoldView,
  ReleaseRail, ItemEditor, DeskField, FlagChips, SuggestedFixes ("Use
  this"), MergeDialog, RemoveDialog, ConflictNotice, `useDeskKeys`.
- Editor: J/K and Prev/Next (ignored while typing); Ctrl/Cmd+S saves;
  unsaved drafts kept per release in memory with a dot on the rail;
  `beforeunload` warning; `?release=` kept in the URL via
  `history.replaceState`. At 375px the rail becomes a select above the
  editor, one column of fields, sticky Prev/Save/Next bar. Styling:
  `ledger-card`, `leather-band`/`leather-panel`, `ui/Button`, `ui/Input`,
  `ui/native-select`.

### Package C (To-do, Rules, History, digest)

- `src/lib/registry/checks.ts` (pure): `FlagKey` = shop_or_sale_title,
  no_colour, roster_in_title (a **neutral note**, answer 1),
  description_in_title, colour_in_title, number_in_title, number_clash,
  wrong_scale, no_mold, mold_no_generation, set_missing_pieces,
  title_lowercase, title_punctuation, year_as_text, mold_name_disagrees,
  duplicate_release, empty_mold, near_name; `FLAG_LABELS` (the mock's
  words); `releaseFlags(row, {mold, siblings, sameNumber})`,
  `moldFlags(mold, releases)`, `computeTodoLists(rows)`. Reuses
  `rosterPieces`, `setLabel`, `generationOf`, `hasTrailingPunctuation`,
  `leadingModelNumber`.
- `fixes.ts`: `FIX_RULES` (key -> generator), `suggestedFixes(row, flags,
rulesInEffect)`: nothing unless a rule with that `check_key` is in effect.
- `rules.ts`: `AGREEMENTS_NEEDED = 3`, `ruleStatusAfterVote()` (proposer
  doesn't count; the owner's agreement counts).
- `todo.ts`: `getCachedTodo()` with `unstable_cache`, revalidate 3600, tags
  `[CACHE_TAGS.registryTodo, CACHE_TAGS.referencePages]` (any Registry
  write already clears referencePages); claims read live on top.
- `digest.ts`: `buildRegistryDigest(admin, since)`,
  `sendRegistryDigest(admin)`.
- `src/lib/cache/tags.ts`: add `registryTodo`.
- Actions `src/app/actions/registry-desk-lists.ts`: `getTodoLists()`,
  `getTodoList(key, page)`, `claimTodo`, `releaseTodo`, `markTodoDone`;
  `listRules()`, `proposeRule()`, `voteRule()`, `withdrawRule()`, owner-only
  `vetoRule()`, `retireRule()`; `getHistory(filter)`, `undoAction(id,
reason)`, `markLooksRight(id)` (not by the actor).
- Routes `desk/todo`, `desk/todo/[list]` (items open the Mold view
  preselected), `desk/rules`, `desk/history`. Components: TodoBoard,
  TodoListTable, RulesBoard, RuleProposalForm, HistoryList, HistoryRow.
- Digest: one guarded step in `src/app/api/cron/refresh-market/route.ts`.
- Docs: GLOSSARY (Desk, to-do, style rule), DECISIONS,
  `docs/guides/registry-moderation.md` (the moderator guide, plain words).

## 3. Single writer: every current write site

| Site                                       | Today                                           | After                                                                  |
| ------------------------------------------ | ----------------------------------------------- | ---------------------------------------------------------------------- |
| `src/lib/catalog/merge.ts` ~55-62, 101-109 | `MERGE_REPOINTS` loop updates `parent_id`       | into `registry_merge` and write.ts `legacyMerge`                       |
| `merge.ts` ~111, 135                       | changelog insert, loser delete                  | `mergeCatalogItemsCore` deleted; `resolveCatalogRef` stays             |
| `src/app/actions/admin.ts` ~473-495        | `mergeCatalogItems`                             | `requestMerge(ownerActor, ...)` (applies at once, undoable)            |
| `admin.ts` ~933-946                        | `resolveLegacySuggestion` insert + changelog    | `insertItem(ownerActor, ...)`                                          |
| `catalog-suggestions.ts` ~605-771          | `revertSuggestion` (ADMIN_EMAIL, alias "Admin") | `requireRegistryModerator` then `revertFields` (real alias and role)   |
| `catalog-suggestions.ts` ~1108-1380        | `applyApprovedSuggestion`                       | moved to `suggestionApply.ts` using updateItem/insertItem/requestMerge |
| `catalog-suggestions.ts` ~544, ~1045       | auto-apply, `reviewSuggestion`                  | call `applySuggestion`                                                 |
| `src/app/actions/linker.ts`                | via `createSuggestion`                          | unchanged (inherits the writer)                                        |
| `scripts/catalog-delta/*.mjs`              | owner-run repairs                               | outside `src/`; the guard excludes them, saying why                    |

Guard test `src/__tests__/registry-single-writer.test.ts`: scans
`src/**/*.{ts,tsx}` minus `__tests__`; fails if a `.from("catalog_items")`
chain (or a table list naming it) reaches `.update/.insert/.upsert/.delete`
outside write.ts; same for `catalog_changelog` inserts; same for
`rpc("registry_(merge|unmerge|remove|restore)")`; planted-sample self-check
like `migration-standards.test.ts`.

## 4. Packages (disjoint files) and merge order A, C, B

- **A**: migrations 242, 243; `admin.ts` (all three probes); `auth.ts`,
  `corrections.ts`, `merge.ts`, `write.ts`, `suggestionApply.ts`,
  `catalog-suggestions.ts`, `src/lib/registry/{types,limits,alerts}.ts`,
  `AdminMembersTab.tsx`, `catalog/changelog/page.tsx`, the guard test.
- **B**: `src/app/catalog/desk/{layout,page,loading}.tsx`, `desk/mold/**`,
  B's `src/components/desk/*`, `registry-desk.ts`, `editableFields.ts`,
  `CatalogMasthead.tsx`.
- **C**: migration 244; `desk/{todo,rules,history}/**`; C's
  `src/components/desk/*`; `registry-desk-lists.ts`;
  `src/lib/registry/{checks,fixes,rules,todo,digest}.ts`; `cache/tags.ts`;
  the `refresh-market` route; docs.

B and C code against A's signatures in this file. B imports C's
`releaseFlags`, `moldFlags`, `suggestedFixes`, `FLAG_LABELS` as specified.
C's pages run their own role check.

## 5. Tests

- **A**: the guard test; `write.test.ts` (every field kind validated, refused
  values in words; re-file scale follows the mold, non-mold parent refused;
  `updated_at` conflict; limit hit refused and owner alerted, owner exempt;
  changelog fallback before 242; legacy merge before 243 owner only;
  removal refused per link kind including set pieces; undo skips drifted
  fields; every write clears referencePages); `auth-registry.test.ts`
  (owner, active, resting, removed, stepped down, suspended, table
  missing); `suggestionApply.test.ts` (approver is the reviewer; nobody
  decides their own; artist can't approve their own; edit-then-approve keeps
  the original and the notice shows the diff; a moderator's duplicate
  approval waits for a second look, the owner's applies);
  `migration-242-243.test.ts` (static SQL: grants revoked, every link table
  covered, unmerge guarded by `AND catalog_id = p_keep`, explicit insert
  columns, no generated columns); updated `merge.test.ts`, `admin.test.ts`
  (grant/remove owner only; a removed moderator refused next action).
- **B**: `editableFields.desk.test.ts` (every real column and curated key;
  mold vs release sets; extras and Import details; member list unchanged);
  `registry-desk.test.ts` (every export checks the role, by source scan and
  a mocked refusal; claim collisions; claim expiry 30 min; Mold view
  excludes a set row on another mold naming this mold); `ItemEditor.test.tsx`
  (J/K, not while typing; Ctrl/Cmd+S; draft kept when moving; leave
  warning; conflict notice; "Use this" fills the field and marks unsaved);
  `QueueItemCard.test.tsx`; a Playwright look-see at 375px, deleted before
  commit.
- **C**: `checks.test.ts` (a positive and a negative per flag; number clash
  ignores same-set rows; (Gn) check Breyer Stablemate molds only; fixtures
  match `registry_health.mjs`); `fixes.test.ts` (no fix without a rule in
  effect; every fix passes `validateChanges`); `rules.test.ts` (proposer
  doesn't count; 3 agreements, owner's counts; veto any time);
  `digest.test.ts` (lists every removal and merge; once a day);
  `cache-tags.test.ts` passes.

## 6. Risks

- Price history and signals cascade away on remove/merge; undo doesn't bring
  them back (re-collected).
- `checkRateLimit` fails open; the speed alarm is the backstop.
- `links` in `registry_actions`/`catalog_removed_items` hold member row ids:
  service role only, never shown publicly.
- New tables aren't in `database.generated.ts` until pasted: untyped casts,
  then `npm run gen-types`.
- A member can still edit a pending suggestion while it is claimed; approval
  uses the moderator's copy and keeps the original.
- Set-piece detection reads titles and can miss some; the FK guards still
  protect horses and want lists.

## Deviations from the plan (Package A, branch desk-a-engine)

Every name and signature above is kept; these are additions and the
choices the plan left open. B and C: read "Return shapes" first.

- **Return shapes.** Every write.ts function returns `WriteResult<T>`:
  `{ success: true, ...T } | { success: false, error, code, field?, current?, counts?, drifted? }`,
  so a server action can return it as its `ActionResult`. `code` is one of
  `invalid, conflict, not_found, forbidden, limit, linked, not_ready, failed`.
  The plan's `{code: "conflict", current}` is the failure branch of
  `updateItem`. Successes: `updateItem -> {item, actionId, touched}`,
  `insertItem -> {id, item, actionId, dropped}`, `revertFields -> {reverted,
drifted, actionId}`, `requestMerge -> {actionId, status, summary, legacy}`,
  `confirmMerge -> {actionId, status: "applied", summary}`,
  `declineMerge -> {actionId, status: "declined"}`, `removeItem -> {actionId,
removedId}`, `undoAction -> {restored: number, drifted: string[], actionId}`.
  `linkCounts(id)` returns `LinkCounts` (the seven database counts plus
  `set_mentions`, `set_siblings`, `total`); `linkWords(counts)` says them.
- **validateChanges(row, changes, ctx?, opts?)** stays pure: `ctx.parent`
  (the mold the row will sit under) and `ctx.childCount` are looked up by
  `updateItem`/`insertItem`; `opts.lenient` drops a bad attribute value
  instead of refusing (suggested additions, as before). `row = null` checks
  a new row. `changes` maps a column or attribute key to its new value; an
  empty value clears it. Attribute keys must be on the row, in the member
  form, in `HIDDEN_ATTRIBUTES`, in a short list of keys the live data
  carries, or in B's `DESK_FIELDS` (read from editableFields when it exists).
- **Optional extras** on the plan's inputs: `updateItem` and `insertItem`
  take `contributor` and `summary` (a member's approved suggestion credits
  them in the changelog); `insertItem` takes `lenient`; `updateItem.kind`
  defaults to `refile` when `parent_id` changes, else `edit`;
  `requestMerge` takes `contributor`.
- **recordChange is exported** from write.ts (still the only changelog
  writer): the suggestion pipeline's photo and removal notes change no row.
- **decideSuggestion(id, {reviewer, verdict: "approved" | "rejected", note?,
edited?}) -> {success, status: "approved" | "rejected" | "awaiting_second_look"}**
  (or `{success: false, error, code, requeued?}`; `requeued` = the apply
  failed and the suggestion is back in the queue with the reason). It does
  the whole decision: refusals, applySuggestion, status, `decided_role`,
  claim cleared, the member's notice. B's approve/reject actions call it.
  Also in suggestionApply.ts: `finishMergedSuggestion` (a confirmed merge's
  report is approved and credited), `withdrawApproval` (a revert or undone
  approval: rejected, credit back, notice), `reviewRefusal`, `editDiff`, and
  `resolveParentMold` / `findExistingMold` / `existingMoldMessage` (moved
  from catalog-suggestions.ts).
- **The owner is exempt** from "nobody decides their own" and the artist
  rule: the owner is the last word, and the old approval path keeps working.
- **Duplicates by a moderator**: the suggestion goes `under_review` while the
  merge waits; confirm approves and credits it; decline puts it back to
  `pending` with the note. Undoing an `approve` also withdraws the approval.
- **Before 243 nobody removes** (there was no removal before); merges
  before 243 are the owner's one-way merge, which now also moves sale reports
  and price flags. `requestMerge` refuses a mold merged into a non-mold and a
  keeper filed under the duplicate.
- **Before 242**, changelog types the old CHECK lacks are written as their
  nearest old type (merge as removal, restore as addition, revert as
  correction).
- **Migration 243** adds one more server-only function,
  `registry_reinsert_item(jsonb)`, shared by unmerge and restore; the merge
  folds a member's second price flag on the same model like a want list.
- **Extra exports for B and C**: `actorOf(seat)` (types.ts) builds the
  `RegistryActor` from `requireRegistryModerator()`; `REGISTRY_DESK_REFUSAL`
  (auth.ts); `checkRegistryLimit(actor, "edit" | "merge" | "remove" | "rule")`,
  `noteRegistryAction`, `REGISTRY_LIMITS`, `SPEED_ALARM_PER_HOUR` (limits.ts;
  C's `proposeRule` calls `checkRegistryLimit(actor, "rule")`);
  `anyActiveModerator()` (alerts.ts); `MERGE_REMOVE_NOT_READY`,
  `MERGE_REPOINTS`, `CatalogRow`, `CATALOG_ROW_COLUMNS`, `isMissingSchema`,
  `describeChanges`, `knownAttributeKeys` (write.ts).
- **Alert links** point at `/catalog/desk/history` and
  `/catalog/desk?tab=second_looks`; B, keep or tell A.
