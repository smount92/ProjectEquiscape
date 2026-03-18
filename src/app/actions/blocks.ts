"use server";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Block a user. Prevents them from messaging, following, or making offers.
 * @param targetUserId - UUID of the user to block
 */
export async function blockUser(targetId: string): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();
    if (user.id === targetId) return { success: false, error: "Cannot block yourself." };

    const { error } = await supabase.from("user_blocks").insert({
        blocker_id: user.id,
        blocked_id: targetId,
    });

    if (error) {
        if (error.code === "23505") return { success: true }; // Already blocked
        return { success: false, error: error.message };
    }

    revalidatePath("/feed");
    return { success: true };
}

/**
 * Unblock a previously blocked user.
 * @param targetUserId - UUID of the user to unblock
 */
export async function unblockUser(targetId: string): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();

    const { error } = await supabase
        .from("user_blocks")
        .delete()
        .eq("blocker_id", user.id)
        .eq("blocked_id", targetId);

    if (error) return { success: false, error: error.message };
    revalidatePath("/feed");
    return { success: true };
}

/**
 * Get the UUIDs of all users the current user has blocked.
 * Used internally by feed/search to filter out blocked users.
 * @returns Array of blocked user UUIDs
 */
export async function getBlockedUserIds(): Promise<string[]> {
    const { supabase, user } = await requireAuth();

    const { data } = await supabase
        .from("user_blocks")
        .select("blocked_id")
        .eq("blocker_id", user.id);

    return (data ?? []).map((b: { blocked_id: string }) => b.blocked_id);
}

/**
 * Check if the current user has blocked a specific user.
 * @param targetUserId - UUID of the user to check
 */
export async function isBlocked(targetId: string): Promise<boolean> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Check both directions — either user blocked the other
    const { data } = await supabase
        .from("user_blocks")
        .select("blocker_id")
        .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${targetId}),and(blocker_id.eq.${targetId},blocked_id.eq.${user.id})`)
        .limit(1);

    return (data ?? []).length > 0;
}
