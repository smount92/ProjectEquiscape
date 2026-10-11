/**
 * /shows/[id]/enter — THE ENTRY PAGE, the single owner of entering a
 * show (replaces the per-horse entry dialog). Signed-in only. Loads
 * the same payloads the show page does — the program, your entries,
 * your enterable horses, your staff role — and hands them to the
 * client workbench. ?class= and ?horse= preselect (Re-enter links and
 * the program's Enter links use them).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getMyEntrantHorses, getMyShowEntries, getPublicShow } from "@/app/actions/shows-v2";
import { getShowRole } from "@/lib/shows/queries";
import type { EntrantHorse, MyShowEntry } from "@/lib/shows/public";
import { createClient } from "@/lib/supabase/server";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import PageMasthead from "@/components/layouts/PageMasthead";
import EnterShowWorkbench from "@/components/shows/EnterShowWorkbench";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
    const { id } = await params;
    const result = await getPublicShow({ showId: id });
    return {
        title: result.success ? `Enter — ${result.show.title}` : "Enter a show",
        robots: { index: false },
    };
}

/** A single string from a search param (first value wins). */
function one(value: string | string[] | undefined): string | null {
    const v = Array.isArray(value) ? value[0] : value;
    return v && v.trim() ? v : null;
}

export default async function EnterShowPage({
    params,
    searchParams,
}: Params & { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const [{ id }, query] = await Promise.all([params, searchParams]);

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect(`/login?redirectTo=${encodeURIComponent(`/shows/${id}/enter`)}`);

    const result = await getPublicShow({ showId: id });
    if (!result.success) notFound();
    const { show, divisions } = result;

    const masthead = (
        <PageMasthead icon="🏇" title={`Enter ${show.title}`} backHref={`/shows/${id}`} backLabel="Show" />
    );

    const [entriesResult, horsesResult, roleResult] = await Promise.all([
        getMyShowEntries({ showId: id }),
        show.status === "entries_open" ? getMyEntrantHorses() : null,
        getShowRole(supabase, id, user.id),
    ]);
    const role = roleResult && !("error" in roleResult) ? roleResult.role : null;

    const refusal =
        show.status !== "entries_open"
            ? "Entries aren't open for this show right now."
            : role === "judge"
              ? "You're judging this show, so you can't enter it — judges sit their own ring out."
              : null;

    if (refusal) {
        return (
            <ExplorerLayout frameless noHeader>
                {masthead}
                <div className="ledger-card mx-auto max-w-[640px]" role="note">
                    <p className="m-0 text-sm text-foreground">{refusal}</p>
                    <Link href={`/shows/${id}`} className="btn-brass mt-3">
                        Back to the show
                    </Link>
                </div>
            </ExplorerLayout>
        );
    }

    const myEntries: MyShowEntry[] = entriesResult.success ? entriesResult.entries : [];
    const horses: EntrantHorse[] = horsesResult?.success ? horsesResult.horses : [];

    return (
        <ExplorerLayout frameless noHeader>
            {masthead}
            <EnterShowWorkbench
                show={{ id: show.id, title: show.title, mode: show.mode }}
                divisions={divisions}
                myEntries={myEntries}
                horses={horses}
                initialClassId={one(query.class)}
                initialHorseId={one(query.horse)}
            />
        </ExplorerLayout>
    );
}
