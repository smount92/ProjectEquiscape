---
description: Phase 8 — Gamification Engine & Ribbon Wall. Deploy the badge dictionary, async evaluation engine, and Trophy Case UI.
---

# V30: Gamification Engine & Ribbon Wall

> **Constraint:** All badge evaluation MUST happen inside `after()` hooks to protect the Vercel serverless main thread. Badge writes use `getAdminClient()` (Service Role). Complex relational badges are deferred to the cron job.

---

## Task 1: Database Migration (085_gamification_engine.sql) ✅ DONE 2026-03-16

Create `supabase/migrations/085_gamification_engine.sql`:

```sql
-- ============================================================
-- Migration 085: Gamification Engine — Badges & User Achievements
-- ============================================================

-- 1. The Badge Dictionary
CREATE TABLE IF NOT EXISTS badges (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL,
    category TEXT NOT NULL,
    tier INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. User Earned Badges
CREATE TABLE IF NOT EXISTS user_badges (
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    badge_id TEXT REFERENCES badges(id) ON DELETE CASCADE,
    earned_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, badge_id)
);

-- 3. RLS Policies
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "badges_select_all" ON badges FOR SELECT USING (true);
CREATE POLICY "user_badges_select_all" ON user_badges FOR SELECT USING (true);

-- 4. Indexes
CREATE INDEX idx_user_badges_user_id ON user_badges(user_id);

-- 5. Seed the initial badge dictionary
INSERT INTO badges (id, name, description, icon, category, tier) VALUES
  -- ══ EXCLUSIVE ══
  ('beta_vanguard',        'Beta Vanguard',          'One of the founding members of Model Horse Hub.',                      '🏅', 'exclusive',  5),

  -- ══ COLLECTION ══
  ('herd_builder_1',       'Herd Builder I',         'Cataloged 10 models in your digital stable.',                          '🐴', 'collection', 1),
  ('herd_builder_2',       'Herd Builder II',        'Cataloged 50 models in your digital stable.',                          '🐴', 'collection', 2),
  ('herd_builder_3',       'Herd Builder III',       'Cataloged 100 models in your digital stable.',                         '🐴', 'collection', 3),
  ('shutterbug_1',         'Shutterbug I',           'Uploaded 25 photos across your collection.',                           '📸', 'collection', 1),
  ('shutterbug_2',         'Shutterbug II',          'Uploaded 100 photos across your collection.',                          '📸', 'collection', 2),
  ('shutterbug_3',         'Shutterbug III',         'Uploaded 250 photos across your collection.',                          '📸', 'collection', 3),
  ('triple_crown',         'Triple Crown',           'Own horses in all three finish types: OF, Custom, and Artist Resin.',  '👑', 'collection', 3),
  ('conga_line',           'Conga Line',             'Own 5 or more horses on the exact same mold.',                         '🎠', 'collection', 2),

  -- ══ SOCIAL ══
  ('social_butterfly_1',   'Social Butterfly I',     'Made 10 posts or replies in the community feed.',                      '🦋', 'social',     1),
  ('social_butterfly_2',   'Social Butterfly II',    'Made 50 posts or replies in the community feed.',                      '🦋', 'social',     2),
  ('popular_kid',          'Popular Kid',            'Received 25 likes across your posts.',                                 '❤️', 'social',     2),
  ('first_follower',       'First Follower',         'Gained your first follower.',                                          '👤', 'social',     1),

  -- ══ COMMERCE ══
  ('first_sale',           'First Sale',             'Completed your first marketplace transaction.',                        '💰', 'commerce',   1),
  ('trusted_trader_1',     'Trusted Trader I',       'Completed 5 marketplace transactions.',                                '🤝', 'commerce',   2),
  ('trusted_trader_2',     'Trusted Trader II',      'Completed 25 marketplace transactions.',                               '🤝', 'commerce',   3),
  ('five_star_seller',     'Five Star Seller',       'Maintained a perfect 5.0 rating with 5+ reviews.',                     '⭐', 'commerce',   4),

  -- ══ SHOWS ══
  ('show_debut',           'Show Debut',             'Entered your first photo show.',                                       '📷', 'shows',      1),
  ('ribbon_collector_1',   'Ribbon Collector I',     'Earned placings in 5 different show classes.',                          '🎀', 'shows',      2),
  ('ribbon_collector_2',   'Ribbon Collector II',    'Earned placings in 25 different show classes.',                         '🎀', 'shows',      3)

ON CONFLICT (id) DO NOTHING;
```

**Run the migration** in the Supabase Dashboard SQL editor. Confirm success before proceeding.

---

## Task 2: The Achievement Evaluator Utility ✅ DONE 2026-03-16

Create `src/lib/utils/achievements.ts`:

```typescript
/**
 * Async Badge Evaluation Engine
 * ─────────────────────────────
 * This module is ONLY called inside after() hooks.
 * It uses getAdminClient() (Service Role) for writes.
 * It NEVER blocks the main request thread.
 */

import { getAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/app/actions/notifications";
import { logger } from "@/lib/logger";

export type AchievementTrigger =
    | "horse_added"
    | "photo_uploaded"
    | "transaction_completed"
    | "show_entered"
    | "post_created"
    | "follower_gained";

interface BadgeCheck {
    badgeId: string;
    check: (admin: ReturnType<typeof getAdminClient>, userId: string) => Promise<boolean>;
}

// ── Badge evaluation rules per trigger ──
const TRIGGER_RULES: Record<AchievementTrigger, BadgeCheck[]> = {
    horse_added: [
        {
            badgeId: "herd_builder_1",
            check: async (admin, userId) => {
                const { count } = await admin.from("user_horses").select("id", { count: "exact", head: true }).eq("owner_id", userId);
                return (count ?? 0) >= 10;
            },
        },
        {
            badgeId: "herd_builder_2",
            check: async (admin, userId) => {
                const { count } = await admin.from("user_horses").select("id", { count: "exact", head: true }).eq("owner_id", userId);
                return (count ?? 0) >= 50;
            },
        },
        {
            badgeId: "herd_builder_3",
            check: async (admin, userId) => {
                const { count } = await admin.from("user_horses").select("id", { count: "exact", head: true }).eq("owner_id", userId);
                return (count ?? 0) >= 100;
            },
        },
    ],
    photo_uploaded: [
        {
            badgeId: "shutterbug_1",
            check: async (admin, userId) => {
                const { count } = await admin
                    .from("horse_images")
                    .select("id", { count: "exact", head: true })
                    .in("horse_id", admin.from("user_horses").select("id").eq("owner_id", userId));
                return (count ?? 0) >= 25;
            },
        },
        {
            badgeId: "shutterbug_2",
            check: async (admin, userId) => {
                const { count } = await admin
                    .from("horse_images")
                    .select("id", { count: "exact", head: true })
                    .in("horse_id", admin.from("user_horses").select("id").eq("owner_id", userId));
                return (count ?? 0) >= 100;
            },
        },
        {
            badgeId: "shutterbug_3",
            check: async (admin, userId) => {
                const { count } = await admin
                    .from("horse_images")
                    .select("id", { count: "exact", head: true })
                    .in("horse_id", admin.from("user_horses").select("id").eq("owner_id", userId));
                return (count ?? 0) >= 250;
            },
        },
    ],
    transaction_completed: [
        {
            badgeId: "first_sale",
            check: async (admin, userId) => {
                const { count } = await admin
                    .from("transactions")
                    .select("id", { count: "exact", head: true })
                    .eq("status", "completed")
                    .or(`party_a_id.eq.${userId},party_b_id.eq.${userId}`);
                return (count ?? 0) >= 1;
            },
        },
        {
            badgeId: "trusted_trader_1",
            check: async (admin, userId) => {
                const { count } = await admin
                    .from("transactions")
                    .select("id", { count: "exact", head: true })
                    .eq("status", "completed")
                    .or(`party_a_id.eq.${userId},party_b_id.eq.${userId}`);
                return (count ?? 0) >= 5;
            },
        },
        {
            badgeId: "trusted_trader_2",
            check: async (admin, userId) => {
                const { count } = await admin
                    .from("transactions")
                    .select("id", { count: "exact", head: true })
                    .eq("status", "completed")
                    .or(`party_a_id.eq.${userId},party_b_id.eq.${userId}`);
                return (count ?? 0) >= 25;
            },
        },
    ],
    show_entered: [
        {
            badgeId: "show_debut",
            check: async (admin, userId) => {
                const { count } = await admin
                    .from("show_entries")
                    .select("id", { count: "exact", head: true })
                    .eq("user_id", userId);
                return (count ?? 0) >= 1;
            },
        },
    ],
    post_created: [
        {
            badgeId: "social_butterfly_1",
            check: async (admin, userId) => {
                const { count } = await admin.from("posts").select("id", { count: "exact", head: true }).eq("author_id", userId);
                return (count ?? 0) >= 10;
            },
        },
        {
            badgeId: "social_butterfly_2",
            check: async (admin, userId) => {
                const { count } = await admin.from("posts").select("id", { count: "exact", head: true }).eq("author_id", userId);
                return (count ?? 0) >= 50;
            },
        },
    ],
    follower_gained: [
        {
            badgeId: "first_follower",
            check: async (admin, userId) => {
                const { count } = await admin.from("follows").select("id", { count: "exact", head: true }).eq("following_id", userId);
                return (count ?? 0) >= 1;
            },
        },
    ],
};

/**
 * Evaluate and award badges for a user based on a trigger event.
 * MUST be called inside after() — never on the main thread.
 */
export async function evaluateUserAchievements(
    userId: string,
    trigger: AchievementTrigger
): Promise<void> {
    try {
        const admin = getAdminClient();
        const rules = TRIGGER_RULES[trigger];
        if (!rules || rules.length === 0) return;

        // Batch-fetch which badges the user already owns for this trigger
        const badgeIds = rules.map((r) => r.badgeId);
        const { data: owned } = await admin
            .from("user_badges")
            .select("badge_id")
            .eq("user_id", userId)
            .in("badge_id", badgeIds);

        const ownedSet = new Set((owned ?? []).map((b: { badge_id: string }) => b.badge_id));

        // Only check badges the user doesn't already have
        const unchecked = rules.filter((r) => !ownedSet.has(r.badgeId));
        if (unchecked.length === 0) return;

        for (const rule of unchecked) {
            try {
                const earned = await rule.check(admin, userId);
                if (earned) {
                    // Award the badge
                    await admin.from("user_badges").insert({
                        user_id: userId,
                        badge_id: rule.badgeId,
                    });

                    // Look up badge name for the notification
                    const { data: badge } = await admin
                        .from("badges")
                        .select("name, icon")
                        .eq("id", rule.badgeId)
                        .single();

                    const badgeName = (badge as { name: string; icon: string } | null)?.name || rule.badgeId;
                    const badgeIcon = (badge as { name: string; icon: string } | null)?.icon || "🏆";

                    // Send achievement notification
                    await createNotification({
                        userId,
                        type: "achievement",
                        actorId: userId, // self-award
                        content: `${badgeIcon} You earned the "${badgeName}" achievement!`,
                    });
                }
            } catch {
                // Individual badge check failure — don't block others
                logger.error("Achievements", `Failed to evaluate badge ${rule.badgeId} for user ${userId}`);
            }
        }
    } catch {
        // Top-level failure — this is fire-and-forget, log and move on
        logger.error("Achievements", `evaluateUserAchievements failed for user ${userId}, trigger: ${trigger}`);
    }
}
```

---

## Task 3: Wire Up Triggers ✅ DONE 2026-03-16

### 3a. Horse Added — `src/app/actions/horse.ts`

In `createHorseRecord`, add an `after()` block before the return:

```typescript
// After: revalidateTag("public_horses", "max");

// Deferred: evaluate achievements
const finalUserId = user.id;
after(async () => {
    try {
        const { evaluateUserAchievements } = await import("@/lib/utils/achievements");
        await evaluateUserAchievements(finalUserId, "horse_added");
    } catch { /* non-blocking */ }
});
```

You'll need to add `import { after } from "next/server";` at the top of `horse.ts`.

### 3b. Photos Uploaded — `src/app/actions/horse.ts`

In `finalizeHorseImages`, add an `after()` block before the return:

```typescript
// After: revalidatePath(`/stable/${horseId}`);

// Deferred: evaluate photo achievements
const finalUserId = user.id;
after(async () => {
    try {
        const { evaluateUserAchievements } = await import("@/lib/utils/achievements");
        await evaluateUserAchievements(finalUserId, "photo_uploaded");
    } catch { /* non-blocking */ }
});
```

### 3c. Transaction Completed — `src/app/actions/transactions.ts`

In `completeTransaction`, add an `after()` block before the return:

```typescript
// After the market price refresh try/catch block

// Deferred: evaluate commerce achievements
const completingUserId = user.id;
after(async () => {
    try {
        const { evaluateUserAchievements } = await import("@/lib/utils/achievements");
        await evaluateUserAchievements(completingUserId, "transaction_completed");
    } catch { /* non-blocking */ }
});
```

You'll need to add `import { after } from "next/server";` at the top of `transactions.ts`.

### 3d. Show Entered — `src/app/actions/shows.ts`

In `enterShow`, add an `after()` block before the return:

```typescript
// Deferred: evaluate show achievements
const showUserId = user.id;
after(async () => {
    try {
        const { evaluateUserAchievements } = await import("@/lib/utils/achievements");
        await evaluateUserAchievements(showUserId, "show_entered");
    } catch { /* non-blocking */ }
});
```

Add `import { after } from "next/server";` at top if not already present.

### 3e. Post Created — `src/app/actions/posts.ts`

Inside the existing `after()` block in `createPost`, add at the end:

```typescript
// Inside the existing after() block, after the mentions line:
const { evaluateUserAchievements } = await import("@/lib/utils/achievements");
await evaluateUserAchievements(userId, "post_created");
```

### 3f. Follower Gained — `src/app/actions/follows.ts`

In the `followUser` function, add an `after()` block:

```typescript
// After the follow is inserted and notification sent:
const targetId = targetUserId;
after(async () => {
    try {
        const { evaluateUserAchievements } = await import("@/lib/utils/achievements");
        await evaluateUserAchievements(targetId, "follower_gained");
    } catch { /* non-blocking */ }
});
```

Add `import { after } from "next/server";` at top if not already present.

---

## Task 4: Cron Fallback for Complex Badges ✅ DONE 2026-03-16

Add to the existing cron job at `src/app/api/cron/refresh-market/route.ts`:

After the garbage collection block, add:

```typescript
// Evaluate complex relational badges (too heavy for after() hooks)
let badgesAwarded = 0;
try {
    const { evaluateComplexBadges } = await import("@/lib/utils/achievements-cron");
    badgesAwarded = await evaluateComplexBadges(admin);
} catch { /* non-blocking */ }
```

Create `src/lib/utils/achievements-cron.ts`:

```typescript
/**
 * Complex Badge Evaluator — runs in cron, NOT in after() hooks.
 * These queries are too heavy for per-request evaluation.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createNotification } from "@/app/actions/notifications";
import { logger } from "@/lib/logger";

export async function evaluateComplexBadges(admin: SupabaseClient): Promise<number> {
    let awarded = 0;

    // ── Triple Crown: own OF + Custom + Artist Resin ──
    try {
        const { data: users } = await admin.rpc("get_triple_crown_candidates" as string);
        // Fallback: raw query if RPC doesn't exist yet
    } catch { /* will implement via RPC in future migration */ }

    // ── Conga Line: 5+ horses on the same mold ──
    try {
        const { data: congaCandidates } = await admin
            .from("user_horses")
            .select("owner_id, catalog_id")
            .not("catalog_id", "is", null);

        if (congaCandidates) {
            // Group by owner + catalog_id, find owners with 5+ of same mold
            const moldCounts = new Map<string, Map<string, number>>();
            for (const row of congaCandidates as { owner_id: string; catalog_id: string }[]) {
                if (!moldCounts.has(row.owner_id)) moldCounts.set(row.owner_id, new Map());
                const userMolds = moldCounts.get(row.owner_id)!;
                userMolds.set(row.catalog_id, (userMolds.get(row.catalog_id) || 0) + 1);
            }

            for (const [userId, molds] of moldCounts) {
                const hasConga = [...molds.values()].some((count) => count >= 5);
                if (hasConga) {
                    // Check if already awarded
                    const { data: existing } = await admin
                        .from("user_badges")
                        .select("badge_id")
                        .eq("user_id", userId)
                        .eq("badge_id", "conga_line")
                        .maybeSingle();

                    if (!existing) {
                        await admin.from("user_badges").insert({ user_id: userId, badge_id: "conga_line" });
                        await createNotification({
                            userId,
                            type: "achievement",
                            actorId: userId,
                            content: '🎠 You earned the "Conga Line" achievement!',
                        });
                        awarded++;
                    }
                }
            }
        }
    } catch (e) {
        logger.error("AchievementsCron", "Conga Line evaluation failed", e);
    }

    // ── Five Star Seller: 5.0 avg with 5+ reviews ──
    try {
        const { data: candidates } = await admin
            .from("reviews")
            .select("target_id")
            .then(() => admin.rpc("get_five_star_sellers" as string));
        // Fallback: will add RPC in future
    } catch { /* future */ }

    // ── Popular Kid: 25+ total likes ──
    try {
        const { data: popularUsers } = await admin
            .from("posts")
            .select("author_id, likes_count")
            .gt("likes_count", 0);

        if (popularUsers) {
            const likeTotals = new Map<string, number>();
            for (const p of popularUsers as { author_id: string; likes_count: number }[]) {
                likeTotals.set(p.author_id, (likeTotals.get(p.author_id) || 0) + p.likes_count);
            }

            for (const [userId, total] of likeTotals) {
                if (total >= 25) {
                    const { data: existing } = await admin
                        .from("user_badges")
                        .select("badge_id")
                        .eq("user_id", userId)
                        .eq("badge_id", "popular_kid")
                        .maybeSingle();

                    if (!existing) {
                        await admin.from("user_badges").insert({ user_id: userId, badge_id: "popular_kid" });
                        await createNotification({
                            userId,
                            type: "achievement",
                            actorId: userId,
                            content: '❤️ You earned the "Popular Kid" achievement!',
                        });
                        awarded++;
                    }
                }
            }
        }
    } catch (e) {
        logger.error("AchievementsCron", "Popular Kid evaluation failed", e);
    }

    return awarded;
}
```

Include `badgesAwarded` in the cron response JSON.

---

## Task 5: The Trophy Case UI ✅ DONE 2026-03-16

### 5a. TrophyCase Component — `src/components/TrophyCase.tsx`

Create a client component that renders badges grouped by category in a glassmorphism grid. Props:

```typescript
interface TrophyCaseProps {
    badges: {
        id: string;
        name: string;
        description: string;
        icon: string;
        category: string;
        tier: number;
        earnedAt: string;
    }[];
}
```

- Group badges by `category` with section headers
- Each badge card: icon, name, earned date
- Tier-based CSS classes: `trophy-tier-1` (bronze), `trophy-tier-2` (silver), `trophy-tier-3` (gold), `trophy-tier-4` (diamond), `trophy-tier-5` (master)
- Hover tooltip showing `description` and `earnedAt`
- Glass card styling matching the site's aesthetic
- Empty state: "No badges earned yet — keep collecting!"

### 5b. Profile Integration — `src/app/profile/[alias_name]/page.tsx`

After the "Public Collections" section, add:

```typescript
// Fetch user badges
const { data: rawBadges } = await supabase
    .from("user_badges")
    .select("badge_id, earned_at, badges(id, name, description, icon, category, tier)")
    .eq("user_id", profileUser.id)
    .order("earned_at", { ascending: false });

const userBadges = (rawBadges ?? []).map((b) => ({
    id: (b.badges as { id: string }).id,
    name: (b.badges as { name: string }).name,
    description: (b.badges as { description: string }).description,
    icon: (b.badges as { icon: string }).icon,
    category: (b.badges as { category: string }).category,
    tier: (b.badges as { tier: number }).tier,
    earnedAt: b.earned_at as string,
}));
```

Render `<TrophyCase badges={userBadges} />` with an anchor `id="trophies"`.

---

## Task 6: Trophy Case CSS ✅ DONE 2026-03-16

Add to `globals.css` — tier-based glow effects:

```css
/* ===== Trophy Case ===== */
.trophy-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: var(--space-md); }
.trophy-card { /* glassmorphism card */ position: relative; text-align: center; padding: var(--space-md); border-radius: var(--radius-lg); background: var(--color-surface-glass); border: 1px solid var(--color-border); transition: transform 0.2s, box-shadow 0.2s; cursor: default; }
.trophy-card:hover { transform: translateY(-2px); }
.trophy-icon { font-size: 2rem; display: block; margin-bottom: var(--space-xs); }
.trophy-name { font-size: calc(0.75rem * var(--font-scale)); font-weight: 600; }
.trophy-date { font-size: calc(0.6rem * var(--font-scale)); color: var(--color-text-muted); margin-top: 2px; }

/* Tier glows */
.trophy-tier-1 { border-color: #cd7f32; }
.trophy-tier-1:hover { box-shadow: 0 0 12px rgba(205,127,50,0.3); }
.trophy-tier-2 { border-color: #c0c0c0; }
.trophy-tier-2:hover { box-shadow: 0 0 12px rgba(192,192,192,0.4); }
.trophy-tier-3 { border-color: #ffd700; }
.trophy-tier-3:hover { box-shadow: 0 0 16px rgba(255,215,0,0.4); }
.trophy-tier-4 { border-color: #b9f2ff; }
.trophy-tier-4:hover { box-shadow: 0 0 20px rgba(185,242,255,0.5); }
.trophy-tier-5 { border-color: var(--color-accent-primary); background: rgba(var(--color-accent-primary-rgb,212,165,116),0.08); }
.trophy-tier-5:hover { box-shadow: 0 0 24px rgba(212,165,116,0.5); }

/* Category headers */
.trophy-category-header { font-size: calc(0.85rem * var(--font-scale)); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-muted); margin: var(--space-lg) 0 var(--space-sm); }
```

---

## Task 7: Achievement Notification Icon ✅ DONE 2026-03-16

In `src/components/NotificationList.tsx`, add to the `getIcon` switch:

```typescript
case "achievement": return "🏆";
```

---

## Task 8: Beta Vanguard Manual Seed ✅ DONE 2026-03-16 (SQL provided, not auto-run)

Provide the human with this SQL snippet (DO NOT auto-run — this is for the founder to manually execute):

```sql
-- Award Beta Vanguard to the first 25 users by signup date
INSERT INTO user_badges (user_id, badge_id)
SELECT u.id, 'beta_vanguard'
FROM users u
WHERE u.account_status = 'active'
ORDER BY u.created_at ASC
LIMIT 25
ON CONFLICT (user_id, badge_id) DO NOTHING;
```

---

## Task 9: Build & Push ✅ DONE 2026-03-16

// turbo
1. Run `npx next build` to verify clean build
2. Run tests
3. Commit: `feat: gamification engine — badge dictionary, async evaluator, trophy case`
4. Push to main
