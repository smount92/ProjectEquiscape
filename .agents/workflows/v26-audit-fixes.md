---
description: "Fix 8 incomplete items from V25/V26 audit. Missing server actions, UI integrations, and life stage dropdowns. All migrations are already deployed."
---

# V25/V26 Audit Fix Workflow

> **Scope:** 8 items that have gaps between deployed migrations and actual code.
> **Pre-requisite:** All migrations (064–070) already exist. Build currently passes.
> **Note:** Items previously thought missing were found on re-inspection:
>   - V25.2 Art Studio Missing Link: ✅ `CommissionRequestForm.tsx` has horse picker, `LinkHorseToCommission.tsx` exists, commission page imports both
>   - V25.4 Expert-Judged Shows: ✅ `CreateEventPage` has judging method radio toggle, `AssignPlacings.tsx` exists
>   - V25.5 Community Moderation: ✅ `moderation.ts` has all 4 actions, `ReportButton.tsx` exists, placed on public passport
>   - V26.2 AI Vision Client: ✅ `add-horse/page.tsx` line 196 checks `data.not_equine`
>   - V26.4 Bundle Skew: ✅ `makeOffer()` already accepts `isBundle` and writes metadata

---

## FIX 1: `linkHorseToCommission` Server Action Missing

**Status:** Component exists, imports the action via dynamic import, but the action doesn't exist in `art-studio.ts`.

**File:** `src/app/actions/art-studio.ts`

### Step 1.1 — Add the action

Add to `art-studio.ts`:

```typescript
/** Artist links a horse to a commission (for WIP→Hoofprint pipeline) */
export async function linkHorseToCommission(
    commissionId: string,
    horseId: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    // Verify user is the artist on this commission
    const { data: commission } = await supabase
        .from("commissions")
        .select("artist_id")
        .eq("id", commissionId)
        .single();

    if (!commission || (commission as { artist_id: string }).artist_id !== user.id) {
        return { success: false, error: "Only the artist can link a horse." };
    }

    const { error } = await supabase
        .from("commissions")
        .update({ horse_id: horseId })
        .eq("id", commissionId);

    if (error) return { success: false, error: error.message };

    revalidatePath(`/studio/commission/${commissionId}`);
    return { success: true };
}
```

---

## FIX 2: `createEvent` Doesn't Accept `judgingMethod`

**Status:** CreateEventPage passes `judgingMethod` to `createEvent()`, but the action doesn't accept it.

**File:** `src/app/actions/events.ts` — `createEvent()`

### Step 2.1 — Add `judgingMethod` to function signature

Find `createEvent()`. Add `judgingMethod?: "community_vote" | "expert_judge"` to its data parameter.

### Step 2.2 — Include in insert

In the `.insert()` call, add:

```typescript
judging_method: data.judgingMethod || "community_vote",
```

### Step 2.3 — Wire `AssignPlacings` into event detail page

In `src/app/community/events/[id]/page.tsx`:
- Fetch `judging_method` in the event query
- If `judging_method === "expert_judge"` AND user is event creator, render `<AssignPlacings />` instead of vote buttons
- If `judging_method === "expert_judge"` AND user is NOT creator, hide vote buttons and show "This show is expert-judged."

---

## FIX 3: Admin Page Missing Reports Section

**Status:** `moderation.ts` has all actions, `ReportButton` is on the public passport, but the admin page doesn't display reports.

**File:** `src/app/admin/page.tsx`

### Step 3.1 — Import and fetch

```typescript
import { getOpenReports } from "@/app/actions/moderation";
import ReportActions from "@/components/ReportActions";
```

In the data fetching section:
```typescript
const reports = await getOpenReports();
```

### Step 3.2 — Add reports section

After existing admin content, add:

```tsx
<div className="admin-section">
    <h2 style={{ marginBottom: "var(--space-md)" }}>
        🚩 Open Reports
        {reports.length > 0 && (
            <span style={{ fontSize: "calc(0.85rem * var(--font-scale))", color: "var(--color-text-muted)", marginLeft: "var(--space-sm)" }}>
                ({reports.length})
            </span>
        )}
    </h2>
    {reports.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)" }}>No open reports. 🎉</p>
    ) : (
        reports.map(report => (
            <div key={report.id} className="card" style={{ padding: "var(--space-md)", marginBottom: "var(--space-sm)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-xs)" }}>
                    <strong>{report.reason}</strong>
                    <span style={{ fontSize: "calc(var(--font-size-xs) * var(--font-scale))", color: "var(--color-text-muted)" }}>
                        {report.targetType} · {new Date(report.createdAt).toLocaleDateString()}
                    </span>
                </div>
                <p style={{ fontSize: "calc(var(--font-size-sm) * var(--font-scale))", marginBottom: "var(--space-xs)" }}>
                    Reported by: {report.reporterAlias} · Target: {report.targetId.slice(0, 8)}…
                </p>
                {report.details && (
                    <p style={{ fontSize: "calc(var(--font-size-sm) * var(--font-scale))", color: "var(--color-text-muted)" }}>
                        {report.details}
                    </p>
                )}
                <ReportActions reportId={report.id} />
            </div>
        ))
    )}
</div>
```

---

## FIX 4: Buyer Offer Retraction

**Status:** No `retractOffer()` action exists. Buyers are stuck if sellers ghost.

**Files:**
- `src/app/actions/transactions.ts` — add `retractOffer()`
- Offer card UI — add "Retract Offer" button

### Step 4.1 — Create `retractOffer()`

Add to `src/app/actions/transactions.ts` (after `cancelTransaction`):

```typescript
/** Buyer retracts their offer while still in offer_made state */
export async function retractOffer(
    transactionId: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    const admin = getAdminClient();
    const { data: txn } = await admin
        .from("transactions")
        .select("id, status, party_a_id, party_b_id, horse_id, conversation_id")
        .eq("id", transactionId)
        .single();

    if (!txn) return { success: false, error: "Transaction not found." };
    const t = txn as { id: string; status: string; party_a_id: string; party_b_id: string; horse_id: string; conversation_id: string };

    // Only buyer (party_b) can retract; only from offer_made
    if (t.party_b_id !== user.id) return { success: false, error: "Only the buyer can retract an offer." };
    if (t.status !== "offer_made") return { success: false, error: "Offer can only be retracted while pending." };

    await admin.from("transactions").update({ status: "cancelled" }).eq("id", transactionId);

    const { data: buyerProfile } = await supabase.from("users").select("alias_name").eq("id", user.id).single();
    const buyerAlias = (buyerProfile as { alias_name: string } | null)?.alias_name || "Buyer";
    await createNotification({
        userId: t.party_a_id,
        type: "offer",
        actorId: user.id,
        content: `@${buyerAlias} retracted their offer.`,
        conversationId: t.conversation_id,
    });

    revalidatePath(`/inbox/${t.conversation_id}`);
    return { success: true };
}
```

### Step 4.2 — Add retract button to offer UI

Find where transactions are rendered in the inbox/chat. Add for buyer when `status === "offer_made"`:

```tsx
<button className="btn btn-ghost btn-sm" onClick={() => retractOffer(txn.id)}>
    ↩️ Retract Offer
</button>
```

---

## FIX 5: Guest Client Portal Code

**Status:** Migration 069 adds `guest_token` to `commissions`. Commission detail page already has guest mode code (lines 35–56). Need to verify `getCommission()` fetches `guest_token`.

**File:** `src/app/actions/art-studio.ts` — `getCommission()`

### Step 5.1 — Add `guest_token` to commission query

In `getCommission()`, add `guest_token` to the `.select()` clause so it's available to the page.

### Step 5.2 — Verify GuestLinkButton works

The component exists at `src/components/GuestLinkButton.tsx` and is already imported/rendered on the commission page (line 7, lines 186–190). Verify it compiles.

---

## FIX 6: Show String Duplication

**Status:** No `duplicateShowString()` action exists.

**File:** `src/app/actions/competition.ts`

### Step 6.1 — Create `duplicateShowString()`

```typescript
/** Duplicate a show string with all its entries */
export async function duplicateShowString(
    stringId: string
): Promise<{ success: boolean; newStringId?: string; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    const { data: original } = await supabase
        .from("show_strings")
        .select("name, notes, user_id")
        .eq("id", stringId)
        .eq("user_id", user.id)
        .single();

    if (!original) return { success: false, error: "Show string not found or not yours." };
    const o = original as { name: string; notes: string | null };

    const { data: newString, error } = await supabase
        .from("show_strings")
        .insert({ user_id: user.id, name: `${o.name} (copy)`, notes: o.notes })
        .select("id")
        .single();

    if (error || !newString) return { success: false, error: error?.message || "Failed to create copy." };
    const newId = (newString as { id: string }).id;

    const { data: entries } = await supabase
        .from("show_string_entries")
        .select("horse_id, class_name, class_id, division, time_slot, notes")
        .eq("show_string_id", stringId);

    if (entries && entries.length > 0) {
        const inserts = (entries as { horse_id: string; class_name: string; class_id: string | null; division: string | null; time_slot: string | null; notes: string | null }[]).map(e => ({
            show_string_id: newId,
            horse_id: e.horse_id, class_name: e.class_name, class_id: e.class_id,
            division: e.division, time_slot: e.time_slot, notes: e.notes,
        }));
        await supabase.from("show_string_entries").insert(inserts);
    }

    revalidatePath("/shows/planner");
    return { success: true, newStringId: newId };
}
```

### Step 6.2 — Add "Duplicate" button to show planner UI

Find the show string list and add a duplicate button next to each string.

---

## FIX 7: "Stripped" Life Stage UI

**Status:** Migration 070 adds `stripped` to CHECK. No UI dropdowns updated.

**Files to grep and update:**
- Search for `blank.*in_progress\|In Progress\|Blank Resin\|life_stage` across all `.tsx` files
- Any dropdown/select that lists life stages needs `<option value="stripped">🛁 Stripped / Body</option>`

### Step 7.1 — Find all life stage dropdowns

```bash
grep -rn "blank\|in_progress\|for_sale" --include="*.tsx" src/ | grep -i "option\|select\|life"
```

### Step 7.2 — Add stripped option to each

Between "Blank" and "In Progress" in every dropdown:
```tsx
<option value="stripped">🛁 Stripped / Body</option>
```

### Step 7.3 — Add to any label maps

If there's a `LIFE_STAGE_LABELS` map, add:
```typescript
stripped: "🛁 Stripped / Body",
```

---

## FIX 8: Reverse Matchmaker (Seller Hype)

**Status:** `user_wishlists` table exists (migration 007, with `catalog_id` from 048). No demand query on `/stable/[id]`.

**File:** `src/app/stable/[id]/page.tsx`

### Step 8.1 — Add demand query

After fetching horse details, add:

```typescript
let wishlistDemand = 0;
if (isOwner && horse.trade_status === "Not for Sale" && horse.catalog_id) {
    const { count } = await supabase
        .from("user_wishlists")
        .select("id", { count: "exact", head: true })
        .eq("catalog_id", horse.catalog_id)
        .neq("user_id", user.id);

    wishlistDemand = count || 0;
}
```

### Step 8.2 — Render demand banner

```tsx
{wishlistDemand > 0 && (
    <div className="getting-started-tip" style={{
        marginBottom: "var(--space-lg)",
        background: "rgba(239, 68, 68, 0.1)",
        borderColor: "rgba(239, 68, 68, 0.3)",
    }}>
        🔥 <strong>{wishlistDemand} collector{wishlistDemand > 1 ? "s" : ""}</strong>
        {wishlistDemand > 1 ? " are" : " is"} looking for this model!
        List it for sale to notify them.
    </div>
)}
```

---

## Verification Checklist

After all 8 fixes:

- [ ] `npx next build` — 0 errors
- [ ] Fix 1: `linkHorseToCommission` action exports from `art-studio.ts`
- [ ] Fix 2: `createEvent` accepts and stores `judgingMethod`
- [ ] Fix 3: Admin page shows open reports with dismiss/action buttons
- [ ] Fix 4: `retractOffer` action exists; buyer can retract `offer_made`
- [ ] Fix 5: `getCommission` returns `guest_token`
- [ ] Fix 6: `duplicateShowString` action exists
- [ ] Fix 7: All life stage dropdowns include "Stripped / Body"
- [ ] Fix 8: Stable detail page shows wishlist demand banner

---

## Status Tracker

| # | Fix | Severity | Status |
|---|-----|----------|--------|
| 1 | `linkHorseToCommission` action | 🟡 Important | ✅ Already existed (line 788) |
| 2 | `createEvent` judging method | 🟡 Important | ✅ Already existed (accepts + inserts judging_method) |
| 3 | Admin reports section | 🟡 Important | ✅ Already existed (imports, fetch, JSX lines 253-282) |
| 4 | Buyer offer retraction | 🔴 Critical | ✅ Done in V26 Sprint Task 8 |
| 5 | Guest portal `guest_token` query | 🟢 Nice-to-have | ✅ Fixed — added to Commission type + mapCommissionJoined |
| 6 | Show string duplication | 🟢 Nice-to-have | ✅ Done in V26 Sprint Task 12 |
| 7 | Stripped life stage UI | 🟡 Important | ✅ Fixed — all 4 dropdowns, labels, icons, type union, market page |
| 8 | Reverse matchmaker banner | 🟢 Nice-to-have | ✅ Done in V26 Sprint Task 11 |
