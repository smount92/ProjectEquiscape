---
description: Core Monetization — promoted listings, ISO feed bounties, a-la-carte PDFs, Studio Pro artist tier (all via Stripe Checkout)
---

# Core Monetization (Microtransactions & Studio Pro)

> **Constraint:** All monetization uses Stripe Checkout Sessions. MHH does NOT hold escrow or process peer-to-peer payments. Each feature creates a new Checkout Session URL and redirects.
> **Last Updated:** 2026-03-28
> **Prerequisite:** Existing Stripe integration (`/api/checkout/route.ts`, `/api/webhooks/stripe/route.ts`)
> **Current Stripe Architecture:** Pro subscription checkout at `/api/checkout` → webhook at `/api/webhooks/stripe` → sets `app_metadata.tier` via admin client.

// turbo-all

---

# ═══════════════════════════════════════
# FEATURE 1: Promoted Listings ($2.99)
# ═══════════════════════════════════════

## Step 1.1 — Database migration

**Target File:** `supabase/migrations/103_promoted_listings.sql` (NEW FILE)

```sql
-- ============================================================
-- Migration 103: Promoted Listings
-- 1. Add is_promoted_until column to user_horses
-- 2. Create index for efficient promoted queries
-- ============================================================

ALTER TABLE user_horses
ADD COLUMN IF NOT EXISTS is_promoted_until TIMESTAMPTZ DEFAULT NULL;

-- Index for finding currently promoted horses
CREATE INDEX IF NOT EXISTS idx_user_horses_promoted
ON user_horses (is_promoted_until)
WHERE is_promoted_until IS NOT NULL;

-- RLS: users can read promoted status on any horse (public)
-- (existing SELECT policies already cover this)
```

## Step 1.2 — Create promote checkout endpoint

**Target File:** `src/app/api/checkout/promote/route.ts` (NEW FILE)

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Stripe from "stripe";

export async function POST(request: Request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { horseId } = await request.json();
    if (!horseId) {
        return NextResponse.json({ error: "Missing horseId" }, { status: 400 });
    }

    // Verify user owns this horse
    const { data: horse } = await supabase
        .from("user_horses")
        .select("id, custom_name")
        .eq("id", horseId)
        .eq("user_id", user.id)
        .single();

    if (!horse) {
        return NextResponse.json({ error: "Horse not found" }, { status: 404 });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: "2026-02-25.clover",
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://modelhorsehub.com";

    const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [{
            price_data: {
                currency: "usd",
                product_data: {
                    name: `Promote: ${horse.custom_name}`,
                    description: "7-day promoted listing in marketplace and grids",
                },
                unit_amount: 299, // $2.99
            },
            quantity: 1,
        }],
        client_reference_id: user.id,
        metadata: {
            type: "promote_listing",
            horse_id: horseId,
            supabase_user_id: user.id,
        },
        success_url: `${appUrl}/stable/${horseId}?promoted=success`,
        cancel_url: `${appUrl}/stable/${horseId}`,
    });

    return NextResponse.json({ url: session.url });
}
```

## Step 1.3 — Handle promote webhook event

**Target File:** `src/app/api/webhooks/stripe/route.ts`

Add a new case inside the `checkout.session.completed` handler:

```ts
// After the existing Pro subscription case:
if (metadata.type === "promote_listing") {
    const horseId = metadata.horse_id;
    const promotedUntil = new Date();
    promotedUntil.setDate(promotedUntil.getDate() + 7); // 7 days

    await adminClient
        .from("user_horses")
        .update({ is_promoted_until: promotedUntil.toISOString() })
        .eq("id", horseId);
}
```

## Step 1.4 — Update grid queries to show promoted first

**Target Files:** `StableGrid.tsx`, `ShowRingGrid.tsx`, `DiscoverGrid.tsx`

In any query that lists horses, add ordering to float promoted horses:

```ts
.order("is_promoted_until", { ascending: false, nullsFirst: false })
```

Add a visual indicator for promoted cards:
```tsx
{horse.is_promoted_until && new Date(horse.is_promoted_until) > new Date() && (
    <span className="absolute top-2 left-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
        ⭐ Promoted
    </span>
)}
```

## Step 1.5 — Add "Promote" button to horse detail page

**Target File:** `src/app/stable/[id]/page.tsx`

Add a promote CTA for horses the current user owns:

```tsx
<button
    className="btn btn-secondary"
    onClick={async () => {
        const res = await fetch("/api/checkout/promote", {
            method: "POST",
            body: JSON.stringify({ horseId: horse.id }),
        });
        const { url } = await res.json();
        if (url) window.location.href = url;
    }}
>
    ⭐ Promote ($2.99 / 7 days)
</button>
```

---

# ═══════════════════════════════════════
# FEATURE 2: ISO Feed Bounties ($1.99)
# ═══════════════════════════════════════

## Step 2.1 — Database migration

**Target File:** `supabase/migrations/103_promoted_listings.sql` (add to same migration)

```sql
-- ISO Feed Bounties
ALTER TABLE wishlist_items
ADD COLUMN IF NOT EXISTS is_boosted_until TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_wishlist_items_boosted
ON wishlist_items (is_boosted_until)
WHERE is_boosted_until IS NOT NULL;
```

## Step 2.2 — Create bounty checkout endpoint

**Target File:** `src/app/api/checkout/boost-iso/route.ts` (NEW FILE)

Same pattern as promote: create a `mode: "payment"` session with `unit_amount: 199`, metadata `type: "boost_iso"` and `wishlist_item_id`.

## Step 2.3 — Handle in webhook

**Target File:** `src/app/api/webhooks/stripe/route.ts`

```ts
if (metadata.type === "boost_iso") {
    const boostedUntil = new Date();
    boostedUntil.setHours(boostedUntil.getHours() + 48);

    await adminClient
        .from("wishlist_items")
        .update({ is_boosted_until: boostedUntil.toISOString() })
        .eq("id", metadata.wishlist_item_id);
}
```

## Step 2.4 — Show boosted ISOs in Activity Feed

**Target File:** `src/components/UniversalFeed.tsx`

Query boosted wishlist items and render them as pinned "🔍 WANTED" cards at the top of the feed with a distinctive border:

```tsx
<div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4">
    <span className="text-xs font-bold text-amber-700">🔍 ISO — WANTED</span>
    {/* Wishlist item details */}
</div>
```

---

# ═══════════════════════════════════════
# FEATURE 3: A La Carte Insurance PDF ($1.99)
# ═══════════════════════════════════════

## Step 3.1 — Create insurance checkout endpoint

**Target File:** `src/app/api/checkout/insurance-report/route.ts` (NEW FILE)

Same pattern: `mode: "payment"`, `unit_amount: 199`, metadata `type: "insurance_report"` and `horse_id`.

## Step 3.2 — Handle in webhook — grant one-time access

**Target File:** `src/app/api/webhooks/stripe/route.ts`

```ts
if (metadata.type === "insurance_report") {
    // Store a one-time access token
    await adminClient.from("purchased_reports").insert({
        user_id: metadata.supabase_user_id,
        horse_id: metadata.horse_id,
        report_type: "insurance",
        purchased_at: new Date().toISOString(),
    });
}
```

> **Migration needed:** Create `purchased_reports` table in the migration.

## Step 3.3 — Gate the Insurance Report PDF endpoint

**Target File:** `src/app/api/insurance-report/route.ts`

Before generating the PDF, check:
1. Is user tier `pro` or `studio`? → Allow
2. Does a row in `purchased_reports` exist for this user + horse? → Allow
3. Otherwise → Return 403

---

# ═══════════════════════════════════════
# FEATURE 4: Studio Pro Tier ($9.99/mo)
# ═══════════════════════════════════════

## Step 4.1 — Create Studio Pro Stripe product

**Manual step:** In Stripe Dashboard:
1. Products → Create new product: "MHH Studio Pro"
2. Price: $9.99/month (recurring)
3. Copy the Price ID → add as `STRIPE_STUDIO_PRO_PRICE_ID` env var

## Step 4.2 — Create studio checkout endpoint

**Target File:** `src/app/api/checkout/studio-pro/route.ts` (NEW FILE)

Same pattern as `/api/checkout/route.ts` but uses `STRIPE_STUDIO_PRO_PRICE_ID` and sets metadata `type: "studio_pro"`.

## Step 4.3 — Handle in webhook

**Target File:** `src/app/api/webhooks/stripe/route.ts`

```ts
if (metadata.type === "studio_pro") {
    await adminClient.auth.admin.updateUserById(userId, {
        app_metadata: {
            tier: "studio",
            stripe_customer_id: session.customer as string,
        },
    });
}
```

## Step 4.4 — Unlock Studio Pro features

**Files to update:**
- `src/components/ArtistBrowser.tsx` — add ✨ verified badge, sort `studio` tier artists first
- `src/app/studio/dashboard/page.tsx` — remove `maxSlots` restriction for studio tier
- `src/app/studio/setup/page.tsx` — show Studio Pro upsell if tier is `free` or `pro`

## Step 4.5 — Migration for purchased_reports table

**Target File:** `supabase/migrations/103_promoted_listings.sql` (add to same migration)

```sql
-- Purchased Reports (a-la-carte PDF access)
CREATE TABLE IF NOT EXISTS purchased_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    horse_id UUID NOT NULL REFERENCES user_horses(id),
    report_type TEXT NOT NULL DEFAULT 'insurance',
    purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE purchased_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own purchases"
ON purchased_reports FOR SELECT
USING (auth.uid() = user_id);
```

---

## Verify All Features

```
cmd /c "npx next build 2>&1 | findstr /C:error /C:Error /C:compiled"
```

```
cmd /c "npx vitest run 2>&1"
```

Check that:
- [ ] Migration 103 applies cleanly
- [ ] All 4 checkout endpoints return Stripe session URLs
- [ ] Webhook handler routes to correct logic based on `metadata.type`
- [ ] Promoted horses sort to top of grids
- [ ] Build passes
- [ ] All tests pass

---

## Commit

```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "feat: core monetization — promoted listings, ISO bounties, a-la-carte PDFs, Studio Pro tier"
```
