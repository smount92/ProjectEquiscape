"use server";

import { requireAuth } from "@/lib/auth";
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
    watermarkPhotos: boolean;
    currencySymbol: string;
} | null> {
    const { supabase, user } = await requireAuth();

    const { data } = await supabase
        .from("users")
        .select("alias_name, bio, avatar_url, notification_prefs, default_horse_public, watermark_photos, currency_symbol")
        .eq("id", user.id)
        .single();

    if (!data) return null;
    const d = data as {
        alias_name: string;
        bio: string | null;
        avatar_url: string | null;
        notification_prefs: Record<string, boolean> | null;
        default_horse_public: boolean | null;
        watermark_photos: boolean | null;
        currency_symbol: string | null;
    };

    // Generate signed URL for avatar if stored as a storage path
    let resolvedAvatarUrl = d.avatar_url;
    if (d.avatar_url && !d.avatar_url.startsWith("http")) {
        const { data: signedData } = await supabase.storage
            .from("avatars")
            .createSignedUrl(d.avatar_url, 3600);
        resolvedAvatarUrl = signedData?.signedUrl || null;
    }

    return {
        aliasName: d.alias_name,
        bio: d.bio || "",
        avatarUrl: resolvedAvatarUrl,
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
        watermarkPhotos: d.watermark_photos ?? false,
        currencySymbol: d.currency_symbol || "$",
    };
}

// ── Update profile (alias, bio) ──

export async function updateProfile(data: {
    aliasName?: string;
    bio?: string;
    defaultHorsePublic?: boolean;
    watermarkPhotos?: boolean;
    currencySymbol?: string;
}): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();

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

    if (data.watermarkPhotos !== undefined) {
        updates.watermark_photos = data.watermarkPhotos;
    }

    if (data.currencySymbol !== undefined) {
        const symbol = data.currencySymbol.trim().slice(0, 5);
        if (!symbol) return { success: false, error: "Currency symbol cannot be empty." };
        updates.currency_symbol = symbol;
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
    const { supabase, user } = await requireAuth();

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
    const { supabase, user } = await requireAuth();

    const file = formData.get("avatar") as File;
    if (!file || file.size === 0) return { success: false, error: "No file selected." };
    if (file.size > 2 * 1024 * 1024) return { success: false, error: "File must be under 2MB." };

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    // Use unique filename to bust CDN cache
    const path = `${user.id}/avatar_${Date.now()}.${ext}`;

    // Delete old avatar file (if any) to prevent orphaned files
    const { data: currentProfile } = await supabase
        .from("users")
        .select("avatar_url")
        .eq("id", user.id)
        .single<{ avatar_url: string | null }>();

    if (currentProfile?.avatar_url) {
        // Handle both legacy full URLs and new storage paths
        let oldPath = currentProfile.avatar_url;
        if (oldPath.startsWith("http")) {
            const oldMatch = oldPath.match(/avatars\/(.+?)(\?|$)/);
            oldPath = oldMatch?.[1] ? decodeURIComponent(oldMatch[1]) : "";
        }
        if (oldPath) {
            await supabase.storage.from("avatars").remove([oldPath]);
        }
    }

    // Upload to storage
    const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) return { success: false, error: uploadError.message };

    // Store the storage path in DB (not a full URL — we generate signed URLs on read)
    const { error: dbError } = await supabase
        .from("users")
        .update({ avatar_url: path })
        .eq("id", user.id);

    if (dbError) return { success: false, error: dbError.message };

    // Revalidate all pages that display avatars
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    revalidatePath("/discover");
    revalidatePath("/feed");
    revalidatePath("/community");

    // Generate a signed URL for immediate display
    const { data: signedData } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, 3600);
    return { success: true, url: signedData?.signedUrl || path };
}

// ── Delete Account (Tombstone) ──

import { getAdminClient } from "@/lib/supabase/admin";

export async function deleteAccount(): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();

    // Call the soft delete RPC
    const adminClient = getAdminClient();
    const { error: rpcError } = await adminClient.rpc("soft_delete_account", {
        target_uid: user.id,
    });

    if (rpcError) return { success: false, error: rpcError.message };

    // Disable the auth account (prevents login)
    const { error: authError } = await adminClient.auth.admin.updateUserById(
        user.id,
        { ban_duration: "876000h" } // ~100 years = effectively permanent
    );

    if (authError) {
        console.error("[DeleteAccount] Failed to disable auth:", authError.message);
        // Non-fatal — the soft delete already happened
    }

    // Sign out the user
    await supabase.auth.signOut();

    return { success: true };
}
