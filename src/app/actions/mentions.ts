import "server-only";

import { getAdminClient } from "@/lib/supabase/admin";
import { extractMentions } from "@/lib/utils/mentions";
import { candidateFirstTokens, resolveMentions } from "@/lib/feed/mentionMatch";

/**
 * Resolve the greedy mention candidates in `content` to the real
 * aliases they refer to.
 *
 * The extractor is deliberately greedy — it hands back "black fox
 * farm loved this" for "@black fox farm loved this" — because only
 * the alias table can say where the name ends. This does that half:
 * pull every alias whose FIRST token matches a candidate's first
 * token (a narrow, indexable prefix query — not the whole user
 * directory), then longest-match.
 *
 * Server-only, and safe to call with untrusted content: it reads
 * aliases and returns them, nothing more.
 */
export async function resolveMentionedAliases(
    content: string,
): Promise<{ alias: string; userId: string }[]> {
    const candidates = extractMentions(content);
    if (candidates.length === 0) return [];

    const tokens = candidateFirstTokens(candidates);
    if (tokens.length === 0) return [];

    const admin = getAdminClient();

    // One prefix query per distinct first token, OR'd together. Tokens
    // come out of the extractor's \w-only character class, so they can
    // never contain the comma or dot that would break PostgREST's `or`
    // grammar.
    const orFilter = tokens.map((t) => `alias_name.ilike.${t}%`).join(",");
    const { data: users } = await admin
        .from("users")
        .select("id, alias_name")
        .or(orFilter)
        .limit(200);

    const rows = (users ?? []) as { id: string; alias_name: string }[];
    if (rows.length === 0) return [];

    const byAlias = new Map<string, string>();
    for (const row of rows) {
        if (row.alias_name) byAlias.set(row.alias_name.toLowerCase(), row.id);
    }

    const matched = resolveMentions(candidates, rows.map((r) => r.alias_name).filter(Boolean));

    return matched
        .map((alias) => ({ alias, userId: byAlias.get(alias.toLowerCase())! }))
        .filter((m) => !!m.userId);
}

/**
 * Parse @mentions from content and send notifications.
 * Fire-and-forget — never fails the parent action.
 *
 * SECURITY: this is an INTERNAL server-only helper, NOT a "use server" action —
 * it must never be a client-callable endpoint. `actorId`/`actorAlias` are
 * trusted here precisely because the only callers are authenticated server
 * actions that derive them from requireAuth(); if this were exposed as an
 * action, a client could forge "@<anyone> mentioned you" notifications. Keep
 * `import "server-only"` and do NOT add a "use server" directive.
 */
export async function parseAndNotifyMentions(
    content: string,
    actorId: string,
    actorAlias: string,
    sourceUrl: string
): Promise<void> {
    try {
        const mentioned = await resolveMentionedAliases(content);
        if (mentioned.length === 0) return;

        // Build notification inserts (exclude self-mentions)
        const inserts = mentioned
            .filter((m) => m.userId !== actorId)
            .map((m) => ({
                user_id: m.userId,
                type: "mention",
                actor_id: actorId,
                content: `@${actorAlias} mentioned you`,
                // Deep link to the mentioning post — callers already pass
                // real permalinks; this was previously discarded, so the
                // notification could only fall back to the actor's profile.
                link_url: sourceUrl,
            }));

        if (inserts.length > 0) {
            const admin = getAdminClient();
            await admin.from("notifications").insert(inserts);
        }
    } catch {
        // Fire-and-forget
    }
}
