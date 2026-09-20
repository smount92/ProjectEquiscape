# Strategy Memo — 23 August 2026

**To:** Stephen
**Subject:** Three months of direction, in order. The first item is dated.

---

## The one-sentence version

You have built a very large machine that has never completed a single cycle, and the cycle is scheduled to complete in the next fourteen days — so finish Summerween first, then spend the rest of the quarter on work you already decided to do and didn't, because that thinking is paid for and new thinking is not.

---

## 0. TIME-CRITICAL — Summerween, and the two dates on it

I re-queried the live show directly rather than trusting the brief. Corrections and new facts:

| Fact | Value |
|---|---|
| Status | `entries_open` |
| **Entries close** | **2026-09-01 02:10 UTC — 9 days** |
| **Judging ends (posted)** | **2026-09-06 02:10 UTC — 14 days** |
| Classes | **22** (not 136 — that was the all-shows total) |
| Live entries | **31** (+7 scratched trolls) |
| Classes with at least one entry | **14** — largest has 5 |
| Exhibitors | **5** |
| Entries missing a photo | **0** |
| `show_staff` rows | **1 — role `host`. No judge.** |
| `show_placings` / `qualification_cards` / `horse_titles` | **0 / 0 / 0** |

**You do not need to recruit a judge.** `getShowRole` returns `host` from `shows.host_id`, and `getJudgeQueue` admits judge, host *and* co-host. Mode is `online`, judging is `judged`. Amanda can open `/shows/host/94926490.../judge` today and work the queue. The two archived test shows *do* carry judge rows; the real one doesn't, and that turns out not to matter.

**The exposure.** The show's own `about_md` promises entrants: *every placement gets permanently recorded on your horse's Hoofprint… a lifetime competitive pedigree.* Five people took that deal. One of them is MODEL HORSES INTERNATIONAL — your second most active catalog contributor — who **joined on 16 August and entered nine horses eight days later.** That is the acquisition mechanism working exactly as the plan says it should, on your most valuable outside contributor, with a stated deadline of 6 September. Nothing else in this memo carries that kind of consequence.

**The one problem, and it is fixable in five minutes.** Amanda is host *and* exhibitor: 2 entries in Arabian (against 3 other people's) and 1 in Carriage Breeds (against 3 other people's). If she judges, she judges her own horses against three strangers' in two classes, on the first result this platform has ever published. `show_staff` has a `coi_flag` column, so the shape of the problem was anticipated; nothing enforces it.

Ranked options: **(a) scratch her 3 entries** — costs 3 of 31, removes the only argument anyone can make about the first published result, cleanest; (b) recruit a guest judge for those two classes only; (c) disclose it plainly in `about_md` and judge anyway. Take (a). The first result is the one that gets read closely.

**The exact sequence, and it must run in this order:**

1. **Now** — resolve the COI. Confirm Amanda knows she personally holds the bar/scratch tools; the TartarSauce bar was applied by the platform admin account, not by her.
2. **Sept 1** — the hourly cron (`vercel.json`, `0 * * * *`) flips `entries_open → entries_closed` automatically. Verify it fired.
3. **Host flips** `entries_closed → judging`. 14 classes, 31 photos. One evening.
4. **`judging → results_review`**, spot-check, then **`results_review → completed`** — this is the flip that writes Hoofprint records, mints cards, fires the entrant/follower/feed fan-outs. Watch Sentry live; it is properly wired now, contra MARKETING_PLAN week 3.
5. **Only then** flip `NEXT_PUBLIC_SHOW_STANDINGS`.

The publish pipeline is genuinely well built — writes records before flipping status, dedupes on show+horse+class, CAS-flips, and isolates five fan-outs so a failure leaves the show recoverable in `results_review`. The risk here is not structural. It is that the step never gets taken.

---

## The order of work

| # | Weeks | Work | Why it's here |
|---|---|---|---|
| **1** | **now–Sep 6** | **Judge and publish Summerween** | Dated, unrepeatable, unblocks 6 downstream commitments |
| 2 | 1–2 | Two catalog-intake fixes | Removes the ceiling on every future correction |
| 3 | 1–2 | Four free SEO items | Already decided, days of work, 11,378 pages |
| 4 | 3–4 | Deterministic catalog repairs (migrations) | Fixes thousands of rows without asking 6 people |
| 5 | 5–6 | Recruit hosts 2 and 3; seed `/calendar` | The only growth channel the numbers support |
| 6 | 5–6 | Fix `last_seen_on`; stateful onboarding; badge email | You are currently flying blind on retention |
| 7 | 7–9 | Photo push; Studio Pro cap line; sale-report UI | Value from members you already have |
| 8 | 10–13 | Scale + year hubs; second show cycle | Proves it repeats; new query families |

---

## 1. ACCURACY — better information into the catalog

**The diagnosis is a single line of code.** `SuggestEditModal.tsx:52-62` filters the attributes JSONB with `.filter(([k, v]) => v != null …)`. **A member can only correct fields that are already filled.** Look at a row with no year, no colour and no run type and the form offers you Title, Maker, Scale — and nothing else. There is no "add a field" control anywhere.

That one filter explains everything else:

- 45 of 51 suggestions ever are **additions**; only **6** are corrections. Adding a whole entry is the harder act, and it wins 7.5:1 — because the addition form has 15 fields and the correction form has 3.
- `breed` and `gender` appear on **0 of 10,945 rows**, despite both being vocabularied, validated and shipped. They are only reachable by creating a *new* entry.
- The catalog's defect is **emptiness, not wrongness**: no colour on 4,988 rows, no year on 3,589, no run type on 5,717 of 6,964 plastic releases.

**Do these two things first, in weeks 1–2:**

1. **Retarget one href.** On all 10,942 reference pages, "Suggest a correction" points at `/catalog/suggestions/new` — the *new entry* form, headed "Suggest a New Catalog Entry". The real correction path is a smaller "✎ Suggest an edit" link two lines below. Point the first link at `/catalog/${item.id}?suggest=true`. One line. Cannot make things worse.
2. **Let the correction form add empty fields.** Offer the same field set the addition form offers, wired to the same Tier-1 vocabularies. This is the ceiling on community accuracy and everything else in this section sits under it.

**Then weeks 3–4: repair mechanically what 6 people could never repair by hand.** Your entire outside contributor base is 6 people, 2 of whom are you. Real outside contribution is 20 changes, all time. So the leverage is in migrations, not in member labour:

- **833 rows re-parented in one pass.** 916 releases hang off a parent mold whose scale contradicts them; for 833 of them a mold row with the same title *and the child's own scale already exists*. "Fighting Stallion [Stablemate]" has 100 children, 53 of them Traditional, while a "Fighting Stallion [Traditional]" row sits right there. One migration keyed on (normalized title, child scale). **Spot-check 20 by hand before applying** — this is the one repair where a bad match writes a wrong answer into a reference page.
- **Finish — glossy vs matte — has no structured home.** `attributes.finish` exists on 74 rows with 7 uncontrolled values. Meanwhile a finish word appears in free text on **1,519 rows** (1,488 inside `color_description`). Glossy/matte is a 5–10x price difference on the same release and the site cannot answer "show me the glossy one." Add `FINISH_TYPES` to `taxonomy.ts` and run a one-time extraction. **This is the highest-value field the schema cannot currently express, and the data is already on file.**
- **Colour is prose, not a facet.** 4,259 distinct strings across 5,957 filled rows; 3,752 used exactly once; 1,875 longer than 60 characters. Case-folding barely helps — the field holds sentences. Split it: controlled `base_color` alongside the existing free text. Also null the **1,033 empty strings** so fill counts stop lying to you.
- **Small tidy-ups, same pass:** 24 rows with `run_type = "Benefit Live Auction Lot #NN"` (a lot number in a type field); fold the 74-row shadow vocabulary `attributes.category` into `run_type`; retire `cast_medium` into `material`; add `MATERIALS` and `FINISH` to `taxonomy.ts` so `material`'s 5 values hold by rule rather than by luck; fix the two maker spellings ("Maggie Bennett." — 3 rows; "Dee Ann Kjelshus" — 4) before they calcify into permanent slugs.
- **Fix the auto-approve ladder or delete it.** It has never fired once. Silver needs 50 approved suggestions; your top contributor has 30, and at the observed rate reaches Silver in about 8 months. Nobody reaches Gold this decade. Worse, **two of the four `SILVER_AUTO_FIELDS` are keys that exist on zero rows** (`production_run`, `release_date` — the real key is `run_count`, on 1,320 rows, and it isn't listed). Recalibrate to your actual base and fix the field list, or stop pretending the ladder exists.

**Also worth doing and cheap:** resolve `mold_name` to `parent_id` at approval time. 40 of 51 suggestions supplied one; the code stores it as a plain attribute with the comment *"so admins can wire parent_id from it later."* Later hasn't come, 0 of 3,488 artist resins have a parent, and the backlog grows with every addition. Either resolve it or stop asking.

**Sculptor is the one gap worth doing by hand.** 24 of 7,457 non-resin rows name a sculptor, and `deriveAttribution()` is already built to surface it. The sculptor is a property of the **mold** — 465 rows, not 7,457 — and it propagates through `parent_id`. "Every mould Chris Hess sculpted" is a page that would rank. 465 rows is a job your six-person pipeline can actually finish.

---

## 2. PEOPLE — getting them here

**Read this number first: 66 of 130 real members have never written a single row anywhere.** No horse, post, message, favourite, follow, wishlist, group or suggestion. 74 never added a horse. The honest active base is **19 members in 30 days**. "133 active members" describes accounts. Every plan sized off 133 is sized off a number five to seven times too big.

And it is not improving. First-action conversion by signup month: March 70%, April 34%, May 36%, June 40%, July 41%, August 54% (recency artifact). **Five months of feature work has not beaten the founding cohort.** That points at the first session, not the feature count — and the first session is a 315-line static essay (`/getting-started`) that reads no session and knows nothing about you, plus a welcome card that names three steps, ships one button, and deletes itself the moment you add your first horse. Nothing anywhere prompts entering a show, joining a group, or following anyone.

Growth is real but not on pace: 140 users, 22 in 30 days, 13 since Aug 1. The day-90 target of 250 lands nearer 200 at the organic rate. **That is not a reason to change the target. It is the number that says host recruitment is the plan, not padding.**

**The four free SEO items — weeks 1–2, all already decided, none needing new data:**

1. **Sibling and parent links on release pages.** `getChildReleases` and `getMoldCustoms` are both gated `isMold ? … : []`, so a release page links to exactly one other reference page: its maker hub. MARKETING_PLAN calls this verbatim *"the highest-return SEO work available and none of it needs new data."* The `parent_id` is already selected on the page. It's one `.eq('parent_id', item.parent_id)`.
2. **Title template.** The root layout sets `template: "%s"`, so nothing ever gets a brand suffix. `/catalog` ships as "Reference Catalog", `/community/groups` as "Barns", `/discover` as "Members" — none containing the phrase "model horse". You already know how to write titles: `/calendar` and `/learn/glossary` are excellent. Set `"%s | Model Horse Hub"` and hand-write five. **`/community/help-id` is urgent** — it was unblocked from search today and "Help Me ID This Model" does not match what anyone types.
3. **BreadcrumbList JSON-LD.** Zero matches site-wide. It's one of the few rich-result types Google still documents as stable, the reference surface already has the exact 3-level hierarchy, and it's unclaimed on 11,378 pages. It also does real architectural work against the doorway-page risk on the hubs you'll build later.
4. **Maker A–Z / all-releases list.** 1,654 reference pages have **no inbound internal link from anywhere** — sitemap-only. The victims are almost entirely artist resins, because maker hubs link every mold plus 12 recent items, and resins have no molds: Brigitte Eberl 296 items / 12 linked; Maggie Bennett 175/12; Kitty Cantrell 147/12. These are the hobby's small creators — the people most likely to link back to you from their own sites — and their work is unfindable.

**Seed `/calendar` — one evening, week 5.** It has **zero rows**, sits in the footer, and carries `priority 0.9, changeFrequency: daily` — the highest feature-page priority in your sitemap, above `/market`, `/shows` and the homepage tier. You are telling Google daily that your most important feature page changed, and it is blank. The research found the page currently ranking for model horse photo shows is advertising a **June 2010** championship. That is a verified competitive vacuum against one evening of data entry.

**Weeks 5–6, retention plumbing:**

- **`last_seen_on` is NULL for 126 of 130 members**, because it's written only from `/api/beacon/view`, which fires on seven entity types. Browse your stable, the Paddock or the market index and you are never recorded. Touch it once per authenticated request (or in `src/proxy.ts`) — still just a date, no page. Until this is fixed, MAU reads low and every conversion rate built on it reads high. BUSINESS_MODEL's recommendation #1 was *"make the money measurable — do this first; everything else is blind without it."* Half of it shipped.
- **`activity_events` records five event types** and captures no posts, messages, listings, show entries, favourites, wishlists or logins. Broaden it.
- **Badges reach more people than any other feature and nobody sees them.** 58 members hold a badge — more than the 56 who own a horse — and 13 badge holders own zero horses. `first_follower` (51 holders) fires when someone *notices you*, which means there is already a working re-engagement trigger aimed precisely at ghosts. Its output goes to an in-app bell that is **71% unread** and there is no badge email. Wire badge and follow notifications to email. It reuses infrastructure you already have and targets 51 people with a genuine reason to come back.
- **Replace the static essay** with a checklist that persists past horse #1 and names show, group and follow.

**Weeks 7–9: the photo push.** 960 of 2,098 live horses have no photo (46%), and 994 are private against 1,058 public. A stable of photoless private records is a spreadsheet, not something to show off — which is the stated reason people come. It also starves Shows, the feed and reference pages, all of which need public. You have a list of 960 specific horses that already exist and specific owners to prompt. **Cheapest engagement win on the board.**

---

## 3. HAVE or CONNECT — what to build, what to plug into

**HAVE (build and own):**
- **The catalog.** Already yours. Section 1 is how it gets better.
- **The show system of record.** Already built, and genuinely good: per-class public rooms, per-placing share pages with OG rosettes, permanent Hoofprint writes (anon-readable via the migration-177 RPC — verified), bearer qualification cards with a public `/cards/[code]` page, a NAMHSA-format CSV export, rolling per-class reveal, Strike/Void correction tools. Results are anon-readable and indexable *today* — I fetched them logged out. **The pitch to a show holder writes itself and it is honest: your results become permanent public pages on the horses themselves. The only thing missing is one completed cycle to point at.**
- **Completed-sale price history.** See below. This is the one genuinely new thing worth building this quarter.

**CONNECT (plug into, never substitute):**
- **The marketplace.** Aggregate and link out. Do not host.
- **eBay comps.** Blocked on someone else. Apply now, plan without it.
- **External shows.** `/calendar` aggregates and links out. Same shape, same ethic.

### On MH$P — the brief you were handed was wrong, and it matters

Every plan premised on a competitor vacuum is invalid. Verified today:

- **Both sites are alive and serving HTTP 200.** Only TLS validation fails. Prior research said they "would not resolve" and are "effectively unreachable." False.
- The certificate expired **2026-07-25 03:34 GMT — 29 days ago.**
- One GoDaddy multi-domain cert covers `wheelsoff.com`, `modelhorseconnection.com` and `modelhorsesalespages.com`, which is why they broke together. It identifies the operator: **Carrie Sapp**, a working web developer, running both sites single-handed.
- **Not abandonment** — all three domains are paid through 2027/2026, registrar locks set, records touched in March.
- **MHC holds 8,519 active listings. You hold 26. That is 328:1.**
- **Sellers are clicking straight through the warning and trading anyway** — 35 ads posted on 22 Aug, 15 on 23 Aug. There is no wave of stranded sellers to catch.
- Every other hobby site verified clean TLS. Model Horse Place and Star Dapple are the natural overflow, not you.

**So the recommendation is the one you can defend publicly, and it happens to also be correct commercially:**

1. **Email Carrie Sapp this week. Tell her the certificate expired on 25 July and it's throwing a full-page warning on all three domains. Attach no pitch.** She is one person with no monitoring and 29 days of an unfixed, highly visible break. This is a courtesy from one operator to another, it costs nothing, and it is the only opening move that leaves a partnership conversation available later.
2. **Do not position MHH as an alternative venue.** At 328:1 it would invite a comparison you lose badly, and the premise — displaced sellers — is factually false.
3. **Build completed-sale price history instead.** MHC is a classifieds board: asking prices only, no completed-sale data, `robots: nofollow`, and the expired cert has stopped the Internet Archive cold (nothing captured since 10 June; MH$P has zero 2026 captures). **The hobby's price history is quietly ceasing to be recorded anywhere.** That gap is genuinely yours to fill: it competes with nobody, needs no transaction to flow through you, sits exactly inside "aggregate and link out" — and **the storage already shipped in migrations 190/191 with no UI.** It is also the most credible thing you could ever offer MH$P: a price guide their board cannot produce for itself.

Build the sale-report UI in weeks 7–9. `mv_market_prices` has one row; nothing has ever sold on the site; the Blue Book is a promise with no data behind it. Member-reported sales are the only path to filling it that doesn't depend on eBay approving you.

---

## What NOT to do, and why

1. **Do not flip `NEXT_PUBLIC_WANTED_NUDGE`.** 13 wishlist entries name a model someone else owns, reaching **10 people**. Only 6 members have ever used a wishlist. The blocker is adoption, not the flag. Put the "I want this" button somewhere with traffic first.
2. **Do not flip `NEXT_PUBLIC_SHOW_STANDINGS` before Summerween publishes.** `show_placings = 0`. You'd publish an empty leaderboard. Keeping it dark is currently the right call — and MARKETING_PLAN week 11's "standings-so-far" post cannot exist until step 1 completes.
3. **Do not build a marketplace or chase MH$P sellers.** 328:1, and they are not stranded.
4. **Do not do Wave D** (the cohesion/refactor wave). It's ~80% undone and reasonably deferred — but nothing is regressing, contrary to what you may have been told. The "3x drift in date formatters" was a measurement error (68 files at the audit, 77 now — +13%), toasts went 24→22 files with the same 2 shared systems throughout, and a shared date util and the first `EmptyState` adoptions both landed after the audit.
5. **Do not add FAQPage schema anywhere.** Deprecated May 2026, docs pulled 15 June, gov/health only. The two existing blocks are harmless — leave them, don't extend them, and don't let "add FAQ schema" onto a task list.
6. **Do not treat `DiscussionForumPosting` as an SEO task.** The marketing plan blames the login wall; that's no longer the constraint (`/community/groups` is crawlable now). The blocker is that nine groups exist and **`group_posts` has zero rows**. That's a community-seeding problem. No markup fixes it.
7. **Do not build a by-sculptor hub yet.** 24 rows of data. Fix the 465 mold rows first (section 1), then it becomes possible.
8. **Do not treat promote/boost as an open trust liability.** The checkout routes were deleted and deployed on 21 Aug. Both columns are 100% NULL — nobody was ever charged. What remains is 17 lines of unreachable webhook code. File it as low-priority dead-code cleanup, not as a live problem. *(Unverified: I cannot see your Stripe dashboard, so a manually-created Payment Link carrying that metadata can't be ruled out. Nothing in the repo can mint one.)*
9. **Do not rebuild reviews or event RSVPs.** Reviews: 4 rows, last used 17 April. RSVPs: 7 rows, last used 1 April. Reviews cannot work until something sells, and 4 reviews against 20 transactions means even the sales you had went unreviewed.
10. **Do not "promote" wishlists and favourites as underused.** 85 wishlist rows / 6 users, 159 favourites / 12 users — these are power tools used correctly by the dozen people who understand the site. They are not broken.
11. **Do not re-do MOVE 4 or Waves 0/A/B.** Verified in code: /about, real social links, export routes, Sentry client+server with `onRequestError`, GA gated behind a stored decline, `deleteShow`, `shows.about_md`, `show_fee_payments`, DESIGN-2 and SEC-7 both clean. Today's robots.txt fix is live and correct — sitemap.xml serves 12,459 URLs.

---

## What depends on someone else

| Dependency | Who | Do now |
|---|---|---|
| eBay Marketplace Insights (sold prices) | eBay — restricted, by application | Submit the application this week. Then plan as if it never arrives — member sale reports are the path that doesn't depend on them. |
| MH$P / MHC partnership | Carrie Sapp, one person | Send the certificate email. No pitch. Then wait. |
| Migrations reaching production | You, by paste | Batch section 4's repairs into as few migrations as possible so you aren't the bottleneck. |
| Hosts 2 and 3 | External show holders | Blocked until Summerween results exist — that's the pitch. |
| Judging Summerween | **Nobody. Amanda already has the role.** | — |

---

## What I could not verify

- **True MAU.** `last_seen_on` is non-null on 4–6 users and all timestamps are a day old, because migration 176 just landed. That is not "6 MAU" — it is a meter that hasn't run. The 19-active-in-30-days figure comes from an ad-hoc union across nine tables, not from a column, because no column can answer it today.
- **Whether Google treats scale/year hubs as doorway pages.** Build them as real hubs with unique framing, not as filter-result URLs. BreadcrumbList first mitigates this.
- **Whether the 833 parent re-points are all correct.** The match is mechanical on (normalized title, child scale). Spot-check before applying.
- **Whether MODEL HORSES INTERNATIONAL's nine entries mean anything durable.** One week of behaviour from one account.
- **Whether Carrie Sapp responds at all.**
- I did not re-verify the hobby-size figures, and I have not leaned on any of them. Nothing in this memo rests on a `[LOW]`-confidence number.

---

## Two ten-minute chores that protect future sessions

- **`docs/OPERATOR_PLAYBOOK.md` is stale two days after revision.** It says *"Next number: 176 (175 is the latest)"* — migrations run through **191**, so next is **192**. An agent following the playbook would overwrite an applied migration. It also claims to list "all four `NEXT_PUBLIC_*` flags"; there are at least nine. Derive the migration number, don't state it.
- **Repo root has ~15 MB of agent scratch left behind** — `_q1`–`_q6.mjs`, `_q_lib.mjs`, `_sd_probe*.mjs`, `scratch_cat_*.mjs`, `scratch_catalog_dump.json`, `verify_lens.mjs`, `catalog_snapshot.json`, `reality_mech.json`. All untracked, all created today. I left them in place in case a parallel session is still reading them; delete them once today's audits are closed. (The audit's *own* stale artifacts are one level up: `C:\Project Equispace\repomix-output.xml`, 10.9 MB from 15 March, and `Architecture&State_Report.txt` from 7 March.)

---

## The closing argument

Everything expensive is already built. The publish pipeline, the card gates, the standings page, the championship points math, the PayPal path, the prepaid terms, the sale-report storage, the eBay client, 11,378 indexable pages — all of it merged, most of it dark, none of it having ever run once end to end.

The constraint is not engineering capacity. It is that **no loop has closed.** Zero placings means zero cards means zero titles means an empty standings page means no week-11 content means no pitch to host number two. One evening of judging in the next fourteen days breaks that chain in six places at once.

Judge the show. Then spend the quarter finishing what you already decided.