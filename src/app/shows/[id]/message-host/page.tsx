/**
 * Message the host (MHH-026). Linked from the show page and from every
 * bar/scratch/removal notice, so an entrant always has a way to ask. Nothing
 * is created until they press Send: the message opens (or continues) their
 * inbox thread with the host.
 */
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAliases } from "@/lib/shows/queries";
import { getMyShowEntries } from "@/app/actions/shows-v2";
import FocusLayout from "@/components/layouts/FocusLayout";
import PageMasthead from "@/components/layouts/PageMasthead";
import BackLink from "@/components/nav/BackLink";
import MessageHostForm, { type HostMessageEntryOption } from "@/components/shows/MessageHostForm";

export const metadata: Metadata = { title: "Message the host", robots: { index: false } };

export default async function MessageHostPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    /** ?entry= preselects one of the viewer's entries (from My Entries). */
    searchParams: Promise<{ entry?: string }>;
}) {
    const { id } = await params;
    const { entry: askedEntry } = await searchParams;
    const showPath = `/shows/${encodeURIComponent(id)}`;
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect(`/login?redirectTo=${encodeURIComponent(`${showPath}/message-host`)}`);

    const { data: show } = await supabase
        .from("shows")
        .select("id, title, host_id")
        .eq("id", id)
        .maybeSingle<{ id: string; title: string; host_id: string }>();
    if (!show) notFound();
    if (show.host_id === user.id) redirect(showPath);

    const [aliases, mine] = await Promise.all([
        getAliases(supabase, [show.host_id]),
        getMyShowEntries({ showId: show.id }),
    ]);
    const hostAlias = aliases instanceof Map ? (aliases.get(show.host_id) ?? null) : null;

    const myEntries = mine.success ? mine.entries : [];
    const classNames = new Map<string, string>();
    if (myEntries.length > 0) {
        const { data: classes } = await supabase
            .from("show_classes")
            .select("id, name")
            .in("id", [...new Set(myEntries.map((e) => e.classId))]);
        for (const c of classes ?? []) classNames.set(c.id as string, c.name as string);
    }
    const entries: HostMessageEntryOption[] = myEntries.map((e) => ({
        id: e.id,
        entryNumber: e.entryNumber,
        horseName: e.horseName,
        className: classNames.get(e.classId) ?? null,
        scratched: e.status === "scratched",
    }));

    return (
        <FocusLayout noHeader>
            <BackLink href={showPath} className="mb-3 inline-block text-sm text-muted-foreground hover:underline">
                ← {show.title}
            </BackLink>
            <PageMasthead
                compact
                icon="✉️"
                title="Message the host"
                subtitle={hostAlias ? `@${hostAlias} hosts ${show.title}` : show.title}
            />
            <MessageHostForm
                showId={show.id}
                showTitle={show.title}
                hostAlias={hostAlias}
                entries={entries}
                initialEntryId={entries.some((e) => e.id === askedEntry) ? (askedEntry as string) : ""}
            />
        </FocusLayout>
    );
}
