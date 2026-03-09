# Model Horse Hub — Project State & Strategic Research Brief

> **Date:** March 8, 2026  
> **Domain:** [modelhorsehub.com](https://modelhorsehub.com)  
> **Purpose:** Comprehensive state-of-the-project report designed for input to a research agent. Identifies what has been built, what the platform's goals are, and where expansion or focus opportunities exist — all framed through the lens of the model horse collecting hobby.
>
> **Source Documents Integrated:**
> - [feature_wishlist_report.md](file:///c:/Project%20Equispace/model-horse-hub/.agents/docs/feature_wishlist_report.md) — 26 community-researched feature proposals with database schemas, priority tiers, and build order
> - [platform_architecture_deep_dive.md](file:///c:/Project%20Equispace/model-horse-hub/.agents/docs/platform_architecture_deep_dive.md) — Full system design for 3 major expansion systems (Creator Economy, Community Fabric, Competition Engine) with ER diagrams, implementation phases, and risk analysis

---

## 1. What Is Model Horse Hub?

Model Horse Hub is a **purpose-built digital stable and community platform** for the model horse collecting hobby. It is not a generic inventory app — it was built specifically to serve collectors of Breyer, Peter Stone, and Artist Resin model horses. The platform's guiding philosophy is:

> *"Does this feature help a collector **manage**, **show**, **sell**, or **admire** their collection?"*

If a feature doesn't serve one of those four verbs, it doesn't belong.

### The Hobby at a Glance

The model horse hobby is a passionate, detail-oriented collecting community with decades of tradition:

- **Manufacturers:** Breyer (dominant, mass-market plastic, since 1950), Peter Stone (defunct, highly collectible), and hundreds of independent Artist Resin sculptors.
- **Three Finish Types:** Original Finish (OF — factory paint), Custom (repainted by an artist), Artist Resin (hand-cast sculptures, often 1-of-1 or limited editions; the luxury tier at $500-$5,000+).
- **Condition Obsession:** Collectors grade models from Mint to Near Mint to Excellent to Very Good to Good to Fair to Poor. Condition dramatically affects value.
- **Live Show Culture:** In-person competitions judged on breed accuracy, condition, and presentation. North American Nationals (NAN) is the most prestigious event. "NAN cards" (qualification placings) are valuable provenance.
- **Photo Show Culture:** Online competitions where LSQ (Live Show Quality) photography standards require 5 specific angles: Near-Side, Off-Side, Front/Chest, Hindquarters/Tail, Belly/Maker's Mark.
- **Trust-Based Marketplace:** The hobby runs on reputation. There is no centralized Yelp or eBay feedback system within the hobby — trust is built through word-of-mouth on Facebook groups and forums.
- **Financial Privacy:** Collectors strongly guard what they paid. No one wants other collectors knowing their vault value.
- **Artist Resin Provenance:** For high-end resins, the sculpt pedigree (who sculpted it, edition number, "parentage" for fantasy breeds) is critical to value and identity.

### Key Organizations

| Organization | Role |
|---|---|
| **NAMHSA** (North American Model Horse Shows Association) | Governs live show rules, divisions, and NAN qualifications |
| **ERD** (Equine Resin Directory) | Independent online directory of artist resins — ~3,500+ entries |
| **BreyerHorses.com** | Breyer's official site; primary source for model numbers and releases |

### Current Community Tools (What Hub Competes With)

The hobby currently relies on:
- **Facebook Groups** — Primary marketplace and social hub (fragmented, no search, no provenance)
- **Personal Spreadsheets** — Most collectors track their herd in Excel/Google Sheets
- **eBay** — Secondary marketplace with no hobby-specific features
- **Identify Your Breyer (IYB)** — Reference site for identifying Breyer models (no inventory or social features)
- **Model Horse Sales Pages (MHSP)** — Classified-style listings on personal websites
- **No centralized platform** exists that combines inventory + marketplace + showing + provenance + community

---

## 2. Tech Stack and Architecture

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16 (App Router), React 19, Vanilla CSS |
| **Design Language** | Glassmorphism (backdrop blur, translucent panels, gradient accents) |
| **Backend / Database** | Supabase (PostgreSQL) with strict Row Level Security (RLS) |
| **Auth** | Supabase Auth with PKCE (code exchange), password recovery flows |
| **Storage** | Supabase Storage — private `horse-images` bucket with signed URLs |
| **Email** | Resend (transactional notifications) |
| **Hosting** | Vercel |
| **Data Engineering** | Custom Node.js/Cheerio web scraper with Levenshtein fuzzy-matching |
| **Testing** | Vitest (smoke tests) |

### Codebase Scale (as of March 8, 2026)

| Metric | Count |
|---|---|
| Server Actions | 20 files (~122 KB) |
| Client Components | 49 files (~254 KB) |
| Database Migrations | 22 SQL files (~103 KB) |
| Reference Data | 7,000+ Breyer/Stone releases + 3,500+ Artist Resins |
| Git Commits | 40+ (project started early March 2026) |

### Database Schema (Key Tables)

| Table | Purpose |
|---|---|
| `reference_molds` | Physical sculpt shapes (base catalog) |
| `reference_releases` / `breyer_catalog` | Specific paint jobs/releases (~7,000+ rows) |
| `artist_resins` | ERD-sourced resin catalog (~3,500+ rows) |
| `user_horses` | Core inventory — each horse a collector owns |
| `financial_vault` | Strictly private: purchase price, estimated value, receipt status |
| `horse_images` | LSQ Photo Suite — 5 standard angles + unlimited extras |
| `user_collections` | Personal folders for organizing inventory |
| `user_wishlists` | "Grail hunting" targets linked to reference data |
| `conversations` / `messages` | Native inbox for buyer-seller communication |
| `horse_favorites` / `horse_comments` | Social interactions on public horses |
| `user_ratings` | 5-star marketplace trust ratings |
| `user_follows` | Follow system between collectors |
| `activity_events` | Social activity feed log |
| `notifications` | In-app notification center |
| `horse_timeline` | Hoofprint provenance timeline events |
| `horse_ownership_history` | Chain-of-custody ownership records |
| `horse_transfers` | Transfer code system for model ownership changes |
| `show_records` | Live/photo show placings and NAN qualifications |
| `horse_pedigree` | Artist Resin lineage (sire/dam for fantasy breeds) |
| `photo_shows` / `show_entries` | Virtual photo show competitions |
| `featured_horses` | "Horse of the Week" admin curation |
| `contact_messages` | Public contact form submissions |

---

## 3. What Has Been Built (Shipped Features)

### 3A. The Digital Stable (Private Dashboard)

The authenticated collector's home base:

- **Inventory Management:** Add, edit, and delete horses with multi-step forms, reference database search, and AI vision detection (currently de-emphasized behind a feature flag)
- **LSQ Photo Suite:** 5 dedicated angle slots (Near-Side, Off-Side, Front/Chest, Hindquarters, Belly/Maker's Mark) + unlimited "Extra Details and Flaws" uploads
- **Financial Vault:** Strictly private purchase price, estimated value, and receipt tracking. Never exposed on public routes. Separate database table by design.
- **Personal Collections (Folders):** Named folders (e.g., "Childhood Herd", "Breyer Traditions") with drag-and-drop organization
- **Multi-Attribute Sorting:** Sort by newest, oldest, name (A-Z/Z-A), and condition grade
- **Analytics Widget:** Total Models, Collections, Vault Value, Show Placings — strictly private
- **Insurance CSV Export:** One-click export of all vault data for insurance documentation
- **Real-Time Search:** Sticky glassmorphism search bar with keyboard shortcut (`/`), X-clear, and cross-field filtering

### 3B. Community and Social

- **Show Ring** (`/community`): Global gallery of all public horses with search, scale filtering, finish filtering, trade status filtering, and sort options (newest, most favorited, etc.)
- **Public Profiles** (`/profile/[alias]`): Shareable URLs with bio, follower/following counts, public horse grids, and collection badges
- **Public Passport** (`/community/[id]`): Individual horse detail pages with photo galleries, provenance (show records, pedigree, Hoofprint timeline), and seller contact CTAs
- **Favorites and Comments:** Social interactions on public horses with notification triggers
- **Follow System:** Follow other collectors, see "Following" vs "Global" activity feeds
- **Activity Feed** (`/feed`): Chronological stream with "All" / "Following Only" toggle, pagination
- **Discover Collectors** (`/discover`): Searchable grid of active collectors with public horse counts, rating badges, and member-since dates
- **Horse of the Week:** Admin-curated featured horse with gold-bordered hero card on the Show Ring
- **Notification Center:** Bell icon with unread count, triggered by favorites, comments, follows, ratings, and messages
- **"NEW" Badges:** Pulse-animated badges on horses added in the last 48 hours
- **Trade Status Badges:** Visual "For Sale" and "Open to Offers" indicators

### 3C. Marketplace

- **For-Sale Listings:** Mark horses with trade status, set listing prices, add marketplace notes
- **Wishlist and Grail Hunting:** Search 10,500+ reference database entries to add to a personal wishlist
- **Matchmaker Engine:** Automatically matches wishlist items to other users' for-sale horses, shows match badges with seller ratings
- **Native Inbox** (`/inbox`): Threaded DMs between buyer and seller, linked to specific horses, with email notifications via Resend
- **Transaction Flow:** Mark conversations as complete, then rate the transaction
- **User-to-User Ratings:** 5-star system with one-rating-per-conversation constraint, aggregate badges on profiles
- **"Message Seller" / "View and Contact" CTAs:** Prominent buttons on for-sale listings

### 3D. Provenance and Hoofprint

- **Show Records:** Log live show placings, NAN qualifications, ribbon colors, show names, and dates against individual models
- **Pedigree Cards:** Artist Resin lineage tracking (sire, dam, breed, registry number) displayed on passport pages
- **Hoofprint Timeline:** Every horse gets a permanent digital identity with a visual vertical timeline showing: acquisition, stage changes (Blank to WIP to Completed to For Sale), customizations, show results, sales, transfers, and freeform notes
- **Ownership Chain:** Chain-of-custody display showing all past and current owners
- **Life Stages:** Models can be tracked through their physical lifecycle (Blank Resin to Work in Progress to Completed to For Sale)
- **Transfer Code System:** Generate unique codes to transfer horse ownership between users; the receiving user "claims" the horse and all Hoofprint history follows
- **Photo Stage Tagging:** Tag uploaded photos with the model's stage at time of photography (connects the visual transformation story)

### 3E. Platform Infrastructure

- **Marketing Landing Page** (`/`): SaaS-style storefront with hero section, feature grid, social proof stats, glassmorphism design
- **Mobile Responsive:** 14 CSS fixes across 4 phases for 375px viewports
- **Desktop Responsive:** 10 fixes for header, containers, and grid density at 1440px
- **Auth Flows:** Login, signup, password recovery (PKCE-based), branded auth error pages
- **Admin Console** (`/admin`): Platform metrics, contact message management, photo show admin, "Feature a Horse" tools, community suggestions panel
- **Security Hardening:** 9-point audit (RLS initplan fixes, FK indexes, policy merges, signed URL authorization)
- **Settings Page** (`/settings`): Account management with profile editing, email/password changes, and avatar upload
- **Native Web Sharing:** iOS/Android-native share + clipboard fallback with toast notifications

---

## 4. Current Roadmap Position

### What's Fully Shipped

All of the following have been implemented, committed, and tested:

1. Core Platform (intake, passport, vault, dashboard)
2. Reference Database (7,000+ Breyer/Stone + 3,500+ ERD Artist Resins)
3. Social Layer (favorites, comments, follows, discover, activity feed)
4. Photo Shows (create, enter, vote, deadlines, winners, admin tools)
5. User-to-User Ratings
6. Provenance Tracking (show records, pedigree cards)
7. Hoofprint (timeline, ownership chain, transfer codes, claim flow)
8. Personal Collections
9. LSQ Multi-Angle Photo Suite
10. Marketplace (for-sale listings, contact seller, wishlist matching)
11. Marketing Landing Page
12. Settings and Account Management
13. Security Hardening
14. Mobile and Desktop Responsive Polish

### What's Planned But Not Yet Built

| Feature | Status | Why It Matters |
|---|---|---|
| **Market Price Guide ("Blue Book")** | Shelved | No platform shows aggregated model horse prices. Would be a "first in the hobby." Needs user volume for credible data. |
| **AI Model Identification** | Shelved | Code exists but hidden. Needs training data (10,000+ labeled images) and API budget. |
| **Insurance PDF Report** | Research | One-click professional document for insurance — extremely high demand from serious collectors. |
| **Batch CSV Import** | Research | Removes friction for "super-collectors" with 500+ models migrating from spreadsheets. |
| **eBay Sold Listing Integration** | Research | Would feed data into Market Price Guide. Requires eBay API access + fuzzy matching. |
| **Mobile App (PWA/Native)** | Research | Camera integration for show photography, offline access, push notifications. |
| **Live Show Integration** | Research | Import official NAMHSA results, NAN tracker, show calendars. Political prerequisite: show organizer buy-in. |
| **Premium/Paid Tier** | Shelved | Monetization through genuinely premium features. "Free forever" is a core brand promise — needs 1,000+ users first. |

### 4B. Complete Feature Catalog (From Community Research)

The following is the full inventory of researched, scoped features organized by **who they serve**. Each was evaluated for Impact, Effort, and Uniqueness against the hobby landscape. Source: [feature_wishlist_report.md](file:///c:/Project%20Equispace/model-horse-hub/.agents/docs/feature_wishlist_report.md)

#### The Art Studio (Artist Service Management)

| ID | Feature | Impact | Effort | Uniqueness | Description |
|---|---|---|---|---|---|
| A1 | **Commission Tracker** | High | High | Novel | Public-facing commission status bar ("3/5 slots open"), transparent numbered queue, status toggles (Open/Closed/Waitlist). Artists currently manage this through Google Forms and Instagram DMs — no purpose-built tool exists. |
| A2 | **WIP Photo Portal** | High | Med | Novel | Private progress timeline where artists upload "making of" photos. When commission completes and horse transfers via Hoofprint, WIP photos **automatically populate the horse's provenance timeline**. The creation story becomes permanent. |
| A3 | **Artist Portfolio Page** | Med | Low | Differentiator | Enhanced profile tab showing completed commissions (pulled from Hoofprint transfers), commission status bar, client reviews, specialties and mediums. Consolidates what artists currently scatter across Instagram/Facebook/personal sites. |

#### Groups and Regional Community

| ID | Feature | Impact | Effort | Uniqueness | Description |
|---|---|---|---|---|---|
| G1 | **Regional Location Tags** | Med | Low | Differentiator | Add `region` dropdown to user profiles (Northeast, Southeast, Midwest, etc.), region filter on Discover page, region badges on profile cards. Single column + filter UI. |
| G2 | **Groups (Clubs and Interest Groups)** | High | High | Novel | User-created groups with feeds, member directories, roles (Admin/Judge/Member). Groups can host their own virtual shows within MHH. Members share horses from their stables into group feeds. Replaces need for separate Facebook Groups. |
| G3 | **Event Calendar** | Med | Med | Differentiator | Community calendar showing live shows, virtual photo shows, swap meets, BreyerFest, artist studio openings. RSVP, reminders, linked to groups. |

#### Show and Competition Features

| ID | Feature | Impact | Effort | Uniqueness | Description |
|---|---|---|---|---|---|
| S1 | **NAN Qualification Tracker** | High | Med | Novel | Digital tracking of paper NAN cards (green=breed, yellow=color, pink=performance). Dashboard widget showing qualification status per horse. When models transfer via Hoofprint, NAN cards transfer digitally — no physical mailing needed. |
| S2 | **Show String Planner** | Med | Med | Novel | Drag-and-drop builder: select a show, drag models into class slots, detect conflicts (same model in overlapping classes), print packing lists and entry forms. After the show, log results that feed into NAN tracker. |
| S3 | **Advanced Photo Show System** | Med | Med | Differentiator | Multi-class entries per show, division structure (Breed/Color/Performance/Workmanship), judge critiques with text feedback, NAN-sanctioning flag for shows, seasonal championships aggregating monthly results. |

#### Marketplace and Commerce

| ID | Feature | Impact | Effort | Uniqueness | Description |
|---|---|---|---|---|---|
| M1 | **Advanced Marketplace Filters** | Med | Low | Expected | Price range filters, scale/manufacturer filters, seller region filter ("local pickup"), "Make an Offer" button. |
| M2 | **Virtual Swap Meet Events** | Med | Med | Novel | Timed, event-based sales windows. Admin or group leader creates an event; sellers list during the window (e.g., Saturday 10am-4pm); live feed of new listings creates urgency and excitement — the digital equivalent of walking into a show room. |
| M3 | **Tack and Accessories Marketplace** | Med | Med | Differentiator | Expand marketplace beyond horses: tack (saddles, bridles), diorama props, show supplies, blank bodies. Each category has relevant fields (scale, discipline, materials). |

#### Analytics and Data Tools

| ID | Feature | Impact | Effort | Uniqueness | Description |
|---|---|---|---|---|---|
| D1 | **Collection Analytics Dashboard** | Med | Med | Differentiator | Charts: collection growth over time, value trends, breakdown by manufacturer/scale/finish, "your rarest model" highlight, comparison to community averages. |
| D2 | **Insurance PDF Report Generator** | High | Med | Novel | One-click PDF: cover page, per-model pages with photos/values/condition, summary totals, date-stamped and watermarked. Uses data already in Financial Vault. Insurance companies love standardized documentation. |
| D3 | **Batch Import Tool (CSV)** | High | Med | Differentiator | Template CSV upload with fuzzy-matching against 10,500+ reference entries. Preview matches before confirming. Removes the #1 onboarding barrier for large collectors. |

#### Community and Social Enhancements

| ID | Feature | Impact | Effort | Uniqueness | Description |
|---|---|---|---|---|---|
| C1 | **Enhanced Direct Messages** | Med | Low | Expected | Share horse passports in messages, "Interested in this horse" quick message, read receipts, block/mute user. |
| C2 | **Discussion Boards (Forum-lite)** | Med | Med | Differentiator | Lightweight channels (General, For Sale/Trade, Show Talk, Customs, Help/ID). Users can embed passport cards in posts. Not trying to replace Model Horse Blab — just an integrated space. |
| C3 | **"Help Me ID This Model"** | Med | Low | Differentiator | Upload mystery model photos, community suggests matches from reference database, best answer gets upvoted, one-click add to stable with reference pre-filled. Gamifies community expertise. |
| C4 | **Achievement Badges** | Low | Low | Differentiator | Profile badges: Stable Starter, Photographer (5 LSQ photos), Show Champion, Trusted Trader (5+ ratings), Collector (10+ models), Hoarder (50+ models), Patron of the Arts (3+ commissions), Provenance Pro (5+ Hoofprints), Founding Member. |
| C5 | **"Horses I've Seen IRL" Journal** | Low | Low | Novel | Personal log for BreyerFest attendees, farm visits, and live show experiences. Link to models in stable that represent real horses seen. Niche but delightful. |

#### Platform Infrastructure

| ID | Feature | Impact | Effort | Uniqueness | Description |
|---|---|---|---|---|---|
| P1 | **User Avatar Upload** | Med | Low | Expected | Supabase `avatars` bucket, upload in settings, initials fallback already working. |
| P2 | **Enhanced Data Export** | Med | Low | Expected | Full-field CSV including vault, references, hoofprint status. Existing `/api/export` route to be expanded. |
| P3 | **PWA (Progressive Web App)** | Med | Low | Differentiator | Manifest + service worker: install on homescreen, offline access to own collection, push notifications, camera shortcut for quick photo capture. |
| P4 | **Weekly Notification Digest (Email)** | Med | Med | Expected | Aggregated weekly email: favorites received, commission status updates, show results, wishlist matches. |

### Priority Tiers (Build Order)

**Tier 1 — Build These Next (High Impact, Achievable Now):**

| # | Feature | Why Now |
|---|---|---|
| A1 | Commission Tracker | Platform-defining — nothing else does this |
| A2 | WIP Photo Portal | Ties into Hoofprint naturally |
| D3 | Batch Import (CSV) | Removes #1 onboarding barrier |
| G1 | Regional Tags | Single column + filter UI |
| D2 | Insurance PDF | Uses data already in vault |

**Tier 2 — Build When User Base Grows (Needs Volume):**

| # | Feature | Volume Trigger |
|---|---|---|
| G2 | Groups | 20+ active users |
| S1 | NAN Tracker | 10+ users who show |
| S2 | Show String Planner | After NAN Tracker |
| M2 | Virtual Swap Meets | 15+ active sellers |
| C2 | Discussion Boards | 30+ active users |

**Tier 3 — Polish and Delight:**
A3 (Artist Portfolio), C3 (Help ID), C4 (Badges), D1 (Analytics Charts), M1 (Marketplace Filters), P3 (PWA)

**Recommended Timeline:**
- **Now:** A1 (Commission Tracker) + G1 (Regional Tags) + D3 (Batch Import)
- **Month 2:** A2 (WIP Portal) + D2 (Insurance PDF) + C4 (Badges)
- **Month 3:** G2 (Groups) + S1 (NAN Tracker)
- **Month 4:** M2 (Swap Meets) + S2 (Show String Planner)
- **Ongoing:** Community feedback drives picks from Tier 3

---

## 5. Strategic Analysis — Through the Hobby Lens

### 5A. The Platform Thesis: From Tool to Operating System

The model horse community is a **$200M+ hobby** split across 8 disconnected tools. Source: [platform_architecture_deep_dive.md](file:///c:/Project%20Equispace/model-horse-hub/.agents/docs/platform_architecture_deep_dive.md)

| What Collectors Do | Current Tool | Problem |
|---|---|---|
| Track collection | Spreadsheets, Etsy trackers | No social, no reference data |
| Sell/trade | Facebook Groups, MHSP, eBay | No provenance, no trust signal |
| Show competitively | Paper NAN cards, binders | Lost cards, no digital record |
| Commission artists | Instagram DMs, Google Forms | No tracking, lost WIP photos |
| Find community | Facebook, Discord, Blab | Fragmented, no integration |
| Document provenance | Word docs, memory | No chain of custody |
| Insure collection | Manual photo + Word doc | Tedious, never updated |
| Plan for shows | Spreadsheets, paper lists | No conflict detection, no integration |

**MHH already solves #1, #2, and #6.** The architecture roadmap connects the remaining five into a unified platform through three major systems: the Creator Economy, the Community Fabric, and the Competition Engine.

#### The Growth Flywheel

Every planned feature feeds every other feature — this is what separates a platform from a tool:

```
Artists join --> Artists bring clients --> Clients become collectors
    |                                           |
Collectors catalog horses --> Horses get Hoofprints --> Hoofprints need provenance
    |                                                       |
Provenance includes WIP photos --> WIP photos come from Art Studio
    |                                                       |
Collectors join groups --> Groups host shows --> Shows create NAN cards
    |                                               |
NAN cards live on passports --> Passports drive marketplace trust
    |
Trust drives more transactions --> Transactions create more Hoofprints
```

### 5B. What the Platform Does Exceptionally Well

1. **The Reference Database is a "Moat":** 10,500+ combined releases represent more structured data than any single hobby site. This is the primary on-ramp for user trust. When collectors Google "Breyer #700195" and it's in the Hub, they start to see the platform as authoritative.

2. **Hoofprint is Genuinely Novel:** No tool in the hobby tracks a model's lifecycle across owners with a visual timeline. The transfer code system is the kind of feature that creates "show it to a friend" virality at live shows.

3. **Financial Privacy is a First-Class Concern:** The physical separation of `financial_vault` into its own table (never joined on public queries) is architecturally sound and exactly matches collector psychology.

4. **LSQ Photo Suite Solves a Real Problem:** Standardizing the 5-angle system digitally (Near-Side, Off-Side, Front, Hindquarters, Belly/Marker) maps perfectly to Photo Show requirements. No other platform enforces this.

5. **The Matchmaker is a Closed Loop:** Wishlist to Match to Contact to Negotiate to Rate to Transfer — this keeps the entire transaction lifecycle on-platform instead of bouncing to Facebook.

### 5C. Gaps and Opportunities (From a Collector's Perspective)

#### GAP 1: The "Super-Collector" On-Ramp

Collectors with 200-2,000+ models (this is extremely common in the hobby) face a massive friction wall: adding each horse individually. Without **Batch CSV Import**, the platform loses the most engaged, highest-value users before they even start.

> *"I have 800 Breyers in a spreadsheet. I'm not entering them one by one."*

#### GAP 2: The Artist Economy Is Unserved (System 1: The Creator Economy)

Model horse artists (painters, customizers, tack makers) are the hobby's content creators and influencers. They drive engagement and spending. The architecture deep dive designs a full **Creator Economy** system:

- **Artist Identity:** A parallel role to "collector" — users "enable their studio" rather than creating a separate account. Studio name, specialties (Custom Paint, Repaint, Tack, Sculpting, Etching, Hair), mediums (Acrylics, Pastels, Oils, Airbrush), scales, pricing ranges, and terms.
- **Commission Lifecycle:** A 9-state machine: Requested -> Accepted -> In Progress -> Review -> Revision -> Completed -> Delivered (with Declined and Cancelled exits). Full database schema designed with slot management, deposit tracking, and estimated timelines.
- **The WIP-to-Hoofprint Pipeline (The Single Most Compelling Feature):** When a commission is marked "delivered", all WIP photos with client visibility automatically become `horse_timeline` entries. The artist is recorded as creator. If the artist owns the horse entry, a Hoofprint transfer auto-initiates to the client. The entire creation timeline (11 photos, 4 milestones) flows into the horse's permanent passport. **No other tool in any hobby connects the creator's process to the object's permanent identity this seamlessly.**
- **Artist Reputation (Multi-Dimensional):** Not a single number — calculated from real data: star rating (from commission reviews), total commissions completed, average turnaround, on-time delivery rate, revision rate. All derived from actual `commissions` and `commission_updates` tables.
- **Artist Directory** (`/artists`): Searchable by specialty, medium, scale, status, region, and rating.

#### GAP 3: No Price Discovery

The hobby has no "Blue Book" — collectors currently estimate value by:
- Searching eBay "completed listings"
- Asking in Facebook groups
- Gut feel from show experience

A **Market Price Guide** aggregating listing prices, transfer prices, and opt-in vault data would be the first credible pricing resource in the hobby. This is a "destination feature" that would drive traffic and SEO.

#### GAP 4: The Show Ecosystem Is Still Analog (System 3: The Competition Engine)

The architecture deep dive designs a full **Competition Engine**:

- **NAN Digital Cards:** Color-coded (green=breed, yellow=gender/color, pink=performance) qualification records linked to specific show results. Dashboard widget showing "7 horses qualified across 12 divisions" with per-horse qualification status.
- **Show Records:** Enhanced schema with show type classification (live_namhsa, live_regional, photo_mepsa, photo_mhh), division structure, NAN card type tracking, judge critiques, and a three-tier verification system (self-reported -> host-verified -> MHH-auto-verified).
- **Show String Planner:** Database-backed planning tool: select a show, assign horses to classes, detect time/class conflicts ("Prairie Rose is in Western Pleasure at 10:00 AM and Trail at 10:15 AM — overlap!"), generate packing lists. After the show, the string becomes a results entry form.
- **Auto-Transfer on Hoofprint:** When a horse transfers, all show records stay with the horse. NAN cards become digital — no physical mailing needed. This is the **most impactful digitization** possible for competitive hobbyists.

However, this requires **political buy-in** from NAMHSA and show organizers — it's high reward but high friction.

#### GAP 5: Regional Community Infrastructure (System 2: The Community Fabric)

The architecture deep dive designs **Groups as Containers** — not a separate app, but a lens that scopes existing features:

- **Region Taxonomy:** Standard enum (us_northeast, us_southeast, us_midwest, us_southwest, us_mountain, us_pacific, canada, europe, australia_nz, international). Shows up on Discover, Marketplace ("Local Pickup"), Groups, Events, Artist Directory, and Profiles.
- **Groups:** Types include regional_club, breed_interest, scale_interest, show_circuit, artist_collective. Visibility levels: public, restricted (admin approval), private (invite-only). Groups can host their own photo shows by scoping the existing show system.
- **Events:** Typed calendar (live_show, photo_show, swap_meet, meetup, breyerfest, studio_opening, auction, workshop). Events link to shows, groups, and swap meets. RSVP with going/interested/not_going.
- **RLS Strategy:** Membership-check pattern using `is_group_member()` and `is_group_admin()` SQL functions.

This is a **low-effort, high-engagement** gap for the foundation (regional tags), but **high-effort** for the full groups system.

#### GAP 6: Insurance and Professional Documentation

Serious collectors insure their collections (high-end herds can be worth $50,000-$200,000+). The existing CSV export is functional but not professional. A **formatted PDF insurance report** with photos, valuations, and date stamps would be a marquee feature for the high-value collector segment.

#### GAP 7: Marketplace Depth

The current marketplace covers horses only. The hobby has a significant secondary market for **tack** (saddles, bridles, halters), **diorama props**, **show supplies**, and **blank bodies**. Virtual Swap Meet events (timed sales windows with urgency mechanics) would recreate the in-person show table experience digitally.

#### GAP 8: Community Knowledge and Engagement Loops

Several features would drive engagement without requiring massive engineering:
- **"Help Me ID This Model"** — Community-powered identification that gamifies expertise and demonstrates the reference database
- **Discussion Boards** — Lightweight forum channels integrated with passports (embed a horse card in a post)
- **Achievement Badges** — Gamification layer (Founding Member, Show Champion, Trusted Trader, Provenance Pro) that rewards platform behavior
- **"Horses I've Seen IRL" Journal** — Personal log for BreyerFest, farm visits, and show experiences

### 5D. Competitive Positioning Summary

| Dimension | Model Horse Hub | Facebook Groups | eBay | Personal Spreadsheets |
|---|---|---|---|---|
| **Inventory Management** | Full | None | None | Manual |
| **Reference Database** | 10,500+ | None | None | None |
| **Photo Standards (LSQ)** | Enforced | None | None | None |
| **Financial Privacy** | Vault | Public | Public | Private |
| **Provenance Tracking** | Hoofprint | None | None | None |
| **Marketplace** | Wishlist + Match | Posts | Auctions | None |
| **Social Features** | Full | Full | Minimal | None |
| **Trust / Ratings** | Per-transaction | None | Seller rating | None |
| **Show Management** | Virtual only | None | None | None |
| **Artist Tools** | Not yet | DMs | None | None |
| **Price Discovery** | Not yet | Informal | Sold listings | None |
| **Mobile UX** | Responsive web | Native app | Native app | Desktop-only |

### 5E. Implementation Roadmap (From Architecture Deep Dive)

The deep dive scopes 15 new database tables across 4 phases, growing the database from 28 to 43 tables:

| Phase | Focus | Estimated Effort | New Tables |
|---|---|---|---|
| **Phase 0: Foundation** | Regional tags, batch CSV import, insurance PDF, unified activity table | ~1 week | 1 |
| **Phase 1: Art Studio** | Artist profiles, commissions, WIP updates, portfolio, artist directory | ~10-12 days | 3 |
| **Phase 2: Groups and Events** | Groups, memberships, group posts/replies, events, RSVPs | ~9-10 days | 5 |
| **Phase 3: Competition Engine** | Enhanced show records, NAN tracking, show strings, judge critiques | ~9-10 days | 4 |
| **Phase 4: Platform Maturity** | Badges, analytics charts, marketplace filters, swap meets, forums, PWA, email digests | Ongoing | 2 |

### 5F. Risk Analysis

From the architecture deep dive, five key risks have been identified:

| Risk | Threat | Mitigation |
|---|---|---|
| **Feature Bloat** | Building too much too fast — nothing works well | Each phase is a commit boundary. Ship Phase 0, get feedback, then start Phase 1. Never start a phase before the previous one is stable. |
| **Artist Adoption** | Artists don't join — commission system is empty | The founder is both a collector and customizer. Be the first artist. Invite 3-5 artist friends specifically. System needs only ~5 active artists to demonstrate value. |
| **Community Governance** | Groups lead to drama, abuse, content moderation | Start with "restricted" visibility as default. Group owners must approve members. Add report/block at global level. Admin can suspend groups. |
| **Facebook Competition** | "Why would I leave my Facebook Group?" | Don't ask them to leave — ask them to USE. Killer pitch: "Your Facebook Group can't automatically link show results to horse passports, track NAN cards, or connect WIP photos to provenance. MHH can." The integration IS the moat. |
| **NAN Data Integrity** | Users self-report fake NAN qualifications | Three-tier verification: (1) Self-reported (unverified badge), (2) Host-verified (verified badge), (3) MHH-generated (auto-verified from MHH-hosted shows). Even unverified digital is better than paper. |

---

## 6. Research Directions for a Research Agent

The following are specific research questions and expansion vectors, organized by strategic theme. These are designed to be fed into a research agent for deeper analysis.

### Theme A: "The Super-Collector Pipeline"

**Research Questions:**
1. What CSV/spreadsheet formats do model horse collectors actually use? Are there common templates shared in hobby forums?
2. How do other collecting platforms (Discogs for vinyl, TCGPlayer for cards, MyFigureCollection for anime figures) handle bulk import for large collections?
3. What is the average collection size across different collector tiers (casual: 10-50, enthusiast: 50-200, serious: 200-1000, "super": 1000+)?
4. What data fields do spreadsheet collectors track that Hub doesn't currently support?
5. Is there an opportunity for a "migration assistant" that maps columns from common spreadsheet formats to Hub fields automatically?

### Theme B: "The Artist Economy"

**Research Questions:**
1. How do model horse artists currently manage their commission queues? What tools do they use (Trello, Google Sheets, Instagram DMs)?
2. What are the average wait times for commissions from popular artists? How does demand outstrip supply?
3. What does a commission lifecycle look like (inquiry to quote to deposit to prep to paint to finish to ship)?
4. Are there successful "Patreon-style" models in the hobby (e.g., artists offering subscription slots)?
5. What do tack makers, performance set designers, and other non-painting artists need that's different from painters?
6. How do other creative marketplaces (Etsy, Fiverr, Sketchmob) handle commission management? What works and what frustrates creators?
7. Could WIP photo sharing become a social content stream (like Instagram Stories for customization progress)?

### Theme C: "The Blue Book Problem" (Price Discovery)

**Research Questions:**
1. How do Discogs, TCGPlayer, Bricklink (LEGO), and other collecting platforms aggregate and display pricing data?
2. What minimum number of data points per item makes a price guide "credible" in the eyes of collectors?
3. How does the hobby currently handle price disputes? Are there "accepted ranges" for common models?
4. Would collectors opt in to anonymously contributing vault data for the greater good? What privacy guarantees would they need?
5. Can eBay "sold listings" for Breyer models be reliably matched to Hub reference data using model numbers?
6. What is the legal landscape for scraping or API-accessing sold listing data from eBay?
7. How would pricing work for OOAK (one-of-a-kind) customs and artist resins where no two are alike?

### Theme D: "The Show Ecosystem Goes Digital"

**Research Questions:**
1. What is the current NAN qualification process? How are cards tracked, submitted, and verified?
2. What show management software (if any) do NAMHSA-affiliated show holders currently use?
3. Are there show holders who would be early adopters of a digital entry/results system?
4. What are the NAMHSA divisions and classes? How complex is the class system?
5. How do other hobby show communities (dog shows, RC racing, cosplay) manage digital entry and results?
6. Could Hub become an "official results repository" if it got NAMHSA endorsement?
7. What would a "Show String Planner" need to include (model eligibility rules, class conflict detection, packing list generation)?

### Theme E: "Regional Community and Events"

**Research Questions:**
1. How are model horse hobby regions defined? Is there a standard map (e.g., NAMHSA regions)?
2. How many active local clubs/groups exist, and what are their needs?
3. What does a typical model horse show calendar look like? How many shows per region per year?
4. Would a "Collector Map" (pin-based visualization of nearby collectors) drive signups, or would it create privacy concerns?
5. How do other collector communities handle regional discovery (e.g., Meetup, Facebook Groups, Discord servers)?

### Theme F: "The Insurance and Documentation Play"

**Research Questions:**
1. What do insurance companies actually require for model horse collections? Photo standards? Appraisal formats?
2. Are there professional model horse appraisers? What format do their reports follow?
3. How do other collectible platforms (wine inventory apps, art collection management) generate insurance documentation?
4. Could Hub partner with an insurance company (e.g., Collectibles Insurance Services / CIS) for co-branded reports?
5. What is the average insured value of a serious model horse collection?

### Theme G: "Mobile and At-Show Experience"

**Research Questions:**
1. What percentage of hobby activity happens on mobile vs. desktop?
2. What specific actions do collectors need to do "at the show table" (quick photo capture, check wishlist, look up a model)?
3. Would a PWA (Progressive Web App) with offline access be sufficient, or do collectors truly need a native app?
4. How do other event-centric hobbies (Pokemon GO, bird watching, wine tasting) handle mobile "in the field" experiences?

### Theme H: "The Fantasy Breed Registry"

**Research Questions:**
1. How does the fantasy breed system work in the resin community? What makes it different from real-world breed registries?
2. Are there existing fantasy breed standards that are widely recognized? Who maintains them?
3. What data would a breed registry need (sire/dam, breed standard, conformation notes, bloodline tracking)?
4. How many active fantasy breed creators/breeders are there in the hobby?
5. Would a digital registry drive resin sales (provenance = value)?

### Theme I: "The Engagement Layer" (Gamification, Forums, Social Content)

**Research Questions:**
1. How do other collecting platforms (Discogs, Goodreads, Untappd) use achievement badges to drive behavior? What badge structures work best?
2. Is there demand for a hobby-integrated discussion forum, or would it fragment attention away from existing communities (Model Horse Blab, Reddit)?
3. Would "Help Me ID This Model" be more effective as a community Q&A feature or as an AI-powered tool? What's the user expectation?
4. Could WIP photo sharing become a TikTok/Instagram Reel-style social content stream within the platform?
5. What engagement metrics matter most for a niche hobby platform — daily active users, weekly return rate, or content creation rate?
6. How do virtual swap meets work in other collector communities (e.g., sneaker drops, trading card releases)? What creates the right level of urgency?

### Theme J: "Platform Risks and Adoption Strategy"

**Research Questions:**
1. What is the minimum number of active artists needed for a commission marketplace to feel "alive" rather than empty?
2. How have other niche platforms (Ravelry for knitting, Discogs for vinyl) successfully migrated users away from Facebook Groups?
3. What content moderation tools are essential at launch for user-created groups — and what can wait?
4. How do platforms handle the transition from "invite-only beta" to "public launch" without losing community quality?
5. What is the risk of NAN qualification fraud, and how do other hobby communities handle self-reported competitive results?

---

## 7. Summary — Where to Focus

### If the goal is user acquisition (getting more collectors to sign up):
- **Batch CSV Import** (removes the #1 friction point for serious collectors)
- **Regional Tags** (unlocks "find collectors near me" — low effort, high engagement)
- **Market Price Guide** (destination SEO feature — collectors searching "what is my Breyer worth?" would land here)
- **"Help Me ID" feature** (drives traffic from "what is this Breyer worth" searches; demonstrates reference database authority)

### If the goal is user retention (keeping existing users engaged daily):
- **Art Studio / Commission Tracker** (serves the artist community, who are the most active users)
- **NAN Qualification Tracker** (tied to Hoofprint — gives show-active collectors a reason to log in weekly)
- **Collection Analytics Charts** (collection growth over time, manufacturer distribution — "admire" verb)
- **Achievement Badges** (gamification loop rewarding platform behaviors)
- **Virtual Swap Meets** (timed sales events create urgency and repeat visits)

### If the goal is revenue / monetization positioning:
- **Insurance PDF Reports** (high-value feature for the premium tier)
- **Market Price Guide** (could be a premium analytics feature)
- **Verified Artist Badges** (artists would pay for trust signals)
- **Commission platform fee** (long-term: small percentage on tracked commissions)

### If the goal is competitive moat (things no other hobby platform can replicate):
- **Hoofprint adoption** (already built — focus on getting users to actually transfer models with codes)
- **WIP-to-Hoofprint Pipeline** (the single feature no competitor can replicate — connects the creator's process to the object's permanent identity)
- **Reference Database expansion** (add more manufacturers, more detailed release data, photos)
- **NAMHSA Partnership** (official results integration would be an insurmountable competitive advantage)
- **The Flywheel** (once artists, collectors, groups, and shows are interconnected, switching costs become prohibitive)

### The Endgame Vision

From the architecture deep dive — what success looks like in 18 months:

> Sarah joins MHH and imports her 200-model collection via CSV in 10 minutes. She joins the NW Breyer Club group. The group is hosting a Spring Show — she uses the show string planner to enter 8 models across 15 classes. She earns 3 NAN green cards, which auto-appear on her horses' passports. She commissions a custom from @AmandaMount (whose studio shows "2/5 slots open"). Over 6 weeks, she watches Amanda's WIP photos appear in her private portal. When the custom is complete, it transfers via Hoofprint — and the entire creation timeline (11 photos, 4 milestones) flows into the horse's permanent passport. She lists her new custom in the group's Virtual Swap Meet event. Another collector in the Midwest sees it, checks the Hoofprint (verified provenance, WIP history, artist rating 4.9 stars), and buys with confidence. The model transfers to the new owner — taking its show records, NAN qualifications, and creation story with it.

**That's not a collection manager. That's the operating system for the hobby.**

---

> **This report is designed to be ingested by a research agent.** Each theme in Section 6 contains specific, answerable research questions that can drive focused investigation. The strategic recommendations in Section 7 provide a decision framework based on whether the priority is acquisition, retention, revenue, or moat-building.
>
> **Key reference documents for deeper technical detail:**
> - [feature_wishlist_report.md](file:///c:/Project%20Equispace/model-horse-hub/.agents/docs/feature_wishlist_report.md) — Full feature proposals with database schemas, mockups, and priority matrix
> - [platform_architecture_deep_dive.md](file:///c:/Project%20Equispace/model-horse-hub/.agents/docs/platform_architecture_deep_dive.md) — Complete system design with ER diagrams, state machines, implementation phases, and risk analysis
