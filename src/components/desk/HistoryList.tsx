/**
 * The Desk's History tab: every Registry Desk action, newest first,
 * filtered by who and by kind. The filter is a plain GET form, so it works
 * before the page's script loads; each line is a HistoryRow.
 */
import Link from "next/link";
import type { HistoryEntry } from "@/app/actions/registry-desk-lists";
import HistoryRow from "@/components/desk/HistoryRow";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";

const KINDS: [string, string][] = [
    ["all", "Everything"],
    ["edit", "Edits"],
    ["add", "New entries"],
    ["refile", "Re-filed under another mold"],
    ["approve", "Suggestions approved"],
    ["revert", "Reverts"],
    ["merge", "Merges"],
    ["remove", "Removals"],
    ["undo", "Undos"],
];
const WHO: [string, string][] = [
    ["all", "Everyone"],
    ["mine", "Mine"],
    ["others", "Everyone else"],
];

export default function HistoryList({
    entries,
    ready,
    message,
    page,
    hasMore,
    filter,
}: {
    entries: HistoryEntry[];
    ready: boolean;
    message: string | null;
    page: number;
    hasMore: boolean;
    filter: { who: string; kind: string };
}) {
    const href = (p: number) => `/catalog/desk/history?who=${filter.who}&kind=${filter.kind}&page=${p}`;
    return (
        <section aria-label="History" className="flex flex-col gap-3">
            <p className="m-0 max-w-[75ch] text-secondary-foreground">
                Everything done on the Registry Desk, newest first. Anything can be undone for 30 days. When you have
                checked someone else’s change, press “Looks right”.
            </p>
            <form method="get" className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <label className="flex flex-col gap-1 text-sm font-semibold text-foreground sm:w-48">
                    Who
                    <NativeSelect name="who" defaultValue={filter.who}>
                        {WHO.map(([v, label]) => (
                            <option key={v} value={v}>
                                {label}
                            </option>
                        ))}
                    </NativeSelect>
                </label>
                <label className="flex flex-col gap-1 text-sm font-semibold text-foreground sm:w-64">
                    What
                    <NativeSelect name="kind" defaultValue={filter.kind}>
                        {KINDS.map(([v, label]) => (
                            <option key={v} value={v}>
                                {label}
                            </option>
                        ))}
                    </NativeSelect>
                </label>
                <Button type="submit" variant="outline">
                    Show
                </Button>
            </form>
            {!ready ? (
                <div className="ledger-card text-secondary-foreground">{message}</div>
            ) : entries.length === 0 ? (
                <div className="ledger-card text-secondary-foreground">Nothing here yet.</div>
            ) : (
                <ul className="ledger-card m-0 flex list-none flex-col divide-y divide-input">
                    {entries.map((e) => (
                        <HistoryRow key={e.id} entry={e} />
                    ))}
                </ul>
            )}
            {(page > 1 || hasMore) && (
                <nav aria-label="Pages" className="flex items-center justify-between gap-3 text-sm">
                    {page > 1 ? (
                        <Link href={href(page - 1)} className="font-semibold text-forest">
                            ← Newer
                        </Link>
                    ) : (
                        <span />
                    )}
                    <span className="text-muted-foreground">Page {page}</span>
                    {hasMore ? (
                        <Link href={href(page + 1)} className="font-semibold text-forest">
                            Older →
                        </Link>
                    ) : (
                        <span />
                    )}
                </nav>
            )}
        </section>
    );
}
