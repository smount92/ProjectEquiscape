import type { getAdminClient } from "@/lib/supabase/admin";

/**
 * Who receives admin-audience notifications (catalog suggestions,
 * wrong-model price flags).
 *
 * Two sources, deduped: users whose role is 'admin', PLUS the account
 * matching ADMIN_EMAIL. The fallback exists because the launch database
 * shipped with zero role='admin' rows, so every admin notification
 * since the feature landed was fanned out to an empty list and nobody
 * noticed — the classic silent-empty failure. ADMIN_EMAIL is already
 * the source of truth for the revert gate, so the two mechanisms now
 * name the same person by construction.
 */
export async function adminNotificationTargets(
    admin: ReturnType<typeof getAdminClient>,
): Promise<string[]> {
    const ids = new Set<string>();
    try {
        const { data: roleAdmins } = await admin.from("users").select("id").eq("role", "admin");
        for (const a of (roleAdmins ?? []) as { id: string }[]) ids.add(a.id);
    } catch {
        /* fall through to the email path */
    }
    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
    if (adminEmail) {
        try {
            const { data: owner } = await admin
                .from("users")
                .select("id")
                .ilike("email", adminEmail)
                .limit(1);
            for (const a of (owner ?? []) as { id: string }[]) ids.add(a.id);
        } catch {
            /* no email column or no match — role list stands alone */
        }
    }
    return [...ids];
}
