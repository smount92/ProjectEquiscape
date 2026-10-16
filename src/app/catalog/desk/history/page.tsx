import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { registryRoleOf } from "@/lib/auth";
import { getHistory } from "@/app/actions/registry-desk-lists";
import DeskListsShell from "@/components/desk/DeskListsShell";
import HistoryList from "@/components/desk/HistoryList";

export const metadata: Metadata = {
    title: "History · Registry Desk",
    robots: { index: false, follow: false },
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Everything done on the Registry Desk, with Undo and "Looks right". */
export default async function DeskHistoryPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    // Own role check: the Desk's shared layout (Package B) checks too, once merged.
    if (!(await registryRoleOf())) notFound();
    const sp = await searchParams;
    const result = await getHistory({ who: one(sp.who), kind: one(sp.kind), page: one(sp.page) });
    return (
        <DeskListsShell active="history">
            {result.success ? (
                <HistoryList
                    entries={result.entries}
                    ready={result.ready}
                    message={result.message}
                    page={result.page}
                    hasMore={result.hasMore}
                    filter={result.filter}
                />
            ) : (
                <div role="alert" className="ledger-card text-secondary-foreground">
                    {result.error}
                </div>
            )}
        </DeskListsShell>
    );
}
