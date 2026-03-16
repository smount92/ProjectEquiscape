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
        // Fallback: raw query if RPC doesn't exist yet
        // Will implement via RPC in future migration
    } catch { /* future */ }

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

    // ── Ribbon Collector: 5+ / 25+ show placings ──
    try {
        const { data: showPlacings } = await admin
            .from("show_records")
            .select("horse_id, user_id")
            .not("placing", "is", null);

        if (showPlacings) {
            const placingCounts = new Map<string, number>();
            for (const p of showPlacings as { horse_id: string; user_id: string }[]) {
                if (p.user_id) {
                    placingCounts.set(p.user_id, (placingCounts.get(p.user_id) || 0) + 1);
                }
            }

            for (const [userId, count] of placingCounts) {
                if (count >= 5) {
                    const { data: existing } = await admin
                        .from("user_badges")
                        .select("badge_id")
                        .eq("user_id", userId)
                        .eq("badge_id", "ribbon_collector_1")
                        .maybeSingle();

                    if (!existing) {
                        await admin.from("user_badges").insert({ user_id: userId, badge_id: "ribbon_collector_1" });
                        await createNotification({
                            userId,
                            type: "achievement",
                            actorId: userId,
                            content: '🎀 You earned the "Ribbon Collector I" achievement!',
                        });
                        awarded++;
                    }
                }
                if (count >= 25) {
                    const { data: existing } = await admin
                        .from("user_badges")
                        .select("badge_id")
                        .eq("user_id", userId)
                        .eq("badge_id", "ribbon_collector_2")
                        .maybeSingle();

                    if (!existing) {
                        await admin.from("user_badges").insert({ user_id: userId, badge_id: "ribbon_collector_2" });
                        await createNotification({
                            userId,
                            type: "achievement",
                            actorId: userId,
                            content: '🎀 You earned the "Ribbon Collector II" achievement!',
                        });
                        awarded++;
                    }
                }
            }
        }
    } catch (e) {
        logger.error("AchievementsCron", "Ribbon Collector evaluation failed", e);
    }

    return awarded;
}
