"use server";

// Supporter actions — the ledger opt-in toggle only.
//
// NOTE: is_supporter / supporter_since are NEVER written here (or anywhere in
// app code). They are set exclusively by the verified Stripe webhook via the
// service-role client, and migration 142's trigger guard reverts any client
// attempt to write them. This action only manages the user's own opt-IN
// preference for the public About-page ledger (default: opted out).

import { revalidatePath } from "next/cache";
import { requireAuth, AuthError } from "@/lib/auth";

export async function setSupporterLedgerListing(
    visible: boolean
): Promise<{ success: boolean; error?: string }> {
    try {
        const { supabase, user } = await requireAuth();

        const { error } = await supabase
            .from("users")
            .update({ show_in_supporters_ledger: visible === true })
            .eq("id", user.id);

        if (error) return { success: false, error: error.message };

        // The About page is static/ISR — surface the ledger change promptly.
        revalidatePath("/about");
        return { success: true };
    } catch (err) {
        if (err instanceof AuthError) return { success: false, error: err.message };
        return { success: false, error: "Failed to update ledger preference." };
    }
}
