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

        const { error } = await supabase.from("catalog_price_signal_flags" as never).insert({
            catalog_item_id: input.catalogItemId,
            reporter_id: user.id,
            note,
        } as never);

        if (error) {
            const e = error as { code?: string; message?: string };
            if (e.code === "23505") {
                // One flag per member per model. Already active: nothing to do.
                // Resolved earlier (the owner showed the price again) and now
                // wrong again: reopen it, so the new report still counts.
                const { data: reopened } = await getAdminClient()
                    .from("catalog_price_signal_flags")
                    .update({ status: "active", note, resolved_at: null, created_at: new Date().toISOString() })
                    .eq("catalog_item_id", input.catalogItemId)
                    .eq("reporter_id", user.id)
                    .neq("status", "active")
                    .select("id");
                if (!reopened || reopened.length === 0) return { success: true };
            } else {
                if (e.code === "42P01" || /catalog_price_signal_flags/.test(e.message ?? "")) {
                    return { success: false, error: "Reporting isn't available yet — try again soon." };
                }
                return { success: false, error: "Could not file the report." };
            }
        }

        // Tell the admins, off the response path.
        const reporterId = user.id;
        const catalogItemId = input.catalogItemId;
        after(async () => {
            try {
                const { createNotification } = await import("@/lib/notifications/createNotification");
                const admin = getAdminClient();
                const { data: item } = await admin
                    .from("catalog_items")
                    .select("title")
                    .eq("id", catalogItemId)
                    .maybeSingle();
                const title = (item as { title: string } | null)?.title ?? "a catalog entry";
                const { adminNotificationTargets } = await import("@/lib/notifications/adminTargets");
                const adminIds = await adminNotificationTargets(admin);
                for (const id of adminIds) {
                    await createNotification({
                        userId: id,
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

// ── The owner's side of a "wrong model" report (MHH-022, gap G4) ──
// A report hid the price and took the model off the sweep, and nothing
// could ever bring it back. The owner now sees every hidden price and can
// show it again when the report turns out to be mistaken; a price that
// really was the wrong model simply stays hidden.

/** One model whose price is hidden, with every member's report on it. */
export interface HiddenPrice {
    catalogItemId: string;
    title: string;
    reports: { reporter: string; reportedAt: string; note: string | null }[];
}

export async function listHiddenPrices(): Promise<
    { success: true; prices: HiddenPrice[] } | { success: false; error: string }
> {
    const { requireAdmin } = await import("@/lib/auth");
    await requireAdmin();
    const admin = getAdminClient();
    const { data, error } = await admin
        .from("catalog_price_signal_flags")
        .select("id, catalog_item_id, note, reporter_id, created_at")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(500);
    if (error) return { success: false, error: "The hidden prices couldn't load just now." };
    const rows = data ?? [];
    const itemIds = [...new Set(rows.map((r) => r.catalog_item_id))];
    const userIds = [...new Set(rows.map((r) => r.reporter_id))];
    const [{ data: items }, { data: users }] = await Promise.all([
        itemIds.length
            ? admin.from("catalog_items").select("id, title").in("id", itemIds)
            : Promise.resolve({ data: [] }),
        userIds.length ? admin.from("users").select("id, alias_name").in("id", userIds) : Promise.resolve({ data: [] }),
    ]);
    const title = new Map(((items ?? []) as { id: string; title: string }[]).map((i) => [i.id, i.title]));
    const alias = new Map(((users ?? []) as { id: string; alias_name: string }[]).map((u) => [u.id, u.alias_name]));
    // Newest report first, so the most recently hidden model leads.
    const byItem = new Map<string, HiddenPrice>();
    for (const r of rows) {
        const entry = byItem.get(r.catalog_item_id) ?? {
            catalogItemId: r.catalog_item_id,
            title: title.get(r.catalog_item_id) ?? "a catalog entry",
            reports: [],
        };
        entry.reports.push({
            reporter: alias.get(r.reporter_id) ? `@${alias.get(r.reporter_id)}` : "a member",
            reportedAt: r.created_at,
            note: r.note,
        });
        byItem.set(r.catalog_item_id, entry);
    }
    return { success: true, prices: [...byItem.values()] };
}

/**
 * The reports were mistaken: show the model's price again and put it back on
 * the sweep. Every active report on the model is resolved (one left open
 * would keep the price hidden), and each member who reported it is told.
 */
export async function restoreHiddenPrice(catalogItemId: string): Promise<{ success: boolean; error?: string }> {
    const { requireAdmin } = await import("@/lib/auth");
    await requireAdmin();
    const admin = getAdminClient();
    const { data: flags, error } = await admin
        .from("catalog_price_signal_flags")
        .update({ status: "resolved", resolved_at: new Date().toISOString() })
        .eq("catalog_item_id", catalogItemId)
        .eq("status", "active")
        .select("reporter_id");
    if (error) return { success: false, error: "That price couldn't be restored just now." };
    if (!flags || flags.length === 0) return { success: false, error: "Those reports were already handled." };

    const reporterIds = [...new Set(flags.map((f) => f.reporter_id as string))];
    after(async () => {
        try {
            const { createNotification } = await import("@/lib/notifications/createNotification");
            const { data: item } = await admin
                .from("catalog_items")
                .select("title")
                .eq("id", catalogItemId)
                .maybeSingle();
            for (const userId of reporterIds) {
                await createNotification({
                    userId,
                    type: "system",
                    actorId: null,
                    content: `Thanks for flagging the eBay price on "${item?.title ?? "a model"}". We checked it against the listings and it is the right model, so the price is showing again.`,
                    linkUrl: `/catalog/${catalogItemId}`,
                });
            }
        } catch {
            /* non-blocking */
        }
    });
    revalidateTag(REFERENCE_PAGES_CACHE_TAG, "max");
    return { success: true };
}
