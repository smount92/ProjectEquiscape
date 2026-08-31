"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { Commission } from "@/app/actions/art-studio";
import {
    ballIsWith,
    STATUS_LABELS,
    type CommissionStatus,
} from "@/lib/studio/pipeline";
import { formatMoney } from "@/lib/studio/terms";
import { CommissionPill } from "./StudioBits";

/**
 * The artist's pipeline board.
 *
 * Artists currently keep this in a spreadsheet or a Notion kanban: jobs by
 * stage, who owes the next move, what's stale. Columns are the pipeline
 * itself, so nothing can be in a state the board can't show.
 *
 * The "waiting on you" filter is the one that earns its keep — it's the
 * question an artist opens a tracker to answer.
 */

const COLUMNS: { key: string; label: string; statuses: CommissionStatus[] }[] = [
    { key: "inbox", label: "Requests", statuses: ["requested"] },
    { key: "quoted", label: "Quoted", statuses: ["quoted"] },
    { key: "bench", label: "On the bench", statuses: ["accepted", "in_progress"] },
    { key: "approval", label: "Awaiting approval", statuses: ["awaiting_approval"] },
    { key: "done", label: "Finished", statuses: ["completed", "delivered", "received"] },
    { key: "closed", label: "Closed", statuses: ["declined", "cancelled"] },
];

/** Days since the last movement — the number that finds forgotten jobs. */
function daysSince(iso: string): number {
    const then = new Date(iso).getTime();
    if (!Number.isFinite(then)) return 0;
    return Math.floor((Date.now() - then) / 86_400_000);
}

export default function PipelineBoard({ commissions }: { commissions: Commission[] }) {
    const [column, setColumn] = useState("inbox");
    const [onlyMine, setOnlyMine] = useState(false);

    const counts = useMemo(() => {
        const map = new Map<string, number>();
        for (const col of COLUMNS) {
            map.set(col.key, commissions.filter((c) => col.statuses.includes(c.status)).length);
        }
        return map;
    }, [commissions]);

    const waitingOnMe = useMemo(
        () => commissions.filter((c) => ballIsWith(c.status) === "artist").length,
        [commissions],
    );

    const active = COLUMNS.find((c) => c.key === column) ?? COLUMNS[0];
    const shown = commissions
        .filter((c) => active.statuses.includes(c.status))
        .filter((c) => !onlyMine || ballIsWith(c.status) === "artist");

    return (
        <div>
            <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className="studio-tabs">
                    {COLUMNS.map((col) => {
                        const count = counts.get(col.key) ?? 0;
                        return (
                            <button
                                key={col.key}
                                type="button"
                                className={`studio-tab ${column === col.key ? "active" : ""}`}
                                onClick={() => setColumn(col.key)}
                            >
                                {col.label}
                                {count > 0 && (
                                    <span className="border-input bg-card text-muted-foreground ml-1.5 rounded-md border px-1.5 py-0.5 text-xs">
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {waitingOnMe > 0 && (
                    <button
                        type="button"
                        className={`studio-chip ${onlyMine ? "active" : ""}`}
                        onClick={() => setOnlyMine((v) => !v)}
                    >
                        ⏳ Waiting on you ({waitingOnMe})
                    </button>
                )}
            </div>

            {shown.length === 0 ? (
                <div className="border-input bg-card rounded-lg border p-10 text-center shadow-md">
                    <p className="text-muted-foreground m-0 text-sm">
                        {onlyMine
                            ? "Nothing in this column is waiting on you."
                            : emptyLine(active.key)}
                    </p>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {shown.map((c) => (
                        <Card key={c.id} commission={c} />
                    ))}
                </div>
            )}
        </div>
    );
}

function emptyLine(key: string): string {
    switch (key) {
        case "inbox":
            return "No new requests. When someone commissions you, they land here first.";
        case "quoted":
            return "No quotes outstanding.";
        case "bench":
            return "Nothing on the bench right now.";
        case "approval":
            return "Nothing waiting on a commissioner's sign-off.";
        case "done":
            return "No finished commissions yet.";
        default:
            return "Nothing here.";
    }
}

function Card({ commission }: { commission: Commission }) {
    const yourMove = ballIsWith(commission.status) === "artist";
    const idle = daysSince(commission.lastUpdateAt);
    // Two weeks without movement on live work is worth a nudge; the number
    // is only shown when it's actually actionable.
    const stale = yourMove && idle >= 14;

    return (
        <Link
            href={`/studio/commission/${commission.id}`}
            className="border-input bg-card flex flex-col rounded-lg border p-5 no-underline shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
            <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <span className="font-serif text-sm font-bold">{commission.commissionType}</span>
                <CommissionPill status={commission.status} />
            </div>

            <div className="text-muted-foreground mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                {commission.clientAlias && <span>@{commission.clientAlias}</span>}
                {commission.agreedPrice != null && (
                    <span className="font-serif tabular-nums">
                        {formatMoney(commission.agreedPrice)}
                    </span>
                )}
                {commission.isWaitlist && commission.status === "requested" && (
                    <span>waitlist</span>
                )}
            </div>

            <p className="text-secondary-foreground mb-3 line-clamp-2 text-sm leading-relaxed">
                {commission.description}
            </p>

            <div className="border-input mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-2">
                <span className={`text-xs ${stale ? "text-warning font-semibold" : "text-muted-foreground"}`}>
                    {stale
                        ? `⏳ ${idle} days without an update`
                        : yourMove
                          ? "Your move"
                          : `Updated ${new Date(commission.lastUpdateAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                </span>
                {commission.revisionsIncluded > 0 && commission.revisionsUsed > 0 && (
                    <span className="text-muted-foreground text-xs">
                        {commission.revisionsUsed}/{commission.revisionsIncluded} rev
                    </span>
                )}
            </div>

            <span className="sr-only">
                {STATUS_LABELS[commission.status]} commission, open to view
            </span>
        </Link>
    );
}
