# MOVE 1 — Public Reference Pages + "Wanted" Demand Engine (Batch I)

**Status:** spec / pre-build (mock awaiting design-lead sign-off). Ships dark behind
`NEXT_PUBLIC_REFERENCE_PAGES`. Source strategy: `docs/OPERATOR_PLAYBOOK.md` MOVE 1 +
`docs/STRATEGY_2026-07.md`. Owner-approved shape: mock-first · all-owners aggregate
counts · everything-in-one-pass · **no platform money handling** (connection-only).

---

## 1. Why these two ship together

MOVE 1 (public, SEO-indexed reference pages per catalog release) is the growth surface.
The **"Wanted" engine** (buyers signal demand → owners of that model get nudged → they
connect) is the marketplace-liquidity payload that *lives on those pages*. Building the
Wanted hooks into the reference page from day one avoids a retrofit later.

The moat: the platform is the only place in the hobby that **knows who owns what**
(`user_horses.catalog_id`). So it can surface *latent* supply — owners who never listed
but might sell if nudged. Facebook groups structurally cannot do this. This is the
"structured-data utility FB can't copy" the strategy names as the core wedge.

**Guardrail (absolute):** never expose an individual owner's vault values, and never
expose a *private* owner's identity to a buyer. All counts are aggregates; the seller
nudge is delivered by a `SECURITY DEFINER` function that reaches owners without returning
their identity to the caller.

---

## 2. Reuse map (already built — do not rebuild)

| Capability | Where | Use |
|---|---|---|
| `catalog_items` anon read | migration 124 | reference pages readable by anon |
| Blue Book aggregate RPC | `get_market_rows` (126) → `getMarketPrice()` | price teaser + Phase-B price band |
| Teaser + members-only split UI | `MarketValueBadge`, `BlueBookProCharts` | Blue Book section |
| OG / `generateMetadata` pattern | `src/app/photo/[slug]/page.tsx` | reference page metadata |
| catalog+photo join | `community.ts` / `profile.ts` | representative photo |
| **Wishlist ("I want this")** | `user_wishlists`, `addToWishlist(catalogId)`, `WishlistButton` | the "I want this" button — already exists |
| **Buyer→listings Matchmaker** | `src/app/wishlist/page.tsx:60-74` query | generalize to "active listings for catalog X" |
| Notifications + deep-link | `createNotification({…, linkUrl})`, `link_url` (096) | the seller nudge delivery pipe |
| Offers/escrow (LATER, optional) | `makeOffer` + `make_offer_atomic` (099) | Phase C only; stays OFF for now |
| Pro-tier gating | `getUserTier()` / `get_user_tier()` (102) | optional Pro hook (Phase B/C) |

Known dead stubs (ignore or revive later, not day-one): `user_wishlists.is_boosted_until`
and `user_horses.is_promoted_until` are **charged via Stripe but never read** — no feed
consumes them. Revisit under Phase C monetization; do not depend on them.

---

## 3. Data model changes (migration FILES — owner applies; next # = 129)

### Migration 129 — `catalog_items` slug
- Add `maker_slug TEXT`, `slug TEXT`; unique index on `(maker_slug, slug)`.
- Backfill from `slugify(maker)` / `slugify(title)` with a deterministic collision suffix
  (`-2`, `-3`, … — stable URLs for SEO). Mirror the `unique_violation` retry pattern from
  migration `112_photo_short_slugs.sql`, but with human-readable output.
- Reference page resolves via `.eq("maker_slug", maker).eq("slug", slug)`.

### Migration 130 — reference + Wanted RPCs (all `SECURITY DEFINER STABLE SET search_path=''`, grant `anon, authenticated`; mirror migration `108` counter pattern)
- `count_catalog_collectors(p_catalog_id UUID) → BIGINT` — `count(DISTINCT owner_id)` of
  `user_horses` where `catalog_id = X AND deleted_at IS NULL`. Aggregate only. *(MOVE 1 collector count.)*
- `count_catalog_wanters(p_catalog_id UUID) → BIGINT` — `count(DISTINCT user_id)` of
  `user_wishlists` where `catalog_id = X`. Aggregate only. *(Wanted "N want this" count. Needs DEFINER because wishlists are RLS owner-only.)*
- `notify_catalog_owners_of_demand(p_catalog_id UUID, p_wanter_id UUID) → INT` — **the unlock.**
  Finds owners of the model (`user_horses` by `catalog_id`, `deleted_at IS NULL`, minus the
  wanter themselves, minus owners who opted out), inserts one aggregate `'demand_alert'`
  notification per owner (deduped/throttled — see §5), returns count nudged. **Never returns
  owner ids/rows to the caller.** Notification `link_url` → the reference page.

Active for-sale listings on the reference page do **not** need a new RPC — anon RLS already
permits reading `is_public = true` horses; expose a reusable
`getActiveListingsForCatalog(catalogId)` in `src/lib/…` generalized from the Matchmaker query
(`is_public`, `trade_status IN ('For Sale','Open to Offers')`, `catalog_id = X`, `deleted_at IS NULL`).

Notification type `'demand_alert'` is a free-form string — **no migration needed**.
Nudge opt-out: reuse the existing `users.notification_prefs` JSONB (add a `demand_alerts`
key) rather than a new column.

---

## 4. Reference page composition (day one)

`app/reference/[maker]/[slug]/page.tsx` (server component, anon SSR), top→bottom:
1. Leather breadcrumb masthead (`Reference › [Maker] › [Name]`).
2. Representative photo (from `horse_images` of public owners) + thumbnails.
3. Title + maker eyebrow + spec chips (year, finish, **material**, run, model #).
4. **"N collectors have this"** (aggregate) + **"Add to your stable"** CTA (`/add-horse?catalog=<id>`).
5. **Blue Book teaser** (`getMarketPrice`) + members-only full-history (`BlueBookProCharts`).
6. **For sale now** — `getActiveListingsForCatalog`, each tagged vs. Blue Book median,
   "Message seller" (no escrow framing).
7. **Wanted bar** — "I want this" (`addToWishlist`) + **"N want this"** (`count_catalog_wanters`).
8. Details ledger (specs) + description + secondary (eBay affiliate, suggest edit, changelog).
9. `generateMetadata` (title/desc/OG/twitter) + canonical → this page (existing `/catalog/[id]`
   stays the curation surface with `rel=canonical` pointing here to avoid duplicate content).

Plus: `/reference` added to `src/proxy.ts` public paths; `robots.ts` allow; `sitemap.ts`
made async/dynamic (one entry per release, ~10.9k URLs); a `slugify` util in `src/lib`.

---

## 5. "Wanted" engine — phased (all Phase A is finance-free)

### Phase A — ships WITH MOVE 1 (the day-one hooks)
- **I want this** button → existing `addToWishlist(catalogId)`.
- **"N want this"** public demand count → `count_catalog_wanters`.
- **For sale now** listings → `getActiveListingsForCatalog`.
- **Seller nudge** → on wishlist-add, call `notify_catalog_owners_of_demand`, firing an
  **aggregate, anonymous** `'demand_alert'` ("Someone's looking for your <model>") that
  deep-links owners to the reference page (where they see demand + can list/message).
  - **Delivery discipline:** aggregate/digest not per-buyer; dedupe so an owner isn't
    re-nudged for the same model within N days; respect `notification_prefs.demand_alerts`
    opt-out; the buyer's identity/number is never in the nudge.
  - **Activation:** the nudge *trigger* is gated behind a sub-flag (`NEXT_PUBLIC_WANTED_NUDGE`)
    so we can ship the reference pages + passive counts first, then switch nudging on once
    indexing is healthy and copy/throttle are tuned. The RPC + plumbing land day one.

### Phase B — fast-follow (still finance-free)
- Optional **private target price** on a wishlist entry (never public, never shown to owners).
- **Price-banded mutual intro:** when a matching listing/ask falls within the band (anchored
  to Blue Book median), fire a *double-opt-in* intro ("you two are in range — connect?").
  Numbers stay private until both opt in. Filters out lowballs via the Blue Book band.
- Anonymity: nudge is anonymous to the buyer; owner is revealed only when they choose to reply
  (reuses existing identity-revealed DMs — no masked relay needed yet).

### Phase C — later / optional
- Masked relay messaging (net-new) if owners must stay anonymous even in-thread.
- Revive the paid ISO/promote stubs (wire a reader/feed) — monetization, revisit deliberately.
- Escrow handoff via the existing Safe-Trade state machine — only if/when money handling is desired.

---

## 6. Privacy & guardrails checklist

- [ ] All counts are aggregates (`count(DISTINCT …)`); no identities, no vault values.
- [ ] `notify_catalog_owners_of_demand` never returns owner rows/ids to the caller.
- [ ] Nudge is anonymous + aggregate; buyer's target price never surfaced to owners.
- [ ] Per-user opt-out (`notification_prefs.demand_alerts`); nudge throttle + dedupe.
- [ ] Private/unlisted owners are nudged but never exposed to buyers; they reveal themselves
      only by choosing to respond.
- [ ] Phase B intros gated to a Blue Book price band to prevent lowball offense.

---

## 7. Build order (combined MOVE 1 + Wanted Phase A)

1. Design-lead sign-off on the reference-page mock (incl. For-sale + Wanted bar).
2. Migration files **129** (slug) + **130** (counters + demand-nudge RPC) → owner applies → `gen-types`.
3. `slugify` util; `getActiveListingsForCatalog` lib; wire `addToWishlist` on the page.
4. `app/reference/[maker]/[slug]/page.tsx` + `generateMetadata`/OG; `/catalog/[id]` canonical.
5. `proxy.ts` public path; `robots.ts` allow; dynamic `sitemap.ts`.
6. Internal links (stable/market/show cards → reference); `/add-horse?catalog=<id>` preselect.
7. `'demand_alert'` notification + `notify_catalog_owners_of_demand` trigger on wishlist-add,
   behind `NEXT_PUBLIC_WANTED_NUDGE`; opt-out in settings.
8. Tests (pure libs: slugify, price-band math; RPC smoke). Ship dark → preview → flip flags →
   submit sitemap to Search Console. Announce nothing (it's for Google).

---

*Companion: `docs/OPERATOR_PLAYBOOK.md` (MOVE 1, MOVE 6), `scripts/catalog-delta/` (the
catalog data this surfaces).*
