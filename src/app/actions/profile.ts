"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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
