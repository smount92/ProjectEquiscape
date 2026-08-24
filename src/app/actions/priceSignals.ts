"use server";

// eBay price-signal actions — the "wrong model" report.
//
// Matching is automated and will sometimes be wrong; the member reading
// a model's page knows the models better than any regex. One report:
//   * notifies the admins with a link to the page
//   * hides the signal from the page immediately (the render gate checks
//     for an active flag)
//   * takes the model OFF the sweep until an admin resolves the flag —
//     a wrong price that keeps coming back after being reported would be
//     worse than no feature.

import { revalidatePath, revalidateTag } from "next/cache";
import { after } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { sanitizeText } from "@/lib/utils/validation";
import { REFERENCE_PAGES_CACHE_TAG } from "@/app/actions/reference-pages";

export async function reportWrongModelMatch(input: {
    catalogItemId: string;
    note?: string;
}): Promise<{ success: boolean; error?: string }> {
    try {
        const { supabase, user } = await requireAuth();
        const note = sanitizeText(input.note ?? "").slice(0, 500) || null;

        const { error } = await supabase
            .from("catalog_price_signal_flags" as never)
            .insert({
                catalog_item_id: input.catalogItemId,
                reporter_id: user.id,
                note,
            } as never);

        if (error) {
            const e = error as { code?: string; message?: string };
            if (e.code === "23505") {
                // The unique constraint: they already reported this one.
                return { success: true };
            }
            if (e.code === "42P01" || /catalog_price_signal_flags/.test(e.message ?? "")) {
                return { success: false, error: "Reporting isn't available yet — try again soon." };
            }
            return { success: false, error: e.message ?? "Could not file the report." };
        }

        // Tell the admins, off the response path.
        const reporterId = user.id;
        const catalogItemId = input.catalogItemId;
        after(async () => {
            try {
                const { createNotification } = await import(
                    "@/lib/notifications/createNotification"
                );
                const admin = getAdminClient();
                const { data: item } = await admin
                    .from("catalog_items")
                    .select("title")
                    .eq("id", catalogItemId)
                    .maybeSingle();
                const title = (item as { title: string } | null)?.title ?? "a catalog entry";
                const { data: admins } = await admin
                    .from("users")
                    .select("id")
                    .eq("role", "admin");
                for (const a of (admins ?? []) as { id: string }[]) {
                    await createNotification({
                        userId: a.id,
                        type: "system",
                        actorId: reporterId,
                        content: `🚩 eBay price signal reported as WRONG MODEL on "${title}"${note ? ` — "${note}"` : ""}. The signal is hidden and the model is off the sweep until resolved.`,
                        linkUrl: `/catalog/${catalogItemId}`,
                    });
                }
            } catch {
                /* non-blocking */
            }
        });

        revalidateTag(REFERENCE_PAGES_CACHE_TAG, "max");
        revalidatePath("/reference");
        return { success: true };
    } catch (err) {
        if (err instanceof AuthError) {
            return { success: false, error: "Log in to report a wrong match." };
        }
        return { success: false, error: "Could not file the report." };
    }
}
