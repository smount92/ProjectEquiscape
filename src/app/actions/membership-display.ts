"use server";

// Membership display — the profile opt-in toggle only.
//
// Mirrors supporter.ts: this action manages ONE preference column on the
// member's own row. It never reads or writes the tier itself — tier lives
// in app_metadata and is written only by the payment webhooks. Flipping
// this on while holding no membership shows nothing: the DEFINER function
// public_membership_label (migration 193) checks the real tier and the
// entitlement clock at read time, so the preference is safe to set in any
// state.

import { revalidatePath } from "next/cache";
import { requireAuth, AuthError } from "@/lib/auth";

export async function setMembershipDisplay(
    visible: boolean
): Promise<{ success: boolean; error?: string }> {
    try {
        const { supabase, user } = await requireAuth();

        const { error } = await supabase
            .from("users")
            .update({ show_membership_on_profile: visible === true })
            .eq("id", user.id);

        if (error) {
            // Feature-detect: before migration 193 the column does not
            // exist. Fail with a message rather than a 500 — main
            // auto-deploys ahead of the owner's paste.
            if (error.code === "42703" || /show_membership_on_profile/.test(error.message)) {
                return { success: false, error: "This option isn't available yet — try again soon." };
            }
            return { success: false, error: error.message };
        }

        revalidatePath("/profile");
        return { success: true };
    } catch (err) {
        if (err instanceof AuthError) return { success: false, error: err.message };
        return { success: false, error: "Failed to update membership display." };
    }
}
