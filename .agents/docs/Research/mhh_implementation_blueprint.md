Here is the comprehensive, highly structured architectural blueprint. I have formatted this specifically as an Agent-Facing Implementation Document.

It is written with explicit technical constraints, database schemas, and architectural logic so that an AI coding agent (like Cursor, Devin, Windsurf, or your custom agents) can read it and immediately understand the required data models, UI components, and API boundaries without hallucinating incorrect tools.

You can copy the markdown block below and save it as mhh_implementation_blueprint.md in your project's .agents/docs/ folder (or just paste it directly into your AI's context window when you start a new session).

Markdown
# Model Horse Hub (MHH) — Agent Implementation Blueprint

> **Target Audience:** Autonomous AI Coding Agents / Developer Assistants
> **Context:** You are building features for a highly specialized hobbyist platform (Model Horse Hub). Do not substitute generic ecommerce logic for the specialized logic detailed here. Provenance, financial privacy, and physical-to-digital trust are the core product pillars.
> **Tech Stack:** Next.js 16 (App Router), React 19, Supabase (PostgreSQL + Auth + Storage), Tailwind CSS (Glassmorphism UI tokens), Resend (Emails).

## 🚨 GLOBAL AGENT DIRECTIVES (CRITICAL)
1. **Security (RLS):** Every new Supabase table MUST have strict Row Level Security (RLS) policies enabled. Financial data (`financial_vault`) must NEVER be exposed on public endpoints or joined in public queries.
2. **Server/Client Boundary:** Use React Server Components (RSC) by default for data fetching. Use Next.js Server Actions (`"use server"`) for database mutations. Only use Client Components (`"use client"`) when interactivity, hooks, or browser APIs (like `FileReader` or local storage) are required.
3. **Image Compression:** All client-side image uploads MUST use client-side compression (e.g., `browser-image-compression`) to restrict files to WebP format, < 400KB, *before* hitting Supabase Storage to protect egress costs. Free tiers have a hard 5-photo limit per horse.
4. **No Third-Party Escrow:** Do not build Stripe or payment processors. Rely purely on UI guardrails and external PayPal.me links.

---

## 🚀 PHASE 1: Supply-Side Liquidity & Single-Player Value
**Goal:** Unblock "Super-Collectors" (whales), provide immediate single-player offline value, and create SEO magnets to siphon traffic from Facebook.

### Feature 1A: Batch CSV Import & Reconciliation UI
**Dependencies:** `papaparse` (client-side CSV parsing), `fuzzysort` or Postgres `pg_trgm` (for fuzzy matching).
**Workflow:**
1. **Client-Side (`"use client"`):** User uploads CSV. `papaparse` reads it locally in the browser (saving server bandwidth).
2. **Mapping UI:** User maps their CSV columns to the MHH schema (`name`, `mold`, `condition`, `purchase_price`).
3. **Server Action (`matchCsvBatch`):** Receives mapped JSON. Queries `reference_releases`. Runs a fuzzy match algorithm.
4. **Reconciliation UI:** Displays 3 states: 
   - *Perfect Matches* (Green) - ready to import.
   - *Review Needed* (Yellow) - shows dropdown of top 3 DB matches to select.
   - *No Match* (Red) - user can create as "Custom/Unknown" or search manually.
5. **Execution (`executeBatchImport`):** Inserts rows into `user_horses` and `financial_vault` inside a single Supabase Postgres Transaction (RPC) to ensure data integrity.

### Feature 1B: Insurance PDF Generator
**Dependencies:** `@react-pdf/renderer` (renders React components directly to PDF client-side).
**Workflow:**
1. **Server Action:** Fetches `user_horses` strictly joined with `financial_vault` for the authenticated `auth.uid()`. *(Agent Note: Must convert remote Supabase images to base64 strings if strict CORS blocks the PDF renderer).*
2. **PDF Template (`components/pdf/InsuranceReport.tsx`):**
   - *Cover Page:* User name, Date stamped, Total model count, Total vault value, MHH branding.
   - *Summary Table:* 1-line per horse (Name, Reference #, Condition, Estimated Value).
   - *Detail Pages:* Grid layout (4 horses per page). Fields: Primary Photo (thumbnail), Name, Finish, Condition, Paid, Value.
3. **Client Action:** "Download PDF" button triggers the client-side `@react-pdf` blob generation. Keeps heavy PDF generation off Vercel serverless functions.

### Feature 1C: "Help Me ID This Model" (Community SEO Magnet)
**Database Schema (Supabase SQL):**
```sql
CREATE TABLE id_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  image_url TEXT NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'open', -- 'open', 'resolved'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE id_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID REFERENCES id_requests(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  reference_id UUID REFERENCES reference_releases(id),
  upvotes INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
Workflow: Feed of open requests (/community/help-id). Users suggest matches from the DB. When the Original Poster (OP) clicks "Accept," status changes to resolved, and OP is prompted to 1-click add the reference model to their digital stable.

🦠 PHASE 2: Trust Architecture & Viral Loops
Goal: Turn off-platform sales into user acquisition loops and protect marketplace integrity without acting as an escrow.

Feature 2A: The "Parked" Export & Certificate of Authenticity (CoA)
Dependencies: qrcode.react.
Database Schema Updates:

Update user_horses.status enum/check to include 'parked'.

Add claim_pin (VARCHAR 6, UNIQUE) to horse_transfers table.
Workflow:

Export: User clicks "Sell Off-Platform". Server Action locks the horse (status = 'parked'), freezing its Hoofprint history, and generates a secure 6-character PIN.

CoA Generation: Client generates a printable 1-page PDF containing the horse's Hoofprint timeline and a large QR Code linking to https://modelhorsehub.com/claim/[PIN].

Viral Claim: Unauthenticated users scanning the QR hit the /claim/[PIN] route, see a beautiful, locked Hoofprint page, and are prompted to create a free account to input the PIN and claim the model into their vault.

Feature 2B: Condition History Ledger
Database Schema (Supabase SQL):

SQL
CREATE TABLE condition_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  horse_id UUID REFERENCES user_horses(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES auth.users(id),
  old_condition VARCHAR(50),
  new_condition VARCHAR(50) NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
Workflow: Implement a Server Action (or Postgres Trigger). Whenever user_horses.condition is updated, prompt the user for an optional note, and insert a row into condition_history. Display this log permanently on the public Hoofprint timeline to create physical accountability.

Feature 2C: Chat UI Guardrails & Rating Constraints
Workflow:

Defensive UI: In the Native Inbox <MessageInput />, add an onChange regex check: /(venmo|zelle|paypal f&f|friends and family)/i. If matched, inject a visually distinct, un-dismissible system warning into the chat UI: "🛡️ Protect yourself: Always use PayPal Goods & Services for off-platform payments."

Trust Signals: Display the seller's account_age and successful_transfers count directly in the chat header.

Review Constraint: In the submitRating Server Action, query the horse_transfers table. if (!transferExistsBetween(userA, userB)) throw new Error("Ratings require a completed Hoofprint transfer.")

🎨 PHASE 3: The Creator Flywheel (Artist Economy)
Goal: Give artists a tool so good they abandon Instagram DMs + Google Forms, automatically pulling their buyers onto MHH.

Feature 3A: Artist Bio Links & Commission Kanban
Database Schema (Supabase SQL):

SQL
CREATE TABLE artist_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  studio_name TEXT NOT NULL,
  alias TEXT UNIQUE NOT NULL, -- e.g., [mhh.com/studio/amanda](https://mhh.com/studio/amanda)
  paypal_me_link TEXT,
  slots_open INT DEFAULT 0,
  is_accepting_commissions BOOLEAN DEFAULT true
);
CREATE TABLE commissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_id UUID REFERENCES auth.users(id),
  client_id UUID REFERENCES auth.users(id), -- Nullable initially
  client_email TEXT, -- Used for external comms
  horse_id UUID REFERENCES user_horses(id), -- Nullable
  status VARCHAR(50) DEFAULT 'prep', -- requested, prep, sculpting, painting, completed
  price DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
Workflow: Public URL (mhh.com/studio/[alias]) shows open slots for Instagram bios. Internal artist dashboard utilizes a drag-and-drop Kanban board to manage commission states.

Feature 3B: Automated Updates & WIP-to-Hoofprint Pipeline
Database Schema (Supabase SQL):

SQL
CREATE TABLE commission_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  commission_id UUID REFERENCES commissions(id) ON DELETE CASCADE,
  image_url TEXT,
  note TEXT,
  requires_payment BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
Workflow:

Automated Comms: When an artist adds a row to commission_updates, trigger a Next.js Server Action -> Resend API call to email the client. If requires_payment is true, inject the artist's paypal_me_link into the email. MHH handles no money.

The Pipeline (Critical Moat): When commission status hits completed and the artist clicks "Transfer to Client":

System queries all commission_updates images and maps them directly into the horse_timeline table.

Initiates auto-transfer to client.

Result: The digital horse transfers, and its provenance timeline is permanently populated with the step-by-step creation photos.

🏆 PHASE 4: Competition Engine & Offline Support
Goal: Modernize live showing, verify histories, and ensure the app works in dead cell zones (fairgrounds).

Feature 4A: Verified Judge Roles
Database Schema Updates:

Add role column to the user table (e.g., 'user', 'judge', 'admin').

Add verification_tier enum to show_records ('self_reported', 'verified').
Workflow: On the horse's Passport UI, map through show_records. If verification_tier === 'self_reported', render a gray badge. If verified (only writable by a user with the judge role), render a glowing Gold "MHH Verified" badge.

Feature 4B: PWA & Offline "Show Mode" (IndexedDB)
Dependencies: @serwist/next (Modern PWA implementation for App Router), idb-keyval.
Workflow:

PWA Setup: Configure serwist in next.config.mjs to cache static assets and generate a manifest.json.

Offline Data Store: Add a "Make String Available Offline" toggle on the show planner. Fetch the user's show string JSON and highly compressed base64 thumbnails. Store in the browser's IndexedDB.

Offline Sync Queue: If navigator.onLine === false and a user logs a show placing, save the mutation payload to an offline_mutations queue in IndexedDB.

Background Sync: Add a window.addEventListener('online') hook to automatically flush the queue to Supabase Server Actions when Wi-Fi returns.

End of Blueprint.
Agent instructions: Acknowledge these guidelines. When the user prompts you to begin, start strictly sequentially with Phase 1, Feature 1A. Always present Supabase DB Migrations for approval before writing component code.


### How to use this with your AI:
1. When you start a new session with Cursor, Windsurf, or Devin, paste this entire document into the chat (or reference the file) and say: 
> *"Read and acknowledge this architecture blueprint. We are starting on Phase 1, Feature 1A (Batch CSV Import). Please write the Supabase migration for any necessary indexes first, then build the Next.js Client Component for parsing the CSV, and finally the Server Action for fuzzy matching."*

Because this document explicitly defines the boundaries (Next.js App Router rules, RLS requirements, specific libraries, and the exact order of operations), it acts as a "straitjacket" that prevents the AI from getting confused, importing deprecated React libraries, or hallucinating insecure database queries.