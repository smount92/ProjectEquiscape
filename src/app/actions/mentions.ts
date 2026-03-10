"use server";

import { getAdminClient } from "@/lib/supabase/admin";
import { extractMentions } from "@/lib/utils/mentions";

/**
 * Parse @mentions from content and send notifications.
 * Fire-and-forget — never fails the parent action.
 */
export async function parseAndNotifyMentions(
    content: string,
    actorId: string,
    actorAlias: string,
    _sourceUrl: string
): Promise<void> {
    try {
        const aliases = extractMentions(content);
        if (aliases.length === 0) return;

        const admin = getAdminClient();

        // Batch resolve aliases to user IDs
        const { data: users } = await admin
            .from("users")
            .select("id, alias_name")
            .in("alias_name", aliases);

        if (!users || users.length === 0) return;

        // Build notification inserts (exclude self-mentions)
        const inserts = users
            .filter((u: { id: string }) => u.id !== actorId)
            .map((u: { id: string }) => ({
                user_id: u.id,
                type: "mention",
                actor_id: actorId,
                content: `@${actorAlias} mentioned you`,
            }));

        if (inserts.length > 0) {
            await admin.from("notifications").insert(inserts);
        }
    } catch {
        // Fire-and-forget
    }
}
