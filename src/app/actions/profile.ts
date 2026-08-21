"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { AuthError, requireAuth } from "@/lib/auth";
import { getPublicImageUrls } from "@/lib/utils/storage";
import {
    MAX_FEATURED,
    sanitizeCustomization,
    type ProfileCustomization,
} from "@/app/profile/customization";
import { fetchProfileCustomization } from "@/app/profile/reads";

const PAGE_SIZE = 24;

export interface ProfileHorseCard {
    id: string;
    customName: string;
    finishType: string;
    conditionGrade: string;
    createdAt: string;
    refName: string;
    thumbnailUrl: string | null;
    collectionName: string | null;
    tradeStatus: string;
    listingPrice: number | null;
    marketplaceNotes: string | null;
}

/**
 * Update the current user's bio.
 */
export async function updateBio(bio: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const trimmed = bio.trim().slice(0, 500);

    const { error } = await supabase
        .from("users")
        .update({ bio: trimmed || null })
        .eq("id", user.id);

    if (error) return { success: false, error: error.message };

    revalidatePath("/profile");
    return { success: true };
}

/**
 * Load more profile horses for infinite scroll / Load More button.
 * Uses offset-based pagination via .range().
 */
export async function loadMoreProfileHorses(
    userId: string,
    offset: number
): Promise<{ horses: ProfileHorseCard[]; hasMore: boolean }> {
    const supabase = await createClient();

    const { data: rawHorses, count } = await supabase
        .from("user_horses")
        .select(`
            id, custom_name, finish_type, condition_grade, created_at, trade_status, listing_price, marketplace_notes,
            user_collections(name),
            catalog_items:catalog_id(title, maker, item_type),
            horse_images(image_url, angle_profile)
        `, { count: "exact" })
        .eq("owner_id", userId)
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

    const horses = rawHorses ?? [];

    // Generate public URLs for thumbnails (batch)
    const thumbnailPaths: string[] = [];
    horses.forEach((horse) => {
        const thumb = horse.horse_images?.find(
            (img: { angle_profile: string }) => img.angle_profile === "Primary_Thumbnail"
        );
        const first = horse.horse_images?.[0];
        const url = (thumb as { image_url: string } | undefined)?.image_url
            || (first as { image_url: string } | undefined)?.image_url;
        if (url) thumbnailPaths.push(url);
    });
    const signedUrlMap = getPublicImageUrls(thumbnailPaths);

    const cards: ProfileHorseCard[] = horses.map((horse) => {
        const thumb = horse.horse_images?.find(
            (img: { angle_profile: string }) => img.angle_profile === "Primary_Thumbnail"
        );
        const firstImage = horse.horse_images?.[0];
        const imageUrl = (thumb as { image_url: string } | undefined)?.image_url
            || (firstImage as { image_url: string } | undefined)?.image_url;
        const signedUrl = imageUrl ? signedUrlMap.get(imageUrl) : undefined;

        return {
            id: horse.id,
            customName: horse.custom_name,
            finishType: horse.finish_type ?? "OF",
            conditionGrade: horse.condition_grade ?? "",
            createdAt: horse.created_at,
            refName: horse.catalog_items
                ? `${(horse.catalog_items as { maker: string }).maker} ${(horse.catalog_items as { title: string }).title}`
                : "Unlisted Mold",
            thumbnailUrl: signedUrl || null,
            collectionName: (horse.user_collections as { name: string } | null)?.name || null,
            tradeStatus: horse.trade_status || "Not for Sale",
            listingPrice: horse.listing_price ?? null,
            marketplaceNotes: horse.marketplace_notes || null,
        };
    });

    return {
        horses: cards,
        hasMore: (count ?? 0) > offset + PAGE_SIZE,
    };
}

// ═══════════════════════════════════════════════════════════════
// PROFILE CUSTOMIZATION — owner-only writes (migration 171)
// ═══════════════════════════════════════════════════════════════
// Everything below writes public.users.profile_customization, a
// single jsonb bag in the notification_prefs mould. RLS ("Users can
// update own profile", USING auth.uid() = id) is what makes these
// owner-only; the action never takes a target user id, so there is
// no id to forge.
//
// Every payload goes through sanitizeCustomization — the SAME
// function the render path uses. That is deliberate: one gate,
// applied on write and on read, so a row written by any other means
// still cannot produce an unreadable or hostile profile.

/** Storage bucket + prefix for banners. Reuses the avatars bucket so
 *  the existing folder-prefixed policies (038) already cover it:
 *  `(storage.foldername(name))[1] = auth.uid()::text`. */
const BANNER_BUCKET = "avatars";
const MAX_BANNER_BYTES = 3 * 1024 * 1024;

/** PostgREST "column does not exist" — migration 171 not pasted yet. */
function isMissingColumnError(err: { code?: string; message?: string } | null): boolean {
    if (!err) return false;
    return err.code === "42703" || /column .* does not exist/i.test(err.message ?? "");
}

export interface MyCustomization {
    customization: ProfileCustomization;
    /** Signed URL for the current banner, if any. */
    bannerUrl: string | null;
    /** The member's public horses, for the featured picker. */
    horses: { id: string; name: string }[];
    /** False when migration 171 has not been applied yet. */
    available: boolean;
}

/** Everything the customization editor needs, in one round trip. */
export async function getMyCustomization(): Promise<MyCustomization | null> {
    try {
        const { supabase, user } = await requireAuth();
        const customization = await fetchProfileCustomization(supabase, user.id);

        // Probe: can we see the column at all? (Cheap, and it is the
        // honest way to tell "not customized" from "not migrated".)
        const { error: probeError } = await supabase
            .from("users")
            .select("profile_customization")
            .eq("id", user.id)
            .maybeSingle();

        const { data: horseRows } = await supabase
            .from("user_horses")
            .select("id, custom_name")
            .eq("owner_id", user.id)
            .eq("visibility", "public")
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .limit(200);

        let bannerUrl: string | null = null;
        if (customization.bannerPath) {
            const { data: signed } = await supabase.storage
                .from(BANNER_BUCKET)
                .createSignedUrl(customization.bannerPath, 3600);
            bannerUrl = signed?.signedUrl ?? null;
        }

        return {
            customization,
            bannerUrl,
            horses: (horseRows ?? []).map((h) => ({
                id: h.id as string,
                name: (h.custom_name as string) || "Unnamed",
            })),
            available: !isMissingColumnError(probeError),
        };
    } catch {
        return null;
    }
}

/**
 * Save the signed-in member's customization.
 *
 * Featured ids are verified against their OWN public horses rather
 * than trusted: the picker only offers those, but the action is the
 * boundary, and pinning someone else's horse to your shelf would be
 * a small but real lie about who owns what.
 */
export async function saveProfileCustomization(
    input: unknown,
): Promise<{ success: boolean; error?: string }> {
    try {
        const { supabase, user } = await requireAuth();
        const clean = sanitizeCustomization(input);

        if (clean.featured.length > 0) {
            const { data: owned } = await supabase
                .from("user_horses")
                .select("id")
                .eq("owner_id", user.id)
                .eq("visibility", "public")
                .is("deleted_at", null)
                .in("id", clean.featured);
            const ownedIds = new Set((owned ?? []).map((h) => h.id as string));
            clean.featured = clean.featured.filter((id) => ownedIds.has(id)).slice(0, MAX_FEATURED);
        }

        // A banner path must live under the member's own storage
        // folder — the same rule the storage policy enforces, checked
        // here so a hand-posted path fails loudly instead of pointing
        // the page at someone else's file.
        if (clean.bannerPath && !clean.bannerPath.startsWith(`${user.id}/`)) {
            clean.bannerPath = null;
        }

        const { error } = await supabase
            .from("users")
            .update({ profile_customization: clean } as Record<string, unknown>)
            .eq("id", user.id);

        if (error) {
            if (isMissingColumnError(error)) {
                return {
                    success: false,
                    error: "Profile customization isn't switched on yet — migration 171 is still pending.",
                };
            }
            return { success: false, error: error.message };
        }

        revalidatePath("/settings");
        revalidatePath("/dashboard");
        return { success: true };
    } catch (err) {
        if (err instanceof AuthError) return { success: false, error: err.message };
        return { success: false, error: "Could not save your profile settings." };
    }
}

/**
 * Upload a profile banner. Mirrors `uploadAvatar` (settings.ts):
 * unique filename to bust the CDN, remove the previous file so the
 * bucket doesn't accumulate orphans, store the PATH not a URL.
 *
 * The banner is not written into the customization here — the client
 * folds the returned path into its draft and saves it with the rest,
 * so an abandoned edit never half-applies.
 */
export async function uploadProfileBanner(
    formData: FormData,
): Promise<{ success: boolean; path?: string; url?: string; error?: string }> {
    try {
        const { supabase, user } = await requireAuth();
        const file = formData.get("banner");
        if (!(file instanceof File) || file.size === 0) {
            return { success: false, error: "No image selected." };
        }
        if (file.size > MAX_BANNER_BYTES) {
            return { success: false, error: "Banner must be under 3MB." };
        }

        const existing = await fetchProfileCustomization(supabase, user.id);
        const ext = (file.name.split(".").pop() || "webp").toLowerCase().replace(/[^a-z0-9]/g, "");
        const path = `${user.id}/banner_${Date.now()}.${ext || "webp"}`;

        const { error: uploadError } = await supabase.storage
            .from(BANNER_BUCKET)
            .upload(path, file, { upsert: true, contentType: file.type });
        if (uploadError) return { success: false, error: uploadError.message };

        // Best-effort cleanup of the file this one replaces.
        if (existing.bannerPath && existing.bannerPath.startsWith(`${user.id}/`)) {
            await supabase.storage.from(BANNER_BUCKET).remove([existing.bannerPath]);
        }

        const { data: signed } = await supabase.storage
            .from(BANNER_BUCKET)
            .createSignedUrl(path, 3600);

        return { success: true, path, url: signed?.signedUrl };
    } catch (err) {
        if (err instanceof AuthError) return { success: false, error: err.message };
        return { success: false, error: "Could not upload that image." };
    }
}
