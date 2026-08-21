# Code inventory — what actually exists (August 2026)

Working notes behind [`../COMMERCE_AND_COMMS_PLAN.md`](../COMMERCE_AND_COMMS_PLAN.md).
Read-only investigation; nothing was changed. File paths are relative to the repo root.

---

## A. Safe-Trade / transactions

### A.1 `transactions` — built, fully wired

Created in `supabase/migrations/044_universal_trust_engine.sql`, expanded by
`060_commerce_state_machine.sql`.

Columns: `id, type, status, party_a_id, party_b_id, horse_id, commission_id,
conversation_id, metadata jsonb, created_at, completed_at, offer_amount NUMERIC(10,2),
offer_message, accepted_at, paid_at, verified_at`.

- `type IN ('transfer','parked_sale','commission','marketplace_sale')`
- `status IN ('pending','offer_made','pending_payment','funds_verified','completed','cancelled')`
- Party semantics: **`party_a_id` = seller, `party_b_id` = buyer** (migration 099).
- **No INSERT policy** — deliberate. All inserts go through `SECURITY DEFINER` RPCs
  (`make_offer_atomic`) or the service-role admin client (`createTransaction`).
- `txn_update` has **no `WITH CHECK`** — a party can update any column, including
  re-pointing `party_b_id`. Only the Node-side state machine narrows this.
- Trigger `trg_transaction_complete_price` (071) stamps `metadata.sale_price` on the
  transition into `completed` — this is what feeds the Blue Book. It is `BEFORE UPDATE`
  only, so rows inserted directly as `completed` never fire it (the transfer/parked paths
  set `sale_price` by hand).
- Cron `cleanup_system_garbage` (068) auto-cancels `offer_made` older than 7 days.

The state graph is documented and enforced in `src/lib/commerce/stateMachine.ts` — 9
actions, party + status guards, exact refusal strings treated as a contract. Inputs
zod-validated in `src/lib/commerce/schemas.ts`. Unit tests in
`src/app/actions/__tests__/transactions.test.ts`.

**Money never moves through us.** `markPaymentSent` is buyer self-attestation (stamps
`paid_at`, no status change); `verifyFundsAndRelease` is seller self-attestation. The
buttons say "External Payment Sent" / "Acknowledge External Payment & Release."

Dead exports: `getReviewableTransactions()`, `getTransactionsForUser()` — zero callers.
`src/app/actions/ratings.ts` is a deprecated shim.
E2E: `e2e/safe-trade.spec.ts` — 2 smoke tests, 3 `test.fixme` placeholders for the actual
transitions.

### A.2 Two live bugs

**1. `'Pending Sale'` violates the CHECK constraint.**
`src/app/actions/transactions.ts:781` writes `trade_status: "Pending Sale"`, but
`007_marketplace_wishlists.sql` constrains the column to
`('Not for Sale','For Sale','Open to Offers')`. `079_stolen_missing_status.sql` intended to
widen it but is a no-op that only writes a `COMMENT` (its own text asserts the column has no
CHECK — it does). The result is never error-checked, so **accepting an offer silently fails
to lock the horse.** It stays listed and offerable while the deal sits in `pending_payment`.
`docs/architecture/state-machines.md:36` assumes this lock works. The same constraint would
reject `'Stolen/Missing'`, which is selectable in three UI dropdowns and declared in
`src/lib/types/database.ts:24`.

**2. Declining an offer writes a phantom column.**
`respond_to_offer_atomic`'s decline path (`099_commerce_locks.sql:108`, and the hardened
`133_security_hardening.sql:177`) does `UPDATE public.transactions SET status='cancelled',
updated_at=NOW()`. `transactions` has no `updated_at` column. Accept, cancel and retract are
unaffected (accept uses `accepted_at`; the others go through PostgREST).

### A.3 Mid-transaction mutation guard — app-layer only

`checkActiveTransaction()` in `src/app/actions/horse.ts:20-37`. Blocks delete /
trade-status-change / bulk-delete when the horse has a transaction in
`offer_made | pending_payment | funds_verified`. Four call sites (`deleteHorse`,
`updateHorseAction`, `bulkDeleteHorses`, and an inline copy in
`parked-export.ts:132`).

Two weaknesses: it is **not a database trigger**, so a raw PostgREST write under the
owner's own RLS bypasses it entirely; and it uses `.maybeSingle()` on a query that can
legitimately match multiple rows — with two competing offers on one horse it errors, returns
null data, and **fails open**.

### A.4 Transfers and claim PINs — built; this is how horses change hands

`horse_transfers` (`018_hoofprint.sql:166`) + `claim_pin VARCHAR(6) UNIQUE` (025).
`status IN ('pending','claimed','expired','cancelled')` — note there is no `'completed'`.

Two live flows:
- **Transfer code**, 48h — `generateTransferCode()` (`hoofprint.ts:288`),
  `src/components/TransferModal.tsx`, claimed via `claim_transfer_atomic`.
- **Claim PIN / "parked"**, 30 days — `parkHorse()` (`parked-export.ts:28`) generates a
  6-char PIN from an unambiguous alphabet via `crypto.randomInt`, sets
  `life_stage='parked'`, writes `transfer_code = 'PARK-'||pin`. UI
  `src/components/ParkedExportPanel.tsx`; redeemed at `src/app/claim/page.tsx`, which
  accepts either form and previews the horse first.

The ownership swap is `claim_parked_horse_atomic` (036, revised through 092/149). It row-locks
`FOR UPDATE`, rejects expired PINs and self-claims, closes the sender's ownership row with a
ghost snapshot, inserts the receiver's row, moves `owner_id`, marks the transfer `claimed`,
and **wipes `financial_vault`**. Rate limited 5 attempts / 15 min.

`trg_user_horses_cards_follow` (`120_cards_safe_trade_hook.sql`) fires `AFTER UPDATE OF
owner_id`, so qualification cards follow the horse on every path.

Expiry: `auto_unpark_expired_transfers()` (071) runs daily from
`/api/cron/refresh-market`; `getParkedHorseByPin` also lazily expires on lookup.

**RLS note:** the `"Lookup by transfer code"` policy is `USING (status = 'pending')` — any
authenticated user can enumerate every pending transfer row, including `transfer_code` and
`claim_pin`. The real claim paths all use the admin client / DEFINER RPCs, so this is
vestigial breadth, but it should be narrowed.

### A.5 Provenance — built, derived

`horse_ownership_history` (018) is the chain of custody; **no user INSERT policy** — written
only by the claim RPCs. The read path is the derived view `v_horse_hoofprint`
(`050_universal_ledger.sql:37`), a `UNION ALL` over the horse row itself, ownership history,
condition history, and show records, exposing `sale_price` only when `is_price_public`.
`horse_timeline` (018) still receives writes but is no longer read.

### A.6 Reviews — schema solid, discovery missing

`reviews` (044): `transaction_id, reviewer_id, target_id, stars, content`, unique on
`(transaction_id, reviewer_id)`, `CHECK reviewer_id != target_id`. The insert policy requires
a **completed** transaction the reviewer is a party to. `leaveReview`
(`transactions.ts:328`) additionally verifies `target_id` is the actual counterparty — the
RLS policy alone doesn't, so a bypassing caller could review a third party.

Forgery guard (`transactions.ts:98-151`): `createTransaction` refuses to mint a `completed`
row unless it can verify the underlying event (a `claimed` transfer, a delivered commission,
or a completed conversation). This closes the review-minting hole from the July audit.

Aggregates: `getUserReviewSummary` → profile page; `discover_users_view` computes
`avg_rating`/`rating_count` (rewritten in 169).

**Gap: nothing prompts a review.** `getReviewableTransactions()` is correct and uncalled.

### A.7 `financial_vault` — built, correctly quarantined

`001_initial_schema.sql:110`, one row per horse, owner-only RLS for all CRUD, plus
`is_trade` (115) and fuzzy purchase dates (075). It is the collector's private cost-basis
and insurance record — **not** a Safe-Trade ledger. Wiped on ownership transfer. Explicit
`🔒 financial_vault is NEVER queried here.` comments guard the two public pages.

### A.8 `mv_trusted_sellers` — was dead for its whole life, fixed in 169

`101_trusted_sellers.sql:13` joins `horse_transfers ... AND ht.status = 'completed'` — a
value the column's CHECK constraint forbids. The view has been empty since it shipped, so
`TrustedBadge` has **never rendered for anyone**. Diagnosed and rebuilt in
`169_market_completion.sql:78-127` (uses `'claimed'`, two `CROSS JOIN LATERAL` aggregates
instead of an N×M cartesian, adds a self-dealing exclusion). Thresholds unchanged: 60-day
account, ≥5 distinct transfer recipients, ≥3 reviews averaging ≥4.8, test accounts excluded.

Refreshed daily by `refresh_mv_trusted_sellers()` from
`src/app/api/cron/refresh-market/route.ts:50` (`0 6 * * *` in `vercel.json`). Wired into
three surfaces already. **169 is the newest migration and needs a manual apply.**

### A.9 Stripe — subscriptions and three upsells, no Connect

Grepping `Stripe.accounts.*`, `transfer_data`, `application_fee`, `on_behalf_of` across
`src/` returns **nothing**. Confirmed: no marketplace code of any kind.

Webhook `src/app/api/webhooks/stripe/route.ts` (API `2026-02-25.clover`), signature-verified,
handles exactly three events: `checkout.session.completed`,
`customer.subscription.updated`, `customer.subscription.deleted`. Everything else falls
through silently — **no refund or dispute handling**.

Six checkout routes: Pro, Studio Pro, Supporter (subscriptions); promote $2.99, boost-ISO
$1.99, insurance-report $1.99 (one-off). **The three one-offs charge for effects nothing
consumes**; the insurance PDF is free elsewhere.

There is **no `subscriptions` table and no `profiles.tier` column** — tier lives in
`auth.users.app_metadata.tier` (`free | pro | studio`) with `stripe_customer_id`. Other
writes: `users.is_supporter`/`supporter_since`, `user_horses.is_promoted_until`,
`user_wishlists.is_boosted_until`, `purchased_reports`.

Two documented hard-won fixes live here: `app_metadata` is merged rather than replaced, and
supporter/studio subscriptions are intercepted before the generic Pro branch. The
subscription-lookup fallback still does `listUsers({perPage:1000})` and scans in memory.

### A.10 Listing state on `user_horses`

`trade_status` (3 legal values, see A.2), `listing_price NUMERIC(10,2)`,
`marketplace_notes`, `life_stage` (`blank|stripped|in_progress|completed|for_sale|parked`),
`is_promoted_until`, `visibility`, `deleted_at`.

**No `sold` status, no auction, no installments, no escrow.** A sale is expressed as an
ownership change plus a completed transaction; `trade_status` just reverts. Wanted ads live
in `user_wishlists`.

### A.11 Feature flags

Twelve `NEXT_PUBLIC_*` vars exist; **none gate any transaction, Safe-Trade, transfer,
review, trust, vault, or Stripe surface.** The commerce stack is unflagged and always on.
Paid gating is server-side via `app_metadata.tier`.

---

## B. Messaging and inbox

### B.1 Schema

**`conversations`** (`009_native_inbox.sql`): `id, buyer_id, seller_id, horse_id,
transaction_status ('open'|'completed', added by 014), created_at, updated_at`.

Exactly two participants, hardcoded as buyer/seller. No participants table, no group threads,
no archived/muted/pinned, no `last_message_at`, no `deleted_at`.

- The unique index is **directional** — `(A,B,horse)` and `(B,A,horse)` are both insertable.
  `createOrFindConversation` compensates with a manual reverse lookup, which is a race, not
  a constraint.
- **No index on `updated_at`**, yet `/inbox` orders by it.
- **`buyer_id` really means "whoever clicked first"** — the RLS INSERT check is
  `WITH CHECK (auth.uid() = buyer_id)`. If a seller opens the thread, the Buyer/Seller pill
  at `src/app/inbox/[id]/page.tsx:245` is inverted.

**`messages`** (009): `id, conversation_id, sender_id, content TEXT, is_read BOOLEAN,
created_at`. That is the entire row — no `kind`, no `payload`, no `edited_at`, no
`deleted_at`, no `reply_to_id`, no `read_at`. No partial index on `is_read = false`, which is
what every unread query filters on.

**No triggers on either table.** `updated_at` is bumped by hand in
`src/app/actions/messaging.ts:157-160`; unread counts are live COUNTs; all notification
fan-out is TypeScript.

**Realtime is not actually enabled by a migration.** `039_modern_social.sql:124-126` has the
`ALTER PUBLICATION supabase_realtime ADD TABLE messages, notifications;` **commented out**
with a note to run it manually. A fresh database yields a chat whose subscription never fires.

**Doc drift:** `docs/database/rls-policies.md:88-94` documents a `participants` array that
does not exist. Don't trust that file.

### B.2 RLS holes

The authoritative policies are the 022 rewrites (`022_performance_hardening.sql:305-358`).
Two real holes:

- The `messages` UPDATE policy is named "mark messages as read" but has **no `WITH CHECK`
  and no column restriction**. Either participant can `UPDATE messages SET content=...` on
  the other person's messages, or change `sender_id`.
- The `conversations` UPDATE policy likewise has **no `WITH CHECK`** — a participant can
  rewrite `buyer_id`/`seller_id`/`horse_id` and re-point a thread at a different horse or a
  third party.

No DELETE policy on either table. Account deletion scrubs content in place
(`UPDATE messages SET content='[Message deleted by user]'`, latest in `160_bulletproof_sweep.sql:44`).

### B.3 Attachments

`media_attachments` (`042_universal_social_engine.sql:40`) — polymorphic, exclusive-arc CHECK,
`message_id` FK. Bucket `chat-attachments` (111) is private, 5 MB/file, images only, path
`{user_id}/{conversation_id}/{filename}`; the counterparty reads via admin-signed URLs
(3600 s) after a membership check.

**`media_select` is `USING (true)`** — every authenticated user can enumerate the
`storage_path` and `caption` of every private DM attachment on the platform. The bytes are
protected; the metadata is not.

Attachment insert failure is logged and swallowed (`messaging.ts:151-153`) — the message
ships without its photos and nobody is told. An empty-content photo message is stored with
the literal string `"📷 Sent a photo"`.

### B.4 Blocking

`user_blocks` (`039_modern_social.sql:51`), PK `(blocker_id, blocked_id)`,
`CHECK blocker_id != blocked_id`.

- **`blocks_select_own` restricts SELECT to `blocker_id = auth.uid()`** — so the bidirectional
  `.or(...)` checks in `messaging.ts:32` and `blocks.ts:76` can only ever return the first
  arm. **You cannot detect that someone blocked you**, and you can still open a fresh thread
  with them. Needs a `SECURITY DEFINER are_blocked(a,b)` RPC or a widened SELECT policy.
- **`sendMessage` has no block check at all.** Blocking is enforced only in
  `createOrFindConversation`. On an existing thread a blocked party keeps messaging, keeps
  incrementing the badge, keeps triggering emails. `BlockButton.tsx:20` promises
  *"They won't be able to message you."*

### B.5 Reporting, rate limits, anti-spam

- `user_reports` (066) accepts `target_type='message'` and `submitReport`
  (`moderation.ts:28`) handles it, but **`ReportButton` is only mounted on the horse page**
  (`community/[id]/page.tsx:766`). There is no report affordance anywhere in `/inbox`.
- `check_rate_limit()` (032) is used by contact, hoofprint, moderation, parked-export and
  auth. **Messaging uses none of it** — no throttle on `sendMessage` or
  `createOrFindConversation`.
- `maxLength={2000}` on the composer is **client-side only**; `sendMessage` accepts
  arbitrary length.
- `sanitizeText` strips HTML. `RISKY_PAYMENT_REGEX` (`src/lib/safety.ts:11`) matches
  `venmo|zelle|paypal f&f|friends and family|cash app|wire transfer` and shows an advisory
  banner **as you type** — evaluated only on the live composer value, never on the stored
  row, never logged or flagged.

### B.6 Surfaces and performance

| File | Lines | Role |
|---|---|---|
| `src/app/inbox/page.tsx` | 291 | thread list (RSC) |
| `src/app/inbox/[id]/page.tsx` | 405 | thread shell (RSC) |
| `src/components/ChatThread.tsx` | 455 | message list + composer |
| `src/components/OfferCard.tsx` | 269 | offer state UI |
| `src/app/actions/messaging.ts` | 406 | all server actions |

- **The inbox list loads every message you have ever received** (`.in("conversation_id",
  convoIds)` with no limit) and reduces in JS for previews and counts. It then builds an
  `.or()` filter with one `metadata->>conversation_id.eq.<uuid>` clause **per conversation**
  against `transactions` — a URL-length bomb and a full jsonb scan.
- The thread view issues roughly **ten sequential queries** before render.
- **Mark-read is a side effect of the RSC render** (`inbox/[id]/page.tsx:173-177`).
  `markConversationRead()` (`messaging.ts:307`) is dead code. So is `getUnreadCount()`
  (`messaging.ts:330`). `refreshMessageCount` in the notification context is never called —
  which is why the header badge stays stale after you read a thread.
- Three independent unread implementations; `src/app/actions/header.ts:38` still returns
  `unreadCount = 0` "for backwards compatibility."
- **Two overlapping realtime subscriptions**: `chat-${conversationId}` filtered
  (`ChatThread.tsx:54`) and a global `global-inbox-${userId}` with **no filter at all**
  (`NotificationProvider.tsx:107`), plus a 30-second-cooldown `visibilitychange` refetch.

### B.7 The entry point and the offer gap

`MessageSellerButton.tsx` branches on `tradeStatus`: offerable → "💰 Make Offer" +
"✉️ Ask a question"; otherwise a single "Message Seller". **It does not prefill a message** —
a conversation can exist with zero messages and renders as "No messages yet."

**Offers do not post into the thread.** `makeOffer` (`transactions.ts:642`) creates/finds the
conversation, calls `make_offer_atomic`, creates a notification, and revalidates the inbox
path. The offer surfaces only as `OfferCard` **above** the message list — the transcript has
no record that an offer was made, accepted, paid or cancelled. This is the structural gap the
deal-room rework exists to close.

`OfferCard` also renders every terminal state as "❌ Offer Declined" — cancelled and declined
are indistinguishable.

### B.8 Notifications

Both fan-outs are inline in `sendMessage` (`messaging.ts:162-226`), **synchronous on the
write path**, in one try/catch. One chat message = ~9 database round trips + one Resend call.

- `sendNewMessageNotification` (`src/lib/email.ts`) is **not prefs-gated** — turning off
  "messages" in settings silences the bell only. No digest or debounce (a 20-message
  exchange sends 20 emails). No `List-Unsubscribe`.
- The in-app bell goes through `createNotification`, which *is* prefs-gated.
- **No push.** There is a service worker but no web-push subscription table or VAPID wiring.
- Offer-lifecycle notifications are richer — `respondToOffer` even fans out cancellations to
  competing bidders (`transactions.ts:800-817`).

### B.9 Tests

**Zero.** No `messaging.test.ts`, no `ChatThread.test.tsx`, no inbox page test. `/inbox`
appears only as a URL in two layout/screenshot sweeps (`e2e/device-layout.spec.ts:33`,
`e2e/visual-qa-mobile.spec.ts:25`). Nothing sends a message or exercises unread state.

---

## C. The add-horse form stack

### C.1 The three forms

| | `src/app/add-horse/page.tsx` | `src/app/add-horse/quick/page.tsx` | `src/app/stable/[id]/edit/page.tsx` |
|---|---|---|---|
| Lines | 1,922 | 530 | 2,070 |
| Shape | 4-step wizard (CSS-hidden, not unmounted) | one card, stay-on-page | one scroll, 3 sticky sections |
| State | ~60 `useState`, no `<form>`, no `onSubmit` | a handful | ~60 again |
| Server schema | **none** | `quickAddHorseSchema` | **none** |
| Category | user-selectable toggle | hardcoded `'model'` | **no control** — immutable post-create |
| Visibility | tri-state public/unlisted/private | **boolean** — cannot produce `unlisted` | tri-state |
| Submit | `createHorseRecord` | `quickAddHorse` | `updateHorseAction` |

### C.2 Duplication, named

Near-identical blocks between the full and edit forms:
- Show Bio block — add `:1435-1512` vs edit `:1569-1640`
- Marketplace status + conditional price/notes — add `:1584-1643` vs edit `:1756-1815`
- Visibility tri-state selector — add `:1649-1691` vs edit `:1818-1859`
- Financial Vault body — add `:1748-1844` vs edit `:1909-2001`
- `handleCropComplete` (4-branch) — add `:298-379` vs edit `:480-551`
- `startExtraCropQueue` / `startFlawCropQueue` — **byte-identical** (add `:381-395`, edit `:553-567`)
- Crop-modal `onCancel` queue drain — add `:1884-1917` vs edit `:2034-2065`
- `rawAttributes` builder — **identical 4 lines**, add `:471-475` vs edit `:675-679`
- Extra/flaw upload loops — add `:560-595` vs edit `:776-812`

The edit loader's per-category `attributes` unpack (`:294-318`) is the exact hand-maintained
inverse of the add form's `rawAttributes` builder, in a different file.

**The required-field rule is written four times**: `add:412`, `add:426-440`, `add:798-808`,
`edit:627-634`.

### C.3 Divergences that are really bugs

| Concern | add-horse | edit |
|---|---|---|
| Flaw/extra file validation | `validateImageFile()` per file | only `f.type.startsWith("image/")` — **no size cap, no HEIC message** |
| `accept` on slot input | `...,image/heic,image/heif` | `image/*` |
| Reference step | conditional on `showReferenceStep` | **always shown** — tack/props get a reference search the add form deliberately hides |
| Preview | `URL.createObjectURL` | `FileReader` data URL |
| Primary-slot detection | `angle === "Primary_Thumbnail"` | `slot.primary` from config |

The quick form's `accept` omits HEIC entirely, declares its own local `FINISH_TYPES` array
(`:26`), and queries `user_collections` **directly from the browser** (`:77-82`) instead of
using `<CollectionPicker>`.

### C.4 `src/lib/config/assetFields.ts` — partly aspirational

334 lines. `FieldDef = { visible, label, required }`; `AssetConfig = { label, icon, steps,
gallerySlots, fields, showReferenceStep, showHoofprint, showShowBio }`. `CONFIGS` covers
`model | tack | prop | diorama | other_model`; `makeFields()` covers exactly 10 keys:
`custom_name, sculptor, finishing_artist, edition_info, finish_type, finish_details,
condition_grade, life_stage, show_bio, public_notes`.

What is **not** used:
- **`FieldDef.required` is never read anywhere.** There is no `getFieldRequired` export.
- **`AssetConfig.icon` is never read** — add-horse re-hardcodes the same emoji at `:753-757`.
- **`StepDef.icon` is never rendered.**
- Only 3 of 10 keys go through `isFieldVisible()`: `sculptor`, `finishing_artist`,
  `edition_info`. `getFieldLabel` is called for `sculptor` only.
- `custom_name`, `finish_details`, `public_notes` render unconditionally regardless of
  `visible`.
- `showShowBio` is read instead of `fields.show_bio.visible` — two mechanisms, one decision.

**Config-vs-form drift:** the config marks `condition_grade` visible for `tack`, `prop`,
`other_model` and `finish_type`/`life_stage` visible for `other_model`, but both forms gate
those controls on a hardcoded `isModel`. Those categories can never receive them.

**The docstring is wrong.** `validateAttributes` claims to be *"Called in createHorseRecord
and updateHorseAction before DB write."* It is not — the only two call sites are client-side
(`add:476`, `edit:680`). `attributes` is on the `HORSE_ALLOWED` whitelist
(`horse.ts:189`), so a direct action call can write arbitrary JSONB. The function also always
returns `valid: true` and both callers discard the flag.

### C.5 CSV import — a third, parallel rule set

`src/app/stable/import/page.tsx` (53) → `src/components/CsvImport.tsx` (849), a 4-step wizard
using `papaparse` + `fuzzysort` against `/api/reference-dictionary`. `.csv` only. Maps to 8
targets: `name, mold, manufacturer, condition, finish_type, purchase_price, estimated_value,
notes`.

Validation lives in `src/lib/csv-import/validation.ts` (193 lines, unit-tested) with its
**own** `FINISH_TYPES` and `CONDITION_GRADES` rather than importing
`src/lib/conditionGrades.ts`. **The import list is missing `"Play Grade"`** — 9 grades vs the
forms' 10 — so a CSV row saying "Play Grade" is rejected as invalid even though the Add/Edit
dropdown offers it. Migration 144 does no enum check on condition, so the rejection is purely
this list.

It also has synonym coercion the forms lack (`"original finish"→"OF"`, `nm→"Near Mint"`), and
it defaults empty finish to `"OF"` and empty condition to `"Not Graded"` where the forms would
block. It never touches `assetFields.ts`; category is pinned to `'model'` in SQL.

Writes: `user_horses` (10 columns) + optional `financial_vault`, via
`batch_import_horses_v2(JSONB, BOOLEAN)` (`144_batch_import_v2.sql:58`, SECURITY DEFINER,
per-row error collection), falling back to the legacy `batch_import_horses` RPC. Cap 1,000
rows.

### C.6 Write paths

Primary table is **`user_horses`** (there is no `assets`/`horses` table; "asset" exists only
as the `asset_category` column). Satellites: `horse_images`, `financial_vault`,
`condition_history`, `horse_collections`.

`src/app/actions/horse.ts` (837 lines): `createHorseRecord:310`, `updateHorseAction:138`,
`quickAddHorse:724`, `finalizeHorseImages:440`, `deleteHorseImageAction:110`,
`deleteHorse:45`, `bulkDeleteHorses:633`, `bulkUpdateHorses:582`, `reorderHorseImages:789`.

**A fourth create path exists outside the form stack:** `src/app/actions/help-id.ts:261`
inserts `user_horses` directly with hardcoded `finish_type:"OF"`,
`condition_grade:"Not Graded"`, `is_public:false`, and **no `visibility`, no
`asset_category`** — bypassing `createHorseRecord` entirely.

Other writers touch single columns: `collections.ts`, `hoofprint.ts` (`life_stage`),
`parked-export.ts` (park/unpark), `transactions.ts` (`trade_status`, `life_stage`),
`art-studio.ts` (`finishing_artist`), the Stripe webhook (`is_promoted_until`).

Triggers: `trg_sync_visibility` (`109`) derives `is_public` from `visibility` — **this is
why the edit form must not send `is_public`**; `trg_user_horses_condition` (`035`) writes
`condition_history`; `trg_user_horses_cards_follow` (`120`) on `owner_id`.

**Bug:** `updateHorseAction`'s `conditionChange: { newCondition, note }` parameter
(`horse.ts:143`) is declared and **never read**. The edit form's "What happened?" note
(`edit:1698-1705`, passed at `:707-713`) is silently discarded.

### C.7 Shared components and what's missing

Shared today: `UnifiedReferenceSearch` (468), `CollectionPicker` (237 — not used by quick),
`ImageCropModal` (455), `ChipToggle` (63 — the only true generic field renderer, used only
inside Tack/Prop form fields), the four `components/forms/*FormFields.tsx` (prop-drilled,
10 props for Tack), `src/lib/conditionGrades.ts`, `src/lib/config/genders.ts`,
`src/lib/utils/imageCompression.ts`, `src/lib/utils/uploadWithRetry.ts`.

**Not present anywhere in the repo:** `react-hook-form` (not a dependency, zero
occurrences), any generic `<FormField>` or schema-driven renderer. `ui/select.tsx` exists but
**every select in all three forms is a raw `<select>` with a hand-copied Tailwind class
string** (`h-9` in add-horse, `h-10` in edit).

Dead code: `PHOTO_STUDIO_SLOTS` (`edit:47-53`, a stale copy of `MODEL_GALLERY` with
different labels), `isModelLike` declared and unused in **both** big forms.

### C.8 Tests

- `src/app/actions/__tests__/horse.test.ts` (464 lines) is the only substantive coverage:
  `createHorseRecord` ×6, **`updateHorseAction` ×1**, `deleteHorse` ×4,
  `bulkUpdateHorses` ×6, `bulkDeleteHorses` ×6, `quickAddHorse` ×6,
  `finalizeHorseImages` tier limits ×5.
- `src/lib/csv-import/__tests__/validation.test.ts` covers the normalizers.
- **No component test exists** for `AddHorsePage`, `QuickAddPage`, `EditHorsePage`,
  `CsvImport`, or any `*FormFields`. **`assetFields.ts` has no test file at all.**
- E2E: `e2e/inventory.spec.ts` (103 lines) is the only real one — a full-wizard happy path
  driven entirely by DOM ids (`#step-1-next`, `#step-2-next`, `#custom-name`,
  `#finish-type`, `#condition-grade`, `#step-3-next`, `#submit-horse`, `.success-overlay`).
  **It clicks `#step-2-next`, so it silently assumes the model category's 4-step layout** —
  any unification that renumbers steps or renames those ids breaks it.
  Nothing touches `/add-horse/quick`, `/stable/[id]/edit`, or `/stable/import`.
