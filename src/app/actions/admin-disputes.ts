"use server";

/**
 * Deal Room disputes, seen by the owner (MHH-020, gap G2).
 *
 * A dispute froze the deal and told the other member, and nobody else: the
 * site keeps the record and does not referee, but the owner still needs to
 * know when one is open (a pattern of non-delivery is a conduct matter).
 * Read through the service role because a deal thread is private to its
 * two members; only the owner reaches this.
 */
import { requireAdmin } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { dealDb } from "@/lib/deals/columnSupport";
import { type ActionResult, safeError } from "@/lib/actions/result";

export interface OpenDispute {
    conversationId: string;
    openedAt: string;
    reason: string;
    raisedBy: string;
    buyer: string;
    seller: string;
    horse: { id: string; name: string } | null;
}

type Row = {
    id: string;
    buyer_id: string | null;
    seller_id: string | null;
    horse_id: string | null;
    disputed_at: string;
    disputed_by: string | null;
    dispute_reason: string | null;
};

export async function listOpenDisputes(): Promise<ActionResult<{ disputes: OpenDispute[] }>> {
    await requireAdmin();
    const admin = getAdminClient();
    const { data, error } = await dealDb(admin)
        .from("conversations")
        .select("id, buyer_id, seller_id, horse_id, disputed_at, disputed_by, dispute_reason")
        .not("disputed_at", "is", null)
        .order("disputed_at", { ascending: false })
        .limit(100);
    if (error) return safeError("AdminDisputes", error, "The dispute list couldn't load just now.");

    const rows = (data ?? []) as Row[];
    const userIds = [
        ...new Set(rows.flatMap((r) => [r.buyer_id, r.seller_id, r.disputed_by]).filter((x): x is string => !!x)),
    ];
    const horseIds = [...new Set(rows.map((r) => r.horse_id).filter((x): x is string => !!x))];
    const [{ data: users }, { data: horses }] = await Promise.all([
        userIds.length ? admin.from("users").select("id, alias_name").in("id", userIds) : Promise.resolve({ data: [] }),
        horseIds.length
            ? admin.from("user_horses").select("id, custom_name").in("id", horseIds)
            : Promise.resolve({ data: [] }),
    ]);
    const alias = new Map(
        ((users ?? []) as { id: string; alias_name: string }[]).map((u) => [u.id, `@${u.alias_name}`]),
    );
    const horseName = new Map(
        ((horses ?? []) as { id: string; custom_name: string }[]).map((h) => [h.id, h.custom_name]),
    );
    const who = (id: string | null) => (id ? (alias.get(id) ?? "a member") : "a member");

    return {
        success: true,
        disputes: rows.map((r) => ({
            conversationId: r.id,
            openedAt: r.disputed_at,
            reason: r.dispute_reason ?? "",
            raisedBy: who(r.disputed_by),
            buyer: who(r.buyer_id),
            seller: who(r.seller_id),
            horse: r.horse_id ? { id: r.horse_id, name: horseName.get(r.horse_id) ?? "a horse" } : null,
        })),
    };
}
