import { STAGE_LABELS, STAGE_ORDER, creditLabel, type WorkStage } from "@/lib/studio/making";
import type { WorkRecordView } from "@/app/actions/work-records";
import WorkRecordControls from "@/components/making/WorkRecordControls";

/**
 * The Making — a work record's reel, rendered as the chronological
 * story of a piece: stage-grouped moments down a rail, captions and
 * artist-claimed dates under each. The gallery above it identifies
 * the horse; this is her biography. Different jobs, different rooms.
 */

function fmtDate(d: string | null): string | null {
    if (!d) return null;
    const dt = new Date(d.length <= 10 ? d + "T00:00:00" : d);
    if (isNaN(dt.getTime())) return null;
    return dt.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function recordSpan(rec: WorkRecordView): string | null {
    const a = fmtDate(rec.claimedStart);
    const b = fmtDate(rec.dateCompleted);
    if (a && b && a !== b) return `${a} – ${b}`;
    return b ?? a;
}

export default function MakingReel({
    records,
    ownerId,
    showControls = false,
}: {
    records: WorkRecordView[];
    /** The horse's owner — needed for the artist-is-owner credit rule. */
    ownerId: string | null;
    showControls?: boolean;
}) {
    if (records.length === 0) return null;

    return (
        <div className="flex flex-col gap-6">
            {records.map((rec) => {
                const credit = creditLabel({
                    recordedBy: rec.recordedBy,
                    ownerConfirmedAt: rec.ownerConfirmedAt,
                    artistIsOwner: !!rec.artistUserId && rec.artistUserId === ownerId,
                });
                const span = recordSpan(rec);
                // Group public-side moments by stage, stages in work order.
                const stages = new Map<WorkStage, typeof rec.moments>();
                for (const m of rec.moments) {
                    const list = stages.get(m.stage) ?? [];
                    list.push(m);
                    stages.set(m.stage, list);
                }
                const ordered = [...stages.entries()].sort(
                    (a, b) => STAGE_ORDER[a[0]] - STAGE_ORDER[b[0]],
                );

                return (
                    <section key={rec.id} className="border-input bg-card rounded-xl border p-4 md:p-5">
                        {/* Record header — the credit card */}
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                            <h3 className="text-foreground m-0 font-serif text-lg font-bold">
                                {rec.workType}
                                {rec.artistAlias && (
                                    <span className="text-secondary-foreground font-sans text-base font-normal">
                                        {" "}by {rec.artistAlias}
                                    </span>
                                )}
                            </h3>
                            {span && (
                                <span className="text-muted-foreground text-sm tabular-nums">{span}</span>
                            )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span
                                className={
                                    credit.verified
                                        ? "text-forest border-forest rounded-full border px-2 py-0.5 text-xs font-semibold"
                                        : "text-muted-foreground border-input rounded-full border px-2 py-0.5 text-xs font-semibold"
                                }
                            >
                                {credit.verified ? "✓ " : ""}{credit.label}
                            </span>
                            {rec.disavowedAt && (
                                <span className="text-destructive text-xs font-semibold">
                                    Disavowed — hidden from credit surfaces
                                </span>
                            )}
                        </div>
                        {rec.summary && (
                            <p className="text-secondary-foreground mt-2 mb-0 text-sm whitespace-pre-line">
                                {rec.summary}
                            </p>
                        )}
                        {rec.materialsUsed && (
                            <p className="text-muted-foreground mt-1 mb-0 text-xs">
                                Materials: {rec.materialsUsed}
                            </p>
                        )}

                        {showControls && (rec.viewerIsOwner || rec.viewerIsArtist) && (
                            <WorkRecordControls record={rec} />
                        )}

                        {/* The reel */}
                        {ordered.length > 0 && (
                            <div className="border-border-tan/40 mt-4 border-l-2 pl-4">
                                {ordered.map(([stage, moments]) => (
                                    <div key={stage} className="mb-4 last:mb-0">
                                        <div className="mb-1.5 flex items-baseline gap-2">
                                            <span className="bg-card text-forest -ml-[1.45rem] inline-block h-2.5 w-2.5 rounded-full border-2 border-(--brass)" aria-hidden="true" />
                                            <h4 className="text-foreground m-0 font-serif text-sm font-bold">
                                                {STAGE_LABELS[stage]}
                                            </h4>
                                            {moments[0]?.claimedDate && (
                                                <span className="text-muted-foreground text-xs tabular-nums">
                                                    {fmtDate(moments[0].claimedDate)}
                                                </span>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                                            {moments.map((m) =>
                                                m.imageUrls.map((url, i) => (
                                                    <figure key={m.id + i} className="border-input bg-background m-0 overflow-hidden rounded-lg border">
                                                        <a href={url} target="_blank" rel="noopener">
                                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                            <img
                                                                src={url}
                                                                alt={m.caption ?? STAGE_LABELS[stage]}
                                                                loading="lazy"
                                                                className="aspect-[4/3] w-full object-cover"
                                                            />
                                                        </a>
                                                        {i === 0 && m.caption && (
                                                            <figcaption className="text-muted-foreground px-2 py-1 text-xs leading-snug">
                                                                {m.caption}
                                                                {!m.isPublic && " 🔒"}
                                                            </figcaption>
                                                        )}
                                                    </figure>
                                                )),
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                    </section>
                );
            })}
        </div>
    );
}
