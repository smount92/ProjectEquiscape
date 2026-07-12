# Shows v2 — Manual Testing Checklist

> **Update (2026-07-11):** `NEXT_PUBLIC_SHOWS_V2` is now LIVE in production — the flag has
> flipped in Vercel. This checklist's items should now be verified against **production**, not
> just a local dev build; a dev-only pass is no longer sufficient sign-off for anything still
> unchecked below.

Everything built through Phase E2 that still needs a **human** pass (all
automated tests green — see `README.md` for the current count; these are the flows only real
clicking can validate). Requires two accounts (host + entrant) and
`NEXT_PUBLIC_SHOWS_V2=1` in `.env.local` (already set on the dev machine) for local checks, or
a production account for the production pass.

## A. Live show — end to end (NEVER tested against real data)

- [ ] Create a **live** show (venue, date, capacity) → publish → open entries
- [ ] Enter 3+ horses from both accounts across 2+ classes (check leg-tag
      numbers: same horse keeps its number across classes)
- [ ] Close entries → transition to **running**
- [ ] **Ring console** (`/shows/host/[id]/ring`) — ideally on a phone:
  - [ ] Call a class (ON DECK → NOW JUDGING)
  - [ ] Tap placings by leg tag, re-tap to remove, save
  - [ ] Split a class / combine two classes from the console
  - [ ] Airplane-mode a save → "pending" banner appears → reconnect → flushes
- [ ] **Announcer board** (`/ring/board`) on a second screen — updates within ~10s
- [ ] Place ALL classes in a section → callback round appears → pick
      champion + reserve → repeat up the ladder to Grand Champion
- [ ] Transition results_review → completed → check:
  - [ ] Public page shows results + champion rosettes
  - [ ] Placed horses got trophy-case records (incl. championship rows)

## B. Online judged show (queue tested only via RTL)

- [ ] Online show with `judging = judged`, enter horses with photos
- [ ] `/shows/host/[id]/judge` on a tablet/phone: tap-to-place with photos,
      critique note, mark class done, progress header
- [ ] Championship round appears after last class → ladder works with photos
- [ ] Results publish → critiques visible where expected, trophy case written

## C. Online community-vote show (partially tested 7/10)

- [x] Create/publish/enter/gallery — tested
- [ ] Voting from BOTH accounts (own-entry vote must be refused)
- [ ] Blind check: no owner names anywhere during judging (view source too —
      blindness is server-side, the name should not exist in the payload)
- [ ] Blind toggle OFF (console Overview) → names appear immediately
- [ ] Finalize votes → provisional placings match vote counts (ties → earlier entry)
- [ ] Complete → results public, owners revealed, trophy cases written

## D. Cross-cutting

- [ ] `/shows/[id]` renders v2 shows AND legacy photo shows correctly;
      old `/shows/v2/[id]` links redirect
- [ ] Proxy entry: enter a horse with a handler → handler shows on entry +
      host console
- [ ] Scratch → re-enter same class (should create a fresh entry, old
      number restored)
- [ ] Staff roles: steward account can record placings but NOT edit the
      classlist; judge account can judge but not manage staff
- [ ] Night mode + Simple Mode on: ring console, judge queue, gallery,
      results (the day-mode-dark-on-leather bug pattern — check DAY mode
      especially on leather surfaces)
- [ ] Everything above on a phone viewport

## E. Known issues (already logged, don't re-report)

- Logged-out visitors see host alias as "unknown" on public show pages
  (pre-existing RLS quirk on `users` reads — fix queued)
- Reserve champion draws from the same pool as champion (NAN's
  "2nd moves up" convention is a future rule tweak)
- Entry-number assignment can race under simultaneous submits (labels
  only, hosts can renumber — accepted at beta scale)

## F. Non-show leftovers worth a spot-check sometime

- [ ] Lamplight sweep: any remaining invisible-text spots while browsing
      at night (report page + element)
- [ ] Leather edition on production: passport page + show picker in DAY
      mode after the fixes (was re-verified on dev only)
- [ ] Want List page buttons (corrupt-class fix from the task chip — confirm
      it merged and renders)
