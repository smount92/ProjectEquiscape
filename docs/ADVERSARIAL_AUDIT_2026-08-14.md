# Adversarial Audit — Intended vs. Manifested (2026-08-14)

Three parallel deep audits comparing what the docs/plans/copy promise against what the code actually does, run ahead of the first public show. Areas: **photo showing**, **add-your-collection**, **social**. Analysis only — nothing has been changed.

Context anchors: Summerween (Amanda's show) is an online, judged, blind-browsing, OF-only v2 show — entries close **Sep 1**, judging ends **Sep 6**. The sloptrough troll incident was Aug 10; migrations end at 147 (nothing shipped since that review).

---

## Cross-cutting themes

1. **Batch H (user safety) was specified in July and never built.** No ban/suspend, scratch not sticky, no report affordance on show surfaces, no results escape hatch, blocks unenforced on the live posts system. Every show-day risk traces back to this.
2. **Half-wired loops.** Producer without consumer or vice versa: judge critiques are write-only; favorites/horse-comments notify no one while the icons/prefs/renderers for those notifications already exist; mention notifications discard their deep link; the feed is two systems that can't see each other.
3. **Copy over-promises code.** Delete modal promises permanent deletion (it's a soft-delete that strands vault + image rows); "Unlisted" promises link-sharing (it's broken at every layer); the Wanted bar promises a nudge behind an unset flag; getting-started describes a form that doesn't exist.
4. **Silent storage leaks.** Post/media deletion queries a column that doesn't exist (cleanup never runs, error swallowed); deleted horses orphan thumbnails forever; unfinalized uploads are never swept.
5. **Trust-integrity soft spots.** Trophy-case idempotency keys on show *title* not `show_id`; show entry rules are action-layer only — RLS doesn't enforce photo ownership, deadline, caps, or OF-only, so devtools + the anon key bypasses all of them.

---

## AREA 1 — Photo showing

### Blockers for the public show

| # | Finding | Evidence | Fix |
|---|---|---|---|
| B1 | **Scratch still not sticky** — scratched troll can re-enter instantly, forever (whack-a-mole until Sep 1) | `src/lib/shows/entryRules.ts:20-25,124`; partial unique index `WHERE status <> 'scratched'` (`117_shows_domain.sql:253-256`) | `show_barred_entrants(show_id,user_id)` checked in `validateEntry` + `NOT EXISTS` in the INSERT RLS policy |
| B2 | **No ban/suspend anywhere** — sloptrough retains full rights: enter, vote, host | grep `is_banned|suspend` → only terms page; `actionReport` (`moderation.ts:120-143`) stamps the report, enforces nothing | `users.is_suspended` + `requireAuth` check + admin toggle |
| B3 | **Entry rules bypassable via direct Supabase insert** — RLS (`118:266-281`) checks only owner/show-status/horse-ownership. Not checked at DB: photo belongs to horse (anyone's photo passes), max-per-class, OF-only, halter declaration, `is_public`, `deleted_at`, `entries_close_at` (up-to-59-min gap before hourly cron closes). Also arbitrary `entry_number`/`handler_id` | `shows-v2.ts:1900-2079` vs `118_shows_domain_rls.sql:266-281`; cron `transition-shows/route.ts:94-95` | BEFORE INSERT/UPDATE trigger re-validating photo-of-horse, public+undeleted horse, deadline |
| B4 | **Published results irreversible; no moderation escape hatch** — troll placing discovered post-publish is permanent: no strike-entry, no voidCard (Batch H asked for it), records+cards minted at transition with no delete action | `stateMachine.ts:33`; `shows-v2.ts:337-363,2129-2135`; `WORK_ORDERS_2026-07-12.md:100-101` | `voidCard` (cards have a status column) + admin/host "strike entry from results" |

### Major

- **M1. Judge critiques are write-only.** Captured (`JudgeQueue.tsx:571`), stored (`show_records.judge_critique`), rendered nowhere — `ShowRecordTimeline` has no critique display, gallery/My-Entries payloads never select `note`. Amanda's Sep 1–6 critique effort would be invisible. Also: critiques can only attach to placed entries (max 6/class). Docs promised "critiques visible where expected" (`SHOWS_V2_TESTING.md` §B).
- **M2. Trophy-case idempotency keyed on show TITLE** (`shows-v2.ts:475-480` `.eq("show_name", show.title)`) not `show_id` (column exists, populated since migration 138). Any title reuse ("Summerween 2027", two "Fun Show"s) silently skips records. **One-line fix.**
- **M3. Summerween's own rules aren't code-enforced**: min-3-participants and main-photo-only are prose; a 1-entrant class can mint a card + 7 season points. Verify `max_per_entrant=3` is actually set on all 22 classes. Surface per-class entrant counts in the judge queue.
- **M4. Reporting can't target show entries; admin console blind to v2 shows.** `targetType` union has no entry/show/card; ReportButton only on passports+dashboard; admin page fetches legacy `getPhotoShows()` only; no admin override on `transitionShowStatus` — abandoned show stuck in `judging` = DB surgery.
- **M5. Blind browsing leaks**: horse names always visible (searchable → owner), and the entrant's alias watermark is applied to entry uploads when their pref is on (exactly how sloptrough self-identified — equally deanonymizes honest entrants). Skip/warn watermark for blind-show uploads.
- **M6. Photo/horse mutations after entry silently degrade judging**: deleting a photo referenced by a live entry → `photo_id SET NULL` → judge sees empty card, nobody notified; horse flipped private post-entry → "Unnamed horse" in gallery.
- **M7. The judged-online path (Summerween's exact mode) has never been human-tested end-to-end** — `SHOWS_V2_TESTING.md` §B all unchecked; e2e covers legacy entry + anon smokes. Unit coverage is excellent; the full seeded dress rehearsal through "Complete show" hasn't happened. Known quirk stands: editing a done class silently reopens it.

### Minor
`judging_ends_at` decorative (no cron — show sits in `judging` if Amanda forgets to click); no rate limiting on `enterClass`/`castVote`; "hosts can renumber" comment is false (no renumber action); `/shows/[id]/results` legacy-only (404s for v2 ids); `NEXT_PUBLIC_SHOW_STANDINGS` still unset (standings dark); handler consent absent (anyone can be named handler, gains entry-row read); `NEXT_PUBLIC_ADMIN_EMAIL` still in env (SEC-7 outstanding); two show engines still live in parallel.

### Verified solid (don't churn)
`enterClass` validation + tested entry rules; duplicate-entry DB backstop; scratch permission contract + staff-scratch notifications; blind rule at payload level (aliases genuinely never leave the server pre-reveal); vote integrity is a real RLS backstop (no-self-vote, window, frozen); cron auto-open/close + deadline nudges; idempotent publish pipeline; callback ladder server-re-derived; **a non-admin host can run the whole happy path from `/shows/host/[id]` + `/judge` without dev help**; standings computed-on-read (can't go stale); anon funnel on all show pages; 27 lib + 5 action test suites.

---

## AREA 2 — Add your collection

### Major

- **M1. "Unlisted" is broken at every layer.** The form never sends `visibility` — it maps unlisted → `is_public: true`, so choosing Unlisted makes the horse fully public in the Show Ring (`add-horse/page.tsx:482,1655-1666`; `horse.ts:349-350` has no unlisted case). A genuinely-unlisted horse (via edit) 404s for every logged-in non-owner (RLS `112:42-49`) while being visible to logged-out visitors (anon RPC allows unlisted). And migration 109's trigger flips an unlisted horse back to public on any edit-save. Three different wrong behaviors from one option.
- **M2. Delete copy promises hard delete; code soft-deletes and strands data.** `DeleteHorseModal` says photos + vault "permanently deleted"; `deleteHorse` keeps the row (provenance — correct!), never deletes `financial_vault` or `horse_images` rows (dangling 404 URLs), and orphans every `*_thumb.webp` forever (thumbs have no DB row; only `horse_images.image_url` paths are removed from storage). Owner can still open the zombie passport (`stable/[id]/page.tsx:84-98` has no `deleted_at` filter). Fix the copy to say provenance-preserving (it's a trust product) and clean up vault/image rows/thumbs.
- **M3. Wanted bar promises a nudge the flag never fires.** Reference page copy states the nudge as fact ("Owners get a private nudge…", `reference/[maker]/[slug]/page.tsx:493-495`) but `NEXT_PUBLIC_WANTED_NUDGE` is unset (plumbing — RPC 130, opt-out 131 — is done and correct). Whole `/reference` tree still dark behind `NEXT_PUBLIC_REFERENCE_PAGES`; MOVE1 doc header ("mock-first") is stale — it's a full implementation.

### Moderate

- **D1.** Every edit-save of a public horse re-fires `new_horse` feed events and re-spams wishlist matchers (no dedupe; MOVE1 specified dedupe discipline for the *new* nudge but the shipped notifier lacks it). Fire only on private→public / NFS→for-sale transitions.
- **D2.** Watermarks bypassed on thumbnails — thumbs are generated from the original un-watermarked file and thumbs are what public grids render.
- **D3.** Photo pipeline: iPhone HEIC rejected with a generic message; 48MP phone JPEGs blow the 10MB cap; flaw/extra dropzones skip `validateImageFile` entirely; sub-200KB files uploaded as original bytes under a `.webp` name + webp MIME; animated GIFs >200KB flattened. **The single most likely first-photo failure for show-driven phone signups.**
- **D4.** Duplicate-horse window: record commits first; an unguarded compression throw → "Something went wrong" → user resubmits → duplicate. Route compression errors into the existing `failedUploads` path.
- **D5.** `finalizeHorseImages` trusts client paths — no `horses/${horseId}/` prefix check; cross-linking another horse's files pollutes galleries and breaks when the other owner deletes.
- **D6.** No orphaned-storage reconciliation (unfinalized uploads, discarded free-tier extras, M2's thumbs).
- **D7.** Pro-gate race: free users see the Pro dropzone until tier resolves; two sources of tier truth in one form.
- **D8.** Boost-ISO / promote checkouts still purchasable while nothing reads `is_boosted_until`/`is_promoted_until` — **users can pay for a no-op**. Disable the entry points.
- **D9.** Unlisted + For Sale = zero market surface and no wishlist matching, with no warning.

### Minor
Getting-started guide describes a form that doesn't exist (N1); non-model submit gating uses a hardcoded step index (N2); Quick Add defaults Mint/OF at scale — unverified condition grades vs "condition is trust infrastructure" (N3); mandatory crop modal per photo = notable mobile first-run friction (N4); `validateAttributes` errors discarded (N6); junction-assigned horses show no collection label on dashboard cards (N7); `horse-images` bucket is public-read since 078 — private horses' photos fetchable by URL, storage RLS is dead letter (N8 — needs a conscious sign-off).

### Verified solid
2-step direct-upload architecture (create → client upload → finalize) with retry/Sentry/per-file failure surfacing and server-enforced tier caps; Quick Add Batch-3 fixes (public-by-default, double-tap lock, ~5-interaction path); the anon funnel incl. full-URL `redirectTo` and open-redirect guards; the reference surface itself (built to MOVE1 spec + extras, correctly flag-gated, secured RPCs); transaction locks + ownership checks on all destructive ops; CSV import; e2e on wizard + anon funnel. Full-wizard first horse ≈ 14–18 interactions; Quick Add ≈ 5 — but the dashboard empty-state CTA funnels to the *full* wizard.

---

## AREA 3 — Social

**Verdict: over-built, under-wired.** Three post systems' DNA, two feeds, three like mechanisms — and the two loops that make a 100-user site feel alive are each broken at one cheap link: (1) you did something → someone reacted → *you found out* → you came back; (2) visitor → sees life → joins.

### Major

- **A1.1 Feed is two disjoint systems.** Global tab reads `posts`, Following reads legacy `activity_events`; neither sees the other. Following the most active member shows you none of their posts/comments/entries. Passport comments appear in no feed at all.
- **A1.2 Commenting on someone's horse never notifies the owner.** `createPost` notifies event creators, studio owners, @mentions — no `horseId` branch. The most likely social act on the site is silent. (~15-line fix; prefs key + icon + bell already exist.)
- **A1.3 Mention notifications discard the deep link** — param literally named `_sourceUrl`, never inserted; "X mentioned you" lands on X's profile.
- **A1.4 Favorites are a one-way mirror** — no notification, no activity event; the ❤️ notification icon, prefs key, and feed renderer all exist for a producer that's gone.
- **A1.5 Post/media deletion cleanup queries a nonexistent column** (`image_url`; schema is `storage_path`) — select errors, catch swallows, **every deleted post/photo has leaked its storage files since migration 042**.
- **A1.6 Blocking unenforced on the posts system** — a blocked user can comment on every horse you own, reply to your posts, and still follow you (`toggleFollow` never checks blocks). Enforced only on legacy feeds/messaging/showring.
- **A1.7 All social proof invisible to logged-out visitors** — `getPosts` requires auth; AnonPassport renders no comments; `/feed`, `/community`, `/discover` redirect anon. The FB-group visitor arriving from the show link sees zero human activity even when the room isn't empty.
- **A1.8 The v2 public show page has no social surface** — legacy show page had comments; the rebuild dropped them. The backend already supports it (`posts.event_id`, eventId notify branch, `/shows/[id]` revalidation) — mounting `UniversalFeed` is nearly free.
- **A1.9 Moderation is one surface wide** (report only on passports/dashboard; resolving a report doesn't touch content; no ban) — same Batch H gap as the shows area.

### Moderate (selected)
Dead like actions calling RPCs dropped in 043; dead legacy event comments/photos subsystem (tables re-created in 097 for code nothing calls); `getActivityFeed` — a fully-built global liveness feed — is unreachable (the empty Global tab could be using it); wishlist_match bypasses the notification stack (ignores prefs, no dedupe/cap); reply notifications link to `/feed` not the post, and the post permalink page renders no replies and no composer; **cards have no OG metadata at all** (the MOVE-3 trust artifact shares as a bare link) and passport OG images use raw storage paths (likely dead in FB/Discord scrapers — PROD-7, still unfixed); Discover is a signup-date directory labeled "Active Collectors"; mention matching pings every "John" for "@John Smith"; **zero tests on every social action file** (the A1.5 column bug is exactly what one test catches).

### Verified solid
Universal posts engine core + reuse across passports/groups/events; notification plumbing (prefs gate, self-guard, bulk cap, realtime bell); DMs (block-guarded, race-safe, realtime); Groups Notice Board (flagged, tested); shows-v2 social periphery (voting, blind galleries, per-show OG, ShareButton); anon read surfaces built the right pattern; achievements loop.

### "Make it actually good" — strategy
For ~100 users a follow-graph feed is structurally a ghost town; **activity-around-objects (horses, shows) is where this community actually is, and that's the 80%-built part.** Minimum coherent loop: comment/heart on a horse → owner notified with a working link → replies notified with working links → all readable by the logged-out show visitor → one aggregated "what's happening" surface so the site never looks asleep.

- **P1 (S, ~1 day): wire the reciprocity loop** — horse-comment notify, mention `link_url`, favorite notify, reply deep-link + render replies on `/feed/[id]`. Highest engagement-per-line change available.
- **P2 (M, post-show): one feed, aggregation-first** — kill Global/Following split; single "Around the Barn" digest interleaving posts with the already-built `getActivityFeed` system events. Keep `user_follows` as notification substrate, drop it as a feed until there's density. Weekly-show cron (PROD-6) later as the metronome.
- **P3 (S/M, pre-show): make the show page the social room** — mount `UniversalFeed` on `PublicShowV2Page` + read-only anon rendering of show thread and passport comments (reuse the AnonPassport scoped-read pattern), composers = login CTAs with `redirectTo`. This is the conversion surface for Summerween.
- **P4 (M, gates the show): safety floor** — block enforcement in `getPosts`/`createPost`/`toggleFollow`; ReportButton on posts/replies/entries; `is_banned` in `requireAuth`; sticky scratch. (= front half of Batch H.)
- **P5 (S): outbound sharing** — `generateMetadata` for `/cards/[code]`; signed-URL OG image on passports; verify in FB sharing debugger.
- **Cut list:** dead like RPC callers, legacy event comments/photos (+ 097 tables), `createTextPost`/`deleteTextPost` after feed unification, dead `proxy.ts` publicPaths (`/leaderboard`, `/search`, `/show-ring`). Don't build: followers-list pages, comment-likes, generic-social anything. Add a first `posts.test.ts` covering exactly the paths found broken.

---

## THE PLAN

### Wave A — before Sep 1 (show safety; blockers)
1. **Sticky scratch / per-show bar** (shows B1) — `show_barred_entrants` + `validateEntry` + RLS clause.
2. **Minimal suspend** (shows B2, social A1.9) — `is_suspended` + `requireAuth` gate + admin toggle.
3. **DB trigger on `show_class_entries`** (B3) — photo-belongs-to-horse, public+undeleted, deadline.
4. **Strike-entry-from-results + voidCard** (B4) — the safety net everything else falls back on.
5. **`show_id` dedupe fix** (M2) — one line.
6. **Render judge critiques post-publish** (M1) — gallery/My-Entries payload + `ShowRecordTimeline`.
7. **Report on show entries + admin v2-show visibility/override** (M4).
8. **Dress rehearsal:** seeded judged show through "Complete show" per `SHOWS_V2_TESTING.md` §B, on a phone.
   - Also: verify `max_per_entrant=3` on all 22 Summerween classes; decide the watermark-during-blind question (M5).

### Wave B — before/with the show (conversion + first-run)
9. **Social P1 reciprocity wiring** (~1 day of one-liners).
10. **Show page as social room + anon read-only comments** (P3).
11. **HEIC/large-photo fix** (collection D3) — the top first-photo failure for phone signups.
12. **Unlisted fix** (collection M1) — pass `visibility` through create; fix edit/trigger flip; or hide the option until fixed.
13. **Wanted-bar copy conditional on flag** (M3) + decide reference-pages flag timing.
14. **OG: cards + passport image** (P5).
15. **Disable boost/promote checkouts** (D8) — users can currently pay for a no-op.

### Wave C — after the show (integrity + cleanup)
16. Unified aggregation-first feed (P2); weekly-show cron.
17. Storage-leak fixes: `storage_path` cleanup bug, thumb orphans, unfinalized-upload sweep, vault/image rows on delete + honest delete copy.
18. Notify-on-edit dedupe (D1), watermarked thumbs (D2), duplicate window (D4), finalize path prefix check (D5), pro-gate race (D7).
19. Cut list + dead code deletion; first social action tests; `judging_ends_at` cron or copy fix; rate-limit `enterClass`; legacy show engine retirement (roadmap #6).
20. Minor copy/UX sweep: getting-started rewrite, crop-modal fast path, Quick Add condition default, Discover ordering.
