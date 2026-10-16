"use server";

/**
 * The owner's mailbox (MHH-027): contact messages by status, with the
 * sender's account when they were signed in, and open/resolved. Older
 * messages page in; before migration 236 everything still lists, as open.
 */
import { requireAdmin } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { type ActionResult, fail, safeError } from "@/lib/actions/result";

export interface MailboxMessage {
    id: string;
    name: string;
    email: string;
    subject: string | null;
    message: string;
    isRead: boolean;
    createdAt: string;
    category: string;
    status: "open" | "resolved";
    errorRef: string | null;
    sender: { alias: string } | null;
}

export type MailboxFilter = "open" | "resolved" | "all";

const PAGE = 50;

type Row = {
    id: string;
    name: string;
    email: string;
    subject: string | null;
    message: string;
    is_read: boolean;
    created_at: string;
    category?: string | null;
    status?: string | null;
    error_ref?: string | null;
    user_id?: string | null;
};

type Untyped = {
    from: (t: string) => {
        select: (c: string) => {
            order: (
                c: string,
                o: { ascending: boolean },
            ) => {
                limit: (n: number) => QueryEnd;
            };
        };
        update: (r: Record<string, unknown>) => { eq: (c: string, v: string) => PromiseLike<{ error: unknown }> };
    };
};
type QueryEnd = PromiseLike<{ data: Row[] | null; error: { code?: string; message?: string } | null }> & {
    eq: (c: string, v: string) => QueryEnd;
    lt: (c: string, v: string) => QueryEnd;
};

/** Messages newest first; `before` pages to older ones. */
export async function listMailbox(
    filter: MailboxFilter,
    before?: string,
): Promise<ActionResult<{ messages: MailboxMessage[]; more: boolean; triage: boolean }>> {
    await requireAdmin();
    const admin = getAdminClient();
    const db = admin as unknown as Untyped;
    const run = (cols: string, withStatus: boolean) => {
        let q = db
            .from("contact_messages")
            .select(cols)
            .order("created_at", { ascending: false })
            .limit(PAGE + 1);
        if (withStatus && filter !== "all") q = q.eq("status", filter);
        if (before) q = q.lt("created_at", before);
        return q;
    };
    let triage = true;
    let { data, error } = await run(
        "id, name, email, subject, message, is_read, created_at, category, status, error_ref, user_id",
        true,
    );
    if (error && (error.code === "42703" || error.code === "PGRST204")) {
        // Migration 236 not pasted yet: list everything, all counted as open.
        triage = false;
        ({ data, error } = await run("id, name, email, subject, message, is_read, created_at", false));
    }
    if (error) return safeError("AdminMailbox", error, "The mailbox couldn't load just now.");

    const rows = (data ?? []).slice(0, PAGE);
    const userIds = [...new Set(rows.map((r) => r.user_id).filter((x): x is string => !!x))];
    const { data: users } = userIds.length
        ? await admin.from("users").select("id, alias_name").in("id", userIds)
        : { data: [] as { id: string; alias_name: string }[] };
    const alias = new Map((users ?? []).map((u) => [u.id, u.alias_name]));

    return {
        success: true,
        triage,
        more: (data ?? []).length > PAGE,
        messages: rows.map((r) => ({
            id: r.id,
            name: r.name,
            email: r.email,
            subject: r.subject,
            message: r.message,
            isRead: r.is_read,
            createdAt: r.created_at,
            category: r.category ?? "question",
            status: r.status === "resolved" ? "resolved" : "open",
            errorRef: r.error_ref ?? null,
            sender: r.user_id && alias.get(r.user_id) ? { alias: alias.get(r.user_id)! } : null,
        })),
    };
}

/** Close a message once it's handled, or open it again. */
export async function setMailboxStatus(id: string, status: "open" | "resolved"): Promise<ActionResult> {
    await requireAdmin();
    if (status !== "open" && status !== "resolved") return fail("Pick open or resolved.");
    const db = getAdminClient() as unknown as Untyped;
    const { error } = await db
        .from("contact_messages")
        .update({
            status,
            resolved_at: status === "resolved" ? new Date().toISOString() : null,
            ...(status === "resolved" ? { is_read: true } : {}),
        })
        .eq("id", id);
    if (error)
        return safeError("AdminMailbox", error, "That message couldn't be updated. Has migration 236 been pasted?");
    revalidatePath("/admin");
    return { success: true };
}
