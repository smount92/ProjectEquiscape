"use client";

/**
 * Admin → Catalog. "Possible duplicates" — the sweeper for the rows the
 * broken legacy approve path minted.
 *
 * That path ran its catalog_items INSERT before a status UPDATE that
 * could never succeed, so every press of Approve on the same suggestion
 * added another entry. resolveLegacySuggestion stopped it; nothing
 * found the rows already in the table. This does.
 *
 * READ-ONLY. It groups, it counts what each row is carrying, and it
 * proposes a direction — then it hands the pair to the EXISTING merge
 * card below rather than reimplementing merge. The admin still reads
 * the confirm dialog and presses Merge.
 *
 * The scan is behind a button on purpose: it reads two thousand catalog
 * rows plus six reference tallies, which is not something the Catalog
 * tab should do every time you click into it.
 */

import { useState, useTransition } from "react";

import { findCatalogDuplicates, type CatalogDuplicateReport } from "@/app/actions/admin";
import type { DuplicateConfidence, DuplicateMember } from "@/lib/admin/catalogDuplicates";
import { CATEGORY_LABELS } from "@/lib/catalog/taxonomy";
import { Button } from "@/components/ui/button";

export interface MergeHandoff {
    /** The row to delete. */
    duplicate: string;
    /** The row that survives. */
    canonical: string;
}

const CONFIDENCE_COPY: Record<DuplicateConfidence, { label: string; blurb: string; tone: string }> = {
    "same-maker": {
        label: "Same maker",
        blurb: "Identical title, category and maker. Near-certainly one entry twice.",
        tone: "border-destructive/40 bg-destructive/5 text-destructive",
    },
    "placeholder-maker": {
        label: "Guessed maker",
        blurb:
            "Makers disagree and at least one is a placeholder or reads like free text — the exact shape the broken approve path produced.",
        tone: "border-forest/40 bg-forest/10 text-forest",
    },
    "different-maker": {
        label: "Two real makers",
        blurb:
            "Same title and category under two genuine makers. Often legitimate — two makers can sculpt the same subject. Your call.",
        tone: "border-input bg-card text-muted-foreground",
    },
};

function categoryLabel(itemType: string): string {
    return CATEGORY_LABELS[itemType] ?? itemType;
}

function loadSummary(member: DuplicateMember): string {
    const { horses, wishlists, otherRefs } = member.load;
    const parts = [
        `${horses} horse${horses === 1 ? "" : "s"}`,
        `${wishlists} wishlist${wishlists === 1 ? "" : "s"}`,
        `${otherRefs} other ref${otherRefs === 1 ? "" : "s"}`,
    ];
    return parts.join(" · ");
}

export default function AdminCatalogDuplicatesCard({
    onHandoff,
}: {
    /** Pre-fills the merge card below. The admin still confirms there. */
    onHandoff: (handoff: MergeHandoff) => void;
}) {
    const [report, setReport] = useState<CatalogDuplicateReport | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();
    /**
     * Per-group keeper override. The suggested keeper is a heuristic
     * (most references, then a real maker, then oldest) and the admin
     * knows the catalog better than the heuristic does — so
     * "Keep this one instead" re-points every Merge button in the group.
     */
    const [keeperOverrides, setKeeperOverrides] = useState<Record<string, string>>({});

    const scan = () => {
        startTransition(async () => {
            setError(null);
            const result = await findCatalogDuplicates();
            if (!result.success) {
                setError(result.error);
                setReport(null);
                return;
            }
            setKeeperOverrides({});
            setReport(result.report);
        });
    };

    return (
        <div className="rounded-lg border border-input bg-card p-4">
            <h3 className="m-0 mb-1 text-base font-bold">Possible duplicates</h3>
            <p className="m-0 mb-3 text-sm text-muted-foreground">
                Groups catalog entries that share a title and category once case, punctuation and
                accents are folded away. Read-only — merging still happens in the card below, with
                its confirm dialog. Nothing here decides anything for you.
            </p>

            <div className="flex flex-wrap items-center gap-3">
                <Button size="sm" disabled={pending} onClick={scan}>
                    {pending ? "Scanning…" : report ? "Re-scan" : "Scan the catalog"}
                </Button>
                {report && (
                    <span className="text-xs text-muted-foreground">
                        {report.scanned.toLocaleString()} entries examined ·{" "}
                        {report.totalGroups} group{report.totalGroups === 1 ? "" : "s"} found
                        {report.groups.length < report.totalGroups && (
                            <> · showing the {report.groups.length} highest-signal</>
                        )}
                    </span>
                )}
            </div>

            {error && (
                <p role="alert" className="m-0 mt-3 text-sm font-semibold text-destructive">
                    {error}
                </p>
            )}

            {report && report.scanCapped && (
                <p className="m-0 mt-3 rounded-md border border-input bg-background px-3 py-2 text-xs text-secondary-foreground">
                    The scan stopped at the newest {report.scanned.toLocaleString()} entries.
                    Anything older than that was <strong>not examined</strong> — this is not a
                    whole-catalog audit.
                </p>
            )}

            {report && report.loadNote && (
                <p className="m-0 mt-2 rounded-md border border-input bg-background px-3 py-2 text-xs text-secondary-foreground">
                    {report.loadNote} Treat the counts below as a floor, not a total.
                </p>
            )}

            {report && report.groups.length === 0 && !error && (
                <p className="m-0 mt-3 text-sm text-muted-foreground">
                    No duplicate groups in the entries examined.
                </p>
            )}

            {report && report.groups.length > 0 && (
                <ul className="m-0 mt-4 flex list-none flex-col gap-4 p-0">
                    {report.groups.map((group) => {
                        const copy = CONFIDENCE_COPY[group.confidence];
                        const overrideId = keeperOverrides[group.key];
                        const keeper =
                            (overrideId && group.members.find((m) => m.id === overrideId)) ||
                            group.members.find((m) => m.keeper) ||
                            group.members[0];
                        return (
                            <li
                                key={group.key}
                                className="rounded-lg border border-input bg-background px-4 py-3"
                            >
                                <div className="mb-1 flex flex-wrap items-center gap-2">
                                    <strong className="text-sm">{group.title}</strong>
                                    <span className="text-xs text-muted-foreground">
                                        {categoryLabel(group.itemType)}
                                    </span>
                                    <span
                                        className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[0.65rem] font-bold tracking-wide uppercase ${copy.tone}`}
                                    >
                                        {copy.label}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {group.totalMembers} entries
                                        {group.totalMembers > group.members.length && (
                                            <> · showing {group.members.length}</>
                                        )}
                                    </span>
                                </div>
                                <p className="m-0 mb-3 text-xs text-muted-foreground">{copy.blurb}</p>

                                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                                    {group.members.map((member) => (
                                        <li
                                            key={member.id}
                                            className={`flex flex-wrap items-center gap-3 rounded-md border px-3 py-2 text-sm ${
                                                member.id === keeper.id
                                                    ? "border-forest/40 bg-forest/5"
                                                    : "border-input"
                                            }`}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <a
                                                        href={`/catalog/${member.slug ?? member.id}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="font-semibold text-forest no-underline hover:underline"
                                                    >
                                                        {member.title}
                                                    </a>
                                                    {member.id === keeper.id && (
                                                        <span className="text-[0.65rem] font-bold tracking-wide text-forest uppercase">
                                                            {overrideId ? "Keeping" : "Suggested keeper"}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="mt-0.5 text-xs text-muted-foreground">
                                                    {member.maker || "(no maker)"}
                                                    {member.makerLooksGuessed && (
                                                        <span
                                                            className="text-destructive"
                                                            title="Placeholder, or reads like the free-text guess the broken approve path wrote"
                                                        >
                                                            {" "}
                                                            ⚠ guessed?
                                                        </span>
                                                    )}
                                                    {" · added "}
                                                    {new Date(member.createdAt).toLocaleDateString()}
                                                </div>
                                                <div className="mt-0.5 text-xs text-secondary-foreground">
                                                    Carries: {loadSummary(member)}
                                                </div>
                                            </div>
                                            {member.id !== keeper.id && (
                                                <div className="flex flex-wrap gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            setKeeperOverrides((prev) => ({
                                                                ...prev,
                                                                [group.key]: member.id,
                                                            }))
                                                        }
                                                        title="Point this group's merges at this entry instead"
                                                    >
                                                        Keep this one
                                                    </Button>
                                                    <Button
                                                        variant="destructive-outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            onHandoff({
                                                                duplicate: member.id,
                                                                canonical: keeper.id,
                                                            })
                                                        }
                                                        title={`Fill the merge card: delete this row, keep "${keeper.title}"`}
                                                    >
                                                        Merge into keeper →
                                                    </Button>
                                                </div>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
