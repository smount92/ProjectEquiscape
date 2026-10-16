"use server";

/**
 * Message the host (MHH-026). An entrant who was barred, scratched or just
 * has a question writes to the show's host from /shows/[id]/message-host.
 * The message opens (or continues) their ordinary inbox thread with the
 * host, and its first line names the show and, when chosen, the entry, so
 * the host never has to ask "which one?".
 */
import { z } from "zod";
import { AuthError, requireAuth } from "@/lib/auth";
import { createOrFindConversation, sendMessage } from "@/app/actions/messaging";
import { fail, NOT_LOGGED_IN, type ActionResult } from "@/lib/actions/result";
import { uuidSchema } from "@/lib/shows/schemas";
import { HOST_MESSAGE_MAX, hostMessageHeading, type HostMessageEntry } from "@/lib/shows/hostMessage";

const schema = z.object({
    showId: uuidSchema,
    entryId: uuidSchema.nullish(),
    message: z.string().trim().min(1, "Write a message first.").max(HOST_MESSAGE_MAX, "That message is too long."),
});

export async function messageShowHost(
    input: z.input<typeof schema>,
): Promise<ActionResult<{ conversationId: string }>> {
    const parsed = schema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the message and try again.");
    const { showId, entryId, message } = parsed.data;

    let auth: Awaited<ReturnType<typeof requireAuth>>;
    try {
        auth = await requireAuth();
    } catch (err) {
        // Suspended accounts get their own words; everyone else logs in.
        if (err instanceof AuthError && err.message !== "Not authenticated.") return fail(err.message);
        return fail(NOT_LOGGED_IN);
    }
    const { supabase, user } = auth;

    const { data: show } = await supabase
        .from("shows")
        .select("id, title, host_id")
        .eq("id", showId)
        .maybeSingle<{ id: string; title: string; host_id: string }>();
    if (!show) return fail("We couldn't find that show.");
    if (show.host_id === user.id) return fail("You host this show.");

    let entry: HostMessageEntry | null = null;
    if (entryId) {
        // Only the viewer's own entries at this show can be named.
        const { data: row } = await supabase
            .from("show_class_entries")
            .select("id, class_id, horse_id, entry_number")
            .eq("id", entryId)
            .eq("show_id", showId)
            .eq("owner_id", user.id)
            .maybeSingle<{ id: string; class_id: string; horse_id: string; entry_number: number | null }>();
        if (!row) return fail("That entry isn't one of yours at this show.");
        const [{ data: horse }, { data: cls }] = await Promise.all([
            supabase
                .from("user_horses")
                .select("custom_name")
                .eq("id", row.horse_id)
                .maybeSingle<{ custom_name: string | null }>(),
            supabase.from("show_classes").select("name").eq("id", row.class_id).maybeSingle<{ name: string }>(),
        ]);
        entry = {
            entryNumber: row.entry_number,
            horseName: horse?.custom_name ?? "Unnamed horse",
            className: cls?.name ?? null,
        };
    }

    const opened = await createOrFindConversation(show.host_id, null);
    if (!opened.success || !opened.conversationId) {
        return fail(opened.error ?? "Could not open a conversation with the host.");
    }

    const heading = hostMessageHeading(show.title, entry);
    const sent = await sendMessage(opened.conversationId, `${heading}\n\n${message}`);
    if (!sent.success) return fail(sent.error ?? "Your message didn't send. Please try again.");

    return { success: true, conversationId: opened.conversationId };
}
