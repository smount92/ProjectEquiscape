"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ============================================================
// SETTINGS — Account Management Actions
// ============================================================

// ── Get current profile ──

export async function getProfile(): Promise<{
    aliasName: string;
    bio: string;
    avatarUrl: string | null;
    email: string;
    notificationPrefs: Record<string, boolean>;
    defaultHorsePublic: boolean;
} | null> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
        .from("users")
        .select("alias_name, bio, avatar_url, notification_prefs, default_horse_public")
        .eq("id", user.id)
        .single();

    if (!data) return null;
    const d = data as {
        alias_name: string;
        bio: string | null;
        avatar_url: string | null;
        notification_prefs: Record<string, boolean> | null;
        default_horse_public: boolean | null;
    };

    return {
        aliasName: d.alias_name,
        bio: d.bio || "",
        avatarUrl: d.avatar_url,
        email: user.email || "",
        notificationPrefs: d.notification_prefs || {
            show_votes: true,
            favorites: true,
            comments: true,
            new_followers: true,
            messages: true,
            show_results: true,
            transfers: true,
        },
        defaultHorsePublic: d.default_horse_public ?? true,
    };
}

// ── Update profile (alias, bio) ──

export async function updateProfile(data: {
    aliasName?: string;
    bio?: string;
    defaultHorsePublic?: boolean;
}): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    const updates: Record<string, unknown> = {};

    if (data.aliasName !== undefined) {
        const trimmed = data.aliasName.trim();
        if (trimmed.length < 3 || trimmed.length > 30) {
            return { success: false, error: "Alias must be 3-30 characters." };
        }
        // Check uniqueness
        const { data: existing } = await supabase
            .from("users")
            .select("id")
            .eq("alias_name", trimmed)
            .neq("id", user.id)
            .maybeSingle();
        if (existing) return { success: false, error: "That alias is already taken." };
        updates.alias_name = trimmed;
    }

    if (data.bio !== undefined) {
        updates.bio = data.bio.trim().slice(0, 500);
    }

    if (data.defaultHorsePublic !== undefined) {
        updates.default_horse_public = data.defaultHorsePublic;
    }

    if (Object.keys(updates).length === 0) return { success: true };

    const { error } = await supabase
        .from("users")
        .update(updates)
        .eq("id", user.id);

    if (error) return { success: false, error: error.message };
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    return { success: true };
}

// ── Update notification preferences ──

export async function updateNotificationPrefs(
    prefs: Record<string, boolean>
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    const { error } = await supabase
        .from("users")
        .update({ notification_prefs: prefs })
        .eq("id", user.id);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

// ── Change password ──

export async function changePassword(data: {
    newPassword: string;
    confirmPassword: string;
}): Promise<{ success: boolean; error?: string }> {
    if (data.newPassword !== data.confirmPassword) {
        return { success: false, error: "Passwords do not match." };
    }
    if (data.newPassword.length < 8) {
        return { success: false, error: "Password must be at least 8 characters." };
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({
        password: data.newPassword,
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
}

// ── Upload avatar ──

export async function uploadAvatar(
    formData: FormData
): Promise<{ success: boolean; url?: string; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    const file = formData.get("avatar") as File;
    if (!file || file.size === 0) return { success: false, error: "No file selected." };
    if (file.size > 2 * 1024 * 1024) return { success: false, error: "File must be under 2MB." };

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/avatar.${ext}`;

    // Upload to storage (upsert)
    const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) return { success: false, error: uploadError.message };

    // Get public URL
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);

    // Update user record
    const { error: dbError } = await supabase
        .from("users")
        .update({ avatar_url: urlData.publicUrl })
        .eq("id", user.id);

    if (dbError) return { success: false, error: dbError.message };
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    return { success: true, url: urlData.publicUrl };
}
