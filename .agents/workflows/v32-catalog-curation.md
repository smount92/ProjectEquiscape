---
description: V32 — Reference Catalog Curation System. Community-driven catalog browsing, suggestion workflow with voting, discussion, trusted curators, changelog, and photo submissions.
---

# V32: Reference Catalog Curation System

> **Prerequisite:** All 194 Vitest tests pass. Build succeeds.  
> **Storage Note:** Catalog reference photos use a **separate** Supabase bucket with a 500KB max file size and max 3 photos per suggestion to keep costs controlled. Admin can purge rejected suggestion photos.  
> **Thresholds:** Bronze Curator = 10, Silver = 50, Gold = 200 approved suggestions.  
> **Auto-Approve Scope:** Silver curators auto-approve `year` and `color` corrections only. Gold curators auto-approve all corrections. Additions always require admin review.

---

## Task 1: Database Migration (091_catalog_curation.sql)

Create `supabase/migrations/091_catalog_curation.sql`:

```sql
-- ============================================================
-- Migration 091: Catalog Curation — Suggestions, Voting, Discussion, Changelog
-- ============================================================

-- 1. Suggestions
CREATE TABLE IF NOT EXISTS catalog_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    catalog_item_id UUID REFERENCES catalog_items(id) ON DELETE SET NULL,
    suggestion_type TEXT NOT NULL CHECK (suggestion_type IN ('correction', 'addition', 'removal', 'photo')),
    field_changes JSONB NOT NULL DEFAULT '{}',
    reason TEXT NOT NULL CHECK (char_length(reason) <= 2000),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'auto_approved')),
    admin_notes TEXT,
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    upvotes INT NOT NULL DEFAULT 0,
    downvotes INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_catalog_suggestions_user ON catalog_suggestions(user_id);
CREATE INDEX idx_catalog_suggestions_item ON catalog_suggestions(catalog_item_id);
CREATE INDEX idx_catalog_suggestions_status ON catalog_suggestions(status);
CREATE INDEX idx_catalog_suggestions_created ON catalog_suggestions(created_at DESC);

ALTER TABLE catalog_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view suggestions"
    ON catalog_suggestions FOR SELECT USING (true);
CREATE POLICY "Auth users can create suggestions"
    ON catalog_suggestions FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pending suggestions"
    ON catalog_suggestions FOR UPDATE TO authenticated
    USING (auth.uid() = user_id AND status = 'pending');

-- 2. Votes (one per user per suggestion)
CREATE TABLE IF NOT EXISTS catalog_suggestion_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    suggestion_id UUID NOT NULL REFERENCES catalog_suggestions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(suggestion_id, user_id)
);

CREATE INDEX idx_suggestion_votes_suggestion ON catalog_suggestion_votes(suggestion_id);

ALTER TABLE catalog_suggestion_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view votes"
    ON catalog_suggestion_votes FOR SELECT USING (true);
CREATE POLICY "Auth users can vote"
    ON catalog_suggestion_votes FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove own vote"
    ON catalog_suggestion_votes FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- 3. Discussion Comments
CREATE TABLE IF NOT EXISTS catalog_suggestion_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    suggestion_id UUID NOT NULL REFERENCES catalog_suggestions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_alias TEXT NOT NULL,
    body TEXT NOT NULL CHECK (char_length(body) <= 2000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_suggestion_comments_suggestion ON catalog_suggestion_comments(suggestion_id);

ALTER TABLE catalog_suggestion_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view comments"
    ON catalog_suggestion_comments FOR SELECT USING (true);
CREATE POLICY "Auth users can comment"
    ON catalog_suggestion_comments FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments"
    ON catalog_suggestion_comments FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- 4. Changelog (public)
CREATE TABLE IF NOT EXISTS catalog_changelog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    suggestion_id UUID REFERENCES catalog_suggestions(id),
    catalog_item_id UUID REFERENCES catalog_items(id),
    change_type TEXT NOT NULL CHECK (change_type IN ('correction', 'addition', 'removal', 'photo')),
    change_summary TEXT NOT NULL,
    contributed_by UUID REFERENCES auth.users(id),
    contributor_alias TEXT NOT NULL,
    approved_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_changelog_created ON catalog_changelog(created_at DESC);

ALTER TABLE catalog_changelog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view changelog"
    ON catalog_changelog FOR SELECT USING (true);

-- 5. Curator tracking on profiles
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS approved_suggestions_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS is_trusted_curator BOOLEAN NOT NULL DEFAULT false;

-- 6. Curator badge seeds (append to existing badges table)
INSERT INTO badges (id, name, description, icon, category, tier) VALUES
    ('catalog_contributor', 'Catalog Contributor', 'Had your first catalog suggestion approved.', '📘', 'community', 1),
    ('bronze_curator',      'Bronze Curator',      'Had 10 catalog suggestions approved.',       '🥉', 'community', 2),
    ('silver_curator',      'Silver Curator',      'Had 50 catalog suggestions approved. Your simple corrections are auto-approved!', '🥈', 'community', 3),
    ('gold_curator',        'Gold Curator',        'Had 200 catalog suggestions approved. All your corrections are auto-approved!',   '🥇', 'community', 4)
ON CONFLICT (id) DO NOTHING;
```

**Run in Supabase Dashboard SQL Editor.** Verify all tables created, RLS enabled, and badges seeded.

---

## Task 2: Storage Bucket for Reference Photos

In Supabase Dashboard → Storage:

1. Create bucket: `catalog-reference-photos`
2. Set to **Private** (signed URLs for access)
3. **Max file size:** 500KB (keeps costs low — reference photos don't need to be huge)
4. Add storage policy via SQL:

```sql
-- Allow authenticated users to upload to catalog-reference-photos
CREATE POLICY "Auth users can upload reference photos"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'catalog-reference-photos');

-- Allow public read via signed URLs (handled by admin client)
CREATE POLICY "Admin can read reference photos"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'catalog-reference-photos');

-- Admin can delete rejected photos
CREATE POLICY "Admin can delete reference photos"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'catalog-reference-photos');
```

---

## Task 3: Server Actions — `src/app/actions/catalog-suggestions.ts`

Create `src/app/actions/catalog-suggestions.ts`:

```typescript
"use server";

import { requireAuth } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { sanitizeText } from "@/lib/utils/validation";

// ── Type definitions ──

interface CatalogFilters {
    search?: string;
    maker?: string;
    scale?: string;
    category?: string;
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortDir?: "asc" | "desc";
}

interface SuggestionInput {
    catalogItemId?: string | null;   // null = new entry
    suggestionType: "correction" | "addition" | "removal" | "photo";
    fieldChanges: Record<string, unknown>;
    reason: string;
}

interface ReviewDecision {
    suggestionId: string;
    decision: "approved" | "rejected";
    adminNotes?: string;
}

// Fields Silver curators can auto-approve
const SILVER_AUTO_FIELDS = new Set(["color", "year", "production_run", "release_date"]);

// ── BROWSING ──

export async function getCatalogItems(filters: CatalogFilters) {
    // Uses createClient (RLS) — catalog_items is publicly readable
    const { supabase } = await requireAuth();
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 50;
    const from = (page - 1) * pageSize;

    let query = supabase
        .from("catalog_items")
        .select("*", { count: "exact" })
        .range(from, from + pageSize - 1);

    if (filters.maker) query = query.eq("maker", filters.maker);
    if (filters.scale) query = query.eq("scale", filters.scale);
    if (filters.search) query = query.ilike("title", `%${filters.search}%`);
    if (filters.sortBy) query = query.order(filters.sortBy, { ascending: filters.sortDir === "asc" });
    else query = query.order("title", { ascending: true });

    const { data, count, error } = await query;
    if (error) return { success: false as const, error: error.message };
    return { success: true as const, items: data ?? [], total: count ?? 0, page, pageSize };
}

export async function getCatalogItem(id: string) {
    const { supabase } = await requireAuth();
    const { data, error } = await supabase
        .from("catalog_items")
        .select("*")
        .eq("id", id)
        .single();
    if (error) return { success: false as const, error: error.message };
    return { success: true as const, item: data };
}

// ── SUGGESTIONS ──

export async function createSuggestion(input: SuggestionInput) {
    const { supabase, user } = await requireAuth();

    // Validate
    const reason = sanitizeText(input.reason).trim();
    if (!reason || reason.length < 10) {
        return { success: false, error: "Please provide a reason (at least 10 characters)." };
    }

    // Check for trusted curator auto-approve
    const admin = getAdminClient();
    const { data: profile } = await admin
        .from("profiles")
        .select("approved_suggestions_count, alias_name")
        .eq("id", user.id)
        .single();

    const approvedCount = (profile as { approved_suggestions_count: number } | null)?.approved_suggestions_count ?? 0;
    const alias = (profile as { alias_name: string } | null)?.alias_name ?? "Unknown";

    let autoApprove = false;
    if (input.suggestionType === "correction" && input.fieldChanges) {
        const changedFields = Object.keys(input.fieldChanges);
        const isGoldCurator = approvedCount >= 200;
        const isSilverCurator = approvedCount >= 50;

        if (isGoldCurator) {
            autoApprove = true;
        } else if (isSilverCurator) {
            autoApprove = changedFields.every((f) => SILVER_AUTO_FIELDS.has(f));
        }
    }

    const status = autoApprove ? "auto_approved" : "pending";

    const { data, error } = await supabase
        .from("catalog_suggestions")
        .insert({
            user_id: user.id,
            catalog_item_id: input.catalogItemId || null,
            suggestion_type: input.suggestionType,
            field_changes: input.fieldChanges,
            reason,
            status,
        })
        .select("id")
        .single();

    if (error) return { success: false, error: error.message };

    // If auto-approved, apply immediately
    if (autoApprove && data) {
        await applyApprovedSuggestion(data.id, user.id, alias);
    }

    // Notify admins for non-auto-approved
    if (!autoApprove) {
        after(async () => {
            try {
                const { createNotification } = await import("@/app/actions/notifications");
                // Notify admins (get admin users)
                const { data: admins } = await admin
                    .from("profiles")
                    .select("id")
                    .eq("role", "admin");
                for (const a of (admins ?? []) as { id: string }[]) {
                    await createNotification({
                        userId: a.id,
                        type: "system",
                        actorId: user.id,
                        content: `📝 New catalog suggestion from @${alias}: "${reason.slice(0, 80)}${reason.length > 80 ? "…" : ""}"`,
                    });
                }
            } catch { /* non-blocking */ }
        });
    }

    revalidatePath("/reference/suggestions");
    return { success: true, id: data?.id, autoApproved: autoApprove };
}

// ── VOTING ──

export async function voteSuggestion(suggestionId: string, voteType: "up" | "down") {
    const { supabase, user } = await requireAuth();

    // Upsert vote (delete + re-insert to handle toggle)
    await supabase
        .from("catalog_suggestion_votes")
        .delete()
        .eq("suggestion_id", suggestionId)
        .eq("user_id", user.id);

    const { error } = await supabase
        .from("catalog_suggestion_votes")
        .insert({ suggestion_id: suggestionId, user_id: user.id, vote_type: voteType });

    if (error) return { success: false, error: error.message };

    // Update denormalized counts
    await updateVoteCounts(suggestionId);

    revalidatePath(`/reference/suggestions/${suggestionId}`);
    return { success: true };
}

export async function removeVote(suggestionId: string) {
    const { supabase, user } = await requireAuth();

    await supabase
        .from("catalog_suggestion_votes")
        .delete()
        .eq("suggestion_id", suggestionId)
        .eq("user_id", user.id);

    await updateVoteCounts(suggestionId);
    revalidatePath(`/reference/suggestions/${suggestionId}`);
    return { success: true };
}

async function updateVoteCounts(suggestionId: string) {
    const admin = getAdminClient();
    const { data: votes } = await admin
        .from("catalog_suggestion_votes")
        .select("vote_type")
        .eq("suggestion_id", suggestionId);

    const ups = (votes ?? []).filter((v: { vote_type: string }) => v.vote_type === "up").length;
    const downs = (votes ?? []).filter((v: { vote_type: string }) => v.vote_type === "down").length;

    await admin
        .from("catalog_suggestions")
        .update({ upvotes: ups, downvotes: downs })
        .eq("id", suggestionId);
}

// ── COMMENTS ──

export async function addSuggestionComment(suggestionId: string, body: string) {
    const { supabase, user } = await requireAuth();

    const sanitized = sanitizeText(body).trim();
    if (!sanitized) return { success: false, error: "Comment cannot be empty." };

    const admin = getAdminClient();
    const { data: profile } = await admin
        .from("profiles")
        .select("alias_name")
        .eq("id", user.id)
        .single();
    const alias = (profile as { alias_name: string } | null)?.alias_name ?? "Unknown";

    const { error } = await supabase
        .from("catalog_suggestion_comments")
        .insert({
            suggestion_id: suggestionId,
            user_id: user.id,
            user_alias: alias,
            body: sanitized,
        });

    if (error) return { success: false, error: error.message };
    revalidatePath(`/reference/suggestions/${suggestionId}`);
    return { success: true };
}

export async function deleteSuggestionComment(commentId: string) {
    const { supabase } = await requireAuth();
    const { error } = await supabase
        .from("catalog_suggestion_comments")
        .delete()
        .eq("id", commentId);
    if (error) return { success: false, error: error.message };
    return { success: true };
}

// ── ADMIN REVIEW ──

export async function reviewSuggestion(decision: ReviewDecision) {
    const { user } = await requireAuth();
    const admin = getAdminClient();

    // Verify admin role
    const { data: profile } = await admin
        .from("profiles")
        .select("role, alias_name")
        .eq("id", user.id)
        .single();
    if ((profile as { role: string } | null)?.role !== "admin") {
        return { success: false, error: "Admin access required." };
    }

    // Get suggestion
    const { data: suggestion } = await admin
        .from("catalog_suggestions")
        .select("*, profiles!catalog_suggestions_user_id_fkey(alias_name)")
        .eq("id", decision.suggestionId)
        .single();

    if (!suggestion) return { success: false, error: "Suggestion not found." };

    // Update status
    await admin
        .from("catalog_suggestions")
        .update({
            status: decision.decision,
            admin_notes: decision.adminNotes || null,
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
        })
        .eq("id", decision.suggestionId);

    const contributorAlias = (suggestion as Record<string, unknown>).profiles
        ? ((suggestion as Record<string, unknown>).profiles as { alias_name: string }).alias_name
        : "Unknown";

    if (decision.decision === "approved") {
        await applyApprovedSuggestion(
            decision.suggestionId,
            (suggestion as { user_id: string }).user_id,
            contributorAlias
        );
    }

    // Notify the suggestion author
    after(async () => {
        try {
            const { createNotification } = await import("@/app/actions/notifications");
            const emoji = decision.decision === "approved" ? "✅" : "❌";
            const verb = decision.decision === "approved" ? "approved" : "not approved";
            await createNotification({
                userId: (suggestion as { user_id: string }).user_id,
                type: "system",
                actorId: user.id,
                content: `${emoji} Your catalog suggestion was ${verb}.${decision.adminNotes ? ` Note: "${decision.adminNotes}"` : ""}`,
            });
        } catch { /* non-blocking */ }
    });

    revalidatePath("/reference/suggestions");
    revalidatePath("/admin");
    return { success: true };
}

// ── APPLY APPROVED SUGGESTION ──

async function applyApprovedSuggestion(suggestionId: string, userId: string, alias: string) {
    const admin = getAdminClient();

    const { data: suggestion } = await admin
        .from("catalog_suggestions")
        .select("*")
        .eq("id", suggestionId)
        .single();

    if (!suggestion) return;

    const s = suggestion as {
        suggestion_type: string;
        catalog_item_id: string | null;
        field_changes: Record<string, unknown>;
        reason: string;
    };

    let changeSummary = "";

    if (s.suggestion_type === "correction" && s.catalog_item_id) {
        // Apply field changes to catalog_items
        const updates: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(s.field_changes)) {
            if (typeof value === "object" && value !== null && "to" in value) {
                updates[key] = (value as { to: unknown }).to;
            }
        }
        if (Object.keys(updates).length > 0) {
            await admin.from("catalog_items").update(updates).eq("id", s.catalog_item_id);
        }
        // Build summary
        const changes = Object.entries(s.field_changes)
            .map(([k, v]) => {
                const val = v as { from: unknown; to: unknown };
                return `${k}: ${val.from} → ${val.to}`;
            })
            .join(", ");
        changeSummary = `🔧 Correction: ${changes}`;

    } else if (s.suggestion_type === "addition") {
        // Insert new catalog entry
        const { data: newItem } = await admin
            .from("catalog_items")
            .insert(s.field_changes)
            .select("id")
            .single();
        changeSummary = `📗 New entry added: ${(s.field_changes as { title?: string }).title ?? "Untitled"}`;

    } else if (s.suggestion_type === "photo") {
        changeSummary = `📸 Reference photo added`;
    }

    // Log to changelog
    await admin.from("catalog_changelog").insert({
        suggestion_id: suggestionId,
        catalog_item_id: s.catalog_item_id,
        change_type: s.suggestion_type,
        change_summary: changeSummary,
        contributed_by: userId,
        contributor_alias: alias,
        approved_by: userId, // for auto-approve; admin sets this in reviewSuggestion
    });

    // Increment user's approved count
    await admin.rpc("increment_approved_suggestions", { target_user_id: userId });

    // Check curator thresholds
    const { data: profile } = await admin
        .from("profiles")
        .select("approved_suggestions_count")
        .eq("id", userId)
        .single();

    const count = (profile as { approved_suggestions_count: number } | null)?.approved_suggestions_count ?? 0;

    // Award curator badges
    const badgesToCheck = [
        { threshold: 1,   badgeId: "catalog_contributor" },
        { threshold: 10,  badgeId: "bronze_curator" },
        { threshold: 50,  badgeId: "silver_curator" },
        { threshold: 200, badgeId: "gold_curator" },
    ];

    for (const { threshold, badgeId } of badgesToCheck) {
        if (count >= threshold) {
            await admin.from("user_badges").upsert(
                { user_id: userId, badge_id: badgeId },
                { onConflict: "user_id,badge_id" }
            );
        }
    }

    // Update trusted curator flag
    if (count >= 50) {
        await admin.from("profiles").update({ is_trusted_curator: true }).eq("id", userId);
    }
}

// ── CHANGELOG ──

export async function getChangelog(page: number = 1) {
    const admin = getAdminClient();
    const pageSize = 20;
    const from = (page - 1) * pageSize;

    const { data, count, error } = await admin
        .from("catalog_changelog")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);

    if (error) return { success: false as const, error: error.message };
    return { success: true as const, entries: data ?? [], total: count ?? 0 };
}
```

Also create a Supabase RPC for incrementing the count atomically:

```sql
-- Add to migration 091 or run separately:
CREATE OR REPLACE FUNCTION increment_approved_suggestions(target_user_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE profiles
    SET approved_suggestions_count = approved_suggestions_count + 1
    WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Task 4: Catalog Browser Page — `/reference`

### 4a. Page: `src/app/reference/page.tsx`

Server Component. Fetch initial catalog page and render:

- **Header:** "📚 Reference Catalog" + subtitle "10,500+ model horse entries maintained by the community"
- **Search bar:** Prominent, full-width, placeholder: "Search by name, mold, color, maker…"
- **Filter chips:** Maker (All, Breyer, Stone, Artist Resin, Other) + Scale dropdown + Year range
- **Results grid:** `CatalogBrowser` client component with sortable columns
- **Sidebar (desktop):** Quick stats card + Top Curators mini-leaderboard + link to Changelog
- **Footer links:** "Suggest a New Entry" button + "View Changelog"

### 4b. Component: `src/components/CatalogBrowser.tsx`

Client component. Props from server:
- `initialItems`, `total`, `filters`

Features:
- Debounced search input (300ms)
- Maker filter chips (toggle on/off)
- Sortable column headers (Name, Maker, Color, Year, Scale)
- Pagination or infinite scroll
- Each row: click → navigate to `/reference/[id]`
- Each row hover: reveal "✏️ Suggest Edit" link (requires auth)

### 4c. Page: `src/app/reference/[id]/page.tsx`

Server Component. Detail view for a single catalog entry.

- All fields displayed in a clean card layout
- "Suggest Edit" button (prominent, primary style)
- "Submit Reference Photo" button
- Link to any pending suggestions for this entry
- If reference photos exist (from approved photo suggestions): photo gallery

---

## Task 5: Suggestion Modal + List

### 5a. Component: `src/components/SuggestEditModal.tsx`

Client component, portal-based modal.

- Pre-filled with current catalog entry values
- User can edit any field (input fields match catalog schema)
- Changed fields highlighted in amber
- "Reason" textarea (required, min 10 chars): "Explain why this change is needed"
- Submit → calls `createSuggestion()`
- On success → toast "Thanks! Your suggestion will be reviewed." (or "Auto-approved!" if curator)

### 5b. Component: `src/components/SuggestNewEntryModal.tsx`

Same as above but fields are blank. For proposing models not in the catalog.

### 5c. Page: `src/app/reference/suggestions/page.tsx`

Server Component. Lists all suggestions.

- Filter tabs: All | Pending | Approved | Rejected
- Sort: Newest | Most Voted | Most Discussed
- Each card shows: title/description of change, author, status badge, vote count, comment count
- Click → detail page

---

## Task 6: Suggestion Detail — Voting + Discussion

### 6a. Page: `src/app/reference/suggestions/[id]/page.tsx`

Server Component. Full suggestion detail.

Layout:
- **Status badge** (top-right): 🟡 Pending / ✅ Approved / ❌ Rejected / ⚡ Auto-Approved
- **Vote panel** (left): Large ▲ number ▼ buttons (like Stack Overflow)
- **Diff panel** (center): Side-by-side current vs. proposed values for corrections
- **Reason section**: The author's explanation
- **Discussion thread** (below): Comments with @mention support
- **Admin bar** (admin only, bottom): Approve / Reject / Edit & Approve buttons with notes field

### 6b. Component: `src/components/SuggestionVoteButtons.tsx`

Client component. Props: `suggestionId`, `currentVote`, `upvotes`, `downvotes`.

- Click up: if already up → remove vote; if down → switch to up; if none → add up
- Click down: same logic
- Optimistic UI updates
- Calls `voteSuggestion()` or `removeVote()`

### 6c. Component: `src/components/SuggestionCommentThread.tsx`

Client component. Reuse the pattern from existing `CommentSection`.

- List of comments with user alias, avatar, timestamp
- "Add Comment" textarea at bottom
- Placeholder: "Share evidence, discuss this change…"
- @mention autocomplete (reuse existing mention hook)
- Delete own comments (trash icon)

### 6d. Component: `src/components/SuggestionDiffView.tsx`

Takes `fieldChanges` JSONB and renders:
- For corrections: `field: oldValue → newValue` with red/green highlighting
- For additions: all fields listed as "new"
- For photos: thumbnail preview

---

## Task 7: Admin Review Queue

### 7a. Add Suggestions Tab to `/admin`

In the existing admin page, add a tab/section:

- "📝 Suggestions" with pending count badge
- Table: Suggestion title | Author | Type | Votes (↑/↓) | Comments | Date | Actions
- Sort by: oldest first (FIFO) or most voted
- Expand row → inline diff view + discussion thread preview
- Action buttons: ✅ Approve / ❌ Reject / ✏️ Edit & Approve
- "Admin Notes" textarea on reject

### 7b. Approve Flow

When admin clicks Approve:
1. Calls `reviewSuggestion({ decision: "approved" })`
2. Server action applies changes to `catalog_items`
3. Logs to `catalog_changelog`
4. Increments author's `approved_suggestions_count`
5. Checks badge thresholds → awards curator badges
6. Notifies author

### 7c. Reject Flow

When admin clicks Reject:
1. Calls `reviewSuggestion({ decision: "rejected", adminNotes: "..." })`
2. Notifies author with reason
3. If photo suggestion → delete uploaded photos from storage

---

## Task 8: Trusted Curators — Profile Flair + Auto-Approve

### 8a. Component: `src/components/CuratorBadge.tsx`

Small inline badge shown next to username:
- 📘 (1+) → tooltip: "Catalog Contributor"
- 🥉 (10+) → tooltip: "Bronze Curator — 12 approved contributions"
- 🥈 (50+) → tooltip: "Silver Curator — auto-approves color/year corrections"
- 🥇 (200+) → tooltip: "Gold Curator — all corrections auto-approved"

Display on:
- Suggestion cards (next to author name)
- Comment threads
- Profile page
- Discover page

### 8b. Auto-Approve Logic (already in Task 3)

Recap:
- **Silver (50+):** Auto-approve corrections where ALL changed fields are in `SILVER_AUTO_FIELDS` (color, year, production_run, release_date)
- **Gold (200+):** Auto-approve ALL corrections
- **Additions:** NEVER auto-approve (always need admin eyes on new entries)
- **Removals:** NEVER auto-approve

### 8c. Top Curators Sidebar

On `/reference` page sidebar, show top 5 curators by `approved_suggestions_count`:

```
🏆 Top Curators
🥇 @CollectorJane — 234 contributions
🥈 @BreyerFan99 — 187 contributions
🥉 @ModelMaven — 91 contributions
```

---

## Task 9: Changelog Page

### 9a. Page: `src/app/reference/changelog/page.tsx`

Server Component. Public (no auth required).

- **Header:** "📋 Catalog Changelog — Community Updates"
- **Feed:** Chronological list with infinite scroll
- Each entry shows:
  - Change icon (🔧 correction, 📗 addition, 📸 photo, 🗑 removal)
  - Change summary text
  - "Contributed by @alias" link
  - "Approved by @admin" (or "Auto-approved ⚡")
  - Timestamp (relative: "2 hours ago")
- Link from entry → the catalog item detail page

### 9b. Changelog Widget (Dashboard)

Optional: small "Recent Catalog Updates" card on the dashboard showing last 3 changes.

---

## Task 10: Photo Suggestions

### 10a. Component: `src/components/PhotoSuggestionUpload.tsx`

Client component. On `/reference/[id]` detail page:

- "📸 Submit Reference Photo" button → opens dropzone
- Max 3 photos per suggestion, 500KB each
- Upload to `catalog-reference-photos` bucket: `{catalogItemId}/{suggestionId}/{filename}`
- User selects angle: Near-Side, Off-Side, Front, Rear, Other
- Optional caption
- Submits as `createSuggestion({ suggestionType: "photo", ... })`

### 10b. Admin Photo Review

In admin queue, photo suggestions show:
- Thumbnail previews
- Approve → photo path stored on catalog item (new `catalog_item_photos` table or JSONB on `catalog_items`)
- Reject → photos deleted from storage (cleans up costs)

### 10c. Catalog Detail Photo Gallery

On `/reference/[id]`, approved photos appear in a small gallery grid.

---

## Task 11: CSS Styling

Create `src/app/reference/reference.module.css`:

- Catalog browser grid (responsive: 1–4 columns)
- Suggestion diff view (red/green highlighting)
- Vote button styles (active state glow)
- Curator badge inline styles
- Changelog feed styles

Follow existing patterns: design tokens from `:root`, warm parchment aesthetic, `--font-scale` for Simple Mode.

---

## Task 12: Tests

Write Vitest tests for:

- [ ] `catalog-suggestions.ts` — createSuggestion, voteSuggestion, reviewSuggestion, auto-approve logic
- [ ] `CatalogBrowser.test.tsx` — search, filter rendering, navigation
- [ ] `SuggestionVoteButtons.test.tsx` — vote toggle behavior
- [ ] `SuggestionDiffView.test.tsx` — rendering field diffs

---

## Task 13: Documentation Updates

- [ ] Update `Model Horse Hub Complete Report.md` — new feature section
- [ ] Update `docs/README.md` — add reference catalog section
- [ ] Update `docs/database/schema-overview.md` — 4 new tables
- [ ] Update `docs/api/server-actions.md` — `catalog-suggestions.ts`
- [ ] Add `docs/guides/catalog-curation.md` — full guide for curators

---

## Task 14: Build & Push

// turbo
1. Run `npx next build` to verify clean build
2. Run `npx vitest run` — all tests pass
3. Commit per phase:
   - `feat(db): migration 091 — catalog curation tables + curator badges`
   - `feat: catalog browser page with search and filters`
   - `feat: suggestion system with voting, discussion, and auto-approve`
   - `feat: admin suggestion review queue`
   - `feat: trusted curator badges, flair, and auto-approve`
   - `feat: public changelog feed + reference photo submissions`
4. Push to main

---

## Summary

| Phase | What | Estimate |
|-------|------|----------|
| 1 | Migration + storage bucket | Quick |
| 2 | Server actions (catalog-suggestions.ts) | 1 session |
| 3 | Catalog browser page (/reference) | 1 session |
| 4 | Suggestion system + voting + discussion | 1 session |
| 5 | Admin review queue | 1 session |
| 6 | Trusted curators + badges + auto-approve | 1 session |
| 7 | Changelog + photo suggestions | 1 session |
| 8 | CSS + tests + documentation | 1 session |
