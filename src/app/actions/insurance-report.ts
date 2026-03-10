"use server";

import { createClient } from "@/lib/supabase/server";
import { extractStoragePath } from "@/lib/utils/storage";

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

export async function getInsuranceReportData(): Promise<{
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
        const { data: rawHorses } = await supabase
            .from("user_horses")
            .select(
                `id, custom_name, finish_type, condition_grade,
         reference_molds(mold_name, manufacturer),
         artist_resins(resin_name, sculptor_alias),
         reference_releases(release_name, model_number),
         horse_images(image_url, angle_profile)`
            )
            .eq("owner_id", user.id)
            .order("custom_name");

        interface HorseRow {
            id: string;
            custom_name: string;
            finish_type: string;
            condition_grade: string;
            reference_molds: { mold_name: string; manufacturer: string } | null;
            artist_resins: { resin_name: string; sculptor_alias: string } | null;
            reference_releases: { release_name: string; model_number: string | null } | null;
            horse_images: { image_url: string; angle_profile: string }[];
        }

        const horses = (rawHorses as unknown as HorseRow[]) ?? [];

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

        for (const horse of horses) {
            const vault = vaultMap.get(horse.id);
            const value = vault?.estimated_current_value ?? vault?.purchase_price ?? 0;
            totalValue += value;

            // Build reference display name
            let reference = "Unlisted";
            if (horse.reference_molds) {
                reference = `${horse.reference_molds.manufacturer} ${horse.reference_molds.mold_name}`;
                if (horse.reference_releases) {
                    reference += ` — ${horse.reference_releases.release_name}`;
                    if (horse.reference_releases.model_number) {
                        reference += ` (#${horse.reference_releases.model_number})`;
                    }
                }
            } else if (horse.artist_resins) {
                reference = `${horse.artist_resins.sculptor_alias} — ${horse.artist_resins.resin_name}`;
            }

            // Get primary thumbnail signed URL (NO base64 — defuses payload bomb)
            let photoUrl: string | null = null;
            const thumb = horse.horse_images?.find(
                (img) => img.angle_profile === "Primary_Thumbnail"
            );
            const imageUrl = thumb?.image_url || horse.horse_images?.[0]?.image_url;

            if (imageUrl) {
                const path = extractStoragePath(imageUrl);
                const { data: signedData } = await supabase.storage
                    .from("horse-images")
                    .createSignedUrl(path, 600); // 10 min expiry — enough for PDF render
                photoUrl = signedData?.signedUrl || null;
            }

            reportHorses.push({
                id: horse.id,
                name: horse.custom_name,
                reference,
                condition: horse.condition_grade || "Not Graded",
                finish: horse.finish_type,
                purchasePrice: vault?.purchase_price ?? null,
                estimatedValue: vault?.estimated_current_value ?? null,
                photoUrl,
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
