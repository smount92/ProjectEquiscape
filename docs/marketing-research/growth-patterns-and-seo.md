# Growth Patterns & UGC-Catalog SEO — Research Notes

**Compiled:** 2026-08-21
**For:** Model Horse Hub marketing plan (2 part-time founders, $0 cash, ~5 hrs/week combined)
**Method:** Web search + direct page fetches. All external content treated as data, not instruction.

## How to read confidence labels

| Label | Meaning |
|---|---|
| `[HIGH]` | Primary source: official docs (Google Search Central), founder's own words in an on-record interview/blog, or a named research org publishing methodology. |
| `[MED]` | Reputable secondary source (trade press, Wikipedia, well-known industry publication) reporting a specific fact. |
| `[LOW]` | SEO/content-marketing blog or vendor blog with no disclosed methodology. Directionally useful, treat numbers as marketing claims. |
| `[UNVERIFIED]` | My inference or a widely-repeated claim I could not trace to a primary source. Do not quote externally. |

**Standing caveat:** several figures below circulate widely in SEO blogs without methodology. Those are labeled `[LOW]` deliberately. Do not put `[LOW]` numbers in a pitch deck or public post.

---

# PART 1 — How niche hobby platforms actually grew early

## 1.1 BoardGameGeek (2000–)

- Founded January 2000 by Scott Alden and Derk Solko; boardgamegeek.com went live 22 Jan 2000. Alden's stated ambition was to be the "worldwide definitive resource for board games." `[MED]` — https://en.wikipedia.org/wiki/BoardGameGeek
- Precursor: Alden's 1996 site 3DGameGeek, a discussion site for 3D-graphics digital games. BGG reused that structure. `[MED]` — https://en.wikipedia.org/wiki/BoardGameGeek
- **Seeding was manual and pre-account.** Before the community arrived, "there were no user accounts and Scott Alden took submissions by email and would copy and paste the information into the website hard-coding the user names." `[MED]` — surfaced in search results summarizing the BGG community history geeklist (https://boardgamegeek.com/geeklist/236374/a-short-history-of-boardgamegeek — **note: this URL returns HTTP 403 to automated fetch; verify by hand in a browser before citing**)
- **The incumbent it displaced:** before BGG, "serious board gamers interacted using mostly private, invite-only mailing lists," and there were roughly four years of accumulated game knowledge with "nothing on the Web except where to buy them." `[MED]` — same geeklist source, unverified by direct fetch
- Growth was slow at first; ad revenue (Google ads) reached the point where Alden quit his day job in January 2006 — i.e. ~6 years from launch to full-time. `[MED]` — https://boardgoats.org/2020/01/22/boardgames-in-the-news-20-years-of-boardgamegeek/ (**403 on fetch**, claim came via search summary) and https://en.wikipedia.org/wiki/BoardGameGeek
- Database scale over time: ~65,000 games / 9,000 artists / 13,000 publishers / 18,000 designers (2014); 80,000 titles and 250,000+ users who had rated at least one game, 15M ratings total (April 2019); 150,000+ games and ~300,000 active users (2024). `[MED]` — https://en.wikipedia.org/wiki/BoardGameGeek
- **They started hosting the hobby's real-world ritual:** BGG.CON launched 2005; the Golden Geek Awards are announced there. `[MED]` — https://en.wikipedia.org/wiki/BoardGameGeek
- Third-party legitimacy: Diana Jones Award for Excellence in Gaming (2010), Origins Award Hall of Fame (2020). `[MED]` — https://en.wikipedia.org/wiki/BoardGameGeek
- Forum activity as growth proxy: posts seeking players/groups "roughly tripled from 2005 to 2015, growing at a rate of 10% per year." `[MED]` — https://en.wikipedia.org/wiki/BoardGameGeek

**Transferable:** manual founder-seeded catalog → user accounts → forums → awards/con. The founder personally did the unglamorous data entry for the first stretch.

## 1.2 Discogs (2000–)

- Domain registered 30 Aug 2000; launched November 2000 by Kevin Lewandowski, an Intel programmer and DJ, **scoped narrowly to electronic music first**, then expanded to all genres/formats. `[MED]` — https://en.wikipedia.org/wiki/Discogs
- Background: took voluntary severance from Intel, gave himself six months to code a project combining programming with his love of dance records. `[MED]` — search summary of https://www.analogplanet.com/content/discogs-founder-kevin-lewandowski-interviewed and https://dustandgrooves.com/kevin-lewandowski/
- **The marketplace was a user request, not a founder plan.** Collection and want-list features already existed; users asked for a "sell" list, and Lewandowski noticed buying/selling was already happening via private messages and email. Marketplace launched late 2005. `[MED]` — https://en.wikipedia.org/wiki/Discogs and https://www.vice.com/en/article/discogs-interview-vinyl-records-marketplace-2/
- Content model described by NYT as "Wikipedia-like"; database is entirely user-submitted. `[MED]` — https://en.wikipedia.org/wiki/Discogs
- Scale: 37 employees, 3M users, ~20M monthly visits (2015); 19M+ user-submitted release listings (2026). `[MED]` — https://en.wikipedia.org/wiki/Discogs
- **Monetization pivot worth noting:** July 2007 launched a paid "Market Price History" subscription for premium sellers; **later the same year they removed all paid access features and made full use of the site free**, moving revenue to transaction fees. `[MED]` — https://en.wikipedia.org/wiki/Discogs
  - *Relevance to Model Horse Hub: this is prior art for the "trust/reference features are never paywalled" instinct already in the product.* `[UNVERIFIED — my read]`
- **Contribution quality system (the actual moat mechanic):**
  - March 2008: replaced manual moderation by ~440 moderators with a **community voting system**. Described in the company's own localization blog as a pivotal moment. `[MED]` — https://localization.discogs.com/the-evolution-of-the-database-submission-guidelines/
  - Voting rights are **earned, not granted**: "the ability to vote is automatically assigned based on your interaction with the site" — regular logins, viewing releases, reading guidelines, correct commenting, good submissions. Rights can be revoked. `[HIGH]` — https://support.discogs.com/hc/en-us/articles/360005055593-Database-Guidelines-20-Voting-Guidelines
  - **Rank points:** 3 points per new submission, 1 per edit; accumulate on profiles and public leaderboards. `[MED]` — https://www.discogs.com/forum/thread/1025229
  - **Contributor Improvement Program (CIP):** users whose submissions draw too many "Needs Major Changes"/"Entirely Incorrect" votes get throttled to 3 pending contributions at a time, with the stated goal of improving them while protecting the database. `[HIGH]` — https://support.discogs.com/hc/en-us/articles/360005007014-Database-Guidelines-21-Contributor-Improvement
- Editorial arm ("Discogs Digs", "Vinylogue"): interviews and collector profiles — content marketing built on the community itself. `[MED]` — https://en.wikipedia.org/wiki/Discogs

**Transferable:** narrow scope first; catalog before commerce; commerce as a response to observed behavior; earned moderation privileges + public contributor leaderboards + a remediation track instead of bans.

## 1.3 Ravelry (2007–) — the closest analogue

- Beta launched **May 2007** by spouses Casey (listed on Wikipedia as "Cassidy") and Jessica Forbes. Jessica was already deeply embedded in the knitting blogging community from ~2005 and was frustrated she couldn't track the detailed project info bloggers were sharing. Casey built it. `[MED]` — https://en.wikipedia.org/wiki/Ravelry and https://fruityknitting.com/2018/05/22/ravelry-founders-jessica-casey/
- **Founder was a member of the community first.** This is the single most repeated fact in every account. `[HIGH]` — https://fruityknitting.com/2018/05/22/ravelry-founders-jessica-casey/
- **Deliberate invite scarcity.** Ravelry's own blog, 2 May 2007: "The only reason we are doing it this way is so we can grow a bit gradually," and beta testers would be given more invites to hand out. `[HIGH]` — https://blog.ravelry.com/were-getting-there/
- **They explicitly asked users to evangelise, and gave them assets to do it with.** Same post: "you can write about Ravelry on your blog if you want!" — they asked people to describe what they liked and link to the main page, and **offered promotional badges for blog sidebars**. `[HIGH]` — https://blog.ravelry.com/were-getting-there/
- Seeding: Jessica sent invitations to a few hundred knitting friends; their friends wanted in; the waitlist reportedly went to a few thousand, then 10,000, then 30,000. Invites were treated like "golden tickets" and screenshots circulated. `[MED/LOW]` — https://thefarmersdaughterfibers.com/blogs/woolgathers-from-320-central/welcome-to-ravelry-the-knitter-s-internet-wonderland (retailer blog; the specific waitlist step-numbers are not primary-sourced — treat as narrative, not data)
- Invite pace, one hard data point: Lisa Chamoff got her invite 23 March 2008 as **Raveler #100880** — i.e. ~100k members within ~10 months of beta. `[MED]` — https://craftindustryalliance.org/raverly-at-10-how-the-knitting-social-network-has-inspired-and-impacted-yarntrepreneurs/
- Stayed in beta until early 2010. `[MED]` — https://en.wikipedia.org/wiki/Ravelry
- Scale: ~9M registered users, ~1M monthly active (March 2020). `[MED]` — https://en.wikipedia.org/wiki/Ravelry
- **Feature architecture — three spaces:** (1) *labor* — Projects, Queue, Stash, Needles & Hooks; (2) *social* — forums, groups, friends, photo integration; (3) *marketplace* — pattern sales, designer transactions, yarn trading. The community-edited yarn and pattern database "emerged organically as users documented their projects." `[MED]` — https://en.wikipedia.org/wiki/Ravelry
  - **This is the key mechanic: the catalog was a by-product of the single-player tracking tool, not a separate data-entry chore.** `[HIGH — restating the source]`
- **Monetization aligned with the small businesses in the niche:** custom ad system where small fiber businesses "spend as little as a few dollars a month to advertise on the site and also sell patterns, with Ravelry taking a nominal percentage." Founders: "we thought we would give it a shot and see if that would work — and it did." 98.7% of pattern store revenue goes to designers. `[MED]` — https://craftindustryalliance.org/raverly-at-10-how-the-knitting-social-network-has-inspired-and-impacted-yarntrepreneurs/ and https://en.wikipedia.org/wiki/Ravelry
- **Designers were invited during beta** and got customer access + market research data they'd never had. Before Ravelry, "customers had to go from blog to blog." `[MED]` — https://craftindustryalliance.org/raverly-at-10-how-the-knitting-social-network-has-inspired-and-impacted-yarntrepreneurs/
- **It consolidated a fragmented incumbent landscape:** blogs, Yahoo groups, Knitter's Review forum, Knitty magazine. `[MED]` — https://craftindustryalliance.org/raverly-at-10-how-the-knitting-social-network-has-inspired-and-impacted-yarntrepreneurs/
- **Member-organised site-wide events became a growth ritual:** the Ravelympics (renamed **Ravellenic Games** in 2012 after a USOC cease-and-desist) is a site-wide knit-along timed to the Olympics — start a project at the opening ceremony, finish before the torch goes out. **Organised by members, not staff.** The USOC dispute generated national press coverage (NPR) and a public apology. `[HIGH]` — https://blog.ravelry.com/ravelympics/ , https://www.npr.org/sections/thetwo-way/2012/06/28/155928786/knotty-problem-solved-knitters-wont-call-their-games-the-ravelympics
- Slate covered why Facebook could not replace it for knitters — worth reading for the "why a dedicated platform beats a Facebook group" argument. `[MED]` — https://slate.com/technology/2011/07/ravelry-and-knitting-why-facebook-can-t-match-the-social-network-for-knitters.html

## 1.4 MyAnimeList (2004–)

- Founded November 2004 by Garrett Gyssler; grew out of IRC channels run by fansub groups, where he already talked about anime. "In 2004 there wasn't an easy way to share or list what anime you'd seen." `[MED]` — https://en.wikipedia.org/wiki/MyAnimeList
- The **shared database came second**: created 29 June 2005 specifically "to standardize anime series' names on every user's list." I.e. the list tool created the need for the catalog. `[MED]` — https://en.wikipedia.org/wiki/MyAnimeList
- Founder, on record: "One of the first biggest hurdles was populating the anime database... I was overwhelmed by the datas that needed to be inserted." And: **"The volunteers and support from the community is without a doubt the #1 reason MAL was able to grow into what it is today."** `[HIGH]` — https://otakumode.com/news/5590fbd763cd06585662ce9d/Exclusive-Interview-with-the-Founder-of-MyAnimeList-a-Colossal-Site-with-120-Million-Monthly-PVs
- On recruiting the first moderators: "Gathering the first couple staff members was incredibly tough. There were no guidelines, and no rules to train off of... I didn't know what to look for in volunteers, so I asked for anyone that had free time and liked anime." `[HIGH]` — same interview
- **Growth curve is the useful part** — it was slow and that was fine: 228 members at domain purchase (2006) → ~2,000 a year later → ~40,000 a year after that. His comment: "a slow start, but I knew people enjoyed using MAL." `[HIGH]` — same interview
- 200,000+ registered users by July 2009, 13,000+ daily sign-ins. `[MED]` — https://en.wikipedia.org/wiki/MyAnimeList

## 1.5 Goodreads (2007–)

- Otis Chandler's stated split for 2007–2012: **"80% make the product better, 20% tune our growth channels."** `[HIGH]` — https://www.startuparchive.org/p/otis-chandler-explains-how-he-grew-goodreads-to-50-million-users
- On SEO: "If you solve a problem, Google will reward you... give people easy tools to share your product because that'll put links out in the wild — and have lots of great content." `[HIGH]` — same
- **Embeddable widgets as a link engine:** "we built some widgets for those guys to show off the books they had been reading on the side of their blogs" — with "a little logo at the bottom that was just static HTML to get a link to our homepage." `[HIGH]` — same
- Address-book importers were "the secret sauce" 2007–2010; copy testing mattered — **"Join my reading network" performed 3x higher** than the alternative. `[HIGH]` — same
- Early users came from book bloggers, online communities, and friend-to-friend referral; reached 650,000 members without outside funding. `[MED]` — https://www.founded.com/how-goodreads-went-from-one-book-review-to-50-million-users-and-an-amazon-acquisition/
- SEO strategy was breadth of UGC: as many reviews as possible across as many books as possible. `[MED]` — same
- Scale checkpoints: 10M members (Dec 2012), 20M (July 2013). `[MED]` — https://techcrunch.com/2013/07/23/goodreads-20-million-members

## 1.6 Letterboxd (2011–)

- Founded by Matthew Buchanan and Karl von Randow (NZ web designers, Cactuslab). Launched 2011 as a **part-time side project alongside their web design studio**, invite-only beta first. `[MED]` — https://en.wikipedia.org/wiki/Letterboxd , https://www.auckland.ac.nz/en/news/2023/11/07/letterboxd-founders-smash-hit.html
- **Positioning by analogy:** tagline was "Goodreads for movies" — books had Goodreads, music had Last.fm, film had nothing. `[MED]` — https://www.auckland.ac.nz/en/news/2023/11/07/letterboxd-founders-smash-hit.html
- Went ~9 years before the **first full-time employee (March 2020)**. Grew 1.8M users (2020) → ~10M during the pandemic. Tiny acquired 60% in Sept 2023 at an $83M valuation. `[MED]` — https://www.auckland.ac.nz/en/news/2023/11/07/letterboxd-founders-smash-hit.html , https://variety.com/2023/digital/news/letterboxd-founders-sell-company-adding-tv-shows-1235746156/
- Also worth reading for community-tone management: https://www.culturedmag.com/article/2026/04/23/film-letterboxd-founders-matthew-buchanan-karl-von-randow/ `[MED]`

**Transferable:** a two-person side project stayed a two-person side project for nearly a decade and still won the category. Slow is survivable.

## 1.7 BrickLink (2000–)

- Started as **BrickBay**, 19 June 2000, by Daniel Jezek (programmer, adult LEGO fan, Honolulu). `[MED]` — https://en.wikipedia.org/wiki/BrickLink
- **Origin is a "tools as marketing" story:** he built a website for *his own* LEGO store; other sellers were impressed and asked for the same; he turned it into one central platform where anyone could run a store. `[MED]` — https://www.danjezek.com/bricklink.html , https://en.wikipedia.org/wiki/BrickLink
- Renamed BrickLink in 2002 after an eBay cease-and-desist over "Bay." Reached 51M+ visitors by ~2010. Acquired by the LEGO Group (2019). `[MED]` — https://en.wikipedia.org/wiki/BrickLink , https://www.lego.com/en-us/aboutus/news/2019/november/lego-bricklink
- The catalog of parts/sets is the reference layer under the marketplace. `[MED]` — https://en.wikipedia.org/wiki/BrickLink

## 1.8 Untappd (2010–)

- Launched 22 Oct 2010 by Greg Avola and Tim Mather — **who met on Twitter** and had never worked together in person. `[MED]` — https://en.wikipedia.org/wiki/Untappd
- Built the prototype in under 24 hours; launched two weeks later; ~$1,000 total initial investment; **neither founder quit his day job** for years. `[MED]` — https://medium.com/@jemersoncooper/untappd-how-2-guys-build-craft-beer-s-social-media-platform-in-their-spare-time-1ee6034be933 , https://www.inc.com/magazine/201909/cameron-albert-deitch/untappd-greg-avola-tim-mather-beer-social-foursquare-2019-inc5000.html (**Inc. returns 403 to automated fetch — verify in browser**)
- Reportedly scaled to ~3M users with **zero ad spend**, "guerilla marketing"; a Mashable write-up was a pivotal early moment. `[MED/LOW]` — https://medium.com/@jemersoncooper/... (single-author Medium post; the "one press hit mattered" claim is plausible but thinly sourced)
- Milestones: 1M users (Jan 2014), 3.2M (April 2016), 820k unique actives across ~180 countries (Sept 2020). `[MED]` — https://en.wikipedia.org/wiki/Untappd
- **Badge system is the retention/ritual engine** — four categories: local badges (specific participating venues), beer badges, venue badges (breweries, restaurants, festivals), and special/promotional badges. Note that badges are the hook that pulls *businesses* (venues, festivals) into the platform. `[MED]` — https://en.wikipedia.org/wiki/Untappd

## 1.9 Strava (2009–)

- **Founders literally drove a van to local cycling races** to get riders to upload their Garmin files. Mark Gainey: they were "begging and borrowing and stealing from cyclists anywhere we could." `[MED]` — https://research.contrary.com/company/strava
- **Segments came from an existing community ritual:** Davis Kitchel recalled an unofficial hill-climb competition from a late-1990s local group ride, and that became segment leaderboards. `[MED]` — https://research.contrary.com/company/strava , https://en.wikipedia.org/wiki/Davis_Kitchel
- Pivoted from paid ("Strava Prime") to freemium specifically to unlock network effects on segment leaderboards. `[MED]` — https://sacra.com/c/strava/
- Adding running (2012) tripled the addressable market. `[MED]` — https://sacra.com/c/strava/

## 1.10 The frameworks these all fit

- **"Come for the tool, stay for the network"** — Chris Dixon, 31 Jan 2015. Attract users with a *single-player* tool, then convert them into network participants. "The tool helps get to initial critical mass. The network creates the long term value for users, and defensibility for the company." Examples given: Delicious (bookmark storage → tagging/discovery), Instagram (filters → sharing network). `[HIGH]` — https://cdixon.org/2015/01/31/come-for-the-tool-stay-for-the-network
  - Counter-argument worth reading before over-applying it: https://techcrunch.com/2016/12/01/come-for-the-tool-stay-for-the-network-reconsidered/ `[MED]`
- **Atomic networks / the cold start problem** — Andrew Chen. Get one small, dense network fully working before expanding. `[MED]` — https://medium.com/point-nine-news/come-for-the-network-stay-for-the-tool-5206c5736b11 (secondary summary; the book itself is the primary source)

## 1.11 Extracted patterns (the part that matters)

| # | Pattern | Evidence |
|---|---|---|
| P1 | **Founder is already a native of the community.** Jessica Forbes (knit blogger), Gyssler (anime IRC), Jezek (AFOL seller), Lewandowski (DJ), Alden/Solko (gamers). Not one of these was an outsider doing market research. | Ravelry, MAL, BrickLink, Discogs, BGG `[HIGH]` |
| P2 | **The catalog is a by-product of a single-player tool, not a data-entry project.** Ravelry's yarn/pattern DB "emerged organically as users documented their projects." MAL built the DB to standardise names across personal lists. | Ravelry, MAL `[HIGH]` |
| P3 | **Founders hand-seed the first tranche themselves.** Alden copy-pasted email submissions into hardcoded pages. Gyssler was "overwhelmed by the datas." | BGG, MAL `[MED/HIGH]` |
| P4 | **Volunteer contributor corps with earned privileges + public standing.** Discogs voting rights are earned by behaviour; rank points and leaderboards are public; CIP throttles instead of banning. | Discogs `[HIGH]` |
| P5 | **Invite scarcity as a growth throttle AND a marketing device.** Ravelry did it explicitly for ops reasons, and it produced golden-ticket status as a side effect. Letterboxd also invite-only at start. | Ravelry `[HIGH]`, Letterboxd `[MED]` |
| P6 | **Ask users to evangelise and hand them the assets.** Ravelry's own blog asked people to blog about it and offered sidebar badges. Goodreads shipped blog widgets with a static HTML link home. | Ravelry, Goodreads `[HIGH]` |
| P7 | **Host the ritual the community already performs.** BGG.CON + Golden Geek Awards; Ravellenic Games (member-organised); Strava segments from an existing unofficial hill climb; Untappd venue/festival badges. | Multiple `[HIGH/MED]` |
| P8 | **Consolidate a fragmented incumbent landscape rather than fight one big incumbent.** Ravelry absorbed blogs + Yahoo groups + forums; BGG absorbed private mailing lists; MAL absorbed IRC. | Multiple `[MED]` |
| P9 | **Serve the niche's small businesses (creators/sellers) as a distinct constituency.** Ravelry's few-dollars-a-month ad system and 98.7%-to-designer pattern store; BrickLink's store-in-a-box. | Ravelry, BrickLink `[MED]` |
| P10 | **Build commerce only after observing the behaviour.** Discogs' marketplace came from users already trading via PM/email. | Discogs `[MED]` |
| P11 | **Long timelines are normal.** BGG: 6 years to founder full-time. Letterboxd: 9 years to first employee. MAL: 228 → 2,000 → 40,000 over two years. | Multiple `[HIGH/MED]` |
| P12 | **Narrow scope first, expand later.** Discogs = electronic music only. Strava = cycling only. | `[MED]` |

---

# PART 2 — UGC-catalog SEO playbook (2025–2026)

## 2.1 The hard constraint: Google's spam policies

These are the policies a 10,000-page catalog most plausibly trips. Verbatim from Google Search Central — https://developers.google.com/search/docs/essentials/spam-policies `[HIGH]`

- **Scaled content abuse:** "Scaled content abuse is when many pages are generated for the primary purpose of manipulating search rankings and not helping users." Examples include "Using generative AI tools or other similar tools to generate many pages without adding value for users" and "Scraping feeds, search results, or other content to generate many pages (including through automated transformations like synonymizing, translating, or other obfuscation techniques), where little value is provided to users."
- **Doorway abuse:** "when sites or pages are created to rank for specific, similar search queries. They lead users to intermediate pages that are not as useful as the final destination." A named example: **"Creating substantially similar pages that are closer to search results than a clearly defined, browseable hierarchy."**
- **Thin affiliation:** publishing affiliate content where descriptions/reviews are copied from the merchant "without any original content or added value" — typically appearing as "cookie-cutter sites or templates with the same or similar content replicated."

**Key reading:** volume is explicitly *not* the violation. Purpose and value-add are. A catalog built from real, user-contributed, otherwise-unavailable data is on the right side of this line; a catalog built by reformatting a manufacturer's release list is not. `[UNVERIFIED — my synthesis of the policy text]`

Enforcement context: the three related policies (scaled content abuse, site reputation abuse, expired domain abuse) launched March 2024; an August 2025 spam update reportedly widened SpamBrain enforcement to programmatic near-duplicate sets without new written policy. `[LOW]` — https://www.breaklineagency.com/guide-to-googles-scaled-content-abuse/ , https://www.seo-kreativ.de/en/blog/google-august-2025-spam-update-officially-complete/

## 2.2 The self-assessment questions to run each catalog page against

From Google's "Creating helpful, reliable, people-first content" — https://developers.google.com/search/docs/fundamentals/creating-helpful-content `[HIGH]`

- "Does the content provide original information, reporting, research, or analysis?"
- "If the content draws on other sources, does it avoid simply copying or rewriting those sources, and instead provide substantial additional value?"
- Red flags Google names: "Producing lots of content on many different topics in hopes that some of it might perform well in search results"; "Using extensive automation to produce content on many topics"; "Mainly summarizing what others have to say without adding much value."
- The **Who / How / Why** framework: make authorship transparent, explain how submissions are vetted or moderated and whether automation is involved, and be able to answer that the page exists to help people rather than to attract search visits.

**Practical implication for a collectibles catalog:** the "substantial additional value" per page must be things a manufacturer's page cannot have — **ownership counts, real sale prices, member photographs, show results, provenance chains, identification tells, condition/flaw notes, and discussion.** Those are all UGC by-products, which is exactly the P2 pattern. `[UNVERIFIED — my synthesis]`

## 2.3 Structured data: what actually exists in 2026

Source of truth: https://developers.google.com/search/docs/appearance/structured-data/search-gallery `[HIGH]`

Currently supported rich-result types relevant here: **Product, Breadcrumb, Carousel, Review snippet, Q&A, Discussion forum, Profile page, Organization, Event, Image metadata, Dataset, Video.**

### FAQPage is dead — do not build for it
- "The FAQ rich result feature is no longer shown in Google Search results, as announced in the changelog entry in May 2026." The only remaining exception: "the feature is only shown for well-known, authoritative government and health websites." Deprecation notice first added 8 May 2024; documentation removed 15 June 2026. `[HIGH]` — https://developers.google.com/search/docs/appearance/structured-data/faqpage
- **Action: do not spend any of the 5 hrs/week on FAQPage markup.** It buys nothing.

### Product / Product snippets
- Two distinct experiences: **merchant listings** (pages where you can buy directly — wants price, availability, shipping, returns, sizing) vs **product snippets** (review-focused pages where purchase doesn't happen on-page, supports pros/cons on editorial review pages). `[HIGH]` — https://developers.google.com/search/docs/appearance/structured-data/product
- "Adding the required product information properties for merchant listings means that your product pages can also be eligible for product snippets." `[HIGH]` — same
- Product **variant** structured data exists and is recommended for distinguishing variations of the same product — directly relevant to model runs / colour variations / special runs. `[HIGH]` — same
- The docs do **not** clearly state whether a page with no offer at all can earn a rich result. `[UNVERIFIED]` — treat as untested; the safe read is that a reference page with aggregate ratings/reviews goes for *product snippets*, and a marketplace listing page goes for *merchant listing*.

### Discussion forum — the sleeper type for a community platform
- `DiscussionForumPosting` markup powers Google's **Discussions and Forums** feature. Eligibility: "Only use `DiscussionForumPosting` markup to describe a user-generated post on a website." Publisher-authored content does not qualify. `[HIGH]` — https://developers.google.com/search/docs/appearance/structured-data/discussion-forum
- Required properties: `author` (with name), `datePublished` (ISO 8601), and at least one of text / image / video. Comments take the same shape. `[HIGH]` — same
- **This is cheap and directly applicable to forum threads, show results discussions, and reviews.** `[UNVERIFIED — my recommendation]`

### Breadcrumb
- Supported and stable; also does architectural work (see 2.4). `[HIGH]` — search gallery

### ItemList / Carousel
- Supported, but the documented carousel experiences are scoped to Recipe, Course, Restaurant and Movie. `[HIGH]` — search gallery. Do not expect a collectible-catalog carousel. `[UNVERIFIED — inference]`

## 2.4 Internal linking / architecture for large page sets

*(All items here are from SEO industry sources, not Google docs — labeled accordingly.)*

- **Crawl depth target: every canonical page within ~3 clicks of the homepage; validate under 4.** `[LOW]` — https://www.digitalapplied.com/blog/internal-linking-strategy-2026-large-site-architecture-guide
- **Faceted navigation is the main risk to a 10k-page catalog.** A 10,000-item catalog with 50 filters can generate 100M+ near-duplicate URL combinations. The recommended remedy is blocking parameter URLs in `robots.txt` (stops the crawl before it starts) rather than relying on `noindex` (which requires the crawl to happen first). `[LOW]` — https://www.digitalapplied.com/blog/ecommerce-seo-product-category-page-guide-2026 , https://hootcore.io/blog/large-catalog-seo`
- **Most pages have zero backlinks, so internal links are the entire ranking budget for them.** Claim: Ahrefs found 66% of websites have zero backlinks pointing to most of their pages. `[LOW]` — https://www.digitalapplied.com/blog/internal-linking-strategy-2026-large-site-architecture-guide (secondhand citation of an Ahrefs study; **verify against Ahrefs directly before quoting**)
- **Hub architecture:** define primary category hubs, map parent-child relationships, implement breadcrumbs, route internal links to canonicals. `[LOW]` — same
- **Category/hub pages need unique prose, not just a grid.** Claim: category pages with 150–300 words of unique descriptive content rank 2.7x higher than grid-only pages. `[LOW]` — https://www.digitalapplied.com/blog/ecommerce-seo-product-category-page-guide-2026 (no methodology disclosed; **treat the 2.7x as marketing, the direction as sound**)
- **Programmatic pages that survive:** "Programmatic SEO is safe when each page delivers original data, context, or evidence. Volume alone is not the violation." Contrast drawn between Zillow-style pages backed by real MLS data and thin doorway sets. `[LOW]` — https://quickseo.ai/blog/programmatic-seo-stats-2026-is-pseo-still-viable-in-the-ai-search-era
- **The named anti-pattern:** "pages that are 90% identical except for one variable." Recommended fixes: per-page unique sections — local/contextual info, user reviews, custom Q&A, data visualisations. `[LOW]` — http://www.gomega.ai/blog/programmatic-seo-complete-guide/

## 2.5 AI Overviews / LLM search — is catalog SEO still worth it?

### The bear case (independent, methodologically disclosed)

Pew Research Center, published 22 July 2025, browsing data from 900 consenting US adults, March 2025 activity — https://www.pewresearch.org/short-reads/2025/07/22/google-users-are-less-likely-to-click-on-links-when-an-ai-summary-appears-in-the-results/ `[HIGH]`

- 58% of respondents ran at least one Google search in March 2025 that produced an AI summary.
- Users who saw an AI summary clicked a traditional result in **8% of visits**; users who did not saw **15%** — nearly twice as often.
- Users clicked a link *inside* the AI summary in just **1% of visits**.
- Sessions ended entirely on **26%** of pages with an AI summary vs **16%** without.

### The bull case (Google's own position)

Liz Reid, VP/Head of Google Search, 6 Aug 2025 — https://blog.google/products-and-platforms/products/search/ai-search-driving-more-queries-higher-quality-clicks/ `[HIGH]` *(primary source, but an interested party)*

- "Overall, total organic click volume from Google Search to websites has been relatively stable year-over-year."
- "Average click quality has increased and we're actually sending slightly more quality clicks to websites than a year ago." (Google defines a quality click as one where the user doesn't quickly bounce back.)
- "While overall traffic to sites is relatively stable, the web is vast, and user trends are shifting traffic to different sites, resulting in decreased traffic to some sites and increased traffic to others."
- **The line that matters most here:** "People are increasingly seeking out and clicking on sites with forums, videos, podcasts, and posts where they can hear authentic voices... Sites that meet these evolving user needs are benefiting from this shift and are generally seeing an increase in traffic."

Note the direct conflict with Pew. Press Gazette covered publisher pushback on Google's claim. `[MED]` — https://pressgazette.co.uk/platforms/google-search-clicks-traffic-2025-ai-overviews/

### AI referral traffic magnitude (as of late 2025 / 2026)

Via Digiday's roundup — https://digiday.com/media/in-graphic-detail-the-state-of-ai-referral-traffic-in-2025/ `[MED]` (aggregating Conductor, Similarweb, Sensor Tower, Microsoft Clarity, Cloudflare)

- AI platforms drive **~1% of overall web traffic** across 10 major industries (Conductor). ChatGPT is ~87.4% of that AI referral slice.
- Sept–Nov 2025 YoY: ChatGPT referrals +52%, Gemini +388% (Similarweb).
- **AI traffic converts far better:** Microsoft Clarity, 1,200+ publisher sites — LLM traffic converted to sign-ups at **1.66% vs 0.15%** from search; to subscriptions **1.34% vs 0.55%** (Microsoft Clarity).
- Crawl-to-referral ratios are brutally lopsided: Anthropic reportedly reaching 500,000:1, OpenAI peaking around 3,700:1 in March (Cloudflare). `[MED]` — i.e. bots consume your catalog far faster than they send anyone back.

Corroborating growth figure: Semrush + Datos analysed 1 billion clickstream data points (US, Oct 2024 – Feb 2026) and found ChatGPT referral traffic to external sites grew **206% YoY**. `[MED]` — https://www.crispycontent.de/en/blog/ai-referral-traffic-chatgpt-growth-impact-b2b-brands-2026 (secondhand report of a Semrush/Datos study; verify at semrush.com before quoting)

Widely circulated but poorly sourced: "AI Overviews reduce organic CTR by 61%." `[LOW]` — https://www.dataslayer.ai/blog/google-ai-overviews-the-end-of-traditional-ctr-and-how-to-adapt-in-2025 . **Use the Pew 8%-vs-15% figures instead.**

### Who gets cited by LLMs

- Reddit is reported as the single most-cited domain across generative engines in 2026 (~40% of multi-engine aggregate citation frequency); Wikipedia second; YouTube, LinkedIn, Forbes also lead. The top 15 domains reportedly absorb 68% of citations. Synthesised from 680M+ citations across six studies (Aug 2024 – Apr 2026). `[MED]` — https://www.prnewswire.com/news-releases/5w-releases-ai-platform-citation-source-index-2026-... and https://searchengineland.com/ai-search-engines-cite-reddit-youtube-and-linkedin-most-study-473138 (**this is a PR-distributed agency index — directionally consistent with other studies but not peer-reviewed**)
- See also Semrush's own study: https://www.semrush.com/blog/most-cited-domains-ai/ `[MED]`
- **Reading: UGC dominates AI citations.** A community catalog with real member discussion is structurally the *kind* of source LLMs cite. `[UNVERIFIED — inference]`

### Does structured data help with LLM visibility?

- **Google says no, explicitly:** "You don't need to create new machine readable files, AI text files, or markup to appear in these features. There's also no special schema.org structured data that you need to add." And: "There are no additional requirements to appear in AI Overviews or AI Mode, nor other special optimizations necessary." `[HIGH]` — https://developers.google.com/search/docs/appearance/ai-features
- Google also states clicks from AI Overviews are "higher quality (meaning, users are more likely to spend more time on the site)," and that AI-feature traffic is already in standard Search Console reporting. `[HIGH]` — same
- Industry counter-claims (65% of Google AI Mode-cited pages and 71% of ChatGPT-cited pages contain structured data; 3+ schema types → 13% higher citation probability; "up to 40%" lifts) are **correlational at best and vendor-published**. `[LOW]` — https://kozec.ai/structured-data-ai-search-visibility/ , https://globerunner.com/structured-data-schema-markup-ai-2026/
- **Net recommendation:** implement structured data for the *documented Google Search rich results* it actually earns (Product snippets, Breadcrumb, Discussion forum, Review snippet, Profile page). Do not implement it *for* LLMs. `[UNVERIFIED — my recommendation]`

### Verdict on catalog SEO in 2026

Still worth it, but the value has shifted:
1. Head/informational queries increasingly get answered in-SERP. `[HIGH — Pew]`
2. Long-tail transactional and identification queries ("is my X real", "what year is X", "what's X worth") still require the user to land on a page with the actual data. `[UNVERIFIED — inference, but consistent with Google's own "quality clicks" framing]`
3. Google says forum/authentic-voice sites are *gaining* traffic in this shift. `[HIGH — Google, interested party]`
4. Being the cited source in AI answers has brand value even without the click, and AI-referred visitors convert better when they do arrive. `[MED]`

## 2.6 Pitfalls checklist

| Pitfall | Mitigation |
|---|---|
| Near-identical entries (same mold, 12 colour variants) reading as duplicates | Product **variant** structured data; per-variant unique UGC (photos, owner counts, sale prices, flaws); canonical the near-duplicates to a parent where genuinely identical `[HIGH policy / LOW tactic]` |
| Empty catalog pages published at scale before any UGC exists | Do not index a page until it clears a minimum-value bar (e.g. has an image + one structured fact + one owner). `noindex` until then. `[UNVERIFIED — my recommendation, but directly implied by the scaled-content-abuse policy]` |
| Faceted URLs exploding the crawlable set | `robots.txt` block on parameter URLs `[LOW]` |
| Pages "closer to search results than a clearly defined, browseable hierarchy" — Google's own doorway example | Build real browseable hubs (by mold, by sculptor, by year, by finish) with editorial framing, not filter-result URLs `[HIGH policy]` |
| Building FAQPage markup | Don't. Deprecated May 2026. `[HIGH]` |
| Scraping a manufacturer's release list to generate pages | This is the scraping example named in the policy. Contributions must be genuinely community-added. `[HIGH]` |

---

# PART 3 — Zero-budget organic playbook for a Facebook-group-dominated hobby

## 3.1 The landscape (Model Horse Hub's actual competitive context)

- **OMHPS** (Online Model Horse Photo Shows) — existing online photo show platform with forums; "allows you to show your horses, keep track of their placings." Open to Breyer, Stone, Schleich, CollectA, artist resins, customs, china/porcelain. `[MED]` — https://www.omhps.com/
- **Model Horse Blab** — long-standing hobby forum. `[MED]` — https://modelhorseblab.com/
- **NAMHSA** — the sanctioning body; North American Nationals 2026 scheduled 6–8 July, Clarion Hotel Conference Center, Lexington KY; NAMHSA membership not required to enter many sanctioned live shows. `[MED]` — https://namhsa.org/ , https://www.facebook.com/NAMHSA/ , https://www.instagram.com/namhsa.official/
- **Breyer Collector Club** — the manufacturer's own official community with expert-moderated forums and BreyerFest club access. `[MED]` — https://www.breyerhorses.com/pages/about-breyer-collector-club
- **identifyyourbreyer.com** — an existing independent identification/reference resource with a clubs directory. `[MED]` — https://www.identifyyourbreyer.com/collecting.htm , https://www.identifyyourbreyer.com/clubs.htm
- "There are Facebook pages devoted to model horses and countless clubs, email lists, and web sites around the world that promote model horse collecting." `[MED]` — https://en.wikipedia.org/wiki/Model_horse
- **Model Horse Hub is already indexed and describing itself in search results** as offering "virtual photo shows with NAMHSA templates," "10,500+ reference releases," and "Hoofprint provenance tracking." `[HIGH — observed in live search results, 2026-08-21]`

**Reading:** this is a P8 situation (fragmented incumbents: a forum + a photo-show site + Facebook groups + a manufacturer club + independent ID sites), not a single-incumbent fight. Ravelry's consolidation play is the closest precedent. `[UNVERIFIED — my analysis]`

## 3.2 Facebook group participation — what the guidance actually says

*(Caveat: this area is dominated by low-quality SEO content marketing. Everything here is `[LOW]` unless noted. The founder-native pattern from Part 1 is better evidence than any of these blogs.)*

- **80/20 rule:** ~80% genuinely helpful content, 20% promotional at most; positions you as an expert first and a marketer second. `[LOW]` — https://sproutsocial.com/insights/marketing-tips-facebook-groups/ , https://heytony.ca/how-to-use-facebook-groups-for-marketing/
- **Context with every link:** if you share a link, explain why it's relevant and how it helps members; frame it as a resource, not an ad. `[LOW]` — https://www.laura-moore.co.uk/promote-business-in-facebook-group/
- **Groups are a research channel first:** active participation gives "a direct line into the minds of your target customers, hearing their exact pain points and desires in their own words." `[LOW]` — https://www.evergreenfeed.com/blog/marketing-on-facebook-groups/
- Scale context: Facebook Groups reportedly ~1.8B monthly active users globally as of 2025, ~60% of Facebook's user base. `[LOW]` — https://sproutsocial.com/insights/marketing-tips-facebook-groups/
- **Group admins are the real gatekeepers.** No source states this better than the Reddit guidance below, but the mechanic is the same: rules are enforced by admins, not the platform. `[UNVERIFIED — inference]`

## 3.3 Reddit norms (better documented, same principle)

- The formal "9:1 rule" was retired by Reddit; what replaced it is a qualitative spam policy **enforced by subreddit moderators and AutoMod, not by Reddit** — which is why rules vary enormously per subreddit. `[MED]` — https://redship.io/blog/reddit-self-promotion-rules
- Practical sequence: 2–4 weeks of genuine participation building comment history *before* any mention; answer existing threads where someone asks a question your product solves rather than creating a promo post; disclose affiliation. `[LOW]` — https://www.replyagent.ai/blog/reddit-self-promotion-rules-naturally-mention-product , https://www.onlinemoderation.com/market-on-reddit-without-getting-banned/
- Failure modes: shadowban (posts invisible with no notice), subreddit ban, sitewide suspension. `[LOW]` — https://getupvotes.com/reddit-self-promotion/

## 3.4 Cold-start / community-led growth tactics

- **First 50–100 members set the tone.** Seed with most-engaged users, power users, and people who can start conversations. `[LOW]` — https://innoloft.com/en-us/blog/community-led-growth
- **Start with 10–15 passionate early users in a simple group chat.** `[LOW]` — same
- **Define one clear recurring ritual** (weekly AMA, monthly showcase of user work). "One consistent, valuable event creates rhythm." `[LOW]` — https://marketingagent.blog/2026/03/07/community-led-growth-the-complete-marketers-guide-to-communities-building-brands-that-market-themselves/
  - This is the low-budget version of P7, and it's corroborated by the Ravellenic Games precedent `[HIGH]`.
- **Directory of existing practitioners as a zero-cost partner network.** Notion's Consultants Directory reportedly grew to 60+ members and provided a qualified partner network "at essentially zero cost." `[LOW]` — https://innoloft.com/en-us/blog/community-led-growth
  - Corroborated by identifyyourbreyer.com already maintaining a clubs directory `[MED]` — https://www.identifyyourbreyer.com/clubs.htm
- **Start with a small cohort of highly relevant creators, build genuine long-term relationships, then replicate the playbook across parallel communities.** `[LOW]` — https://www.moburst.com/blog/niche-community-influencer-partnerships-that-drive-growth/
- **Pick 2–3 most active communities, spend 2–3 weeks in each as the helpful expert before mentioning the product.** "The smaller and more specific the community, the faster trust compounds, and you stop being a vendor and start being a peer who built something useful." `[LOW]` — https://www.indiehackers.com/post/i-help-founders-get-their-first-100-users-heres-what-i-ve-learned-252734737f
- **Combine one outbound channel with one place users already gather.** `[LOW]` — https://www.indiehackers.com/post/how-i-got-my-first-100-users-2fc9d71c34

## 3.5 Free-tool-as-marketing

- Genuinely useful free tools generate backlinks when bloggers and journalists reference them; HubSpot's tools cited as earning thousands of backlinks. `[LOW]` — https://authority.builders/blog/saas-link-building/
- "Free tools, templates, and calculators earn the highest-authority backlinks and compound traffic with zero ongoing spend." `[LOW]` — https://growresolve.com/saas-link-building/
- **The strong version of this evidence is not the SEO blogs — it's Goodreads' embeddable widgets with a static-HTML link home** `[HIGH]` (https://www.startuparchive.org/p/otis-chandler-explains-how-he-grew-goodreads-to-50-million-users) **and Ravelry's sidebar badges** `[HIGH]` (https://blog.ravelry.com/were-getting-there/).

---

# Open questions / things to verify before acting

1. The BGG "email submissions, hardcoded usernames" and "invite-only mailing lists" detail came via a search summary of a BGG geeklist that **403s to automated fetch**. Verify in a browser at https://boardgamegeek.com/geeklist/236374/a-short-history-of-boardgamegeek before quoting publicly.
2. The Untappd Inc. profile (https://www.inc.com/magazine/201909/...) also 403s. The "3M users with zero ad spend" claim currently rests on a single Medium post.
3. The Ahrefs "66% of pages have zero backlinks" and "category pages with 150–300 words rank 2.7x higher" figures are secondhand from a single SEO blog. Verify at source or drop them.
4. Whether a catalog page with **no offer/price** can earn Product rich results is not answered in Google's docs. Needs a live test.
5. NAMHSA / OMHPS / Model Horse Blab relationship dynamics — whether these are partnership candidates or perceived competitors — is not something web research can answer. Founder knowledge required.
6. Semrush/Datos and the 5W citation index are both vendor-published. Fine as directional evidence, not as citations in anything public-facing.
