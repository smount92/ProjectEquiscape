---
description: Phase 3 — The Creator Flywheel (Art Studio). Artist Profiles, Commission Management, WIP Portal, and Hoofprint Pipeline.
---

# Phase 3: The Creator Flywheel (Art Studio)

> **Goal:** Give artists tools so compelling they abandon Instagram DMs + Google Forms, pulling their buyers onto MHH.
> **Pre-requisites:** Phase 1 ✅ and Phase 2 ✅ must be complete. Build must be clean.

// turbo-all

---

## Feature 3A: Artist Profiles & Commission Management

### Task 3A-1: Database Migration — `027_art_studio.sql`

Create `supabase/migrations/027_art_studio.sql`:

```sql
-- ============================================================
-- Migration 027: Art Studio — Artist Profiles & Commissions
-- ============================================================

-- ── Artist Profiles ──
CREATE TABLE IF NOT EXISTS artist_profiles (
  user_id            UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  studio_name        TEXT NOT NULL,
  studio_slug        TEXT UNIQUE NOT NULL,
  specialties        TEXT[] DEFAULT '{}',
  mediums            TEXT[] DEFAULT '{}',
  scales_offered     TEXT[] DEFAULT '{}',
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
CREATE POLICY "Owner inserts own artist profile"
  ON artist_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner updates own artist profile"
  ON artist_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner deletes own artist profile"
  ON artist_profiles FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_artist_profiles_slug ON artist_profiles (studio_slug);
CREATE INDEX idx_artist_profiles_status ON artist_profiles (status);

-- ── Commissions ──
CREATE TABLE IF NOT EXISTS commissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id         UUID NOT NULL REFERENCES users(id),
  client_id         UUID REFERENCES users(id),
  client_email      TEXT,
  horse_id          UUID REFERENCES user_horses(id) ON DELETE SET NULL,
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
  ON commissions FOR UPDATE TO authenticated
  USING (auth.uid() = artist_id)
  WITH CHECK (auth.uid() = artist_id);
CREATE POLICY "Artist deletes commissions"
  ON commissions FOR DELETE TO authenticated
  USING (auth.uid() = artist_id);
CREATE POLICY "Client creates commission requests"
  ON commissions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Artist creates own commissions"
  ON commissions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = artist_id);

CREATE INDEX idx_commissions_artist ON commissions (artist_id, status);
CREATE INDEX idx_commissions_client ON commissions (client_id);

-- ── Commission Updates (WIP Photos, Status Changes, Messages) ──
CREATE TABLE IF NOT EXISTS commission_updates (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id         UUID NOT NULL REFERENCES commissions(id) ON DELETE CASCADE,
  author_id             UUID NOT NULL REFERENCES users(id),
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

CREATE POLICY "Artist views all updates for own commissions"
  ON commission_updates FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM commissions c WHERE c.id = commission_id AND c.artist_id = auth.uid()
  ));
CREATE POLICY "Client views visible updates for own commissions"
  ON commission_updates FOR SELECT TO authenticated
  USING (
    is_visible_to_client = true
    AND EXISTS (
      SELECT 1 FROM commissions c WHERE c.id = commission_id AND c.client_id = auth.uid()
    )
  );
CREATE POLICY "Commission participants create updates"
  ON commission_updates FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM commissions c WHERE c.id = commission_id
    AND (c.artist_id = auth.uid() OR c.client_id = auth.uid())
  ));

CREATE INDEX idx_commission_updates ON commission_updates (commission_id, created_at DESC);
```

**IMPORTANT:** FK references use `users(id)` (the `public.users` table), NOT `auth.users(id)`. This ensures PostgREST joins work correctly (learned from Help ID bug in Phase 1).

**Verification:** Present this SQL to the user for approval. They will run it in the Supabase SQL Editor.

---

### Task 3A-2: Server Actions — `src/app/actions/art-studio.ts`

Create `src/app/actions/art-studio.ts` with these Server Actions:

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
```

**Actions to implement:**

1. `getArtistProfile(userId: string)` — Fetch artist profile by user ID
2. `getArtistProfileBySlug(slug: string)` — Fetch artist profile by slug (for public URL)
3. `createArtistProfile(formData: FormData)` — Create new profile (validate slug uniqueness)
4. `updateArtistProfile(formData: FormData)` — Update profile fields
5. `getArtistCommissions()` — Fetch all commissions where `artist_id = auth.uid()`
6. `getClientCommissions()` — Fetch all commissions where `client_id = auth.uid()`
7. `createCommission(data: {...})` — Client creates a commission request for an artist
8. `updateCommissionStatus(commissionId: string, newStatus: string, note?: string)` — Artist advances commission through workflow. Must also insert a `commission_updates` row with `update_type = 'status_change'`.
9. `addCommissionUpdate(commissionId: string, data: {...})` — Add WIP photo, message, or milestone. Handle image uploads to Supabase Storage at `{artist_id}/commissions/{commission_id}/`.

**Status transition rules (enforce server-side):**
- `requested` → `accepted` | `declined`
- `accepted` → `in_progress` | `cancelled`
- `in_progress` → `review` | `revision`
- `review` → `completed` | `revision`
- `revision` → `in_progress`
- `completed` → `delivered`

**All queries involving user names:** Fetch from `public.users` separately — do NOT use PostgREST joins on `auth.users` FK columns.

---

### Task 3A-3: Artist Profile Setup Page — `src/app/studio/setup/page.tsx`

Create the artist profile setup/edit form:

- **Route:** `/studio/setup`
- **Fields:** Studio Name, Studio Slug (auto-generated from name, editable), Specialties (multi-select checkboxes), Mediums (multi-select), Scales (multi-select), Bio, Status (open/waitlist/closed), Max Slots, Turnaround Range, Price Range, Terms, PayPal.me Link
- **Slug validation:** Show real-time preview like `modelhorsehub.com/studio/your-slug`
- **If profile exists:** Pre-fill all fields for editing

---

### Task 3A-4: Public Studio Page — `src/app/studio/[slug]/page.tsx`

The public-facing artist page:

- **Route:** `/studio/[slug]`
- **Hero:** Studio Name, Status badge (🟢 Open / 🟡 Waitlist / 🔴 Closed), Specialties tags, Bio
- **Commission Queue:** Show active commissions (where `is_public_in_queue = true`). Display: slot number, commission type, status badge. NO client names for privacy — just "Slot 1: Custom Paint — In Progress"
- **Portfolio:** Gallery of the artist's public horses that have `customization_logs` entries (their work)
- **Request Commission button:** Opens modal or navigates to request form (only if status != 'closed')
- **Pricing info:** Price range, turnaround estimate, terms

---

### Task 3A-5: Commission Request Form — `src/app/studio/[slug]/request/page.tsx`

Where clients request a commission:

- **Route:** `/studio/[slug]/request`
- **Fields:** Commission Type (dropdown from artist's specialties), Description, Reference Images (multi-file upload, max 5), Budget
- **Validation:** Artist must be `open` or `waitlist` status
- **On submit:** Creates `commissions` row with `status = 'requested'`, creates a `commission_updates` row with `update_type = 'message'`

---

### Task 3A-6: Artist Dashboard — `src/app/studio/dashboard/page.tsx`

The artist's private commission management hub:

- **Route:** `/studio/dashboard`
- **Layout:** Kanban-style columns OR tabbed view by status:
  - 📥 Requests (new, needs accept/decline)
  - 🎨 In Progress
  - 👁️ Review
  - ✅ Completed
  - 📦 Delivered
- **Each commission card shows:** Client name, type, description preview, status, last update date
- **Quick actions:** Accept/Decline (on requests), Advance Status, Add WIP Photo
- **Stats bar at top:** Open slots (e.g., "3/5 slots filled"), Total active commissions

---

## Feature 3B: WIP Updates & Client Portal

### Task 3B-1: Commission Detail Page — `src/app/studio/commission/[id]/page.tsx`

Shared detail view for both artist and client:

- **Route:** `/studio/commission/[id]`
- **Header:** Commission type, status badge, artist + client names, dates
- **Timeline:** All `commission_updates` displayed chronologically:
  - WIP photos with thumbnails
  - Status changes with before/after
  - Messages
  - Payment milestones
- **Artist actions (if owner):** Add WIP Photo button, Advance Status, Mark Payment Received
- **Client actions (if client):** Request Revision (only during `review` status), Approve
- **Image uploads:** Compress to WebP < 400KB. Store at `{artist_id}/commissions/{commission_id}/{timestamp}.webp`

---

### Task 3B-2: Client "My Commissions" Page — `src/app/studio/my-commissions/page.tsx`

- **Route:** `/studio/my-commissions`
- **List:** All commissions where `client_id = auth.uid()`, grouped by status
- **Each card links to:** `/studio/commission/[id]`
- **Also accessible from:** Link in header user menu dropdown

---

### Task 3B-3: Hoofprint Pipeline Integration

When artist marks a commission as `delivered`:

1. Query all `commission_updates` where `update_type = 'wip_photo'` and `is_visible_to_client = true`
2. If `commission.horse_id` is set, insert each WIP photo into `horse_timeline` with `event_type = 'customization'`
3. Record the artist as creator in `customization_logs`
4. Display a prompt: "Transfer this horse to the client?" → If yes, initiate a Hoofprint transfer

**This is the critical moat feature** — the horse's permanent passport shows its step-by-step creation story.

---

## Feature 3C: Navigation & CSS Integration

### Task 3C-1: Add Navigation Links

- Add "🎨 Art Studio" link to the header nav (desktop + mobile) — between "Shows" and "Help ID"
- Link to `/studio/dashboard` if user has an artist profile, otherwise to `/studio/setup`
- Add "My Commissions" link to user dropdown menu

### Task 3C-2: CSS Styles

Add to `src/app/globals.css` all necessary styles for:

- Studio profile pages (hero, status badges, specialties tags, portfolio grid)
- Commission cards (Kanban layout or tabbed view)
- Commission timeline (WIP photos, status changes, messages)
- Commission request form
- Status badges with colors:
  - `requested` → gray
  - `accepted` → blue
  - `in_progress` → amber
  - `review` → purple
  - `revision` → orange
  - `completed` → green
  - `delivered` → teal
  - `declined`/`cancelled` → red

Use existing design tokens from globals.css. Glass-card style for commission cards.

---

## Verification Checklist

After implementing all tasks:

1. `npm run build` — must compile with zero errors
2. Test artist profile creation at `/studio/setup`
3. Verify public studio page renders at `/studio/[slug]`
4. Test commission request flow from client perspective
5. Test commission management from artist dashboard
6. Test WIP photo upload in commission detail view
7. Verify all RLS policies work (artist sees own commissions, client sees own, public queue visible)
8. Git commit with message: `feat: Phase 3 — Art Studio (Artist Profiles, Commissions, WIP Portal)`
9. Push to main

---

## ⚠️ Common Pitfalls (From Phase 1 & 2 Bugs)

1. **FK Joins:** All `user_id` / `artist_id` / `client_id` FKs in migration MUST reference `users(id)` (public table), NOT `auth.users(id)`. This ensures PostgREST joins work. See Help ID fix for context.
2. **Hidden required inputs:** Never put `required` on a hidden file input. Use manual JS validation.
3. **Font loading:** If generating PDFs, use locally bundled `.ttf` fonts from `/fonts/`, not Google Fonts CDN URLs.
4. **Image compression:** All uploads must go through `compressImage()` utility before Supabase Storage.
5. **revalidatePath:** Call after every mutation to ensure SSR pages refresh.
