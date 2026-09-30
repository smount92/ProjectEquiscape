"use server";
/**
 * Set purchases — link horses bought together under one price (224).
 * Owner-only throughout: every horse id is checked against the caller's
 * stable before a row is touched, and financial_vault's own row policy
 * is the second lock.
 */
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import {
    isMissingSetColumn,
    SET_LABEL_MAX,
    SET_MAX_MEMBERS,
    SET_MIGRATION_NOTICE,
    type SetPurchase,
} from "@/lib/vault/setPurchase";

type ActionResult<T = object> = ({ success: true } & T) | { success: false; error: string };

const uuid = z.string().uuid();
const linkSchema = z.object({
    horseIds: z.array(uuid).min(2, "A set needs at least two horses.").max(SET_MAX_MEMBERS),
    price: z.number().positive("The set price must be more than zero.").max(1_000_000),
    label: z.string().trim().max(SET_LABEL_MAX).optional(),
});

async function ownHorseIds(
    supabase: Awaited<ReturnType<typeof requireAuth>>["supabase"],
    userId: string,
    ids: string[],
): Promise<Set<string>> {
    const { data } = await supabase
        .from("user_horses")
        .select("id")
        .eq("owner_id", userId)
        .is("deleted_at", null)
        .in("id", ids);
    return new Set(((data ?? []) as { id: string }[]).map((r) => r.id));
}

/** Link these horses (all the caller's) as one purchase at one price. */
export async function linkSetPurchase(input: z.input<typeof linkSchema>): Promise<ActionResult<{ groupId: string }>> {
    const parsed = linkSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid set." };
    const { supabase, user } = await requireAuth();
    const ids = [...new Set(parsed.data.horseIds)];
    const owned = await ownHorseIds(supabase, user.id, ids);
    if (owned.size !== ids.length) return { success: false, error: "Every horse in a set has to be in your stable." };

    // Join an existing group if any member already has one; else mint one.
    const { data: existing, error: readErr } = await supabase
        .from("financial_vault")
        .select("horse_id, purchase_group_id")
        .in("horse_id", ids);
    if (readErr) {
        return { success: false, error: isMissingSetColumn(readErr) ? SET_MIGRATION_NOTICE : readErr.message };
    }
    const found = ((existing ?? []) as { purchase_group_id: string | null }[]).find((r) => r.purchase_group_id)?.purchase_group_id;
    const groupId = found ?? randomUUID();
    const label = parsed.data.label?.trim() || null;

    const rows = ids.map((horse_id) => ({
        horse_id,
        purchase_price: parsed.data.price,
        purchase_group_id: groupId,
        purchase_group_label: label,
        is_trade: false,
    }));
    const { error } = await supabase.from("financial_vault").upsert(rows as never, { onConflict: "horse_id" });
    if (error) return { success: false, error: isMissingSetColumn(error) ? SET_MIGRATION_NOTICE : error.message };

    for (const id of ids) revalidatePath(`/stable/${id}`);
    revalidatePath("/dashboard");
    return { success: true, groupId };
}

/** Take one horse out of its set; its purchase price is left for the owner to correct. */
export async function unlinkSetPurchase(horseId: string): Promise<ActionResult> {
    if (!uuid.safeParse(horseId).success) return { success: false, error: "Invalid horse." };
    const { supabase, user } = await requireAuth();
    const owned = await ownHorseIds(supabase, user.id, [horseId]);
    if (owned.size !== 1) return { success: false, error: "Not your horse." };
    const { error } = await supabase
        .from("financial_vault")
        .update({ purchase_group_id: null, purchase_group_label: null } as never)
        .eq("horse_id", horseId);
    if (error) return { success: false, error: isMissingSetColumn(error) ? SET_MIGRATION_NOTICE : error.message };
    revalidatePath(`/stable/${horseId}`);
    revalidatePath("/dashboard");
    return { success: true };
}

/** The set this horse belongs to, with its members' names; null when solo (or before 224). */
export async function getSetPurchase(horseId: string): Promise<SetPurchase | null> {
    if (!uuid.safeParse(horseId).success) return null;
    const { supabase, user } = await requireAuth();
    const { data: mine, error } = await supabase
        .from("financial_vault")
        .select("purchase_group_id, purchase_group_label, purchase_price")
        .eq("horse_id", horseId)
        .maybeSingle();
    if (error || !mine) return null;
    const row = mine as { purchase_group_id: string | null; purchase_group_label: string | null; purchase_price: number | null };
    if (!row.purchase_group_id) return null;

    const { data: members } = await supabase
        .from("financial_vault")
        .select("horse_id, user_horses!inner(id, custom_name, owner_id, deleted_at)")
        .eq("purchase_group_id", row.purchase_group_id)
        .eq("user_horses.owner_id", user.id)
        .is("user_horses.deleted_at", null);
    const list = ((members ?? []) as unknown as { horse_id: string; user_horses: { custom_name: string } | null }[]).map((m) => ({
        id: m.horse_id,
        name: m.user_horses?.custom_name ?? "—",
    }));
    return {
        groupId: row.purchase_group_id,
        label: row.purchase_group_label,
        price: Number(row.purchase_price ?? 0),
        members: list,
    };
}

/** The caller's own horses, by name, for the set picker. */
export async function listMyHorsesForSet(query: string, excludeId?: string): Promise<{ id: string; name: string }[]> {
    const { supabase, user } = await requireAuth();
    const q = query.trim().replace(/[%_,()]/g, "");
    let req = supabase
        .from("user_horses")
        .select("id, custom_name")
        .eq("owner_id", user.id)
        .is("deleted_at", null)
        .order("custom_name")
        .limit(15);
    if (q) req = req.ilike("custom_name", `%${q}%`);
    const { data } = await req;
    return ((data ?? []) as { id: string; custom_name: string }[])
        .filter((h) => h.id !== excludeId)
        .map((h) => ({ id: h.id, name: h.custom_name }));
}
