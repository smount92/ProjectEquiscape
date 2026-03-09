"use server";

import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { getSignedImageUrl } from "@/lib/utils/storage";

// ============================================================
// PARKED EXPORT — Server Actions
// ============================================================

/** Generate a unique 6-char PIN (no ambiguous chars: 0/O, 1/I/L) */
function generatePin(): string {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let pin = "";
    for (let i = 0; i < 6; i++) {
        pin += chars[Math.floor(Math.random() * chars.length)];
    }
    return pin;
}

/** Park a horse for off-platform sale and generate a claim PIN */
export async function parkHorse(horseId: string): Promise<{
    success: boolean;
    pin?: string;
    transferId?: string;
    error?: string;
}> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "Not authenticated." };

        // Verify ownership
        const { data: horse } = await supabase
            .from("user_horses")
            .select("id, owner_id, custom_name, life_stage")
            .eq("id", horseId)
            .single();

        if (!horse || (horse as { owner_id: string }).owner_id !== user.id) {
            return { success: false, error: "You don't own this horse." };
        }

        const h = horse as { id: string; custom_name: string; life_stage: string };

        // Cancel any existing pending transfers for this horse
        await supabase
            .from("horse_transfers")
            .update({ status: "cancelled" })
            .eq("horse_id", horseId)
            .eq("sender_id", user.id)
            .eq("status", "pending");

        // Generate unique PIN (retry up to 5 times for uniqueness)
        let pin = "";
        for (let attempt = 0; attempt < 5; attempt++) {
            pin = generatePin();
            const { data: existing } = await supabase
                .from("horse_transfers")
                .select("id")
                .eq("claim_pin", pin)
                .maybeSingle();
            if (!existing) break;
        }

        // Set horse to parked
        await supabase
            .from("user_horses")
            .update({ life_stage: "parked" })
            .eq("id", horseId);

        // Create transfer with long expiry (30 days for off-platform sales)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        const { data: transfer, error: transferError } = await supabase
            .from("horse_transfers")
            .insert({
                horse_id: horseId,
                sender_id: user.id,
                transfer_code: `PARK-${pin}`,
                claim_pin: pin,
                acquisition_type: "purchase",
                notes: "Parked for off-platform sale",
                expires_at: expiresAt.toISOString(),
            })
            .select("id")
            .single<{ id: string }>();

        if (transferError) return { success: false, error: transferError.message };

        // Add timeline event
        await supabase.from("horse_timeline").insert({
            horse_id: horseId,
            user_id: user.id,
            event_type: "status_change",
            title: "Parked for off-platform sale",
            description: `${h.custom_name} was parked for an off-platform sale. A Certificate of Authenticity with claim PIN was generated.`,
            metadata: { action: "parked", pin },
        });

        revalidatePath(`/stable/${horseId}`);
        revalidatePath("/dashboard");
        return { success: true, pin, transferId: transfer.id };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Failed to park horse" };
    }
}

/** Unpark a horse — cancel the pending transfer, restore life_stage */
export async function unparkHorse(horseId: string): Promise<{
    success: boolean;
    error?: string;
}> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "Not authenticated." };

        // Verify ownership
        const { data: horse } = await supabase
            .from("user_horses")
            .select("id, owner_id")
            .eq("id", horseId)
            .single();

        if (!horse || (horse as { owner_id: string }).owner_id !== user.id) {
            return { success: false, error: "You don't own this horse." };
        }

        // Cancel pending transfers with claim_pin
        await supabase
            .from("horse_transfers")
            .update({ status: "cancelled" })
            .eq("horse_id", horseId)
            .eq("sender_id", user.id)
            .eq("status", "pending")
            .not("claim_pin", "is", null);

        // Restore life_stage
        await supabase
            .from("user_horses")
            .update({ life_stage: "completed" })
            .eq("id", horseId);

        revalidatePath(`/stable/${horseId}`);
        revalidatePath("/dashboard");
        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Failed to unpark horse" };
    }
}

/** Public lookup — find a parked horse by PIN (no auth required for preview) */
export async function getParkedHorseByPin(pin: string): Promise<{
    success: boolean;
    horse?: {
        name: string;
        photo: string | null;
        finish: string;
        condition: string;
        timelineCount: number;
        ownerCount: number;
        transferId: string;
    };
    error?: string;
}> {
    try {
        const supabase = await createClient();

        // Look up transfer by claim_pin
        const { data: transfer } = await supabase
            .from("horse_transfers")
            .select("id, horse_id, sender_id")
            .eq("claim_pin", pin.toUpperCase().trim())
            .eq("status", "pending")
            .single();

        if (!transfer) {
            return { success: false, error: "Invalid or expired PIN." };
        }

        const t = transfer as { id: string; horse_id: string; sender_id: string };

        // Get horse details (public data only)
        const { data: horse } = await supabase
            .from("user_horses")
            .select(`
                id, custom_name, finish_type, condition_grade,
                horse_images(image_url, angle_profile)
            `)
            .eq("id", t.horse_id)
            .single();

        if (!horse) return { success: false, error: "Horse not found." };

        const h = horse as unknown as {
            id: string; custom_name: string; finish_type: string; condition_grade: string;
            horse_images: { image_url: string; angle_profile: string }[];
        };

        // Get photo
        const thumb = h.horse_images?.find((img) => img.angle_profile === "Primary_Thumbnail");
        const imageUrl = thumb?.image_url || h.horse_images?.[0]?.image_url;
        let photo: string | null = null;
        if (imageUrl) {
            photo = await getSignedImageUrl(supabase, imageUrl);
        }

        // Get timeline count
        const { count: timelineCount } = await supabase
            .from("horse_timeline")
            .select("id", { count: "exact", head: true })
            .eq("horse_id", t.horse_id)
            .eq("is_public", true);

        // Get owner count
        const { count: ownerCount } = await supabase
            .from("horse_ownership_history")
            .select("id", { count: "exact", head: true })
            .eq("horse_id", t.horse_id);

        return {
            success: true,
            horse: {
                name: h.custom_name,
                photo,
                finish: h.finish_type,
                condition: h.condition_grade,
                timelineCount: timelineCount || 0,
                ownerCount: (ownerCount || 0) + 1,
                transferId: t.id,
            },
        };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Failed to look up PIN" };
    }
}

/** Claim a parked horse — transfer ownership to the authenticated user */
export async function claimParkedHorse(pin: string): Promise<{
    success: boolean;
    horseName?: string;
    horseId?: string;
    error?: string;
}> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "Not authenticated. Please log in or create an account first." };

        // Look up transfer
        const { data: transfer } = await supabase
            .from("horse_transfers")
            .select("id, horse_id, sender_id, acquisition_type, sale_price, is_price_public, notes, expires_at")
            .eq("claim_pin", pin.toUpperCase().trim())
            .eq("status", "pending")
            .single();

        if (!transfer) {
            return { success: false, error: "Invalid or expired PIN." };
        }

        const t = transfer as {
            id: string; horse_id: string; sender_id: string;
            acquisition_type: string; sale_price: number | null;
            is_price_public: boolean; notes: string | null; expires_at: string;
        };

        // Check expiration
        if (new Date(t.expires_at) < new Date()) {
            await supabase.from("horse_transfers").update({ status: "expired" }).eq("id", t.id);
            return { success: false, error: "This claim PIN has expired." };
        }

        // Can't claim your own horse
        if (t.sender_id === user.id) {
            return { success: false, error: "You can't claim your own horse." };
        }

        const admin = getAdminClient();

        // Get horse name + aliases
        const { data: horse } = await admin.from("user_horses").select("custom_name").eq("id", t.horse_id).single();
        const horseName = (horse as { custom_name: string } | null)?.custom_name || "Unknown Horse";

        const { data: senderProfile } = await admin.from("users").select("alias_name").eq("id", t.sender_id).single();
        const senderAlias = (senderProfile as { alias_name: string } | null)?.alias_name || "Unknown";

        const { data: receiverProfile } = await admin.from("users").select("alias_name").eq("id", user.id).single();
        const receiverAlias = (receiverProfile as { alias_name: string } | null)?.alias_name || "Unknown";

        // 1. Close sender's ownership record
        await admin.from("horse_ownership_history")
            .update({ released_at: new Date().toISOString() })
            .eq("horse_id", t.horse_id)
            .eq("owner_id", t.sender_id)
            .is("released_at", null);

        // 2. Create receiver's ownership record
        await admin.from("horse_ownership_history").insert({
            horse_id: t.horse_id,
            owner_id: user.id,
            owner_alias: receiverAlias,
            acquisition_type: t.acquisition_type,
            sale_price: t.sale_price,
            is_price_public: t.is_price_public,
            notes: "Claimed via Certificate of Authenticity PIN",
        });

        // 3. Transfer ownership + unpark
        await admin.from("user_horses")
            .update({ owner_id: user.id, collection_id: null, life_stage: "completed" })
            .eq("id", t.horse_id);

        // 4. Timeline events
        await admin.from("horse_timeline").insert([
            {
                horse_id: t.horse_id,
                user_id: t.sender_id,
                event_type: "transferred",
                title: `Sold off-platform to @${receiverAlias}`,
                description: `${horseName} was sold off-platform and claimed via Certificate of Authenticity by @${receiverAlias}.`,
                metadata: { from: senderAlias, to: receiverAlias, type: "parked_export" },
            },
            {
                horse_id: t.horse_id,
                user_id: user.id,
                event_type: "acquired",
                title: `Received from @${senderAlias}`,
                description: `${horseName} was acquired from @${senderAlias} via off-platform sale with Certificate of Authenticity.`,
                metadata: { from: senderAlias, to: receiverAlias, type: "parked_export" },
            },
        ]);

        // 5. Mark transfer claimed
        await admin.from("horse_transfers").update({
            status: "claimed",
            claimed_by: user.id,
            claimed_at: new Date().toISOString(),
        }).eq("id", t.id);

        // 6. Notify sender
        await admin.from("notifications").insert({
            user_id: t.sender_id,
            type: "general",
            actor_id: user.id,
            content: `@${receiverAlias} claimed ${horseName} using the Certificate of Authenticity! Transfer complete.`,
            horse_id: null,
        });

        revalidatePath("/dashboard");
        revalidatePath(`/stable/${t.horse_id}`);
        return { success: true, horseName, horseId: t.horse_id };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Failed to claim horse" };
    }
}

/** Get CoA data for a parked horse (owner only) */
export async function getCoaData(horseId: string): Promise<{
    success: boolean;
    data?: {
        horseName: string;
        reference: string;
        finish: string;
        condition: string;
        pin: string;
        timelineCount: number;
        ownerCount: number;
        ownerAlias: string;
        generatedAt: string;
        photoBase64: string | null;
    };
    error?: string;
}> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "Not authenticated." };

        // Verify ownership and get horse data
        const { data: horse } = await supabase
            .from("user_horses")
            .select(`
                id, owner_id, custom_name, finish_type, condition_grade,
                reference_molds(mold_name, manufacturer),
                artist_resins(resin_name, sculptor_alias),
                reference_releases(release_name, model_number),
                horse_images(image_url, angle_profile)
            `)
            .eq("id", horseId)
            .single();

        if (!horse) return { success: false, error: "Horse not found." };

        interface HorseRow {
            id: string; owner_id: string; custom_name: string; finish_type: string; condition_grade: string;
            reference_molds: { mold_name: string; manufacturer: string } | null;
            artist_resins: { resin_name: string; sculptor_alias: string } | null;
            reference_releases: { release_name: string; model_number: string | null } | null;
            horse_images: { image_url: string; angle_profile: string }[];
        }
        const h = horse as unknown as HorseRow;

        if (h.owner_id !== user.id) return { success: false, error: "You don't own this horse." };

        // Get active PIN
        const { data: transfer } = await supabase
            .from("horse_transfers")
            .select("claim_pin")
            .eq("horse_id", horseId)
            .eq("sender_id", user.id)
            .eq("status", "pending")
            .not("claim_pin", "is", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        if (!transfer || !(transfer as { claim_pin: string }).claim_pin) {
            return { success: false, error: "No active claim PIN found. Park the horse first." };
        }

        const pin = (transfer as { claim_pin: string }).claim_pin;

        // Build reference string
        let reference = "Unlisted";
        if (h.reference_molds) {
            reference = `${h.reference_molds.manufacturer} ${h.reference_molds.mold_name}`;
            if (h.reference_releases) {
                reference += ` — ${h.reference_releases.release_name}`;
                if (h.reference_releases.model_number) reference += ` (#${h.reference_releases.model_number})`;
            }
        } else if (h.artist_resins) {
            reference = `${h.artist_resins.sculptor_alias} — ${h.artist_resins.resin_name}`;
        }

        // Counts
        const { count: timelineCount } = await supabase
            .from("horse_timeline")
            .select("id", { count: "exact", head: true })
            .eq("horse_id", horseId)
            .eq("is_public", true);

        const { count: ownerCount } = await supabase
            .from("horse_ownership_history")
            .select("id", { count: "exact", head: true })
            .eq("horse_id", horseId);

        // Owner alias
        const { data: profile } = await supabase
            .from("users")
            .select("alias_name")
            .eq("id", user.id)
            .single<{ alias_name: string }>();

        // Photo as base64
        let photoBase64: string | null = null;
        const thumb = h.horse_images?.find((img) => img.angle_profile === "Primary_Thumbnail");
        const imageUrl = thumb?.image_url || h.horse_images?.[0]?.image_url;
        if (imageUrl) {
            try {
                const signedUrl = await getSignedImageUrl(supabase, imageUrl);
                const response = await fetch(signedUrl);
                if (response.ok) {
                    const buffer = await response.arrayBuffer();
                    const base64 = Buffer.from(buffer).toString("base64");
                    const contentType = response.headers.get("content-type") || "image/webp";
                    photoBase64 = `data:${contentType};base64,${base64}`;
                }
            } catch { /* skip */ }
        }

        return {
            success: true,
            data: {
                horseName: h.custom_name,
                reference,
                finish: h.finish_type,
                condition: h.condition_grade,
                pin,
                timelineCount: timelineCount || 0,
                ownerCount: (ownerCount || 0) + 1,
                ownerAlias: profile?.alias_name || "Collector",
                generatedAt: new Date().toLocaleDateString("en-US", {
                    year: "numeric", month: "long", day: "numeric",
                }),
                photoBase64,
            },
        };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Failed to get CoA data" };
    }
}
