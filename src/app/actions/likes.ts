"use server";

import { requireAuth } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";

export async function toggleActivityLike(activityId: string): Promise<{ success: boolean; action?: string; error?: string }> {
    try {
        const { user } = await requireAuth();
        const admin = getAdminClient();
        const { data, error } = await admin.rpc("toggle_activity_like", {
            p_activity_id: activityId,
            p_user_id: user.id,
        });
        if (error) return { success: false, error: error.message };
        const result = data as { success: boolean; action: string };
        return { success: true, action: result.action };
    } catch {
        return { success: false, error: "Not authenticated." };
    }
}

export async function toggleGroupPostLike(postId: string): Promise<{ success: boolean; action?: string; error?: string }> {
    try {
        const { user } = await requireAuth();
        const admin = getAdminClient();
        const { data, error } = await admin.rpc("toggle_group_post_like", {
            p_post_id: postId,
            p_user_id: user.id,
        });
        if (error) return { success: false, error: error.message };
        const result = data as { success: boolean; action: string };
        return { success: true, action: result.action };
    } catch {
        return { success: false, error: "Not authenticated." };
    }
}

export async function toggleCommentLike(commentId: string): Promise<{ success: boolean; action?: string; error?: string }> {
    try {
        const { user } = await requireAuth();
        const admin = getAdminClient();
        const { data, error } = await admin.rpc("toggle_comment_like", {
            p_comment_id: commentId,
            p_user_id: user.id,
        });
        if (error) return { success: false, error: error.message };
        const result = data as { success: boolean; action: string };
        return { success: true, action: result.action };
    } catch {
        return { success: false, error: "Not authenticated." };
    }
}
