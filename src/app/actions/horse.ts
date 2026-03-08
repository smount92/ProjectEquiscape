"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function deleteHorse(horseId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    // Verify ownership
    const { data: horse } = await supabase
        .from("user_horses")
        .select("id, owner_id")
        .eq("id", horseId)
        .eq("owner_id", user.id)
        .single();

    if (!horse) return { success: false, error: "Horse not found or not yours." };

    // Get images to clean up storage
    const { data: images } = await supabase
        .from("horse_images")
        .select("image_url")
        .eq("horse_id", horseId);

    // Delete storage files
    if (images && images.length > 0) {
        const paths = images
            .map((img: { image_url: string }) => {
                const match = img.image_url.match(/horse-images\/(.+)$/);
                return match ? match[1] : null;
            })
            .filter(Boolean) as string[];
        if (paths.length > 0) {
            await supabase.storage.from("horse-images").remove(paths);
        }
    }

    // Delete the horse (cascades to horse_images, financial_vault, etc.)
    const { error } = await supabase
        .from("user_horses")
        .delete()
        .eq("id", horseId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard");
    return { success: true };
}
