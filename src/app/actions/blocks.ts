"use server";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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

export async function getBlockedUserIds(): Promise<string[]> {
    const { supabase, user } = await requireAuth();

    const { data } = await supabase
        .from("user_blocks")
        .select("blocked_id")
        .eq("blocker_id", user.id);

    return (data ?? []).map((b: { blocked_id: string }) => b.blocked_id);
}

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
