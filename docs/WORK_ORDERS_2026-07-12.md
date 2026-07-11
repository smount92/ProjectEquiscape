# Work Orders — Settings / Admin / Catalog (from 2026-07-11 audits)

Self-contained batches from the settings, admin-panel, and catalog audits.
Any agent MUST first read `docs/OPERATOR_PLAYBOOK.md` (house rules) and
`docs/guides/DESIGN_LANGUAGE.md` (the leather/ledger design language — all
UI work follows it: tokens only, no raw hex / bg-white, text-on-leather
uses `--leather-text*`, both themes + Simple Mode must work).

**Ground truth (2026-07-11):** 1,031 tests / 71 files · migrations 001-123
(119 files; next number = check folder, likely 124) · flags SHOWS_V2 /
GROUPS_FORUM / STABLE_V2 / SHOWRING_V2 all LIVE in prod · zod-at-boundary
only in the 5 rebuilt domains (shows-v2*, groups-forum, showring, stable);
reference pattern = `src/app/actions/stable.ts` + `src/lib/stable/schemas.ts`
· admin gate helper = `requireAdmin()` in `src/lib/auth.ts` (added 2026-07-11)
· migrations are FILES ONLY, owner applies them in Supabase SQL editor, then
`npm run gen-types` · house flow: branch in a worktree → push → main session
merges after review (money/schema/security get adversarial review) · main
auto-deploys prod; public pages (settings/admin/catalog) are LIVE, not
flag-gated.

**ALREADY DONE 2026-07-11 (do not redo):** security hotfix `becf7f2` gated
5 ungated admin server actions (suggestions.ts reviewSuggestion — was an
UNAUTHENTICATED write to catalog_items; getPendingSuggestions; moderation.ts
getOpenReports/dismissReport/actionReport) via the new `requireAdmin()`.

---

## BATCH E — Quick live-bug + design fixes (mechanical, DO FIRST) — S each

E1. **Catalog broken for anon (live bug).** `/catalog` is in `src/proxy.ts`
    public paths and the logged-out Header links to it, but `catalog_items`
    has NO `TO anon` RLS policy (only `TO authenticated` from migration
    048), so anon visitors get 0 rows and 404s on `/catalog/[id]`. FIX:
    new migration (124+) adding `CREATE POLICY ... ON catalog_items FOR
    SELECT TO anon USING (true)` (or merge to `TO authenticated, anon`),
    following the precedent in 112_photo_short_slugs.sql / 118_shows_domain_rls.sql.
    DECISION NEEDED: `mv_market_prices` had anon SELECT revoked in
    092_supabase_linter_fixes.sql — for the Blue Book teaser to work for
    anon, either re-grant or (better) wrap it in a SECURITY DEFINER
    aggregate-only RPC. File-only migration; owner applies. **S** (judgment
    on the mv_market_prices approach).
E2. **Exhibitor-number validation.** `settings.ts:updateProfile` only
    trims/slices the exhibitor number, so `MyStable!` is baked verbatim into
    printed show tags (`api/export/show-tags/route.ts:108`). Add a format
    constraint (alphanumeric, sane length). Pairs with Batch G zod. **S**
E3. **Settings design/bug pass** (`src/app/settings/page.tsx`, 584 ln):
    drop the duplicate page-local `<h1>` (FocusLayout already renders one
    from `title`); replace raw `#ef4444` Danger Zone hex → `destructive`
    tokens; swap the 6 ad-hoc section cards → `.ledger-card`; replace the
    `shadow-[…rgb(245 245 244)…]` (night-unsafe) with a standard shadow.
    Per DESIGN_LANGUAGE. Visual-check spacing after the `.ledger-card` swap.
    **S/M**
E4. **Admin design pass:** `AdminTabs.tsx` + `admin/page.tsx` — swap raw
    `#ef4444` → `Button variant="destructive"` / `text-destructive`; fix the
    broken repeated-class-string nested-box bug in `AdminSuggestionsPanel.tsx:61-107`.
    **S**
E5. **Catalog perf:** `catalog/page.tsx:25,32` runs two full-table scans
    (all ~10.5k rows, twice) per load to dedupe maker/scale facets — replace
    with a `SELECT DISTINCT` RPC or cached facet table (copy `get_stable_facets`
    pattern from migration 123). `catalog-suggestions.ts:getCatalogItems`
    (line 88): explicit column select + `count:"estimated"` instead of
    `"exact"` (runs on every keystroke). **S**
E6. **Catalog-suggestion design pass:** replace `bg-white`/hardcoded hex at
    `catalog/suggestions/new/page.tsx:31`, `catalog/suggestions/page.tsx:165,201`,
    `catalog/suggestions/[id]/page.tsx:269,315`, `SuggestEditModal.tsx:145`,
    `SuggestReferenceModal.tsx:135` → tokens. Per DESIGN_LANGUAGE. **S**

## BATCH F — Make notification preferences actually work — M, judgment

Live bug: the 7 settings notification toggles write `users.notification_prefs`
but NOTHING reads it — `createNotification` (`notifications.ts:131-161`)
ignores prefs entirely, so turning off a notification does nothing. AND the
newer types have no toggle (forum `reply`, `judge_assigned`, card issuance
has no notification at all). DO: (1) inventory every `type:` string emitted
across the app (grep `createNotification`); (2) define the pref taxonomy /
keys + sensible defaults (judgment); (3) thread a prefs check into
`createNotification`; (4) expand the Settings toggle list + `NOTIF_LABELS`
to cover all live types incl. forum replies. Cross-cutting.

## BATCH G — zod-at-boundary retrofit — M, mostly mechanical

The pre-rebuild action files never got the house standard. Add zod schemas
at the boundaries of `settings.ts`, `admin.ts`, `moderation.ts`,
`suggestions.ts`, `catalog-suggestions.ts` following the `stable.ts` /
`src/lib/stable/schemas.ts` precedent (schema → `safeParse` → `firstZodError`).
Highest value on `catalog-suggestions.ts` (`applyApprovedSuggestion` reads
untyped client `field_changes` JSON straight into `catalog_items` writes)
and the now-gated `suggestions.ts`/`moderation.ts` (do while they're fresh).

## BATCH H — UGC moderation coverage (USER SAFETY) — L, judgment

The platform now lets any user host shows, post forum threads, and earn
qualification cards, with ZERO admin oversight. Build it out:
- Extend `ReportButton` `targetType` union to include forum `thread`/`reply`,
  show entries, cards; wire report entry points into `ThreadView.tsx`,
  `RingConsole.tsx`/`PublicShowV2Page`, and `/cards/[code]` (today ReportButton
  is wired to exactly ONE surface: horse profiles).
- Add `deleteThread`/`hidePost` to `groups-forum.ts` (no forum delete exists;
  `posts.ts:202 deletePost` has an isAdmin bypass but no UI reaches it).
- Add a `voidCard`/`revokeQualification` action (hoofprint.ts or competition.ts)
  — a fraudulent card currently cannot be invalidated by anyone.
- Add an admin view of v2 hosted shows (`getAllHostedShows` + suspend/cancel;
  shows-v2.ts has no ADMIN_EMAIL touchpoint today) as a new AdminTabs tab.
- Make the Reports tab deep-link each `targetType` to its item instead of a
  truncated UUID.
- Consider splitting `AdminTabs.tsx` (447 ln, 5 jobs) into per-tab files
  before adding tabs. All admin actions use `requireAdmin()`.

## BATCH I — Move 1: public reference pages (GROWTH, strategy #1) — M/L project

Own mini-project; GATED on E1 (anon RLS) landing first. Turn the 10,500+
releases into public SEO pages `/reference/[maker]/[slug]`. Gap list:
- slug column on catalog_items + backfill (slugify maker+title, handle
  collisions — 10.5k rows WILL collide) + `updated_at` column (only
  created_at exists) for sitemap lastmod.
- new public route + `generateMetadata`/OG (copy `catalog/[id]/page.tsx`
  shape; decide: `/reference/*` as SEO twin vs repurpose `/catalog/[id]`).
- `src/app/reference/sitemap.ts` querying all releases; add `/catalog` +
  `/reference/*` to `robots.ts` (both absent today).
- privacy-safe "N collectors own this" aggregate RPC (copy get_stable_summary
  pattern; COUNT-only, never leak which user owns what).
- Blue Book teaser: `market.ts:getMarketPrice` already returns the right
  shape — wire it in once E1's mv_market_prices decision lands.
- **PHOTOS (L, the biggest piece):** NO image infra exists on catalog_items
  — the `photo` suggestion type is a silent no-op. Needs a
  `catalog_item_images` table (or `image_urls[]`) + storage bucket + anon
  read RLS + wiring + a sourcing strategy for 10.5k photoless rows. A public
  reference DB with no photos is a materially weaker wedge — scope this
  deliberately.
- Retire/merge the legacy `database_suggestions` system into `catalog_suggestions`
  (two competing suggestion pipelines exist; the legacy one guesses maker by
  comma-splitting free text and has weaker data quality — bad when public).

## BATCH J — Settings data-export + continuity (strategy Move 4) — M

Export pieces exist but are scattered across 5 API routes and undiscoverable.
Surface the existing NAN-cards CSV in Settings' Data & Reports; add an
aggregate show-history/collections export; add the plain-English
continuity/backup statement the strategy calls for (a trust signal — the
hobby lost Blab and MH$P). Mostly wiring + copy (owner signs off on the
statement wording).

---

## Suggested sequencing & delegation
- **E (all) → G**: quick wins + zod, mechanical, Sonnet-safe, high value,
  de-risks the surfaces before more eyes. E1 also unblocks I.
- **F**: judgment (notification taxonomy) — Opus or careful Sonnet.
- **H vs I**: two real projects — pick by priority. H = user-safety (do
  before growth brings more UGC + more strangers). I = growth wedge (do when
  ready to invest in the public catalog + photos). J pairs naturally with I
  (both public-facing trust/SEO).
- Owner approves: the mv_market_prices approach (E1), notification defaults
  (F), the /reference route architecture + photo sourcing (I), and the
  continuity copy (J).
