"use server";

import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/app/actions/notifications";
import { createActivityEvent } from "@/app/actions/activity";
import { after } from "next/server";

/**
 * Toggle follow on a user. Returns new state + counts.
 */
export async function toggleFollow(
    targetUserId: string
): Promise<{
    success: boolean;
    isFollowing?: boolean;
    followerCount?: number;
    error?: string;
}> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "You must be logged in." };
    if (user.id === targetUserId) return { success: false, error: "You cannot follow yourself." };

    // Check if already following
    const { data: existing } = await supabase
        .from("user_follows")
        .select("id")
        .eq("follower_id", user.id)
        .eq("following_id", targetUserId)
        .maybeSingle();

    if (existing) {
        // Unfollow
        await supabase.from("user_follows").delete().eq("id", existing.id);
    } else {
        // Follow
        const { error } = await supabase.from("user_follows").insert({
            follower_id: user.id,
            following_id: targetUserId,
        });

        if (error) {
            if (error.code === "23505") return { success: true, isFollowing: true };
            return { success: false, error: error.message };
        }

        // Notify the followed user (fire-and-forget)
        const { data: actor } = await supabase
            .from("users")
            .select("alias_name")
            .eq("id", user.id)
            .single();
        const alias = (actor as { alias_name: string } | null)?.alias_name || "Someone";
        await createNotification({
            userId: targetUserId,
            type: "follow",
            actorId: user.id,
            content: `@${alias} started following you`,
        });
        await createActivityEvent({
            actorId: user.id,
            eventType: "follow",
            targetId: targetUserId,
            metadata: { targetAlias: alias },
        });

        // Deferred: evaluate follower achievements for the target user
        const targetId = targetUserId;
        after(async () => {
            try {
                const { evaluateUserAchievements } = await import("@/lib/utils/achievements");
                await evaluateUserAchievements(targetId, "follower_gained");
            } catch { /* non-blocking */ }
        });
    }

    // Fetch updated follower count
    const { count } = await supabase
        .from("user_follows")
        .select("id", { count: "exact", head: true })
        .eq("following_id", targetUserId);

    return {
        success: true,
        isFollowing: !existing,
        followerCount: count ?? 0,
    };
}

/**
 * Get follow stats for a user.
 */
export async function getFollowStats(userId: string): Promise<{
    followerCount: number;
    followingCount: number;
    isFollowing: boolean;
}> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const [{ count: followerCount }, { count: followingCount }] = await Promise.all([
        supabase
            .from("user_follows")
            .select("id", { count: "exact", head: true })
            .eq("following_id", userId),
        supabase
            .from("user_follows")
            .select("id", { count: "exact", head: true })
            .eq("follower_id", userId),
    ]);

    let isFollowing = false;
    if (user && user.id !== userId) {
        const { data: follow } = await supabase
            .from("user_follows")
            .select("id")
            .eq("follower_id", user.id)
            .eq("following_id", userId)
            .maybeSingle();
        isFollowing = !!follow;
    }

    return {
        followerCount: followerCount ?? 0,
        followingCount: followingCount ?? 0,
        isFollowing,
    };
}
