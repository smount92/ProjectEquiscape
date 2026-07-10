# Post-Shows Roadmap — What to Update Next

Site-wide survey, July 10 2026 (after the shows-v2 rebuild set the new
standard: zod-validated inputs, RLS-first, pure tested domain libs,
Button/token-only UI). Full findings live in the session analysis; this
is the actionable order.

## Priority order

### 1. 🥇 Safe-Trade / Commerce hardening ("Phase 3")
`src/app/actions/transactions.ts` (810 lines) moves **money** through
9 service-role (RLS-bypassing) writes with zero input validation —
not even offer amounts — and a single test. Apply the shows-v2
treatment end to end: pure escrow state machine in `src/lib/commerce/`,
zod on every action, RLS-first with each remaining admin call justified,
tests, adversarial review before merge. Highest risk in the codebase.

### 2. Quick-wins bundle (one small pass, do alongside/before #1)
- Bound `searchMarketPrices` (`market.ts:93`) — currently loads the
  ENTIRE price view and paginates in JS on every /market visit
- Fix anon "unknown" aliases on public pages (RLS-safe alias lookup —
  definer function or public view)
- Clean the legacy shows-list copy-paste pocket
  (`src/app/shows/page.tsx:149-183`, everything wearing the same card
  class + a stray `text-[#a78bfa]`)

### 3. Catalog/reference suggestions hardening
`catalog-suggestions.ts`: 9× `select("*")` on the 10.5k-entry reference
spine + 9 admin-client calls incl. trusted-curator auto-approve.
Column-scope + zod + tests.

### 4. HorseForm unification
`add-horse/page.tsx` (1,718) and `stable/[id]/edit/page.tsx` (1,646)
are near-duplicates — every field change is made twice. Extract shared
`<HorseForm>` (the `components/forms/*FormFields.tsx` set already
points the way). Biggest dev-velocity win.

### 5. Rolling cross-cutting passes
- zod adoption beyond shows (currently 3 files in the whole app)
- Test backfill: groups.ts (961), events.ts (896), art-studio.ts (833),
  competition.ts (1,125), messaging.ts (392) — all have ZERO tests
- Shared form-submit + toast layer (18 components hand-roll banners;
  `ToastContext` exists — consolidate onto it)
- Button-primitive leftovers: 65 dynamic-className + 21 bespoke statics
- Status-color design decision (~55 bright Tailwind hexes vs heritage
  tokens — needs the design lead)
- Alias storage normalization (strip stored `@` prefixes, one-time
  migration + signup constraint)

### 6. Legacy photo-show deletion (GATED — after v2 launches publicly)
The old "show system" is TWO systems:
- **`shows.ts` (1,280) + CreateShowForm + ExpertJudgingPanel +
  ShowEntryForm + LegacyShowPage** = the photo-show engine, superseded
  by v2's online mode. Deletable ONLY after (a) the prod flag flips and
  stabilizes, and (b) a data migration moves legacy photo shows → v2.
  Ordered leaf-first deletion sequence documented in the survey.
- **`competition.ts` (1,125) + ShowStringManager + events/[id]/manage +
  NAN card export** = the Show Packer / real-NAMHSA-card tracker for
  entrants attending REAL-WORLD shows. NOT superseded by v2 (v2 hosts
  shows ON MHH). Keep; modernizing it is its own future project.
  Schema link is pre-staged: `show_string_entries.v2_class_id`
  (migration 120).

## Confirmed healthy — leave alone
Notifications/realtime (modern postgres_changes), art-studio structure
(RLS-first, cleanest big subsystem), chat realtime.

## Shows v2 launch checklist (separate from the above)
1. Work through docs/SHOWS_V2_TESTING.md (esp. the live/ring path)
2. Fix whatever that shakes out
3. Recruit 2–3 friendly showholders for a hosted beta
4. Flip NEXT_PUBLIC_SHOWS_V2=1 in Vercel
5. Later: photo-show → v2 data migration, then legacy deletion (#6)
6. Pro tier build-out: multi-ring, packet PDF, Stripe fees, card
   redemption ("MHH Nationals") — the monetization layer
