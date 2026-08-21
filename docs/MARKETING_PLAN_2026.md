# Marketing Plan 2026 — Model Horse Hub

**Written August 2026 · for Stephen and Amanda · research and planning only, no code changed**

The brief was: *"I think we have the platform — now we need the users."* That is the right
diagnosis. This plan is written to the constraint that actually binds — **two people with
day jobs, no cash, and about five hours a week between them** — so it is ruthless about what
gets dropped. Sources with confidence labels are in [`marketing-research/`](marketing-research/).

---

# The one page

**The wedge.** Model Horse Hub is **the hobby's record — the only place a claim can be
checked by a stranger.** Anyone can type "NAN qualified" into a sale post. Nobody has ever
been able to look it up. On MHH a placing exists because a show was run here, and every
qualification card has a public verification page that a buyer opens without a login and
without asking the seller for anything. That is a sentence no incumbent can say, and the
audit that went looking for weak claims found card issuance and card verification to be the
one part of the trust story that survives scrutiny. **Lead with the cards.**

**The spine of the next 90 days is one sequence, not a list of channels:**

> **Run the show → mint the artifacts → use the artifacts to recruit the next hosts → each host
> brings their own entrants.**

Summerween closes Aug 31 and publishes around Sep 6. Its results page, its winner rosette
pages and its verifiable cards are the first real proof this platform works. They are also
the entire pitch deck for showholder recruitment, which is the highest-leverage growth move
available to a two-person team, because **one showholder delivers 20–50 exhibitors and no
other software in this hobby exists to serve them.**

**Top three channels, in order:**

1. **Showholder / club partnership (direct outreach).** Uncontested. Each host is a
   multiplier, not an impression. ~15 hrs of the 65-hour budget.
2. **Facebook, as participants — not advertisers.** The hobby lives there. Amanda is already
   a member of these rooms; the plan is value-first participation plus *shareable objects*
   (results pages, rosette pages, card verify links) that other people drop into threads.
   ~7 hrs.
3. **The Registry as an SEO engine.** 10,900+ reference pages are already live, indexed-ready,
   with `Product` JSON-LD and canonical tags. This is the only channel that compounds while
   you sleep. What's left is mostly measurement and interlinking. ~8 hrs.

**Instagram is fourth** (the show-off surface, cheap because the content is a by-product of
running shows). **TikTok and YouTube are partnerships, not a posting job.** **Paid ads are
off the table** — not on principle, on arithmetic.

**The single highest-leverage action in week one:** Amanda personally fills Summerween's thin
classes before Aug 31, using the product's own recruiting line — *"this class needs one more
exhibitor before it mints cards."* Two hours. It decides whether the next six weeks of
content exist at all. (Detail: [§6, Week 1](#6-the-90-day-calendar).)

**Day-90 targets:** 3 shows run by non-owner hosts · 250 members · 1,500 Registry pages
indexed · 30 verifiable cards minted · 1 partner club. (Detail: [§7](#7-measurement).)

**The thing that would cost the most:** spending trust to buy attention. This community has
been burned twice by infrastructure collapse and reads self-promotion as a smell. Every play
below is designed to be *welcome in the room*. [§8](#8-what-not-to-do) is not boilerplate —
read it.

---

# 1. Baseline — what we're actually working with

## 1.1 The assets, verified in the repo

Not marketing copy. These were read out of the code and the docs.

| Asset | Where | Marketing significance |
|---|---|---|
| **Qualification cards + public verify** | `qualification_cards`, `/cards/[code]`, `opengraph-image.tsx` | **The crown jewel.** RLS requires a real 1st/2nd placing by a real host — hosts *cannot* fabricate them. Anon-readable. Has its own link-preview image. Cards travel with the horse on sale (migration 120 trigger). |
| **The field stamp** | `cardIssuance.ts` | A card carries the class size and exhibitor count: *"1st of 12, 8 exhibitors."* This is the anti-inflation feature the hobby's open secret needs. |
| **Permanent titles** | `titles.ts`, migration 159 | CH / ROM / SUP live on the horse forever and transfer on sale. Nobody else mints portable achievements. |
| **The recruit mechanic** | `ShowEntrySectionParts.tsx:202` | A qualifying class *says* whether it's minting: *"1 more exhibitor mints cards."* The product turns entrants into recruiters. This is a growth loop, in code, today. |
| **Share-your-placing page** | `/shows/[id]/placing/[entryId]` + its OG image | A rosette celebration page built for the person who just clicked a Facebook link — with a what-is-MHH pitch and a free-account CTA for logged-out visitors. Purpose-built acquisition surface. |
| **Public show results** | `/shows/[id]/results` | No auth. The link a host drops back into their group. |
| **The Registry** | `/reference/[maker]/[slug]` × ~10,900 | Live. `Product` JSON-LD, canonical tags, OG images, per-page collector counts, Blue Book teaser, active listings, glossary links, mold→release→custom interlinking. Listed in `sitemap.ts`. |
| **The calendar of record** | `/calendar` | Lists **everyone else's shows too** — OMHPS, MEPSA, Facebook group shows, live halls. Tools-as-marketing in its purest form, already shipped. |
| **The Blue Book** | `/market/guide` | Free real-sale price data. "What's my Breyer worth" has no good answer on the open web. |
| **Provenance marketplace** | `/market` | The listing *is* the passport: record, condition, ownership history. No fees, no money held. |
| **The Deal Room** | `/inbox/[id]`, `payment_installments`, `/inbox/[id]/record` | Time payments — hobby-routine, tracked nowhere else — plus signed terms and a PDF evidence pack designed to be handed to a third party. |
| **Art Studios** | `/studio/[slug]` (anon-readable since migration 170) | Portfolios that prove work with the horses' actual ribbons. Free for 3 active commissions. |
| **The trust iron law** | `PlainTerms.tsx`, playbook | Records, provenance, condition, card verification are free permanently. *"A proof behind a paywall is not a proof."* |
| **The founders are named** | `/about` | Amanda and Stephen Mount, husband and wife, no investors — plus a plain-English continuity statement that names Blab and MH$P by name. The Ravelry precedent: communities trust people, not brands. |

## 1.2 The numbers, honestly

- **Members:** roughly 75–100. (The blueprint says "75+ registered users, 900+ horses";
  the playbook says "~100 users, ~1,800 cataloged horses." They disagree — read the real
  figure off the admin pulse strip before quoting it anywhere.)
- **Registry:** ~10,900 releases.
- **Shows run:** Summerween is effectively the first at any scale, and it is **small** — the
  championship doc records its largest class as **4 entries**, which is why the Season 1 card
  gate was set at 3 entries / 2 exhibitors instead of the permanent 5-and-3.
- **Search presence:** the reference pages are live and in the sitemap, but the strategy doc's
  July finding was **~1 indexed page**. Indexing status is unmeasured. That is a five-minute
  fix (Search Console) and it is in Week 1.
- **Social presence:** none. No Facebook page, no Instagram, no links in the footer. In a
  Facebook-native hobby this reads as "not real."

## 1.3 Claims you may make, and claims you may not — yet

This matters more than any channel choice. The August adversarial audit called trust and
provenance **"the product's stated moat, and the weakest area audited."** Marketing a claim
the product cannot currently honour is the single most expensive mistake available here.

**Safe to market now** (audit-verified solid):

- Qualification cards and `/cards/[code]` verification — issuance integrity holds, hosts
  cannot forge, the anon verify RPC carries an honest NAMHSA disclaimer.
- Cards follow the horse on sale (trigger-enforced).
- The private vault genuinely stays private (owner-only RLS, wiped on claim).
- Free show hosting, the ring console, results pages, NAMHSA-format export.
- The Registry, the Blue Book, the calendar.
- Two-sided transfer consent.
- "We never hold your money and we don't charge you to sell" — true, and structurally true.

**Do not market until fixed** (each is a live audit finding — see
[`ADVERSARIAL_AUDIT_2026-08-14_PART2.md`](ADVERSARIAL_AUDIT_2026-08-14_PART2.md) Area 6):

| Claim | Why it's blocked |
|---|---|
| **"A stranger can check the Hoofprint"** | `/community/[id]/hoofprint` reads `user_horses` through the RLS-honouring client, and that table is `SELECT TO authenticated` since migration 109. **A logged-out buyer gets a 404 or a blank report** — the exact skeptical-Facebook-buyer the feature exists for. The *passport* (`/community/[id]`, via `get_public_passport`) and the *card verify* page are fine. Say "the card is checkable," not "the Hoofprint is checkable," until this is fixed. |
| **Full ownership chains / "CarFax for model horses"** | F3: `horse_ownership_history` has no INSERT policy, so genesis rows were silently never written. Every never-transferred horse has an empty chain; transferred horses start at the *second* owner. |
| **Seller reputation / reviews** | F2: reviews are forgeable and review-bombable — a caller can mint a fake completed transaction per review. |
| **"Verified Artist" badges** | F1: `finishing_artist_verified` is in the owner-editable whitelist. Any owner can self-set it. |
| **Anything about the season standings or the new add-horse forms** | Both are **built but dark** (`NEXT_PUBLIC_SHOW_STANDINGS`, `NEXT_PUBLIC_FORM_ENGINE`). Members cannot see them. Never describe a dark feature as live. |
| **Offline show mode / "works in airplane mode"** | MAJ-4: the PWA page matcher can never match; the offline promise doesn't work today. |

**Two operational risks that will bite during the Summerween campaign specifically:**

- **The results CSV has an unguarded formula-injection hole** (`escapeCSV` doesn't escape a
  leading `=+-@`). Amanda is going to export results and share them. A troll alias like
  `=HYPERLINK(...)` executes in Excel on whoever opens it. **Do not distribute the CSV until
  that guard lands** — share the results *page* link instead, which is better marketing anyway.
- **Sentry is mostly dead in production** (MAJ-2). If the site breaks on results day, nobody
  finds out from an alert. Have one of you actually watching on Sep 6.

> **Rule for this plan:** the fastest way to lose this community is to promise a proof that
> isn't there. When in doubt, market the card.

---

# 2. Positioning

## 2.1 The wedge

> **Anyone can type "NAN qualified." We're the only place a buyer can look it up.**

That is the whole pitch, and the landing page already carries it (`TheRecord.tsx`). Everything
else the site does — the Stable, the Market, the Registry, the Paddock, the Studios — is the
reason people *stay*. The record is the reason they *arrive*.

**Why this wedge and not another.** Three tests:

1. **Can an incumbent copy it?** No. A Facebook group cannot mint a verifiable placing because
   it has no idea what a class is. MH$P / Model Horse Connection is classifieds — no records,
   by design. A spreadsheet can't be checked by a stranger. The record requires the show and
   the sale to happen *in the same system*, which is precisely what nobody else has built.
2. **Does it survive a skeptic?** Yes — and only just. Audit-verified: card issuance requires a
   real placing by a real host; hosts cannot fabricate. Most of the *rest* of the trust story
   is currently forgeable (§1.3). So the wedge must be stated narrowly and truthfully, at card
   granularity. Narrow and true beats broad and checkable-to-be-false.
3. **Does the hobby actually care?** The evidence says yes: scam anxiety is literally encoded
   in group names and rules, and NAMHSA's own documentation reports roughly a third of
   submitted NAN cards arrive invalid, expired or misfilled. The hobby has a verification
   problem it already knows about.

**Positioning statement, long form** (for the About page, the FB page bio, a host pitch):

> Model Horse Hub is where the hobby's record lives. A placing exists here because a show was
> run here — so every card on a horse links back to the class it came out of, with the judge,
> the date, and the size of the field it beat. Anyone can check it, without an account. And it
> belongs to the horse: when the horse changes hands, the record goes with it.

**Elevator version** (for a comment, a bio line, a DM):

> One place to keep the herd, campaign it, and sell out of it — where a placing can actually
> be checked by the person buying.

## 2.2 The five hooks

House voice rules for every line below: plain and concrete; hobby vocabulary, not startup
vocabulary; specific numbers as proof; understate rather than oversell; never an exclamation
point; never "revolutionary," "seamless," "game-changing," "empowering," or "community-driven."

### The showholder — *"Your results file themselves."*

The most valuable person on this list. Nobody serves them at all.

> You already do the hard part. You build the classlist, you find the judges, you keep the
> ring moving. Then you spend the evening typing results into a spreadsheet, and a year later
> the spreadsheet is on a laptop that died.
>
> Host on Model Horse Hub and the results file themselves. Build a classlist from the NAMHSA
> structure in one click, take entries, judge from your phone at the table, hit complete — and
> everyone's placings land on their horses permanently, with a public results page you can drop
> straight back into your group. Hosting is free. It always will be. We don't take entry fees
> and we don't want a cut of anything.

### The shower / exhibitor — *"A win that stays won."*

> A ribbon photo is a ribbon photo. A card is different: it says *1st of 12, 8 exhibitors*, it
> has a page anyone can open, and it stays on the horse for the rest of the horse's life — even
> after you sell her.
>
> Three cards at three shows under two judges makes her an MHH Champion. That title is hers
> permanently. It goes with her.

### The collector — *"Stop looking it up twice."*

> Was that palomino a '94 or a '95? The Registry has 10,900 releases with maker, sculptor,
> scale, finish and year, and collectors correct it as they go, so a fix lands for everybody at
> once. Look it up, add it to your stable in one tap, and never chase that answer again.
>
> Free. No account needed to look.

### The artist — *"Your portfolio, with the ribbons attached."*

> Anyone can post a finished horse. A Studio page shows the horse *and* what it went on to
> win — the actual placings, on the actual record. That is a portfolio a commission client
> can't argue with.
>
> Free while you're carrying three active commissions or fewer, and the whole quote → work →
> approval → delivery pipeline comes with it, so you stop running your books out of a DM thread.

### The seller — *"The listing is the passport."*

> Your listing here isn't a photo and a paragraph. It's the horse's passport: what she's won
> with links to the classes she won it in, her condition grade, who's owned her. The buyer
> checks it themselves before they ask you a single question.
>
> We take no cut, we hold no money, and we don't charge you to list. That part isn't a
> promotion — it's the whole design.

### The buyer — *"Look it up before the money moves."*

> If a listing says the horse is NAN qualified, ask for the card link. It opens without a
> login and it tells you the class, the judge, the date, and how many exhibitors were in the
> ring. If there's no link, you've learned something too.

### The one for time payments — *"Every deal leaves a record."*

Aimed at resin sellers and buyers, the highest-anxiety end of the hobby.

> Six monthly payments on a $400 resin, arranged in a DM, tracked in nobody's spreadsheet.
> That's how expensive horses actually change hands, and it's the part of this hobby with the
> least paper behind it.
>
> The Deal Room gives both of you the same ledger: the terms you agreed, signed by both sides,
> and every installment marked sent and confirmed. If it ever goes wrong, either of you can
> print the whole record as a PDF and hand it to PayPal. We never touch the money — we just
> write down what happened.

---

# 3. The growth loops already built

These are not proposals. Each one is shipped code. The job is to *activate* them — and the
product nudges listed are small, cheap, and recommendations only.

## Loop 1 — Hosts recruit exhibitors (the strongest loop, and it's automatic)

**The mechanic:** a qualifying class only mints cards at 3 entries from 2 exhibitors (Season 1).
The public class row *says so*: **"1 more exhibitor mints cards."** So an entrant who wants
their card has a direct, honest, non-spammy reason to go get a friend — and the host has a
reason to promote their own show, because a show with thin classes mints nothing.

**How to activate:** teach hosts the line. When you onboard a showholder, show them the badge
and say: *"When a class is one short, post that. People turn up for it."*

**Nudges worth building** (recommendations, not builds):
- A one-tap **"share this class"** on the class row that copies a pre-written line with the
  gate state in it — *"Class 14, Arabian Halter, needs one more exhibitor before it mints
  cards. Entries close Friday."*
- An **entries-closing digest to the host** listing exactly which qualifying classes are short
  and by how much. The data is already computed for the badge.
- A per-class OG image so a class link previews with the class name, the count, and the gate.

## Loop 2 — Winners share rosettes; strangers land on a pitch

**The mechanic:** `/shows/[id]/placing/[entryId]` is a purpose-built celebration page — a CSS
rosette in the correct ribbon colour, the entry photo, the permanent-record line, its own OG
image, and — for logged-out visitors — a what-is-MHH block with a free-account CTA. It exists
precisely to be pasted into Facebook.

**How to activate:** most exhibitors don't know it exists. The results notification should push
them at it, and the copy should tell them what it's for.

**Nudges worth building:**
- The results notification links to *your placing page*, not the results index.
- The share sheet should pre-fill a caption in the exhibitor's own register, not the site's:
  *"Toffee took 1st of 9 at Summerween 🎃"*.
- Confetti is fine. A "download the rosette as an image" button would be better — an image
  posts natively on Facebook and Instagram; a link does not.

## Loop 3 — The card as a brag object *and* a due-diligence tool

**The mechanic:** `/cards/[code]` is anon-readable and has a link-preview image that
deliberately shows the card's claims but never its verdict (previews get cached; verdicts
change). Two completely different people share this URL: the winner showing off, and the buyer
checking.

**How to activate:** the second use is the one that converts strangers. Put the sentence in
sellers' mouths — a copy-ready line on the horse's page that a seller can paste into a
Facebook sales post: *"Show record verifiable here: modelhorsehub.com/cards/XXXXX."*

**Nudges worth building:**
- A **"copy the verification line"** button on the passport for sellers listing off-platform.
  This is Trojan-horse marketing at its most legitimate: the seller wants it, the buyer wants
  it, and it puts an MHH link in a group where you're not allowed to advertise.
- Fix card discovery (audit D3: cards only render on for-sale or v2 passports today, so a
  non-selling owner's cards are invisible to outsiders — which kills exactly this loop).

## Loop 4 — The Matchmaker pulls lurkers back

**The mechanic:** the wishlist / "I want this" + `notify_catalog_owners_of_demand` machinery
means an owner who never listed anything gets an anonymous, aggregate nudge when someone wants
their model. That is latent supply Facebook structurally cannot surface, because Facebook
doesn't know who owns what.

**Status check:** `NEXT_PUBLIC_WANTED_NUDGE` is **off**. The passive half ("N want this") works;
the nudge doesn't fire. This is the cheapest re-engagement lever on the site and it's switched
off. Turning it on is a product decision — throttling and copy need a look first — but it
belongs on the near list.

## Loop 5 — Artist portfolios are shareable proof-of-work

**The mechanic:** since migration 170, `/studio/[slug]` is anon-readable, and the receipts wall
shows finished horses *with the ribbons they won*. Artists have audiences. Artists post their
own work constantly. A portfolio URL that proves the work is a link an artist wants to share.

**How to activate:** [§4.6 — founding artists](#46-artist-seeding--founding-studios).

## Loop 6 — The evidence pack gets shown to third parties by design

**The mechanic:** `/inbox/[id]/record` produces a PDF and a plain-text record of a deal,
intended to be handed to PayPal or to a group admin. Every time someone does that, a
non-member reads a document with your name on it in the moment they most want what you offer.

**How to activate:** nothing to build. Just make sure the PDF header says what the site is and
where to find it, and lead the time-payments message at resin sellers (§2.2).

## Loop 7 — The Registry is a permanent, compounding front door

Covered as a channel in §4.3 — but note it *is* a loop: members correct entries → the pages get
better → they rank better → strangers arrive → some join and correct entries.

---

# 4. The channel plan

Effort-ranked. The budget is **65 hours across 90 days.** Anything not on this list is a no.

## 4.1 Showholder and club partnership — ~15 hrs · **the highest-leverage channel**

**The play.** Every other channel buys you *individuals*. This one buys you *groups*. A
showholder who runs their show on MHH delivers their whole entrant list, and the public results
page they post afterwards is an acquisition surface aimed at exactly the right people. No
live-show or photo-show hosting software exists anywhere in this hobby, so there is nothing to
displace — only a vacuum to fill.

**Cadence.** One named target per week, worked properly. Not a blast.

**First three actions:**
1. **Make the list.** Amanda names 8–10 showholders she genuinely respects — photo-show hosts
   and small live-show hosts, people whose shows she'd enter herself. Rank by *how likely they
   are to say yes*, not by size. The first host has to succeed.
2. **Wait for Sep 6.** Do not pitch before Summerween results publish. The pitch is
   ten times stronger with a link in it.
3. **Send one personal message per week** (not a template blast — a real message from Amanda,
   referencing their actual show), offering to do the whole setup yourself:

> Hi — this is Amanda (Black Fox Farm). I've entered your shows for years.
>
> My husband and I built show-hosting software for the hobby, and I ran my own show on it this
> month — [Summerween results](https://modelhorsehub.com/shows/…), if you want to see what it
> looks like from the outside.
>
> The offer is this: let me set your next show up for you. I'll build your whole classlist,
> load your entry rules, add your judges as staff, and be on call the day you judge. You judge
> from your phone at the table, hit complete, and the results page publishes itself — you drop
> the link in your group instead of typing placings into a spreadsheet at midnight.
>
> It's free, and it stays free. We don't take entry fees and we don't take a cut of anything.
> If you hate it you've lost an evening and I've done your paperwork.

**What success looks like:** 3 shows run end-to-end by non-owner hosts by day 90. One of them
recruiting the next one for you is the real win condition.

**DON'Ts.** Don't pitch a group of hosts at once — this is a small world and a blast reads as
a blast. Don't ask them to switch platforms; ask for *one show*. Don't oversell offline mode
(§1.3). Don't disappear after setup — being on-call during their show is the entire product.

## 4.2 Facebook — ~7 hrs · **where the hobby actually is**

**The play.** You do not advertise into Facebook groups. You *participate*, and you make
objects other people want to post. Everything above in §3 exists so that the link in a thread
is dropped by a member answering a question, not by you.

Amanda is the front. She is a real, long-standing member of these rooms; Stephen is not. This
matters more than any tactic on this page.

**Cadence.** 20–30 minutes, twice a week. That's it.

**First three actions:**
1. **Create the official Facebook page** (~30 min) — named founders, the About-page continuity
   language, the wordmark. Then link it in the site footer. Zero presence is disqualifying in a
   Facebook-native hobby; you don't need it to be *active*, you need it to *exist*.
2. **Read the rules of every group you're in, and write them down.** One row per group: name,
   rough size, whether links are allowed, whether self-promo is allowed, admin names, and the
   specific rule text. Keep it in [`marketing-research/`](marketing-research/). This is the
   single most important compliance artifact in the plan.
3. **Answer identification and value questions with a Registry link.** These questions are
   posted daily. A reply that says *"That's the 1995 run — here's the page with the specs and
   what they've been selling for"* is a helpful answer that happens to contain your URL. Where
   a group forbids links, answer the question anyway with no link. The reputation is the point.

**What success looks like:** members other than you posting MHH links. Watch for it in the
Vercel referrer data.

**The DON'Ts — read these twice.**

- **Never drop a bare promo link.** In most model-horse sales and discussion groups this is a
  removal-or-ban offence, and admins talk to each other. One incident can close the whole
  channel permanently.
- **Ask admins before posting anything promotional**, every single time, in every group. A
  short private message to an admin — *"I built a show-hosting tool, is a post about it
  allowed, and would you rather I didn't?"* — costs nothing and converts a rule violation into
  a relationship. Some admins will say yes and pin it.
- **Never post the same thing in ten groups.** Cross-posting is the most reliable way to be
  read as a marketer.
- **Never argue with a skeptic in public.** "Will this die like Blab?" is a fair question and
  the honest answer — nightly backups, full export whenever you want, advance notice if we ever
  wind down — is on the About page already. Answer once, link, and stop.
- **Never use a second account.** Astroturfing in a community this small is not just wrong,
  it's detectable.
- **Don't touch the megagroups yet.** Earn the small rooms first.

## 4.3 The Registry as an SEO engine — ~8 hrs · **the only channel that compounds**

**The play.** This is the Discogs move, and the hard part is already shipped: ~10,900 anon-safe
reference pages with `Product` JSON-LD, canonical tags, per-page collector counts, a Blue Book
teaser, live listings, glossary interlinking, and mold → release → custom links. The remaining
work is *measurement*, *interlinking*, and *query targeting* — not building.

**Cadence.** One hour a week, mostly checking.

**First three actions:**
1. **Google Search Console. This week.** Verify the property, submit `/sitemap.xml`, and read
   the Coverage report. The strategy doc's last count was ~1 indexed page; you currently have
   no idea whether 10,900 pages are indexed, blocked, or classified as thin. **You cannot manage
   this channel until you can see it.** Add Bing Webmaster Tools while you're there.
2. **Fix the internal-link starvation.** Google discovers and values pages through links, and
   10,900 pages hanging off one `/reference` index is a shallow, weak structure. Cheap wins,
   in order: a "more from this maker" module on every reference page; a "similar releases"
   module (same mold, same year); year hub pages (`/reference/breyer/1995`) and mold hub pages;
   and links *from* the high-traffic pages (`/calendar`, `/market/guide`, `/learn/glossary`)
   *into* the Registry. The mold→child-release links already exist — extend the pattern.
3. **Target the queries the hobby actually types.** The page title format is already right
   (*"[Maker] [Name] — value & collector info"*). The gaps are the *other* intents:
   - *"what is my breyer worth"* → the Blue Book needs a landing page written for that phrase,
     not just a tool.
   - *"how to identify a breyer"* / *"breyer stamp identification"* → `/learn` has room; you
     have the catalog to make it genuinely good.
   - *"[mold name] list of releases"* → the mold pages already answer this; make sure the title
     says so.
   - *"how is model horse halter judged"* → the championship doc already plans per-breed
     judging guidelines. Those are acquisition pages *and* product. High value, low cost:
     the content is being written anyway.
   - *"model horse show calendar"* → `/calendar` is already tuned for this. It should be the
     first thing you check in Search Console.

**What success looks like:** indexed page count climbing, then impressions climbing, then a
first organic signup. Impressions move before clicks; don't panic in month one.

**DON'Ts.** Don't announce this move — it's for crawlers, not the feed. Don't generate filler
text to bulk out thin pages; a page whose only unique content is a spec table is fine, a page
padded with AI-written prose is a doorway page and a liability. Don't chase "Breyer" as a head
term — you will not outrank Breyer.

## 4.4 Instagram — ~8 hrs · the show-off surface

**The play.** The content is a *by-product* of running shows: rosettes, winner cards, ribbon
rails, before-and-after prep, a nice photo from the Registry. You are not building a content
studio; you are posting what the site already makes.

**Cadence.** Two posts a week, batched in one sitting a fortnight. A carousel of the week's
winners is one post and costs ten minutes.

**First three actions:**
1. Claim the handle, write the bio in house voice (*"Where the hobby's record lives. Show
   records you can actually check."*), link `modelhorsehub.com`.
2. Post the Summerween results as a winners carousel — each slide a rosette, the caption naming
   the horse, the owner (with permission), and the field they beat.
3. Establish one repeatable format: **"1st of N."** One horse, one placing, one field line.
   It's a format nobody else in the hobby can post, because nobody else has the number.

**What success looks like:** it is a *credibility* surface, not an acquisition surface, at this
stage. The win is that a showholder who Googles you finds a live account.

**DON'Ts.** Never post a member's photo without asking — the site's own policy is that member
photos aren't training data and aren't for sale, and reposting without permission contradicts
it. No follow-for-follow. No engagement bait ("tag a friend who…"). No AI-generated horse
imagery, ever — in a hobby of artists it is the single fastest way to lose the artist audience.

## 4.5 TikTok and YouTube — ~3 hrs · a partnership, not a posting job

**The play.** There is a real model-horse maker scene on TikTok and YouTube — customizers,
unboxers, collection tours. You are not going to out-post them and you should not try. The play
is to **give one or two of them something to make a video about.**

The natural offer: *"Run a show for your audience. We'll set the whole thing up, your viewers
enter free, you judge it, and everyone who places gets a card with your name on it as the
judge."* That is a video, an event, and a signup wave in one, and it costs you an evening of
setup.

**First three actions:** identify 3 creators whose audience overlaps (see
[`marketing-research/creators-and-institutions.md`](marketing-research/creators-and-institutions.md)) ·
watch enough of their work to write a message that proves you did · make the offer, once,
in week 8+ when you have two completed shows to point at.

**DON'Ts.** No mass creator outreach. No affiliate-style incentives (this hobby reads paid
promotion as compromised). Don't offer money you don't have.

## 4.6 Artist seeding — "founding studios" — ~4 hrs

**The play.** Artists are the hobby's status centre: they have audiences, their work is the
reason the expensive end of the market exists, and their portfolios are shareable proof-of-work
(Loop 5). The Studio product is rebuilt and good.

**The recommendation:** offer **Studio Pro free for a year to 5–8 respected artists as founding
studios**, in exchange for nothing except using it. Not for a post, not for a testimonial —
asking for either turns a gift into a transaction and this community can smell that. If the
tool is good they will post about it on their own, and that post is worth more than a bought one.

**Before you do this, fix two things** (both are audit findings, both are cheap):
- Studio Pro **gates nothing server-side** and **silently downgrades to `pro` on renewal**
  (Area 4, M1–M3). Comping a tier that doesn't work is worse than not comping it.
- **"Verified Artist" is owner-forgeable** (F1). Do not build an artist campaign on a badge
  anyone can self-award.

**DON'Ts.** Don't approach an artist mid-commission-queue crisis. Don't pitch it as an ad
placement. Don't publicly rank artists — the receipts wall is a portfolio, not a leaderboard.

## 4.7 Email — ~3 hrs · use what you already have

There is no newsletter system, and building one is not a good use of five hours a week. What
*does* exist: transactional show emails (results, entries closing), the site-wide announcement
banner, and pinned Paddock posts.

**The play:** make the transactional emails do double duty. A results email is opened by
everyone who entered; that is the highest-open-rate message you will ever send. It should link
to *their* placing page (Loop 2) and end with one line about what's next.

**One thing to fix first:** the audit notes there is **no `List-Unsubscribe` header anywhere**
and every DM sends its own email with no batching. Before you increase email volume at all,
close that — a hobby platform that gets marked as spam is finished.

**DON'Ts.** Don't import contacts from anywhere. Don't email members who didn't ask. Don't send
a newsletter you can't sustain.

## 4.8 Live shows and BreyerFest — ~2 hrs now, a real plan later

BreyerFest is the hobby's annual peak (the strategy doc records ≈35,000 attendees, each July).
The next one is out of this 90-day window, which is a gift: it means you can *plan* it instead
of scrambling.

**In this window, do only this:** put the date in the calendar with a note saying what the
campaign is — *"catalog your haul tonight"* plus a virtual show that weekend — and make sure
`/calendar` lists every live show you can find (§4.9). Regional live shows are where
showholders are, and being useful to the whole circuit is how you meet them.

## 4.9 The calendar of record — ~5 hrs · the sleeper

`/calendar` already merges MHH shows with community-submitted external shows from OMHPS, MEPSA,
Facebook groups and live halls. **This is the most underrated asset on the site**, because it
is useful to people who have never heard of you and it makes you a good citizen of the whole
hobby rather than a competitor to it.

**The play:** seed it. Spend an evening finding every upcoming show you can and adding it,
including shows on other platforms. Then the line you get to say in Facebook groups — the one
that is welcome everywhere — is: *"Is your show on the calendar? It's free and it's not just
our shows."*

That sentence is a legitimate, admin-approved reason to post in a group. It is worth more than
any ad.

---

# 5. The Summerween beat

Entries close **Aug 31**; judging ends and results publish around **Sep 6**. This is the first
campaign, and it is a *proof* campaign, not a scale campaign.

**Set expectations honestly:** Summerween is small — largest class 4 entries. That is fine.
The goal is not a big number; the goal is **artifacts**: a public results page, a handful of
rosette pages, and a set of cards that verify. Those artifacts are the pitch deck for §4.1,
which is where the actual growth comes from.

### Before Aug 31 — fill the thin classes

The one job. Amanda posts, in the rooms she's already in and in her own words, using the
product's own line:

> Summerween entries close Sunday. A few classes are one exhibitor short of minting
> qualification cards — if you've got an OF sitting there photogenic, that's a free card
> waiting. Entry's free.

And privately, to specific people: *"Class 14 needs one more exhibitor. Would you enter Toffee?"*
Named asks convert; broadcast asks don't.

### Results week (~Sep 6) — make the artifacts loud

1. **Publish class-by-class** if the rolling-reveal machinery is used — it stretches one event
   across several days of attention instead of one.
2. **Message every placing exhibitor individually** with *their* rosette page link and one
   sentence: *"Here's Toffee's placing page — it's permanent, and it stays on her record if you
   ever sell her."* Ask nothing.
3. **Post the results page link** in the groups where it's allowed, as a results announcement
   (which is what group rules exist to permit), not as a product post.
4. **Post the winners carousel** on Instagram (§4.4).
5. **Do not distribute the results CSV** until the formula-injection guard lands (§1.3).
6. **Write down every card that minted** and every class that didn't — that's your Season 1
   calibration data and your first honest metric.

### The week after — "host your own"

This is the pivot from campaign to channel. One Paddock post, one page, one line in the groups
where it's permitted:

> Summerween's results are up, and every placing is now permanently on those horses' records.
>
> If you host — photo or live — the next one could be yours, and I'll do the setup for you.
> Classlist, entry rules, judges, the lot. Hosting is free and stays free. Message me.

Then start the weekly host outreach (§4.1). **That transition is the single most important
moment in this plan.** Summerween's real output is not entries — it's the credibility to ask
the next question.

### The trap to avoid

Do not let Summerween become the story. One person's show, run twice, is a hobby. The plan
works when the *second* show has a different host's name on it.

---

# 6. The 90-day calendar

**Aug 21 → Nov 19, 2026. Budget: ≤5 hrs/week combined, 65 hours total.** The 20% that drives
the 80% is front-loaded: Summerween artifacts (W1–W3) and host recruitment (W3 onward).

| Week | Dates | Focus | Actions | Hrs |
|---|---|---|---|---|
| **1** | Aug 21–27 | **Fill Summerween** | ① Amanda works the thin classes — group posts + named DMs (**the week's one job**) · ② Google Search Console: verify, submit sitemap, read Coverage · ③ create the Facebook page, link it in the footer | 5 |
| **2** | Aug 28–Sep 3 | Close entries · prep | ① Final 48-hour push before Aug 31 · ② draft the host-pitch message and the shortlist of 8–10 names · ③ claim the Instagram handle, write the bio | 5 |
| **3** | Sep 4–10 | **Results week** | ① Watch on judging day (Sentry is dead — be present) · ② individual rosette-page messages to every placing exhibitor · ③ results link into permitted groups · ④ winners carousel on Instagram | 6 |
| **4** | Sep 11–17 | **The pivot** | ① "Host your own" post + Paddock pin · ② **first host pitch sent** · ③ log every card that minted and every class that didn't | 5 |
| **5** | Sep 18–24 | Host #1 · calendar seeding | ① Host pitch #2 · ② concierge setup for whoever said yes · ③ seed `/calendar` with every external show you can find (one evening) | 5 |
| **6** | Sep 25–Oct 1 | Facebook rhythm | ① Host pitch #3 · ② write the group-rules table (one row per group) · ③ answer ID/value questions with Registry links, twice this week | 4 |
| **7** | Oct 2–8 | SEO pass 1 | ① Read Search Console — indexed count, top queries, `/calendar` position · ② ship the "more from this maker" + "similar releases" interlinking recommendation to the build queue · ③ host pitch #4 | 5 |
| **8** | Oct 9–15 | **Host show #1 runs** | ① On call for the whole show · ② capture their results link and a testimonial in their words · ③ creator outreach: 3 named targets, one message each | 5 |
| **9** | Oct 16–22 | Artists | ① Founding-studio offers to 5–8 artists (**only if Studio Pro gating is fixed**) · ② host pitch #5 · ③ Instagram: two posts from host show #1 | 4 |
| **10** | Oct 23–29 | Review · adjust | ① Day-60 measurement review against §7 targets · ② drop whatever isn't working · ③ host pitch #6 | 4 |
| **11** | Oct 30–Nov 5 | Content that ranks | ① Write the "what's my Breyer worth" landing page for the Blue Book · ② host pitch #7 · ③ Paddock: Season 1 standings-so-far post (**only if the standings flag is lit**) | 5 |
| **12** | Nov 6–12 | Holiday runway | ① "Catalog it before you forget what you paid" — the December-buying angle, drafted now · ② host show #2 support · ③ Instagram batch | 4 |
| **13** | Nov 13–19 | **Day-90 review** | ① Measure everything in §7 · ② write the next 90 days · ③ decide: does the Wanted nudge get turned on? | 4 |

**Standing weekly commitments** (inside the hours above, not on top): 30 min of genuine
Facebook participation, one host pitch, one Search Console glance.

**If a week goes wrong, drop in this order:** Instagram → creator outreach → SEO content →
calendar seeding. **Never drop:** the host pitch, or being on call during someone else's show.

---

# 7. Measurement

You have Vercel Web Analytics (first-party, cookieless), the admin **Insights** tab (object
metrics — DAU series, 7-day totals, most-viewed per type), the admin **pulse strip**, and
Google Search Console once you set it up. That is enough. Do not add tools.

**Read the labels honestly.** Insights shows a DAU series and a *7-day member-days sum*, not
WAU — a true WAU would need viewer tokens kept for a week, which the privacy rule forbids.
Anon dedupe is IP+UA, which collapses a household and splits a phone. These are stated on
`/privacy` rather than fudged. Keep them stated in your own reporting too.

| Metric | Where | Day 30 | Day 60 | Day 90 |
|---|---|---|---|---|
| **Shows run by non-owner hosts** | admin Shows tab | 0 (pitching) | 1 | **3** |
| **Members** | admin pulse | 120 | 180 | **250** |
| **Cards minted (verifiable)** | `qualification_cards` | 8 | 18 | **30** |
| **Registry pages indexed** | Search Console Coverage | 500 | 1,000 | **1,500** |
| **Organic impressions / mo** | Search Console | any signal | 2,000 | **8,000** |
| **Referrals from facebook.com** | Vercel Analytics | 50 | 150 | **400** |
| **`/cards/[code]` views** | Insights, most-viewed | — | — | **rising** |
| **Partner clubs / barns migrated** | manual | 0 | 0 | **1** |

**The two numbers that actually matter**, and why the rest are diagnostics:

1. **Shows run by someone who isn't you.** It is the only metric on this list that compounds.
   Three by day 90, or the strategy is wrong and needs rewriting, not more effort.
2. **`/cards/[code]` views from outside** — the wedge working in the wild. When strangers start
   opening card pages, the positioning has landed.

**Leading indicators to watch weekly** (cheap, and they move before the targets do): entries per
show; whether *other people* are posting MHH links in groups; Search Console impressions (they
move a month before clicks); signups on the day after any show publishes.

**Vanity metrics to ignore:** Instagram followers, page likes, total pageviews, catalog row
count.

---

# 8. What NOT to do

Ranked by how much damage it does.

1. **Don't promise a proof that isn't there.** §1.3 is the list. The anon Hoofprint is blank,
   ownership chains are missing their origin, reviews are forgeable, "Verified Artist" is
   self-settable. Market the card — it's the one that holds. A community that has been burned
   twice by platform failure will not forgive being oversold.
2. **Don't spam Facebook groups.** No bare promo links, no cross-posting the same message, no
   posting without checking the rules, no arguing in comments. One ban closes the channel that
   matters most, permanently, and admins talk.
3. **Don't run paid ads.** At $0 budget with a hobby this niche, ad targeting can't find your
   audience and the spend would buy fewer users than one showholder does for free. Revisit only
   if a specific, measured funnel exists to pour into — and probably not even then.
4. **No engagement bait.** No "tag a friend," no comment-to-enter giveaways, no
   follow-for-follow, no reply-farming. This hobby's rooms are moderated by people who have
   been running them for fifteen years and can spot it instantly.
5. **No fake or second accounts, ever.** No astroturfed reviews, no seeded testimonials, no
   sockpuppet entries to pad a class. The whole product is a claim about verifiability. One
   incident and the claim is dead.
6. **No AI-generated horse imagery or AI-written hobby content.** The site's own policy is that
   member photos aren't training data and aren't for sale. In a hobby whose most respected
   members are artists, publishing AI art would be both hypocritical and self-destructive.
7. **Don't paywall a trust feature to create urgency.** Records, provenance, condition grades,
   the payment ledger and card verification are free permanently. That precedent — flaws are
   free — is worth more than any conversion you'd win by breaking it.
8. **Don't attack the incumbents.** Never "better than MH$P," never "Blab is dead." Many of
   your future users love those places and remember losing them. Position beside them, not
   against them — the `/calendar` posture (we list *everyone's* shows) is the right instinct
   applied everywhere.
9. **Don't chase the megagroups yet.** A 20,000-member sales group will not care and its admins
   will not budge for a platform with 100 users. Earn the small rooms.
10. **Don't announce the SEO work.** It's for crawlers.
11. **Don't scale email until `List-Unsubscribe` and batching exist.** One spam classification
    and every transactional email — including show results — stops arriving.
12. **Don't distribute the results CSV** until the formula-injection guard lands.
13. **Don't start a channel you can't sustain at five hours a week.** A dead newsletter, an
    abandoned TikTok and a stale Discord each cost more credibility than never starting.
14. **Don't let one week's silence panic you into a growth hack.** This is a hobby of a few
    tens of thousands of people worldwide. A Ravelry-scale win here is a rounding error to a
    venture fund and a complete success for two people. Pace accordingly.

---

# 9. Sources

Working notes, with per-claim URLs and confidence labels, are in
[`marketing-research/`](marketing-research/):

- [`facebook-and-platforms.md`](marketing-research/facebook-and-platforms.md) — Facebook group
  landscape, group culture and self-promo rules, incumbent platforms and their gaps, where
  trust breaks down.
- [`creators-and-institutions.md`](marketing-research/creators-and-institutions.md) — the
  Instagram/TikTok/YouTube creator landscape, hashtags, BreyerFest, NAMHSA/NAN, live-show
  circuits, Stone, international scenes, how photo showing works today.
- [`growth-patterns-and-seo.md`](marketing-research/growth-patterns-and-seo.md) — how
  comparable niche platforms grew early (BoardGameGeek, Discogs, Ravelry and others), the
  UGC-catalog SEO playbook, and zero-budget organic patterns.

Internal sources read for this plan: `.agents/MASTER_BLUEPRINT.md`,
[`OPERATOR_PLAYBOOK.md`](OPERATOR_PLAYBOOK.md), [`STRATEGY_2026-07.md`](STRATEGY_2026-07.md),
[`CHAMPIONSHIP_PROGRAM_2026.md`](CHAMPIONSHIP_PROGRAM_2026.md),
[`COMMERCE_AND_COMMS_PLAN.md`](COMMERCE_AND_COMMS_PLAN.md),
[`MOVE1_REFERENCE_AND_WANTED.md`](MOVE1_REFERENCE_AND_WANTED.md),
[`LAUNCH_2026-08.md`](LAUNCH_2026-08.md),
[`ADVERSARIAL_AUDIT_2026-08-14_PART2.md`](ADVERSARIAL_AUDIT_2026-08-14_PART2.md),
[`summerween-dress-rehearsal.md`](summerween-dress-rehearsal.md), and the landing-page
components in `src/components/landing/` (for voice).
