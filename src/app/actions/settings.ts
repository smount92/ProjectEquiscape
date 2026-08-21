"use server";

import { logger } from "@/lib/logger";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ============================================================
// SETTINGS — Account Management Actions
// ============================================================

// ── Get current profile ──

/**
 * Get the current user's profile data for the settings page.
 * @returns Profile with alias, bio, location, avatar URL, and notification prefs
 */
export async function getProfile(): Promise<{
    aliasName: string;
    bio: string;
    avatarUrl: string | null;
    email: string;
    notificationPrefs: Record<string, boolean>;
    defaultHorsePublic: boolean;
    watermarkPhotos: boolean;
    watermarkText: string;
    currencySymbol: string;
    showBadges: boolean;
    showPhotosOnReference: boolean;
    exhibitorNumber: string;
} | null> {
    const { supabase, user } = await requireAuth();

    const { data } = await supabase
        .from("users")
        .select("alias_name, bio, avatar_url, notification_prefs, default_horse_public, watermark_photos, watermark_text, currency_symbol, show_badges, show_photos_on_reference, exhibitor_number")
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
        watermark_text: string | null;
        currency_symbol: string | null;
        show_badges: boolean | null;
        show_photos_on_reference: boolean | null;
        exhibitor_number: string | null;
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
        // Defaults mirror NOTIFICATION_TYPE_PREF_KEYS in
        // src/lib/notifications/prefs.ts — keys absent from a user's
        // saved jsonb default ON at delivery time, so adding a key
        // here never silences existing users.
        notificationPrefs: d.notification_prefs || {
            show_votes: true,
            favorites: true,
            comments: true,
            new_followers: true,
            messages: true,
            show_results: true,
            transfers: true,
            demand_alerts: true,
            show_staff: true,
            show_updates: true,
            show_announcements: true,
            show_deadlines: true,
        },
        defaultHorsePublic: d.default_horse_public ?? true,
        watermarkPhotos: d.watermark_photos ?? true,
        watermarkText: d.watermark_text ?? "",
        currencySymbol: d.currency_symbol || "$",
        showBadges: d.show_badges ?? true,
        showPhotosOnReference: d.show_photos_on_reference ?? true,
        exhibitorNumber: d.exhibitor_number || "",
    };
}

// ── Update profile (alias, bio) ──

/**
 * Update the current user's profile fields.
 * @param data - Profile fields to update (alias, bio, location, etc.)
 */
export async function updateProfile(data: {
    aliasName?: string;
    bio?: string;
    defaultHorsePublic?: boolean;
    watermarkPhotos?: boolean;
    watermarkText?: string;
    currencySymbol?: string;
    showBadges?: boolean;
    showPhotosOnReference?: boolean;
    exhibitorNumber?: string;
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

    if (data.watermarkText !== undefined) {
        // Custom watermark stamped onto uploads; blank = fall back to the
        // default "© @alias — ModelHorseHub". Cap length so it fits the plate.
        const wm = data.watermarkText.trim().slice(0, 60);
        updates.watermark_text = wm || null;
    }

    if (data.currencySymbol !== undefined) {
        const symbol = data.currencySymbol.trim().slice(0, 5);
        if (!symbol) return { success: false, error: "Currency symbol cannot be empty." };
        updates.currency_symbol = symbol;
    }

    if (data.showBadges !== undefined) {
        updates.show_badges = data.showBadges;
    }

    if (data.showPhotosOnReference !== undefined) {
        updates.show_photos_on_reference = data.showPhotosOnReference;
    }

    if (data.exhibitorNumber !== undefined) {
        // Baked verbatim into printed show tags (XXX-YYY) by
        // api/export/show-tags — constrain to a sane alphanumeric token so
        // e.g. "MyStable!" can't end up on a physical tag. Empty clears it.
        const exhibitor = data.exhibitorNumber.trim();
        if (exhibitor && !/^[A-Za-z0-9]{1,10}$/.test(exhibitor)) {
            return {
                success: false,
                error: "Exhibitor number must be 1-10 letters or numbers (no spaces or symbols).",
            };
        }
        updates.exhibitor_number = exhibitor || null;
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

/**
 * Update the current user's notification preferences.
 * @param prefs - Notification preference flags
 */
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

/**
 * Change the current user's password.
 * @param newPassword - The new password (min 6 characters)
 */
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

/**
 * Upload a new avatar image for the current user.
 * Stores in Supabase Storage and updates the user's avatar_url.
 * @param formData - FormData containing the avatar file
 */
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

/** Show statuses a departing host can leave behind without harm once
 *  handled: draft is deleted, these two are archived + entrants told. */
const PRE_JUDGING_STATUSES = ["published", "entries_open"];
/** Mid-flight statuses — entries/judging in progress. Left untouched
 *  and flagged to the admin so results can be salvaged by hand. */
const MID_FLIGHT_STATUSES = ["entries_closed", "running", "judging", "results_review"];

/**
 * A deleted host must not leave ghost shows behind (audit S10):
 * drafts vanish, pre-judging shows are archived with their entrants
 * notified, and mid-flight shows are flagged to the admin untouched.
 * Every step is non-fatal — the user's right to delete their account
 * never hangs on cleanup, so failures log and continue.
 */
async function windDownHostedShows(hostId: string): Promise<void> {
    const admin = getAdminClient();
    try {
        const { data: shows, error } = await admin
            .from("shows")
            .select("id, title, status")
            .eq("host_id", hostId)
            .not("status", "in", "(completed,archived)");
        if (error || !shows || shows.length === 0) return;

        const drafts = shows.filter((s) => s.status === "draft");
        const preJudging = shows.filter((s) => PRE_JUDGING_STATUSES.includes(s.status as string));
        const midFlight = shows.filter((s) => MID_FLIGHT_STATUSES.includes(s.status as string));

        if (drafts.length > 0) {
            await admin.from("shows").delete().in("id", drafts.map((s) => s.id));
        }

        // House pattern: createNotification is server-only — dynamic
        // import + try/catch so it can never take deletion down.
        let notify: typeof import("@/lib/notifications/createNotification") | null = null;
        try {
            notify = await import("@/lib/notifications/createNotification");
        } catch {
            notify = null;
        }

        for (const show of preJudging) {
            const { data: entryRows } = await admin
                .from("show_class_entries")
                .select("owner_id")
                .eq("show_id", show.id)
                .neq("status", "scratched");
            const entrantIds = [...new Set((entryRows ?? []).map((e) => e.owner_id as string))];

            await admin.from("shows").update({ status: "archived" }).eq("id", show.id);

            if (notify && entrantIds.length > 0) {
                try {
                    await notify.createNotificationsBulk(
                        entrantIds.map((userId) => ({
                            userId,
                            type: "show_moderation",
                            content: `"${show.title}" has been cancelled — the host's account was closed. Your entries there no longer count.`,
                            linkUrl: "/shows",
                        })),
                    );
                } catch (err) {
                    logger.error("DeleteAccount", "Entrant cancel notify failed (continuing)", err);
                }
            }
        }

        if (midFlight.length > 0 && notify) {
            const adminEmail = process.env.ADMIN_EMAIL;
            if (adminEmail) {
                const { data: adminUser } = await admin
                    .from("users")
                    .select("id")
                    .ilike("email", adminEmail)
                    .maybeSingle();
                if (adminUser) {
                    try {
                        await notify.createNotificationsBulk(
                            midFlight.map((show) => ({
                                userId: adminUser.id as string,
                                type: "show_moderation",
                                content: `⚠️ Host account deleted mid-show: "${show.title}" is ${show.status} with no host. Salvage or archive it from the console.`,
                                linkUrl: `/shows/host/${show.id}`,
                            })),
                        );
                    } catch (err) {
                        logger.error("DeleteAccount", "Admin mid-flight flag failed (continuing)", err);
                    }
                }
            }
        }
    } catch (err) {
        logger.error("DeleteAccount", "Hosted-show wind-down failed (continuing)", err);
    }
}

/**
 * Permanently delete the current user's account and all data.
 * Uses admin client for cascade deletion.
 */
export async function deleteAccount(): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();

    // Wind down any shows they host BEFORE the account row is
    // scrubbed (audit S10 — no ghost shows).
    await windDownHostedShows(user.id);

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
        logger.error("DeleteAccount", "Failed to disable auth", authError.message);
        // Non-fatal — the soft delete already happened
    }

    // Sign out the user
    await supabase.auth.signOut();

    return { success: true };
}
