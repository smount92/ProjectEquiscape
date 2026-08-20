# Summerween Dress Rehearsal

The end-to-end run for two people (Stephen + Amanda, or one of you plus a
test account) before Summerween's results publish (~Sep 6). Code audits
proved the machinery; this proves the *felt experience*. Run it top to
bottom on production with a throwaway show — the cleanup script at the
bottom removes every trace afterward.

**Cast:** HOST (account A, creates and runs the show) · ENTRANT (account B)
· ANON (a logged-out browser window / incognito — keep it open the whole
time).

**Prep:** ENTRANT needs 3+ public horses. HOST needs 1 public horse.
The test show must be **MHH-qualifying = ON** (that's the pipeline we're
rehearsing) — the cleanup script erases its cards/records/standings after.

---

## Phase 1 — Create & configure (HOST)

- [ ] Create show "REHEARSAL — DELETE ME", online, judged, MHH-qualifying ON.
- [ ] Build a classlist with at least 2 classes in one section.
- [ ] Set entries-close ~1 hour out and a judging deadline.
- [ ] Try to add ENTRANT as **judge** *after* they enter (Phase 2) — expect
      refusal: "has live entries… a judge can't compete in their own ring."
- [ ] Set capacity = 2, confirm it displays.
- [ ] ANON: the draft show is invisible everywhere (browse, direct URL).
- [ ] Publish → open entries. ANON: show now visible; classlist readable;
      no entrant data yet.

## Phase 2 — Enter (ENTRANT + HOST)

- [ ] ENTRANT enters horse #1 in class 1. Expect instant confirmation +
      entry number.
- [ ] Enter the same horse in the same class again — expect the friendly
      "already entered" message, not a database error.
- [ ] Enter horse #2 naming HOST as **handler** — HOST gets the "named you
      as handler" notification with a working link.
- [ ] ENTRANT enters horse #3 in class 1 (3 entries total in class 1 —
      that's the Season 1 card gate: 3 entries / 2 exhibitors).
- [ ] HOST enters their own horse in class 1 (2nd exhibitor ✓).
- [ ] With capacity = 2 and both of you entered: have any third account
      (or temporarily set capacity = 1) confirm "this show is full."
      Reset capacity afterward.
- [ ] A private horse can't be entered (make one private and try).
- [ ] ANON: entries visible per show settings; no owner aliases if blind
      browsing is on.

## Phase 3 — Bar & scratch (HOST)

- [ ] Scratch one of ENTRANT's entries (their own scratch). Re-enter it —
      new entry, works.
- [ ] Bar a third account (or skip if none) — confirm the bar notification
      arrives and re-entry is refused.

## Phase 4 — Judge (HOST as judge)

- [ ] Close entries (manually or wait for the cron).
- [ ] Move to judging. ENTRANT: got any judging-opened notice appropriate
      to their role? ANON: **placings must NOT be visible yet** — this is
      the migration-160 fix; check the class page shows no results.
- [ ] Record placings for class 1: 1st = ENTRANT's horse, 2nd = HOST's.
      Write a critique on at least one entry (model + photo notes).
- [ ] **Rolling reveal**: publish class 1's results only. Class room now
      shows the ribbon rail + critiques; class 2 still hidden. ANON sees
      the same.
- [ ] Pull class 1 back (unpublish) — room hides again. Re-publish.

## Phase 5 — Publish (HOST) — the big one

- [ ] Complete the show. Then check, in order:
- [ ] **Notifications**: ENTRANT gets results notice; card earners get
      card notices; links land on the right pages.
- [ ] **Cards**: ENTRANT's 1st in class 1 minted a card. Its passport
      plaque reads "1st of 3 (2 exhibitors)". Open /cards/[code] —
      shows the horse's NAME, the field line, Valid badge.
- [ ] Class 2 (if under 3 entries / 2 exhibitors): **no card** — the gate
      working is a pass, not a failure.
- [ ] **Trophy case**: show_records rows on both horses' passports.
- [ ] **Hoofprint**: show-result events on the timeline.
- [ ] **Standings** (flip NEXT_PUBLIC_SHOW_STANDINGS=1 first): both of you
      appear; 1st in the 3-entry class = 3 points; ranks and the "scored
      from" line are right.
- [ ] **Titles**: none should grant (CH needs 3 shows / 2 judges; ROM
      needs 30 career points) — absence is correct.
- [ ] Dates and qualifying flag are now FROZEN in show settings (expect
      the "results are published" refusal).

## Phase 6 — Corrections (HOST)

- [ ] **Strike** ENTRANT's 2nd-place entry (any test reason): its placing
      disappears, its card (if any) voids, ONLY that class's record is
      deleted, ENTRANT gets the strike notification.
- [ ] **Void** the 1st-place card from /cards/[code] or the console:
      verify page flips to "Void"; holder gets the void notification.
- [ ] (After migration 162) Re-publish the show → a REPLACEMENT card
      mints for the corrected result.

## Phase 7 — Anon & privacy sweep (ANON window)

- [ ] /shows/rules renders logged out; numbers match what you just lived.
- [ ] ENTRANT sets a placed horse to private → its name degrades to
      "Unnamed horse" in the class room and standings; passport 404s;
      no photo leaks anywhere.
- [ ] An unlisted horse's passport shows photos to a *signed-in*
      non-owner (the migration-160 horse_images fix).

## Phase 8 — Cleanup (Stephen, SQL editor)

Run as one block — order matters (cards RESTRICT the show delete):

```sql
-- Replace with the rehearsal show's id:
-- SELECT id FROM shows WHERE title = 'REHEARSAL — DELETE ME';
DO $$
DECLARE sid UUID := '<SHOW_ID>';
BEGIN
  DELETE FROM qualification_cards WHERE show_id = sid;
  DELETE FROM show_records WHERE show_id = sid;
  DELETE FROM horse_titles ht USING show_class_entries e
    WHERE e.show_id = sid AND ht.horse_id = e.horse_id;  -- rehearsal grants only; none expected
  DELETE FROM show_placings p USING show_classes c, show_sections s, show_divisions d
    WHERE p.class_id = c.id AND c.section_id = s.id AND s.division_id = d.id AND d.show_id = sid;
  DELETE FROM show_callbacks WHERE show_id = sid;
  DELETE FROM show_class_entries WHERE show_id = sid;
  DELETE FROM show_barred_entrants WHERE show_id = sid;
  DELETE FROM show_staff WHERE show_id = sid;
  DELETE FROM show_classes c USING show_sections s, show_divisions d
    WHERE c.section_id = s.id AND s.division_id = d.id AND d.show_id = sid;
  DELETE FROM show_sections s USING show_divisions d
    WHERE s.division_id = d.id AND d.show_id = sid;
  DELETE FROM show_divisions WHERE show_id = sid;
  DELETE FROM shows WHERE id = sid;
END $$;
```

Then confirm: /standings no longer lists the rehearsal points, and both
passports are clean of rehearsal records.

---

*Anything that surprises you mid-run — wrong copy, a dead link, a moment
of "wait, what do I do now" — write it down even if it isn't a bug.
Those notes are the real yield of a dress rehearsal.*
