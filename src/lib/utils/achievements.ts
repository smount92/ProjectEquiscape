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
                    .from("event_entries")
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
                const { count } = await admin.from("user_follows").select("id", { count: "exact", head: true }).eq("following_id", userId);
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
