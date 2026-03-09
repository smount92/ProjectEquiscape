# Model Horse Hub — Unified Implementation Blueprint

> **Status:** Single Source of Truth — All architectural decisions
> **Last Updated:** 2026-03-09
> **Audience:** Architect agent (reads everything), Developer agents (reads via phase workflows)
> **Sources Reconciled:** `mhh_implementation_blueprint.md`, `platform_architecture_deep_dive.md`, `feature_wishlist_report.md`, `model_horse_hub_state_report.md`

---

## 🚨 GLOBAL AGENT DIRECTIVES (CRITICAL)

1. **Security (RLS):** Every new Supabase table MUST have `ENABLE ROW LEVEL SECURITY` and strict policies. Financial data (`financial_vault`) must NEVER be exposed on public endpoints or joined in public queries.
2. **Server/Client Boundary:** Use React Server Components (RSC) by default for data fetching. Use Next.js Server Actions (`"use server"`) for database mutations. Only use Client Components (`"use client"`) when interactivity, hooks, or browser APIs are required.
3. **Image Compression:** All client-side image uploads MUST compress to WebP format, < 400KB, before hitting Supabase Storage. Free tiers have a hard 5-photo limit per horse.
4. **No Third-Party Escrow:** Do not build Stripe or payment processors. UI guardrails and external PayPal.me links only.
5. **CSS:** Use **Vanilla CSS** with custom properties (CSS variables) for the glassmorphism design system. ALL styles in `src/app/globals.css`. Do NOT use Tailwind.
6. **UUID Generation:** Use `gen_random_uuid()` in all SQL (NOT `uuid_generate_v4()`). This is a built-in Postgres function and does not require extensions.
7. **Signed URLs:** All Supabase Storage images are served via signed URLs (`createSignedUrl`), never public URLs. Use the existing `getSignedImageUrls()` utility.
8. **Auth Pattern:** Always use `createClient()` from `@/lib/supabase/server` → `supabase.auth.getUser()` for authentication checks.

---

## 📐 TECH STACK (Definitive)

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16 (App Router), React 19, Vanilla CSS (Glassmorphism design tokens via CSS custom properties) |
| **Backend / Database** | Supabase (PostgreSQL) with strict Row Level Security (RLS) |
| **Auth** | Supabase Auth with PKCE (code exchange), password recovery flows |
| **Storage** | Supabase Storage — private buckets with signed URLs |
| **Email** | Resend (transactional notifications) |
| **Hosting** | Vercel |
| **Testing** | Vitest (smoke tests) |

---

## 📦 DATABASE SCHEMA — EXISTING TABLES

> **28 tables shipped** as of March 9, 2026. Migrations `001` through `022`.

| Table | Purpose | Migration |
|---|---|---|
| `users` | Profiles linked 1:1 with `auth.users` | 001 |
| `reference_molds` | Physical sculpt shapes (base catalog) | 001 |
| `reference_releases` | Specific paint jobs/releases (~7,000+ rows) | 002 |
| `artist_resins` | ERD-sourced resin catalog (~3,500+ rows) | 001 |
| `user_horses` | Core inventory — each model a collector owns | 001 |
| `financial_vault` | STRICTLY PRIVATE: purchase price, estimated value | 001 |
| `horse_images` | LSQ Photo Suite — multi-angle galleries | 001 |
| `customization_logs` | Tracks artist work on a horse | 001 |
| `user_collections` | Personal folders for organizing inventory | 004 |
| `contact_messages` | Public contact form submissions | 006 |
| `user_wishlists` | "Grail hunting" targets linked to reference data | 007 |
| `conversations` / `messages` / `conversation_reads` | Native inbox for buyer-seller DMs | 009 |
| `horse_favorites` / `horse_comments` | Social interactions | 010 |
| `user_follows` | Follow system between collectors | 010 |
| `activity_events` | Social activity feed log | 010 |
| `notifications` | In-app notification center | 010 |
| `horse_pedigree` | Artist Resin lineage (sire/dam) | 011 |
| `show_records` | Live/photo show placings and NAN qualifications | 011 |
| `user_ratings` | 5-star marketplace trust ratings | 012 |
| `featured_horses` | "Horse of the Week" admin curation | 013 |
| `photo_shows` / `show_entries` | Virtual photo show competitions | 014-015 |
| `horse_timeline` | Hoofprint provenance timeline | 018 |
| `horse_ownership_history` | Chain-of-custody ownership records | 018 |
| `horse_photo_stages` | Photo stage tagging | 018 |
| `horse_transfers` | Transfer code system for ownership changes | 018 |

---

## 🗺️ IMPLEMENTATION PHASES

### Overview

| Phase | Focus | Key Deliverables | New Tables |
|---|---|---|---|
| **1** | Supply-Side Liquidity & Single-Player Value | CSV Import, Insurance PDF, Help ID | 2 |
| **2** | Trust Architecture & Viral Loops | Parked Export/CoA, Condition History, Chat Guardrails | 1 |
| **3** | The Creator Flywheel (Art Studio) | Artist Profiles, Commissions, WIP Portal, Pipeline | 3 |
| **4** | Competition Engine & Community | NAN Tracker, Show String, Groups, Events, Offline | 7+ |

Each phase has a dedicated workflow in `.agents/workflows/` that the developer agent follows.

---

## PHASE 1: Supply-Side Liquidity & Single-Player Value

> **Goal:** Unblock "super-collectors" (200-2000+ model herds), provide offline-valuable tools, and create SEO magnets.
> **Workflow:** `/phase1-supply`

### Feature 1A: Batch CSV Import & Reconciliation

**Dependencies:** `papaparse` (client-side CSV parsing), `fuzzysort` (client-side fuzzy matching)

**Database:** No new tables. Batch inserts into existing `user_horses` and `financial_vault` via Supabase RPC transaction.

**Architecture:**
1. **Client-Side (`"use client"`):** User uploads CSV. `papaparse` reads locally in browser.
2. **Mapping UI:** User maps their CSV columns to MHH schema (`name`, `mold`, `condition`, `purchase_price`).
3. **Server Action (`matchCsvBatch`):** Receives mapped JSON. Queries `reference_releases`. Runs fuzzy match via `fuzzysort` against pre-fetched reference list.
4. **Reconciliation UI:** Three states:
   - ✅ Perfect Match (Green) — ready to import
   - ⚠️ Review Needed (Yellow) — shows top 3 DB matches to select
   - ❌ No Match (Red) — create as "Custom/Unknown" or search manually
5. **Server Action (`executeBatchImport`):** Inserts into `user_horses` and `financial_vault` inside a single Supabase Postgres Transaction (RPC) for data integrity.

### Feature 1B: Insurance PDF Generator

**Dependencies:** `@react-pdf/renderer` (client-side PDF rendering)

**Architecture:**
1. **Server Action:** Fetches `user_horses` joined with `financial_vault` for authenticated `auth.uid()` only.
2. **Image Handling:** Convert remote Supabase signed URLs to base64 strings if CORS blocks the PDF renderer.
3. **PDF Template (`components/pdf/InsuranceReport.tsx`):**
   - Cover Page: User name, date stamp, total model count, total vault value, MHH branding
   - Summary Table: 1-line per horse (Name, Reference #, Condition, Estimated Value)
   - Detail Pages: Grid layout (4 horses/page) — Primary Photo thumbnail, Name, Finish, Condition, Paid, Value
4. **Client action:** "Download PDF" button triggers client-side blob generation. Keeps heavy work off Vercel serverless.

### Feature 1C: "Help Me ID This Model" (Community SEO)

**Database:**
```sql
CREATE TABLE id_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  image_url TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE id_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view open requests"
  ON id_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner manages own requests"
  ON id_requests FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE id_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES id_requests(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  reference_id UUID REFERENCES reference_releases(id),
  upvotes INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE id_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view suggestions"
  ON id_suggestions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can suggest"
  ON id_suggestions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner manages own suggestions"
  ON id_suggestions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

**Workflow:** Feed at `/community/help-id`. Users suggest matches from DB. OP accepts → status changes to `resolved` → prompt to 1-click add reference model to their stable.

---

## PHASE 2: Trust Architecture & Viral Loops

> **Goal:** Turn off-platform sales into user acquisition loops. Protect marketplace integrity.
> **Workflow:** `/phase2-trust`

### Feature 2A: "Parked" Export & Certificate of Authenticity (CoA)

**Dependencies:** `qrcode.react`

**Database Changes:**
```sql
-- Extend life_stage to include 'parked'
ALTER TABLE user_horses DROP CONSTRAINT IF EXISTS user_horses_life_stage_check;
ALTER TABLE user_horses ADD CONSTRAINT user_horses_life_stage_check
  CHECK (life_stage IN ('blank', 'in_progress', 'completed', 'for_sale', 'parked'));

-- Add claim_pin to transfers
ALTER TABLE horse_transfers ADD COLUMN claim_pin VARCHAR(6) UNIQUE;
```

**Workflow:**
1. User clicks "Sell Off-Platform." Server Action locks horse (`life_stage = 'parked'`), freezing Hoofprint history, generates secure 6-char PIN.
2. Client generates printable 1-page CoA PDF containing the horse's Hoofprint timeline summary and a QR code linking to `https://modelhorsehub.com/claim/[PIN]`.
3. **Viral Claim:** Unauthenticated users scanning QR hit `/claim/[PIN]`, see a locked Hoofprint page, and are prompted to create a free account to input the PIN and claim the model.

### Feature 2B: Condition History Ledger

**Database:**
```sql
CREATE TABLE condition_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  horse_id UUID REFERENCES user_horses(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES auth.users(id),
  old_condition TEXT,
  new_condition TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE condition_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View history on public horses"
  ON condition_history FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_horses h WHERE h.id = condition_history.horse_id AND h.is_public = true
  ));
CREATE POLICY "Owner views own history"
  ON condition_history FOR SELECT TO authenticated
  USING (auth.uid() = changed_by);

CREATE INDEX idx_condition_history_horse ON condition_history (horse_id, created_at DESC);
```

**Implementation:** Postgres trigger on `user_horses` — whenever `condition_grade` changes, auto-insert into `condition_history`. Display on Hoofprint timeline for physical accountability.

### Feature 2C: Chat UI Guardrails & Rating Constraints

**No new tables.** UI-only changes:

1. **Defensive UI:** In `<MessageInput />`, add `onChange` regex: `/(venmo|zelle|paypal f&f|friends and family)/i`. If matched, inject un-dismissible warning: "🛡️ Protect yourself: Always use PayPal Goods & Services."
2. **Trust Signals:** Display seller's `account_age` and `successful_transfers` count in chat header.
3. **Review Constraint:** In `submitRating` Server Action, verify a completed `horse_transfers` record exists between the two users before allowing a rating.

---

## PHASE 3: The Creator Flywheel (Art Studio)

> **Goal:** Give artists tools so compelling they abandon Instagram DMs + Google Forms, pulling their buyers onto MHH.
> **Workflow:** `/phase3-art-studio`

### Feature 3A: Artist Profiles & Commission Management

**Database:**
```sql
CREATE TABLE artist_profiles (
  user_id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  studio_name        TEXT NOT NULL,
  studio_slug        TEXT UNIQUE NOT NULL,
  -- URL: mhh.com/studio/[slug]
  specialties        TEXT[] DEFAULT '{}',
  -- ['Custom Paint', 'Repaint', 'Tack', 'Sculpting', 'Etching', 'Hair']
  mediums            TEXT[] DEFAULT '{}',
  -- ['Acrylics', 'Pastels', 'Oils', 'Airbrush', 'Mixed Media']
  scales_offered     TEXT[] DEFAULT '{}',
  -- ['Traditional', 'Classic', 'Stablemate']
  bio_artist         TEXT,
  portfolio_visible  BOOLEAN DEFAULT true,
  status             TEXT NOT NULL DEFAULT 'closed'
    CHECK (status IN ('open', 'waitlist', 'closed')),
  max_slots          INTEGER DEFAULT 5 CHECK (max_slots BETWEEN 1 AND 20),
  turnaround_min_days INTEGER,
  turnaround_max_days INTEGER,
  price_range_min    DECIMAL(10,2),
  price_range_max    DECIMAL(10,2),
  terms_text         TEXT,
  paypal_me_link     TEXT,
  accepting_types    TEXT[] DEFAULT '{}',
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE artist_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view artist profiles"
  ON artist_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner manages own artist profile"
  ON artist_profiles FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

---

CREATE TABLE commissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id         UUID NOT NULL REFERENCES auth.users(id),
  client_id         UUID REFERENCES auth.users(id),
  client_email      TEXT,
  -- Used for external comms when client isn't on MHH yet
  horse_id          UUID REFERENCES user_horses(id) ON DELETE SET NULL,
  -- Set when horse entry is created for this commission
  commission_type   TEXT NOT NULL,
  description       TEXT NOT NULL,
  reference_images  TEXT[] DEFAULT '{}',
  slot_number       INTEGER,
  estimated_start   DATE,
  estimated_completion DATE,
  actual_start      DATE,
  actual_completion DATE,
  price_quoted      DECIMAL(10,2),
  deposit_amount    DECIMAL(10,2),
  deposit_paid      BOOLEAN DEFAULT false,
  final_paid        BOOLEAN DEFAULT false,
  status            TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN (
      'requested', 'accepted', 'declined', 'cancelled',
      'in_progress', 'review', 'revision',
      'completed', 'delivered'
    )),
  is_public_in_queue BOOLEAN DEFAULT true,
  last_update_at    TIMESTAMPTZ DEFAULT now(),
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT artist_not_client CHECK (artist_id != client_id)
);
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Artist views own commissions"
  ON commissions FOR SELECT TO authenticated
  USING (auth.uid() = artist_id);
CREATE POLICY "Client views own commissions"
  ON commissions FOR SELECT TO authenticated
  USING (auth.uid() = client_id);
CREATE POLICY "Public queue visibility"
  ON commissions FOR SELECT TO authenticated
  USING (is_public_in_queue = true AND status IN ('accepted', 'in_progress'));
CREATE POLICY "Artist manages commissions"
  ON commissions FOR ALL TO authenticated
  USING (auth.uid() = artist_id)
  WITH CHECK (auth.uid() = artist_id);
CREATE POLICY "Client creates commission requests"
  ON commissions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = client_id);

CREATE INDEX idx_commissions_artist ON commissions (artist_id, status);
CREATE INDEX idx_commissions_client ON commissions (client_id);
```

**UI:** Public URL (`modelhorsehub.com/studio/[slug]`) shows open slots, specialties, portfolio. Internal artist dashboard with Kanban-style commission management.

### Feature 3B: WIP Updates & Hoofprint Pipeline

**Database:**
```sql
CREATE TABLE commission_updates (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id         UUID NOT NULL REFERENCES commissions(id) ON DELETE CASCADE,
  author_id             UUID NOT NULL REFERENCES auth.users(id),
  update_type           TEXT NOT NULL CHECK (update_type IN (
    'wip_photo', 'status_change', 'message',
    'revision_request', 'approval', 'milestone'
  )),
  title                 TEXT,
  body                  TEXT,
  image_urls            TEXT[] DEFAULT '{}',
  old_status            TEXT,
  new_status            TEXT,
  requires_payment      BOOLEAN DEFAULT false,
  is_visible_to_client  BOOLEAN DEFAULT true,
  created_at            TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE commission_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Artist views all updates"
  ON commission_updates FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM commissions c WHERE c.id = commission_id AND c.artist_id = auth.uid()
  ));
CREATE POLICY "Client views visible updates"
  ON commission_updates FOR SELECT TO authenticated
  USING (
    is_visible_to_client = true
    AND EXISTS (
      SELECT 1 FROM commissions c WHERE c.id = commission_id AND c.client_id = auth.uid()
    )
  );
CREATE POLICY "Participants create updates"
  ON commission_updates FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM commissions c WHERE c.id = commission_id
    AND (c.artist_id = auth.uid() OR c.client_id = auth.uid())
  ));

CREATE INDEX idx_commission_updates ON commission_updates (commission_id, created_at DESC);
```

**The Pipeline (Critical Moat):** When commission status hits `delivered` and artist clicks "Transfer to Client":
1. System queries all `commission_updates` where `update_type = 'wip_photo'` and `is_visible_to_client = true`
2. Maps images into `horse_timeline` entries with `event_type = 'customization'`
3. Records artist as creator in ownership history
4. Auto-initiates Hoofprint transfer to client
5. **Result:** Horse's permanent passport shows the step-by-step creation story

**Email:** When `commission_updates` row is inserted, trigger Resend email to client. If `requires_payment = true`, include artist's `paypal_me_link`. **Throttle:** Batch updates within a 30-minute window into a single email digest to prevent spam from rapid-fire uploads.

---

## PHASE 4: Competition Engine & Community

> **Goal:** Digitize the paper-based showing world. Build community infrastructure.
> **Workflow:** `/phase4-competition`

### Feature 4A: Verified Judge Roles & Enhanced Show Records

**Database Changes:**
```sql
-- User roles
ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'
  CHECK (role IN ('user', 'judge', 'admin'));

-- Enhanced show records
ALTER TABLE show_records ADD COLUMN IF NOT EXISTS verification_tier TEXT DEFAULT 'self_reported'
  CHECK (verification_tier IN ('self_reported', 'host_verified', 'mhh_auto'));
ALTER TABLE show_records ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id);
ALTER TABLE show_records ADD COLUMN IF NOT EXISTS judge_critique TEXT;
```

**UI:** On horse passport, show records display with badge:
- Gray badge = `self_reported`
- Gold "MHH Verified" badge = `host_verified` or `mhh_auto` (only writable by `judge`/`admin` role)

### Feature 4B: NAN Qualification Tracker

Extends existing `show_records` table. Dashboard widget shows qualification status per horse with NAN card type tracking (green/yellow/pink). Transfer with Hoofprint — NAN cards go with the horse.

### Feature 4C: Show String Planner

**Database:**
```sql
CREATE TABLE show_strings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  show_date   DATE,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE show_string_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_string_id  UUID NOT NULL REFERENCES show_strings(id) ON DELETE CASCADE,
  horse_id        UUID NOT NULL REFERENCES user_horses(id) ON DELETE CASCADE,
  class_name      TEXT NOT NULL,
  division        TEXT,
  time_slot       TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

**UI:** Drag-and-drop planner with conflict detection. Print packing list + entry forms. After show, becomes results entry form feeding into `show_records`.

### Feature 4D: Groups & Events

See full schema in `platform_architecture_deep_dive.md`. Groups are containers that scope existing features (shows, feeds). Events link to shows, groups, and swap meets.

### Feature 4E: PWA & Offline Show Mode

**Dependencies:** `@serwist/next`, `idb-keyval`

**Architecture:**
1. PWA manifest + service worker via serwist
2. "Make String Available Offline" toggle — fetches show string JSON + compressed thumbnails into IndexedDB
3. Offline mutation queue in IndexedDB for show placings entered at dead-zone fairgrounds
4. `window.addEventListener('online')` hook to auto-flush queue to Supabase when connectivity returns

---

## 📊 FULL TABLE INVENTORY (After All Phases)

| Category | Existing | New | Total |
|---|---|---|---|
| Core (users, horses, images, vault) | 7 | 1 (condition_history) | 8 |
| Reference Data | 3 | 0 | 3 |
| Social (follows, favorites, comments, feed) | 5 | 0 | 5 |
| Shows & Competition | 2 | 2 (show_strings, show_string_entries) | 4 |
| Provenance (Hoofprint) | 4 | 0 | 4 |
| Marketplace | 2 | 0 | 2 |
| Messaging | 3 | 0 | 3 |
| Ratings | 1 | 0 | 1 |
| Collections | 1 | 0 | 1 |
| Art Studio | 0 | 3 (artist_profiles, commissions, commission_updates) | 3 |
| Help ID | 0 | 2 (id_requests, id_suggestions) | 2 |
| Groups (Phase 4D) | 0 | 5+ | 5+ |
| **TOTAL** | **28** | **13+** | **41+** |

---

## ⚠️ RISK MITIGATIONS

| Risk | Mitigation |
|---|---|
| Feature bloat | Each phase is a commit boundary. Never start a phase before previous is stable. |
| Artist adoption | Founder is first artist. Invite 3-5 artist friends. Only need ~5 active artists. |
| Facebook competition | Don't ask users to leave — pitch integration value ("Facebook can't link WIP to provenance"). |
| NAN data integrity | Three-tier verification. Even unverified digital is better than paper. |
| Community governance | Groups default to `restricted`. Owners approve members. Admin can suspend groups. |
| Email spam from WIP | 30-minute batching window for commission update emails. |

---

## 🔗 REFERENCE DOCUMENTS

| Document | Location | Purpose |
|---|---|---|
| This blueprint | `.agents/docs/master_implementation_blueprint.md` | Single source of truth |
| Feature wishlist | `.agents/docs/feature_wishlist_report.md` | All 26 researched proposals |
| Architecture deep dive | `.agents/docs/platform_architecture_deep_dive.md` | Full ER diagrams, state machines |
| State report | `.agents/docs/model_horse_hub_state_report.md` | Current project state + research Qs |
| External blueprint | `.agents/docs/Research/mhh_implementation_blueprint.md` | Original external spec |
| Blueprint analysis | Brain artifacts `blueprint_analysis.md` | Cross-reference review |

## 📋 WORKFLOW INDEX

| Phase | Workflow | Description |
|---|---|---|
| 1 | `/phase1-supply` | CSV Import, Insurance PDF, Help ID |
| 2 | `/phase2-trust` | Parked Export, Condition History, Chat Guardrails |
| 3 | `/phase3-art-studio` | Artist Profiles, Commissions, WIP Pipeline |
| 4 | `/phase4-competition` | Judge Roles, NAN Tracker, Show Strings, Groups, PWA |
