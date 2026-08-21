"use client";

/**
 * The pulse — the top of the admin console.
 *
 * Two bands. The first is the house at a glance (members, horses,
 * posts, listings, shows). The second is "waiting on you": every
 * actionable queue with its count and a jump to the tab that handles
 * it, so nothing has to be discovered by clicking through tabs.
 *
 * Every number arrives from getAdminPulse() — service-role COUNTs, no
 * timeseries store, no derived engagement metric. A null means the
 * shape behind it isn't in the database yet (a hand-pasted migration
 * that hasn't been run); it renders as "—", never as a zero, because a
 * confident wrong zero is worse than an honest blank.
 */

import type { AdminPulse } from "@/app/actions/admin";

type JumpTarget =
    | "mailbox"
    | "reports"
    | "catalog"
    | "calendar"
    | "shows"
    | "sanctioning"
    | "members"
    | "content"
    | "ops";

interface PulseStripProps {
    pulse: AdminPulse | null;
    onJump: (target: JumpTarget) => void;
}

/** "—" for an unknown, a grouped number for a known. */
function fmt(n: number | null): string {
    return n === null ? "—" : n.toLocaleString();
}

function StatTile({
    label,
    value,
    sub,
}: {
    label: string;
    value: string;
    sub?: string;
}) {
    return (
        <div className="rounded-lg border border-input bg-card px-4 py-3">
            <div className="font-serif text-2xl leading-none font-bold text-foreground tabular-nums">
                {value}
            </div>
            <div className="mt-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {label}
            </div>
            {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
        </div>
    );
}

interface QueueSpec {
    key: JumpTarget;
    label: string;
    count: number | null;
    /** Reports get the red treatment; everything else is brass. */
    urgent?: boolean;
}

function QueueTile({ spec, onJump }: { spec: QueueSpec; onJump: (t: JumpTarget) => void }) {
    const waiting = (spec.count ?? 0) > 0;
    return (
        <button
            type="button"
            onClick={() => onJump(spec.key)}
            className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-left transition-all hover:border-forest ${
                waiting
                    ? spec.urgent
                        ? "border-destructive/40 bg-destructive/5"
                        : "border-input bg-card shadow-sm"
                    : "border-input bg-transparent opacity-60"
            }`}
        >
            <span className="text-sm font-semibold text-foreground">{spec.label}</span>
            <span
                className={`inline-flex h-6 min-w-[24px] items-center justify-center rounded-full px-2 text-xs font-bold tabular-nums ${
                    waiting
                        ? spec.urgent
                            ? "bg-destructive text-white"
                            : "bg-forest text-white"
                        : "text-muted-foreground"
                }`}
            >
                {fmt(spec.count)}
            </span>
        </button>
    );
}

export default function AdminPulseStrip({ pulse, onJump }: PulseStripProps) {
    if (!pulse) {
        return (
            <div className="mb-6 rounded-lg border border-input bg-card px-4 py-3 text-sm text-muted-foreground">
                The pulse could not be read this load — the queues below are still live.
            </div>
        );
    }

    const queues: QueueSpec[] = [
        { key: "reports", label: "Reports", count: pulse.pending.reports, urgent: true },
        { key: "mailbox", label: "Unread mail", count: pulse.pending.contactMessages },
        { key: "catalog", label: "Catalog suggestions", count: pulse.pending.catalogSuggestions },
        { key: "sanctioning", label: "Sanctioning requests", count: pulse.pending.sanctioning },
        { key: "calendar", label: "Calendar listings", count: pulse.pending.externalShows },
        { key: "content", label: "Legacy suggestions", count: pulse.pending.legacySuggestions },
    ];

    const totalWaiting = queues.reduce((sum, q) => sum + (q.count ?? 0), 0);
    const barnRequests = pulse.pending.barnJoinRequests ?? 0;

    return (
        <section className="mb-8" aria-label="Console pulse">
            <div className="brass-heading mb-3">
                <span className="brass-heading-bar" aria-hidden="true" />
                <h2 className="text-sm font-bold text-foreground">The Pulse</h2>
            </div>

            {/* Band 1 — the house */}
            <div className="mb-4 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
                <StatTile
                    label="Members"
                    value={fmt(pulse.totalMembers)}
                    sub={
                        pulse.newMembers7d === null
                            ? undefined
                            : `+${pulse.newMembers7d} in 7 days`
                    }
                />
                <StatTile label="Horses" value={fmt(pulse.totalHorses)} sub="in the database" />
                <StatTile label="Posts" value={fmt(pulse.posts7d)} sub="last 7 days" />
                <StatTile label="Live listings" value={fmt(pulse.liveListings)} sub="for sale" />
                <StatTile
                    label="Open shows"
                    value={fmt(pulse.openShows)}
                    sub={
                        pulse.openShowEntries === null
                            ? undefined
                            : `${pulse.openShowEntries.toLocaleString()} entries`
                    }
                />
            </div>

            {/* Band 2 — waiting on you */}
            <div className="mb-2 flex items-baseline gap-2">
                <h3 className="m-0 text-xs font-bold tracking-wide text-muted-foreground uppercase">
                    Waiting on you
                </h3>
                <span className="text-xs text-muted-foreground">
                    {totalWaiting === 0
                        ? "nothing in the queues"
                        : `${totalWaiting.toLocaleString()} item${totalWaiting === 1 ? "" : "s"}`}
                </span>
            </div>
            <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))]">
                {queues.map((q) => (
                    <QueueTile key={q.key} spec={q} onJump={onJump} />
                ))}
            </div>

            {barnRequests > 0 && (
                <p className="mt-2 mb-0 text-xs text-muted-foreground">
                    Also: {barnRequests} pending join request{barnRequests === 1 ? "" : "s"} on
                    barns you staff — those are handled on the barn&rsquo;s own page, not here.
                </p>
            )}
        </section>
    );
}
