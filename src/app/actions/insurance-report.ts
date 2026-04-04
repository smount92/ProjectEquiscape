"use server";

import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { extractStoragePath } from "@/lib/utils/storage";
import sharp from "sharp";

// ============================================================
// Insurance Report Data — Server Action
// Fetches user's horses with vault data and converts images to base64
// ============================================================

interface HorseReportData {
    id: string;
    name: string;
    reference: string;
    condition: string;
    finish: string;
    purchasePrice: number | null;
    estimatedValue: number | null;
    photoUrl: string | null;
}

export interface InsuranceReportPayload {
    userName: string;
    generatedAt: string;
    horses: HorseReportData[];
    totalModels: number;
    totalValue: number;
}

/**
 * Get data needed to generate an insurance report PDF.
 * Includes horse details, photos, financial vault, and provenance.
 * @param collectionId - Optional: scope to a single collection
 * @returns Array of horses with financial and provenance data
 */
export async function getInsuranceReportData(collectionId?: string): Promise<{
    success: boolean;
    data?: InsuranceReportPayload;
    error?: string;
}> {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "Not authenticated." };

        // Get user profile
        const { data: profile } = await supabase
            .from("users")
            .select("alias_name, full_name")
            .eq("id", user.id)
            .single<{ alias_name: string; full_name: string | null }>();

        // Fetch horses with reference data
        let horseQuery = supabase
            .from("user_horses")
            .select(
                `id, custom_name, finish_type, condition_grade,
         catalog_items:catalog_id(title, maker, item_type),
         horse_images(image_url, angle_profile)`
            )
            .eq("owner_id", user.id)
            .is("deleted_at", null)
            .order("custom_name");

        interface HorseRow {
            id: string;
            custom_name: string;
            finish_type: string;
            condition_grade: string;
            catalog_items: { title: string; maker: string; item_type: string } | null;
            horse_images: { image_url: string; angle_profile: string }[];
        }

        // Filter by collection if provided (OOM prevention for large herds)
        // Must check BOTH legacy FK (user_horses.collection_id) AND junction table (horse_collections)
        let horses: HorseRow[];
        if (collectionId) {
            // Get horse IDs from junction table
            const { data: junctionRows } = await supabase
                .from("horse_collections")
                .select("horse_id")
                .eq("collection_id", collectionId);
            const junctionHorseIds = (junctionRows ?? []).map((r: { horse_id: string }) => r.horse_id);

            // Query legacy FK horses
            horseQuery = horseQuery.eq("collection_id", collectionId);
            const { data: legacyHorses } = await horseQuery;

            // If there are junction-only horses, fetch them separately and merge
            const legacyIds = new Set((legacyHorses ?? []).map((h) => h.id));
            const extraIds = junctionHorseIds.filter((id: string) => !legacyIds.has(id));

            let mergedHorses = (legacyHorses ?? []) as HorseRow[];
            if (extraIds.length > 0) {
                const { data: extraHorses } = await supabase
                    .from("user_horses")
                    .select(
                        `id, custom_name, finish_type, condition_grade,
                 catalog_items:catalog_id(title, maker, item_type),
                 horse_images(image_url, angle_profile)`
                    )
                    .in("id", extraIds)
                    .eq("owner_id", user.id)
                    .is("deleted_at", null)
                    .order("custom_name");
                mergedHorses = [...mergedHorses, ...((extraHorses ?? []) as HorseRow[])];
            }

            // Sort merged results by custom_name
            mergedHorses.sort((a, b) => (a.custom_name || "").localeCompare(b.custom_name || ""));
            horses = mergedHorses;
        } else {
            const { data: rawHorses } = await horseQuery;
            horses = (rawHorses ?? []) as HorseRow[];
        }

        // Fetch vault data (private — owner only via RLS)
        const horseIds = horses.map((h) => h.id);
        const { data: rawVaults } = await supabase
            .from("financial_vault")
            .select("horse_id, purchase_price, estimated_current_value")
            .in("horse_id", horseIds);

        const vaultMap = new Map<
            string,
            { purchase_price: number | null; estimated_current_value: number | null }
        >();
        (rawVaults ?? []).forEach(
            (v: { horse_id: string; purchase_price: number | null; estimated_current_value: number | null }) => {
                vaultMap.set(v.horse_id, v);
            }
        );

        // Build report data with base64 images
        let totalValue = 0;
        const reportHorses: HorseReportData[] = [];

        // ── Convert photos to base64 using admin SDK (bypasses storage RLS) ──
        const base64Map = new Map<string, string>();
        const adminStorage = getAdminClient().storage.from("horse-images");
        for (const horse of horses) {
            const thumb = horse.horse_images?.find(
                (img) => img.angle_profile === "Primary_Thumbnail"
            );
            const imageUrl = thumb?.image_url || horse.horse_images?.[0]?.image_url;
            if (!imageUrl) continue;

            try {
                const path = extractStoragePath(imageUrl);
                const { data: blob, error: dlError } = await adminStorage.download(path);

                if (dlError || !blob) {
                    console.error(`[InsuranceReport] Download failed for ${horse.custom_name}:`, dlError?.message, { path, imageUrl });
                    continue;
                }

                const rawBuffer = Buffer.from(await blob.arrayBuffer());

                // @react-pdf/renderer only supports JPEG and PNG — convert WebP
                const isWebP = imageUrl.endsWith(".webp") || blob.type === "image/webp";
                let finalBuffer: Buffer;
                let contentType: string;

                if (isWebP) {
                    finalBuffer = await sharp(rawBuffer).png({ quality: 85 }).toBuffer();
                    contentType = "image/png";
                } else {
                    finalBuffer = rawBuffer;
                    contentType = blob.type || "image/jpeg";
                }

                const base64 = finalBuffer.toString("base64");
                base64Map.set(horse.id, `data:${contentType};base64,${base64}`);
            } catch (err) {
                console.error(`[InsuranceReport] Exception for ${horse.custom_name}:`, err);
                continue;
            }
        }

        // Build report data
        for (const horse of horses) {
            const vault = vaultMap.get(horse.id);
            const value = vault?.estimated_current_value ?? vault?.purchase_price ?? 0;
            totalValue += value;

            // Build reference display name
            let reference = "Unlisted";
            if (horse.catalog_items) {
                reference = `${horse.catalog_items.maker} ${horse.catalog_items.title}`;
            }

            reportHorses.push({
                id: horse.id,
                name: horse.custom_name,
                reference,
                condition: horse.condition_grade || "Not Graded",
                finish: horse.finish_type ?? "OF",
                purchasePrice: vault?.purchase_price ?? null,
                estimatedValue: vault?.estimated_current_value ?? null,
                photoUrl: base64Map.get(horse.id) || null,
            });
        }

        // Sort by value descending for the report
        reportHorses.sort((a, b) => {
            const aVal = a.estimatedValue ?? a.purchasePrice ?? 0;
            const bVal = b.estimatedValue ?? b.purchasePrice ?? 0;
            return bVal - aVal;
        });

        return {
            success: true,
            data: {
                userName: profile?.full_name || profile?.alias_name || "Collector",
                generatedAt: new Date().toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                }),
                horses: reportHorses,
                totalModels: reportHorses.length,
                totalValue,
            },
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to generate report data",
        };
    }
}
