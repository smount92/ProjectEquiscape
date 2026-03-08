---
description: Long-term product roadmap for Model Horse Hub. Features that require user volume, external integrations, or significant R&D. Not for immediate execution.
---

# 🗺️ Model Horse Hub — Long-Term Roadmap

> **Purpose:** Features and ideas that are out of scope for current sprints but represent the future direction of the platform. These are queued for when the user base, data volume, or technical infrastructure justifies them.
> **Last Updated:** 2026-03-07
> **Status Key:** 🧊 Shelved (good idea, waiting for right time) | 🔬 Research (needs design work) | 📋 Planned (designed, waiting for trigger) | 🚧 In Progress

---

# ═══════════════════════════════════════
# WHAT'S BEEN SHIPPED (For Context)
# ═══════════════════════════════════════

| Feature | Status | Date |
|---|---|---|
| Core Platform (intake, passport, vault, dashboard) | ✅ Shipped | 2026-03 |
| Reference Database (7,000+ Breyer/Stone + 3,500+ ERD resins) | ✅ Shipped | 2026-03 |
| Social Layer (favorites, comments, follows, discover, feed) | ✅ Shipped | 2026-03 |
| Photo Shows (create, enter, vote, deadlines, winners, admin) | ✅ Shipped | 2026-03 |
| User-to-User Ratings | ✅ Shipped | 2026-03 |
| Provenance Tracking (show records, pedigree cards) | ✅ Shipped | 2026-03 |
| Hoofprint™ (timeline, ownership chain, transfer codes, claim) | ✅ Shipped | 2026-03 |
| Personal Collections | ✅ Shipped | 2026-03 |
| LSQ Multi-Angle Photo Suite | ✅ Shipped | 2026-03 |
| Marketplace (for-sale listings, contact seller, wishlist matching) | ✅ Shipped | 2026-03 |
| Marketing Landing Page | ✅ Shipped | 2026-03 |

---

# ═══════════════════════════════════════
# 🧊 SHELVED: AI Model Identification
# ═══════════════════════════════════════

**What:** Upload a photo of a model horse and have AI identify the mold, manufacturer, and likely release.

**Why it's shelved:**
- The 10,500+ reference database does the identification job for known models
- AI identification is a "wow demo" but adds marginal daily value vs. searchable reference data
- Requires image training data (photos of models labeled by mold) — we don't yet have enough user-uploaded photos to train on
- API costs for vision AI are non-trivial at scale

**Prerequisites to un-shelve:**
- [ ] 500+ active users with photo-rich passports
- [ ] Budget for OpenAI Vision / Google Gemini Vision API calls
- [ ] Training dataset: at least 50 photos per major mold (~200 molds × 50 = 10,000 labeled images)

**Existing code:**
- The AI detect button was built but hidden behind a `{false && ...}` guard in `src/app/add-horse/page.tsx`
- The action exists in `src/app/actions/ai.ts` (or similar)
- Re-enable requires removing the guard and testing the API integration

**Trigger:** When the platform has enough photo data to make identification accurate and cost-effective.

---

# ═══════════════════════════════════════
# 🧊 SHELVED: Market Price Guide ("Blue Book")
# ═══════════════════════════════════════

**What:** A "Kelly Blue Book" for model horses — aggregate price data showing what models are worth, with historical trends.

**Why it matters:** No platform in the hobby shows aggregated market data. Collectors currently rely on eBay sold listings, word-of-mouth, and "What's this worth?" forum threads.

**How it would work:**

### Tier 1: OF Breyers (Easy — same mold/release across many owners)
- Aggregate listing prices from `user_horses.listing_price` (already public data)
- Aggregate transfer sale prices from `horse_ownership_history.sale_price` (where `is_price_public = true`)
- Add anonymous vault opt-in: `financial_vault.contribute_to_market_data` checkbox
- Output: per-release price guide — "Breyer #700195 SM — Avg: $45-$65, 12 data points, ↑ 8% 6mo"

### Tier 2: Artist Resins (Group by resin model + edition size)
- Track by `artist_resins.id` → aggregate across all owners of the same casting
- Edition sizes are known → scarcity multiplier
- Split: Blank resin price vs. painted custom price
- Output: "Midnight Dream resin (25 cast) — Blank: $80-$120, Custom: $200-$600"

### Tier 3: Customs (Group by artist + mold)
- Can't track individual OOAKs
- Track by artist alias + mold: "What do StableQueenPaints Stablemates sell for?"
- Output: "Custom SM — Avg: $150-$350 | Custom Trad — Avg: $300-$800"

**Database prep (cheap, do when convenient):**
```sql
ALTER TABLE financial_vault
  ADD COLUMN contribute_to_market_data BOOLEAN DEFAULT false;

COMMENT ON COLUMN financial_vault.contribute_to_market_data IS
  'User opt-in to anonymously contribute price data to the market guide.';
```

**New tables needed:**
```sql
CREATE TABLE market_price_data (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_release_id UUID REFERENCES breyer_catalog(id),
  artist_resin_id  UUID REFERENCES artist_resins(id),
  mold_id          UUID REFERENCES reference_molds(id),
  finish_type      TEXT,
  data_source      TEXT CHECK (data_source IN ('listing', 'transfer', 'vault_optin', 'external')),
  price            DECIMAL(10,2) NOT NULL,
  price_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  is_anonymous     BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE market_price_summary (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_release_id UUID REFERENCES breyer_catalog(id),
  artist_resin_id  UUID REFERENCES artist_resins(id),
  period           TEXT CHECK (period IN ('30d', '90d', '1y', 'all')),
  avg_price        DECIMAL(10,2),
  median_price     DECIMAL(10,2),
  min_price        DECIMAL(10,2),
  max_price        DECIMAL(10,2),
  data_points      INTEGER,
  trend_percent    DECIMAL(5,2),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Prerequisites to un-shelve:**
- [ ] 50+ active users (enough data points per release)
- [ ] At least 100 public Hoofprint transfers with price data
- [ ] Financial vault opt-in feature built

**UI Pages:**
- `/market` — Browse price guide by manufacturer/mold/release
- `/market/[release_id]` — Detailed price history with chart
- Integration: Show "Market Value: ~$45-$65" badge on passport pages

**Trigger:** When there are enough data points (50+ per popular release) to make prices credible.

---

# ═══════════════════════════════════════
# 📋 PLANNED: Settings & Account Management
# ═══════════════════════════════════════

**What:** A proper `/settings` page for account management.

**Features:**
- Profile editing (alias, bio, avatar upload)
- Email change
- Password change
- Notification preferences (email vs. in-app, granular per-event)
- Privacy settings (default public/private for new horses)
- Theme preferences
- Data export (download my collection as CSV)
- Account deletion with data handling

**Trigger:** Before public launch / when user feedback demands it.

---

# ═══════════════════════════════════════
# 📋 PLANNED: User Avatars & Profile Photos
# ═══════════════════════════════════════

**What:** Let users upload a profile avatar displayed on their profile, collector cards, comments, and activity feed.

**Implementation:**
- Add `avatar_url` column to `users` table
- Storage bucket `avatars` in Supabase Storage
- Upload on settings page or profile edit
- Resize/crop utility (client-side)
- Fallback: generated initials avatar (already working)

**Trigger:** When Settings page is built.

---

# ═══════════════════════════════════════
# 🔬 RESEARCH: eBay Sold Listing Integration
# ═══════════════════════════════════════

**What:** Automatically pull "sold" listing data from eBay for known Breyer releases to supplement the Market Price Guide.

**Challenges:**
- eBay API access requires developer account + approval
- Rate limits and data freshness
- Matching eBay listing titles to our reference releases (fuzzy matching)
- Handling lots, customs, and mislabeled listings

**Approach:**
1. Use eBay Browse API `search` endpoint with `filter=sold` parameter
2. Match by Breyer model number (e.g., "#700195") — most reliable signal
3. Store in `market_price_data` with `data_source = 'external'`
4. Run as a periodic background job (daily or weekly)

**Trigger:** After Market Price Guide v1 ships and users request more data.

---

# ═══════════════════════════════════════
# 🔬 RESEARCH: Mobile App (React Native / PWA)
# ═══════════════════════════════════════

**What:** Native or PWA mobile experience for photo-heavy workflows.

**Options:**
1. **PWA (Progressive Web App)** — Add manifest, service worker, offline support. Cheapest path.
2. **React Native** — Full native app using shared Supabase backend.
3. **Capacitor/Ionic** — Wrap Next.js in a native shell.

**Key mobile needs:**
- Camera integration for quick photo capture at shows
- Offline access to own collection data
- Push notifications
- Quick "Add Horse" flow optimized for phone

**Trigger:** When mobile traffic exceeds 40% of total (track via analytics).

---

# ═══════════════════════════════════════
# 🔬 RESEARCH: Live Show Integration
# ═══════════════════════════════════════

**What:** Official integration with live show systems (NAMHSA, etc.).

**Potential features:**
- Import show results directly from official databases
- NAN qualification tracking
- Show calendar with registration
- Digital entry forms
- Judge assignment system for online shows

**Challenges:**
- NAMHSA doesn't have a public API
- Manual data entry is the current standard
- Political: requires buy-in from show organizers

**Trigger:** Community demand + relationship with show organizers.

---

# ═══════════════════════════════════════
# 🔬 RESEARCH: Insurance Report Generator
# ═══════════════════════════════════════

**What:** Generate a formatted PDF report of a user's collection with photos and values for insurance purposes.

**Features:**
- Export financial vault data + photos as a professional document
- Per-horse detail pages: name, photos, purchase price, estimated value
- Summary page: total models, total value, total insured value
- Date-stamped and versioned

**Implementation:**
- Server-side PDF generation (puppeteer or @react-pdf/renderer)
- Private endpoint only accessible by the owner
- Optional watermark with Model Horse Hub branding

**Trigger:** When vault data has enough depth (purchase prices + estimated values populated).

---

# ═══════════════════════════════════════
# 🧊 SHELVED: Premium/Paid Tier
# ═══════════════════════════════════════

**What:** Monetization through optional premium features.

**Potential premium features:**
- Unlimited photo storage (free tier could cap at N photos)
- Advanced analytics (collection value trends, market comparisons)
- Priority support
- Custom profile themes
- Verified collector badge
- Ad-free experience (if ads are ever introduced)

**Why shelved:** "Free forever" is a core brand promise. Monetization should come from genuinely premium features, not paywalling existing functionality. Need significant user base first.

**Trigger:** 1,000+ active users and clear demand for advanced features.

---

# ═══════════════════════════════════════
# NOTES & IDEAS (RAW — UNSCOPED)
# ═══════════════════════════════════════

Capture raw ideas here. Move to a proper section when scoped.

- **Breed Registry for Fantasy Resins** — Track parentage, bloodlines, breed standards for fantasy breeds. Popular in the resin community.
- **Show String Builder** — Drag-and-drop tool to plan which models to bring to a show, organized by division.
- **Collection Analytics Dashboard** — Charts showing collection growth over time, value trends, manufacturer distribution.
- **Batch Import Tool** — CSV upload for collectors migrating from spreadsheets.
- **API for Third-Party Tools** — Public REST API for show management tools, collection trackers, etc.
- **Group Collections / Stables** — Shared stables for families or business partners who co-own models.
- **Event Calendar** — Community calendar of upcoming live shows, sales, and hobby events.
