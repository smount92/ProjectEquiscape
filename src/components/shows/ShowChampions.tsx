/**
 * Phase E2 — CHAMPIONS on the public results view: the callback
 * ladder rendered as rosettes. Grand champion leads, then division
 * and section champions in classlist order.
 *
 * Server-renderable (no interactivity). Rosette centers use the
 * brass tokens (they read correctly in day AND night modes); the
 * champion/reserve dot colors are the hobby's convention
 * (placings.ts) and never themed.
 */

import { championHex, championLabel } from "@/lib/shows/placings";
import type { ChampionAward, ShowChampionsData } from "@/lib/shows/ring";

function AwardLine({
    award,
    kind,
}: {
    award: ChampionAward;
    kind: "champion" | "reserve";
}) {
    const entry = kind === "champion" ? award.champion : award.reserve;
    if (!entry) return null;
    return (
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5" data-testid={`award-${kind}`}>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <span
                    aria-hidden="true"
                    className="inline-block h-2.5 w-2.5 rounded-full border border-border"
                    style={{ backgroundColor: championHex(kind) }}
                />
                {championLabel(kind, award.scope)}
            </span>
            {entry.entryNumber !== null && (
                <span className="font-mono text-sm font-bold text-foreground">
                    #{entry.entryNumber}
                </span>
            )}
            <span className="text-sm font-medium text-foreground">{entry.horseName}</span>
            {entry.ownerAlias && (
                <span className="text-xs text-muted-foreground">@{entry.ownerAlias}</span>
            )}
        </div>
    );
}

/** The brass rosette medallion. */
function Rosette({ grand }: { grand: boolean }) {
    return (
        <span
            aria-hidden="true"
            className={`inline-block shrink-0 rounded-full border ${grand ? "h-10 w-10" : "h-7 w-7"}`}
            style={{
                background:
                    "radial-gradient(circle at 35% 30%, var(--brass-hi), var(--brass-dark))",
                borderColor: "var(--brass-dark)",
            }}
        />
    );
}

function AwardCard({ award }: { award: ChampionAward }) {
    const grand = award.scope === "show";
    return (
        <div
            className={`flex items-start gap-3 rounded-lg border p-3 ${
                grand ? "border-2" : "border-input"
            }`}
            style={grand ? { borderColor: "var(--brass)" } : undefined}
            data-testid="champion-award"
            data-scope={award.scope}
        >
            <Rosette grand={grand} />
            <div className="min-w-0 flex-1">
                <p className="m-0 text-sm font-bold text-foreground">
                    {grand
                        ? "Grand Championship"
                        : award.divisionName
                          ? `${award.divisionName} · ${award.scopeLabel}`
                          : award.scopeLabel}
                </p>
                <div className="mt-1.5 flex flex-col gap-1">
                    <AwardLine award={award} kind="champion" />
                    <AwardLine award={award} kind="reserve" />
                </div>
            </div>
        </div>
    );
}

export default function ShowChampions({ champions }: { champions: ShowChampionsData }) {
    const hasAny =
        champions.show !== null ||
        champions.divisions.length > 0 ||
        champions.sections.length > 0;
    if (!hasAny) return null;

    return (
        <section className="ledger-card" aria-labelledby="champions-heading">
            <span className="ledger-tab" id="champions-heading">
                Champions
            </span>
            <div className="flex flex-col gap-3">
                {champions.show && <AwardCard award={champions.show} />}
                {champions.divisions.length > 0 && (
                    <div className="grid gap-3 sm:grid-cols-2">
                        {champions.divisions.map((award) => (
                            <AwardCard key={`division-${award.scopeLabel}`} award={award} />
                        ))}
                    </div>
                )}
                {champions.sections.length > 0 && (
                    <div className="grid gap-3 sm:grid-cols-2">
                        {champions.sections.map((award) => (
                            <AwardCard
                                key={`section-${award.divisionName}-${award.scopeLabel}`}
                                award={award}
                            />
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
