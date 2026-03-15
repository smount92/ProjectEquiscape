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
        const rawAliases = extractMentions(content);
        if (rawAliases.length === 0) return;

        const admin = getAdminClient();

        // For multi-word mentions, also try progressively shorter substrings
        // e.g. "@John Smith is cool" → try ["John Smith is cool", "John Smith is", "John Smith", "John"]
        const candidates = new Set<string>();
        for (const alias of rawAliases) {
            const words = alias.split(/\s+/);
            for (let len = words.length; len >= 1; len--) {
                const sub = words.slice(0, len).join(" ");
                if (sub.length >= 3) candidates.add(sub);
            }
        }

        // Batch resolve aliases to user IDs
        const { data: users } = await admin
            .from("users")
            .select("id, alias_name")
            .in("alias_name", [...candidates]);

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
