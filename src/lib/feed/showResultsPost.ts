import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getPostColumnSupport } from "@/lib/feed/columnSupport";

/**
 * Emit the one social artefact a show produces: a feed post
 * announcing that its results are live.
 *
 * SERVER-ONLY ON PURPOSE. This is not a "use server" action and must
 * never become one — it authors a post as the show's HOST, so a
 * client-callable version would let anyone publish in someone else's
 * name. Its only caller is the results-publish path in
 * transitionShowStatus, which has already proved host/co-host role.
 *
 * Every failure mode is swallowed: publishing results must never fail
 * because the feed post did not land.
 */
export async function emitShowResultsPost(
    admin: SupabaseClient,
    showId: string,
): Promise<{ emitted: boolean; reason?: string }> {
    try {
        const { data: show } = await admin
            .from("shows")
            .select("id, title, host_id, status")
            .eq("id", showId)
            .maybeSingle();

        const s = show as { id: string; title: string; host_id: string; status: string } | null;
        if (!s) return { emitted: false, reason: "show-not-found" };
        if (s.status !== "completed") return { emitted: false, reason: "not-completed" };
        if (!s.host_id) return { emitted: false, reason: "no-host" };

        const support = await getPostColumnSupport(admin);

        // Idempotency. With migration 166 applied a partial unique index
        // makes a double-fire a no-op anyway; this check keeps it a no-op
        // (rather than a logged conflict) before the migration lands, and
        // works on the pre-166 shape where `kind` does not exist.
        let existingQuery = admin.from("posts").select("id").eq("show_id", showId).limit(1);
        if (support.kind) existingQuery = existingQuery.eq("kind", "show_results");
        const { data: existing } = await existingQuery;
        if (existing && existing.length > 0) return { emitted: false, reason: "already-emitted" };

        const title = (s.title || "the show").trim();
        const content = `🏆 Results are in: ${title}\n\n[See the placings](/shows/${showId}#results)`;

        const row: Record<string, unknown> = {
            author_id: s.host_id,
            content,
            show_id: showId,
            horse_id: null,
            group_id: null,
            event_id: null,
            studio_id: null,
            help_request_id: null,
            parent_id: null,
        };
        if (support.kind) row.kind = "show_results";
        if (support.visibility) row.visibility = "public";

        const { error } = await admin.from("posts").insert(row);
        if (error) {
            // 23505 = the unique index did its job on a concurrent publish.
            if (error.code === "23505") return { emitted: false, reason: "already-emitted" };
            return { emitted: false, reason: error.message };
        }

        return { emitted: true };
    } catch (err) {
        return { emitted: false, reason: err instanceof Error ? err.message : "unknown" };
    }
}
