---
description: Phase 3 — The Creator Flywheel (Art Studio) + Transfer Architecture Fixes. Artist Profiles, Commission Management, WIP Portal, Hoofprint Pipeline, and transfer hardening.
---

# Phase 3: The Creator Flywheel (Art Studio) + Transfer Hardening

> **Goal:** Give artists tools so compelling they abandon Instagram DMs + Google Forms, pulling their buyers onto MHH. Also harden the transfer system based on ownership audit.
> **Pre-requisites:** Phase 1 ✅ and Phase 2 ✅ must be complete. Build must be clean.

// turbo-all

---

## PRIORITY 0: Transfer Architecture Fixes (Do First!)

> These fix ownership-related RLS bugs discovered during testing. Must be run BEFORE Phase 3 features.

### Task 0A: Database Migration — `029_transfer_improvements.sql`

Create `supabase/migrations/029_transfer_improvements.sql`:

```sql
-- ============================================================
-- Migration 029: Transfer Architecture Improvements
-- Fixes: ownership_history RLS, pedigree UPDATE, ghost remnants
-- ============================================================

-- 1. Fix horse_ownership_history SELECT
--    Problem: New owner can't see chain of custody on private horses
--    because the policy uses `auth.uid() = owner_id` (the record's
--    owner, not the horse's current owner).
DROP POLICY IF EXISTS "horse_ownership_history_select" ON horse_ownership_history;
CREATE POLICY "horse_ownership_history_select"
  ON horse_ownership_history FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = owner_id
    OR EXISTS (
      SELECT 1 FROM user_horses h
      WHERE h.id = horse_ownership_history.horse_id
        AND h.owner_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM user_horses h
      WHERE h.id = horse_ownership_history.horse_id
        AND h.is_public = true
    )
  );

-- 2. Fix horse_pedigrees UPDATE
--    Problem: New owner can't update pedigree on transferred horse
--    because UPDATE policy uses `auth.uid() = user_id` (the original
--    creator, not the current owner).
DROP POLICY IF EXISTS "Owner can update own pedigree" ON horse_pedigrees;
DROP POLICY IF EXISTS "Owner can update pedigree" ON horse_pedigrees;
CREATE POLICY "Owner can update pedigree"
  ON horse_pedigrees FOR UPDATE TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM user_horses h
      WHERE h.id = horse_pedigrees.horse_id
        AND h.owner_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_horses h
      WHERE h.id = horse_pedigrees.horse_id
        AND h.owner_id = (SELECT auth.uid())
    )
  );

-- 3. Add snapshot columns for ghost remnants
--    When a horse is transferred, the seller keeps a ghost card
--    showing the horse's name and thumbnail at time of transfer.
ALTER TABLE horse_ownership_history
  ADD COLUMN IF NOT EXISTS horse_name TEXT,
  ADD COLUMN IF NOT EXISTS horse_thumbnail TEXT;
```

**Present this SQL to the user for approval.** They will run it in the Supabase SQL Editor.

---

### Task 0B: Update Transfer Actions — Clear Vault + Save Ghost Snapshot

Modify **both** `claimTransfer()` in `src/app/actions/hoofprint.ts` and `claimParkedHorse()` in `src/app/actions/parked-export.ts`.

**In both functions, after the ownership transfer step (step 3), add:**

```typescript
// ── Clear financial vault (seller's data does not transfer) ──
await admin.from("financial_vault")
    .update({
        purchase_price: null,
        purchase_date: null,
        estimated_current_value: null,
        insurance_notes: null,
    })
    .eq("horse_id", t.horse_id);
```

**In both functions, when closing sender's ownership record (step 1), add the snapshot fields:**

First, fetch the horse's primary thumbnail URL:

```typescript
// Get thumbnail for ghost remnant
let thumbnailUrl: string | null = null;
try {
    const { data: thumbImg } = await admin
        .from("horse_images")
        .select("image_url")
        .eq("horse_id", t.horse_id)
        .eq("angle_profile", "Primary_Thumbnail")
        .maybeSingle();
    thumbnailUrl = (thumbImg as { image_url: string } | null)?.image_url || null;
} catch { /* optional */ }
```

Then update the ownership closing to include snapshot:

```typescript
// Close sender's ownership record with ghost snapshot
await admin.from("horse_ownership_history")
    .update({
        released_at: new Date().toISOString(),
        horse_name: horseName,       // Already fetched earlier
        horse_thumbnail: thumbnailUrl // Snapshot for ghost card
    })
    .eq("horse_id", t.horse_id)
    .eq("owner_id", t.sender_id)
    .is("released_at", null);
```

---

### Task 0C: Transfer History View — `getTransferHistory()` action

Add to `src/app/actions/hoofprint.ts`:

```typescript
/** Get horses the current user has transferred away (ghost remnants) */
export async function getTransferHistory(): Promise<{
    id: string;
    horseId: string;
    horseName: string | null;
    horseThumbnail: string | null;
    salePrice: number | null;
    isPricePublic: boolean;
    acquisitionType: string;
    releasedAt: string;
}[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: records } = await supabase
        .from("horse_ownership_history")
        .select("id, horse_id, horse_name, horse_thumbnail, sale_price, is_price_public, acquisition_type, released_at")
        .eq("owner_id", user.id)
        .not("released_at", "is", null)
        .order("released_at", { ascending: false });

    if (!records) return [];

    return (records as any[]).map(r => ({
        id: r.id,
        horseId: r.horse_id,
        horseName: r.horse_name,
        horseThumbnail: r.horse_thumbnail,
        salePrice: r.sale_price,
        isPricePublic: r.is_price_public,
        acquisitionType: r.acquisition_type,
        releasedAt: r.released_at,
    }));
}
```

### Task 0D: Dashboard "Transfer History" Section

On the main dashboard page, add a section below the horse grid:

**If `getTransferHistory()` returns results**, show:

```
📤 Transfer History
─────────────────────
🐴 [Horse Name]       [Horse Thumbnail]
   Transferred March 9, 2026
   Sale: $125.00
   [View Hoofprint →]
```

- Show as faded/ghost-style cards (reduced opacity, dashed border)
- Each card links to `/community/[horse_id]` (the horse's public passport, if still public)
- Only show `sale_price` if `is_price_public = true`
- Use a collapsible section so it doesn't clutter the main stable view
- CSS: `.transfer-ghost-card` — glass card with 0.6 opacity, dashed border, grayscale thumbnail

---

## Feature 3A: Artist Profiles & Commission Management

### Task 3A-1: Database Migration — `028_art_studio.sql`

**This migration already exists at `supabase/migrations/028_art_studio.sql`.** Verify it's been run. If not, present to user.

The migration creates 3 tables: `artist_profiles`, `commissions`, `commission_updates`.

**IMPORTANT:** FK references use `users(id)` (the `public.users` table), NOT `auth.users(id)`. This ensures PostgREST joins work correctly (learned from Help ID bug in Phase 1).

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
- Transfer ghost cards (`.transfer-ghost-card` — glass card with 0.6 opacity, dashed border, grayscale thumbnail)
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
2. Run migration 029 (transfer improvements) in Supabase SQL Editor
3. Test transfer between accounts — vault is cleared, ghost card appears
4. Test artist profile creation at `/studio/setup`
5. Verify public studio page renders at `/studio/[slug]`
6. Test commission request flow from client perspective
7. Test commission management from artist dashboard
8. Test WIP photo upload in commission detail view
9. Verify all RLS policies work (artist sees own commissions, client sees own, public queue visible)
10. Git commit with message: `feat: Phase 3 — Art Studio + Transfer Hardening`
11. Push to main

---

## ⚠️ Common Pitfalls (From Phase 1, 2, & Transfer Audit)

1. **FK Joins:** All `user_id` / `artist_id` / `client_id` FKs in migration MUST reference `users(id)` (public table), NOT `auth.users(id)`. This ensures PostgREST joins work. See Help ID fix for context.
2. **Hidden required inputs:** Never put `required` on a hidden file input. Use manual JS validation.
3. **Font loading:** If generating PDFs, use locally bundled `.ttf` fonts from `/fonts/`, not Google Fonts CDN URLs.
4. **Image compression:** All uploads must go through `compressImage()` utility before Supabase Storage.
5. **revalidatePath:** Call after every mutation to ensure SSR pages refresh.
6. **Transfer-safe RLS:** For any table with horse-related data, SELECT policies must include an ownership check (`EXISTS(user_horses.owner_id)`), not just `auth.uid() = user_id`. The `user_id` is the record creator, not the current owner.
7. **Financial vault on transfer:** Always clear vault after ownership change. Sale price lives in `horse_ownership_history` / `horse_transfers`, not the vault.
8. **Photo limits:** Tier-based photo limits apply on UPLOAD only, never on DISPLAY. A transferred horse keeps all its photos regardless of new owner's tier.
