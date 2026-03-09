# 🐴 Model Horse Hub — Community Feature Wishlist Report

> **Date:** March 8, 2026
> **Research Based On:** Community forums (Model Horse Blab, Reddit r/BreyerHorses), NAMHSA/MEPSA organizations, artist community pain points, existing competitor tools, and collector behavior analysis.
> **Already Shipped:** Collection management, 10,500+ reference DB, social layer, photo shows, user ratings, Hoofprint™ provenance, collections, LSQ photos, marketplace, landing page.

---

## How to Read This Report

Features are organized by **who they serve** (Collector, Artist, Community, Platform) and rated on:

| | Impact | Effort | Uniqueness |
|---|---|---|---|
| 🔴 | **High** — solves a real pain point | **High** — new tables, new pages, complex logic | **Novel** — nobody does this |
| 🟡 | **Medium** — nice to have, engagement boost | **Medium** — moderate effort | **Differentiator** — some competitors do it |
| 🟢 | **Lower** — polish/completeness | **Low** — CSS + simple queries | **Expected** — table stakes |

---

# ═══════════════════════════════════════
# 🎨 THE ART STUDIO (Artist Service Management)
# ═══════════════════════════════════════

> Your idea. This is the **single biggest untapped niche** in the model horse world. Artists currently manage commissions through Google Forms, Instagram DMs, and spreadsheets. There is NO purpose-built tool.

## Feature A1: Commission Tracker (Public Queue)

**Impact:** 🔴 High | **Effort:** 🔴 High | **Uniqueness:** 🔴 Novel

**The Problem:**
Artists are overwhelmed with DMs asking "are your commisions open?" — they answer the same question 50 times a week. Collectors have no way to see an artist's availability without DMing them.

**The Solution:**
An artist can set up a public-facing commission status on their profile:

```
🎨 Amanda Mount — Art Studio
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Status: ✅ Open (3 of 5 slots filled)
▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░ 60%
Current wait time: ~6-8 weeks
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Queue:
 1. ████████ — Traditional Custom — In Progress
 2. ████████ — SM Repaint — Waiting
 3. ████████ — Trad Custom — Waiting
 ◻ Slot 4 — Available
 ◻ Slot 5 — Available
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[📩 Request a Slot]
```

**Database:**
```sql
CREATE TABLE artist_commissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id     UUID NOT NULL REFERENCES auth.users(id),
  client_id     UUID REFERENCES auth.users(id),
  horse_id      UUID REFERENCES user_horses(id),
  status        TEXT CHECK (status IN ('waiting', 'in_progress', 'completed', 'cancelled')),
  slot_number   INTEGER,
  description   TEXT,
  estimated_completion DATE,
  price_agreed  DECIMAL(10,2),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE artist_studio_settings (
  user_id        UUID PRIMARY KEY REFERENCES auth.users(id),
  is_artist      BOOLEAN DEFAULT false,
  studio_name    TEXT,
  max_slots      INTEGER DEFAULT 5,
  status         TEXT CHECK (status IN ('open', 'waitlist', 'closed')),
  turnaround_min INTEGER, -- days
  turnaround_max INTEGER,
  commission_types TEXT[], -- e.g. ['Custom Paint', 'Repaint', 'Tack', 'Sculpting']
  price_range_min DECIMAL(10,2),
  price_range_max DECIMAL(10,2),
  terms_text     TEXT,
  updated_at     TIMESTAMPTZ DEFAULT now()
);
```

**Why This Wins:**
- Reduces "are you open?" spam by 90%
- Gives collectors confidence to wait vs. look elsewhere
- Creates a **reason for artists to create profiles** on the platform
- Nobody else does this

---

## Feature A2: WIP (Work-in-Progress) Photo Portal

**Impact:** 🔴 High | **Effort:** 🟡 Medium | **Uniqueness:** 🔴 Novel

**The Problem:**
Artists send WIP photos via DM, email, or text. These are often lost. When the model eventually gets its Hoofprint™ passport, none of the "making of" story is captured.

**The Solution:**
Artists upload WIP photos to a private portal tied to the commission. The client sees a timeline:

```
🎨 Commission: "Midnight Dream" — Custom Traditional
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📸 Progress Timeline:
  Mar 1  — Body prep complete [3 photos]
  Mar 8  — Base coat applied [2 photos]
  Mar 15 — Detail work started [4 photos]
  Mar 22 — Final clear coat [2 photos]
  ✅ Mar 25 — COMPLETE! [5 final photos]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[💬 Leave feedback for artist]
```

**The Magic:** When the commission is marked complete and the horse is transferred via Hoofprint™, the WIP photos **automatically become part of that horse's provenance timeline** — "Created by @AmandaMount, March 2026" with the build photos as a gallery.

**Why This Wins:**
- Solves the "where did my WIP photos go?" problem
- Creates the most premium provenance story in the hobby
- Connects the Art Studio to Hoofprint™ seamlessly
- No competitor does this

---

## Feature A3: Artist Portfolio Page

**Impact:** 🟡 Medium | **Effort:** 🟢 Low | **Uniqueness:** 🟡 Differentiator

**The Solution:**
Artists who enable "Art Studio" get an enhanced profile tab showing:
- Gallery of completed commissions (pulled from Hoofprint™ transfers where they're the creator)
- Commission status bar
- Reviews from commission clients
- Specialties & mediums

**Why it matters:** Artists currently build portfolios on Instagram/Facebook/personal sites. Consolidating this into MHH makes the platform stickier for the artist community.

---

# ═══════════════════════════════════════
# 🌍 GROUPS & REGIONS
# ═══════════════════════════════════════

> Your idea. The model horse hobby is deeply regional — clubs meet locally, shows happen regionally, and collectors want to find others nearby.

## Feature G1: Regional Location Tags

**Impact:** 🟡 Medium | **Effort:** 🟢 Low | **Uniqueness:** 🟡 Differentiator

**The Problem:**
Collectors want to find nearby collectors for in-person sales, show travel buddies, and local meetups. Currently, @Black Fox Farm says "Midwest" in their bio — but there's no way to search by region.

**The Solution:**
- Add a `region` field to user profiles (dropdown: Northeast, Southeast, Midwest, Southwest, West Coast, Pacific NW, Mountain, International, etc.)
- Add a region filter to the Discover page
- Show region badges on profile cards

**Database change:** `ALTER TABLE users ADD COLUMN region TEXT;`

**Why it matters:** Model horse shows are regional. Finding other collectors in your area is the #1 way people grow in the hobby.

---

## Feature G2: Groups (Clubs & Interest Groups)

**Impact:** 🔴 High | **Effort:** 🔴 High | **Uniqueness:** 🔴 Novel

**The Problem:**
Model horse clubs currently operate through Facebook Groups, Discord servers, and email lists — all disconnected from where collectors manage their collections.

**The Solution:**
User-created groups with:
- Group feed (text posts, photo shares from members)
- Group shows (only members can enter)
- Shared resources/files
- Member directory with roles (Admin, Judge, Member)

```
📋 NorthWest Breyer Horse Club
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌲 Region: Pacific Northwest
👥 42 members
📸 Next Show: Spring Stampede (Mar 22)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Recent Activity:
  @PNWcollector shared "New OF arrival!" [photo]
  @JudgeSarah posted "Spring Stampede class list is up!"
  @TackMaker_Kelly shared "New English set" [photo]
```

**Database:**
```sql
CREATE TABLE groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  region      TEXT,
  group_type  TEXT CHECK (group_type IN ('club', 'interest', 'regional', 'show_team')),
  is_public   BOOLEAN DEFAULT true,
  created_by  UUID NOT NULL REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE group_members (
  group_id  UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role      TEXT CHECK (role IN ('admin', 'moderator', 'member')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE group_posts (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id  UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES auth.users(id),
  content   TEXT NOT NULL,
  horse_id  UUID REFERENCES user_horses(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Why This Wins:**
- Replaces the need for a Facebook Group
- Groups can host their own virtual shows within MHH
- Members can share horses directly from their stables
- Nothing else in the hobby combines groups + collection management

---

## Feature G3: Event Calendar

**Impact:** 🟡 Medium | **Effort:** 🟡 Medium | **Uniqueness:** 🟡 Differentiator

**The Solution:**
A community calendar showing:
- Live shows (NAMHSA-sanctioned, regional)
- Virtual photo shows (including MHH's own shows)
- Swap meets
- BreyerFest / major events
- Artist studio openings (commission slot openings)

Users can RSVP, set reminders, and link events to groups.

---

# ═══════════════════════════════════════
# 🏆 SHOW & COMPETITION FEATURES
# ═══════════════════════════════════════

## Feature S1: NAN Qualification Tracker

**Impact:** 🔴 High | **Effort:** 🟡 Medium | **Uniqueness:** 🔴 Novel

**The Problem:**
Collectors track NAN (North American Nationals) qualification cards with **paper cards in binders**. There's no digital system. Cards get lost. When a model is sold, tracking which NAN cards transfer is done by hand.

**The Solution:**
Link show results to the Digital Passport:
- Each horse's passport shows: "🏆 NAN Qualified — Breed Class (Green Card), Color Class (Yellow Card)"
- When a model is transferred via Hoofprint™, NAN cards transfer automatically
- Dashboard widget: "You have 7 NAN-qualified models. NAN 2026 entry opens June 1."

**Why This Wins:**
- NAN qualification is the #1 competitive goal in the hobby
- Paper cards are archaic and easily lost
- Ties directly to Hoofprint™ provenance
- NAMHSA doesn't offer a digital solution

---

## Feature S2: Show String Planner

**Impact:** 🟡 Medium | **Effort:** 🟡 Medium | **Uniqueness:** 🔴 Novel

**The Problem:**
Before a live show, collectors spend hours figuring out which models to bring and which classes to enter them in. They use spreadsheets, paper lists, and memory. At BreyerFest, people bring 50+ models in suitcases.

**The Solution:**
A drag-and-drop show string builder:
- Select which show you're attending
- Drag models from your stable into class slots
- See conflicts (same model can't be in overlapping classes)
- Print packing list + entry forms
- After the show, log results → feeds into NAN tracker

```
📋 Spring Stampede 2026 — Show String
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🐴 Bringing: 12 models | Entering: 27 classes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Breed Classes:
  Arabian Stallion → "Midnight Dream" ✓
  QH Mare → "Prairie Rose" ✓
  Draft Gelding → [empty — drag a model here]

Performance:
  Western Pleasure → "Prairie Rose" ⚠️ (conflict with next class)
  Trail → "Midnight Dream" ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[📄 Print Packing List] [📄 Print Entry Forms]
```

---

## Feature S3: Advanced Photo Show System

**Impact:** 🟡 Medium | **Effort:** 🟡 Medium | **Uniqueness:** 🟡 Differentiator

**Enhancements to existing show system:**
- **Multi-class entries** — enter one horse in multiple classes within a show
- **Division structure** — Breed, Color, Performance, Workmanship divisions
- **Judge critiques** — text feedback per entry (like MEPSA does)
- **NAN-sanctioning support** — flag shows as NAN-qualifying
- **Seasonal championships** — aggregate placings across monthly shows
- **Entry fees** (future) with Stripe integration

---

# ═══════════════════════════════════════
# 💰 MARKETPLACE & COMMERCE
# ═══════════════════════════════════════

## Feature M1: Advanced Marketplace Filters

**Impact:** 🟡 Medium | **Effort:** 🟢 Low | **Uniqueness:** 🟢 Expected

**Add to existing marketplace:**
- Filter by price range ($0-$50, $50-$200, $200-$500, $500+)
- Filter by scale (Traditional, Classic, Stablemate, Paddock Pal)
- Filter by manufacturer
- Filter by seller region (local pickup possible)
- "Make an Offer" button (replaces current "Contact Seller")

---

## Feature M2: Virtual Swap Meet Events

**Impact:** 🟡 Medium | **Effort:** 🟡 Medium | **Uniqueness:** 🔴 Novel

**The Problem:**
In-person swap meets are the lifeblood of the hobby, but they're infrequent and regional. Facebook sales groups are clunky and have no integration with collection management.

**The Solution:**
Timed, event-based sales:
- Admin or group leader creates a "Virtual Swap Meet" event
- Sellers list items during the event window (e.g., Saturday 10am-4pm)
- Live feed of new listings, favorites, comments
- After the event, unsold items go back to the regular marketplace

**Why it matters:** Creates urgency and community excitement — the digital equivalent of walking into a room full of tables at a show.

---

## Feature M3: Tack & Accessories Marketplace

**Impact:** 🟡 Medium | **Effort:** 🟡 Medium | **Uniqueness:** 🟡 Differentiator

**The Problem:**
Tack makers sell through Instagram, Etsy, MH$P, and personal websites. There's no single marketplace that integrates with the model horse ecosystem.

**The Solution:**
Expand the marketplace beyond horses:
- Tack (saddles, bridles, halters)
- Diorama props
- Show supplies
- Bodies/uncustomed models

Each listing category has relevant fields (e.g., tack scale, discipline, materials).

---

# ═══════════════════════════════════════
# 📊 ANALYTICS & DATA
# ═══════════════════════════════════════

## Feature D1: Collection Analytics Dashboard

**Impact:** 🟡 Medium | **Effort:** 🟡 Medium | **Uniqueness:** 🟡 Differentiator

**The Solution:**
Charts and insights for collectors:
- Collection growth over time (models added per month)
- Value trends (total vault value over time)
- Breakdown by manufacturer, scale, finish type
- "Your rarest model" highlight
- Comparison to community averages

```
📊 Your Collection at a Glance
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Models: 47    Total Value: $12,450
Growth: +8 models this month

By Manufacturer:           By Scale:
████████ Breyer (28)      ████████ Traditional (22)
████ Stone (8)            ████ Classic (12)
███ Artist Resin (6)      ███ Stablemate (8)
██ Peter Stone (3)        █ Other (5)
█ Other (2)
```

---

## Feature D2: Insurance Report Generator (PDF Export)

**Impact:** 🔴 High | **Effort:** 🟡 Medium | **Uniqueness:** 🔴 Novel

**The Problem:**
Collectors with $5,000-$50,000+ collections need insurance documentation. Currently they take photos of each model, write descriptions in a Word doc, and submit to their insurance company. It's tedious and rarely kept up to date.

**The Solution:**
One-click PDF generation:
- Cover page with collector name, date, total value
- Per-model pages: photo, name, purchase price, estimated value, condition, provenance notes
- Summary page: total models, total insured value, manufacturer breakdown
- Watermarked with Model Horse Hub branding
- Date-stamped and versioned

**Why This Wins:**
- Genuine **daily value** for serious collectors
- Uses data already in the Financial Vault
- Creates a premium reason to fill in financial data
- Insurance companies love standardized documentation

---

## Feature D3: Batch Import Tool (CSV)

**Impact:** 🔴 High | **Effort:** 🟡 Medium | **Uniqueness:** 🟡 Differentiator

**The Problem:**
Serious collectors often have 100-500+ models tracked in spreadsheets. Entering them one by one is a dealbreaker for onboarding.

**The Solution:**
CSV upload flow:
1. Download a template CSV with columns: Name, Mold, Release, Finish Type, Condition, Purchase Price, etc.
2. Upload filled CSV
3. System fuzzy-matches against reference database (10,500+ entries)
4. Preview matches: "Row 3: 'Adios' → Breyer #31, Adios (1969-1987) ✓"
5. Confirm and import

**Why This Wins:**
- Removes the #1 onboarding friction for large collectors
- Shows off the reference database (fuzzy matching is a wow moment)
- Converts spreadsheet users to MHH users

---

# ═══════════════════════════════════════
# 🌐 COMMUNITY & SOCIAL
# ═══════════════════════════════════════

## Feature C1: Direct Messages (Enhanced)

**Impact:** 🟡 Medium | **Effort:** 🟢 Low | **Uniqueness:** 🟢 Expected

**Enhancements to existing inbox:**
- Share a horse passport into a message (embed card)
- "Interested in this horse" quick message from marketplace listings
- Read receipts
- Block/mute user

---

## Feature C2: Discussion Boards (Forum-lite)

**Impact:** 🟡 Medium | **Effort:** 🟡 Medium | **Uniqueness:** 🟡 Differentiator

**The Problem:**
Model Horse Blab is the main forum, but it's aging and disconnected from any collection tools. Reddit r/BreyerHorses is generic.

**The Solution:**
Lightweight topic-based discussions:
- Channels: General, For Sale/Trade, Show Talk, Customs & Art, Help & ID
- Users can embed their passports in posts ("Here's the model I'm asking about")
- Replies, likes, pin important topics
- NOT trying to replace Blab — just providing an integrated discussion space

---

## Feature C3: "Help Me ID This Model" (Community-Powered)

**Impact:** 🟡 Medium | **Effort:** 🟢 Low | **Uniqueness:** 🟡 Differentiator

**The Problem:**
Every day on Reddit, Facebook, and Blab, someone posts: "I found this at a thrift store, what is it?" Currently, this is the AI identification shelved feature — but the COMMUNITY is actually better at this than AI.

**The Solution:**
A dedicated "ID Request" flow:
1. Upload photo(s) of mystery model
2. Community members suggest matches from the reference database
3. Best answer gets upvoted
4. Once identified, user can one-click add it to their stable with the reference link pre-filled

**Why it matters:** Gamifies community expertise, drives traffic, and demonstrates the value of the reference database.

---

## Feature C4: Achievement Badges

**Impact:** 🟢 Lower | **Effort:** 🟢 Low | **Uniqueness:** 🟡 Differentiator

**Gamification badges on profiles:**
- 🏠 "Stable Starter" — Added first horse
- 📸 "Photographer" — Uploaded 5 LSQ photos
- 🏆 "Show Champion" — Won a photo show
- 🤝 "Trusted Trader" — 5+ positive ratings
- 📦 "Collector" — 10+ models
- 🏰 "Hoarder" — 50+ models (tongue in cheek)
- 🎨 "Patron of the Arts" — Commissioned 3+ customs
- 🐾 "Provenance Pro" — Complete Hoofprint™ on 5+ models
- 🌟 "Founding Member" — Joined during beta

---

## Feature C5: "Horses I've Seen IRL" Journal

**Impact:** 🟢 Lower | **Effort:** 🟢 Low | **Uniqueness:** 🔴 Novel

A personal log for collectors who attend BreyerFest, live shows, or farms — tracking famous real horses they've visited:
- "Saw Justify at Coolmore, June 2025" [photo]
- Can link to model horses in their stable that represent these real horses

Niche but delightful for the community.

---

# ═══════════════════════════════════════
# 🔧 PLATFORM & INFRASTRUCTURE
# ═══════════════════════════════════════

## Feature P1: User Avatars (Photo Upload)

**Impact:** 🟡 Medium | **Effort:** 🟢 Low | **Uniqueness:** 🟢 Expected

Already built in settings — just needs the Supabase bucket fix (done in this session). Currently showing initials fallback.

---

## Feature P2: Data Export (CSV Download)

**Impact:** 🟡 Medium | **Effort:** 🟢 Low | **Uniqueness:** 🟢 Expected

Let users download their entire collection as a CSV. Already have an `/api/export` route. Ensure it includes all fields: financial vault, references, hoofprint status, etc.

---

## Feature P3: PWA (Progressive Web App)

**Impact:** 🟡 Medium | **Effort:** 🟢 Low | **Uniqueness:** 🟡 Differentiator

Add manifest + service worker for:
- Install on home screen
- Offline access to own collection
- Push notifications for favorites, messages, show results
- Camera shortcut for quick photo capture

---

## Feature P4: Notification Digests (Email)

**Impact:** 🟡 Medium | **Effort:** 🟡 Medium | **Uniqueness:** 🟢 Expected

Weekly email digest:
- "3 people favorited your horses this week"
- "Your commission with @Artist is now In Progress"
- "Spring Stampede show results are in — you placed 2nd!"
- "2 new models match your wishlist"

---

# ═══════════════════════════════════════
# 📋 PRIORITY MATRIX
# ═══════════════════════════════════════

## Tier 1: Build These Next (High Impact, Achievable Now)

| # | Feature | Impact | Effort | Why Now |
|---|---|---|---|---|
| A1 | Commission Tracker | 🔴 High | 🔴 High | **Platform-defining** — nothing else does this |
| A2 | WIP Photo Portal | 🔴 High | 🟡 Med | Ties into Hoofprint™ naturally |
| D3 | Batch Import (CSV) | 🔴 High | 🟡 Med | Removes #1 onboarding barrier |
| G1 | Regional Tags | 🟡 Med | 🟢 Low | Single column + filter UI |
| D2 | Insurance PDF | 🔴 High | 🟡 Med | Use data already in vault |

## Tier 2: Build When User Base Grows (Needs Volume)

| # | Feature | Impact | Effort | Trigger |
|---|---|---|---|---|
| G2 | Groups | 🔴 High | 🔴 High | 20+ active users |
| S1 | NAN Tracker | 🔴 High | 🟡 Med | 10+ users who show |
| S2 | Show String Planner | 🟡 Med | 🟡 Med | After NAN Tracker |
| M2 | Virtual Swap Meets | 🟡 Med | 🟡 Med | 15+ sellers active |
| C2 | Discussion Boards | 🟡 Med | 🟡 Med | 30+ active users |

## Tier 3: Polish & Delight (Nice to Have)

| # | Feature | Impact | Effort |
|---|---|---|---|
| A3 | Artist Portfolio | 🟡 Med | 🟢 Low |
| C3 | Help ID This Model | 🟡 Med | 🟢 Low |
| C4 | Achievement Badges | 🟢 Low | 🟢 Low |
| D1 | Analytics Dashboard | 🟡 Med | 🟡 Med |
| M1 | Marketplace Filters | 🟡 Med | 🟢 Low |
| P3 | PWA | 🟡 Med | 🟢 Low |

---

# ═══════════════════════════════════════
# 💡 THE BIG PICTURE
# ═══════════════════════════════════════

### What Makes MHH Different From Everything Else

The model horse community currently uses:
- **Facebook Groups** for social + selling (no collection tools)
- **Instagram** for artist portfolios + WIPs (no structure)
- **Spreadsheets** for collection tracking (no social)
- **Model Horse Blab** for forums (aging, no integration)
- **NAMHSA website** for show info (paper-based, no digital tools)
- **BreyerHorseRef** for reference data (no social, limited)
- **Etsy/MH$P/eBay** for marketplace (no hobby context)

**MHH is the first platform that combines ALL of these into one integrated experience.**

The Art Studio feature (A1 + A2) is the **strongest differentiator** because:
1. It brings **artists** to the platform (not just collectors)
2. Artists are influencers in the community — where they go, their followers follow
3. The WIP → Hoofprint™ pipeline is genuinely magical and unprecedented
4. It creates a new revenue stream (potential commission fee in far future)

### Recommended Build Order

```
Now:      A1 Commission Tracker + G1 Regional Tags + D3 Batch Import
Month 2:  A2 WIP Portal + D2 Insurance PDF + C4 Badges
Month 3:  G2 Groups + S1 NAN Tracker
Month 4:  M2 Swap Meets + S2 Show String Planner
Ongoing:  Community feedback → prioritize from Tier 3
```
