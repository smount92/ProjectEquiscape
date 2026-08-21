"use client";

/**
 * Admin → Ops. Read-only. The one question this answers: which
 * hand-pasted migrations are actually in the running database?
 *
 * Migrations in this project are pasted into the Supabase SQL editor by
 * the owner, so the repo and the live schema can legitimately disagree
 * for days. Every feature behind one of these files feature-detects and
 * degrades quietly — which is correct, and also means nothing on the
 * site ever tells you it's running in the degraded shape. This is that
 * telltale.
 *
 * Nothing here writes. The "applied?" column comes from one cheap probe
 * per migration (getMigrationStatus in actions/admin.ts); migrations
 * that only widen a CHECK or replace a function body say so instead of
 * guessing.
 */

import type { MigrationStatusRow } from "@/app/actions/admin";

function StatusPill({ applied }: { applied: boolean | null }) {
    if (applied === true) {
        return (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-forest/30 bg-forest/10 px-2.5 py-0.5 text-[0.7rem] font-bold tracking-wide text-forest uppercase">
                Applied
            </span>
        );
    }
    if (applied === false) {
        return (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-destructive px-2.5 py-0.5 text-[0.7rem] font-bold tracking-wide text-white uppercase">
                Not pasted
            </span>
        );
    }
    return (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-input px-2.5 py-0.5 text-[0.7rem] font-bold tracking-wide text-muted-foreground uppercase">
            Can&rsquo;t tell
        </span>
    );
}

export default function AdminOpsTab({ migrations }: { migrations: MigrationStatusRow[] }) {
    if (migrations.length === 0) {
        return (
            <div className="rounded-lg border border-input bg-card px-8 py-12 text-center">
                <div className="mb-3 text-4xl">🛠️</div>
                <h2 className="m-0 text-base font-bold">Migration status unavailable</h2>
                <p className="m-0 mt-1 text-sm text-muted-foreground">
                    The probes could not run this load. Nothing is broken by this — it is a
                    read-only view.
                </p>
            </div>
        );
    }

    const missing = migrations.filter((m) => m.applied === false);

    return (
        <div className="flex flex-col gap-4">
            <div>
                <h3 className="mt-0 mb-1 flex items-center gap-2 text-base font-bold">
                    🛠️ Migrations awaiting paste
                </h3>
                <p className="mt-0 mb-0 text-xs text-muted-foreground">
                    Every feature behind these files degrades quietly until the SQL is pasted, so
                    the site never complains. This is the only place that says so out loud. Paste
                    order matters: run them lowest number first.
                </p>
            </div>

            {missing.length > 0 && (
                <p className="m-0 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-2.5 text-sm font-semibold text-destructive">
                    {missing.length} migration{missing.length === 1 ? "" : "s"} not yet in the
                    database: {missing.map((m) => m.id).join(", ")}
                </p>
            )}

            <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {migrations.map((m) => (
                    <li
                        key={m.id}
                        className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-input bg-card px-4 py-3"
                    >
                        <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-foreground">
                                <span className="font-mono text-muted-foreground">{m.id}</span>{" "}
                                {m.title}
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground">{m.summary}</div>
                            {m.note && (
                                <div className="mt-1 text-xs text-secondary-foreground italic">
                                    {m.note}
                                </div>
                            )}
                        </div>
                        <StatusPill applied={m.applied} />
                    </li>
                ))}
            </ul>

            <p className="m-0 text-xs text-muted-foreground">
                Files live in <span className="font-mono">supabase/migrations/</span>. A probe reads
                one column (or calls one function) per migration; it never writes.
            </p>
        </div>
    );
}
