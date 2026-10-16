import Link from "next/link";
import MakingReel from "@/components/making/MakingReel";
import OwnerCreditDialog from "@/components/making/OwnerCreditDialog";
import { creditLabel } from "@/lib/studio/making";
import type { WorkRecordView } from "@/app/actions/work-records";

/**
 * "The Making" — the passport chapter. Lives in the LEFT column under
 * the gallery (owner's decision 2026-09-01): the visual column reads
 * top to bottom as what she looks like now, then how she came to be.
 *
 * Rendered as a zero-JS <details> fold (the Survey pattern) so a
 * 7-moment reel never shoves the Hoofprint below it — collapsed, it
 * is one honest line; open, it is the whole biography.
 *
 * The CREDITS line reads the chain in work order — the hobby works in
 * relays (sculpted, cast, prepped, painted, restored), one record per
 * pair of hands, each with its own verification. (The sculpt credit
 * for a factory mold or resin lives at catalog level and already
 * renders in the passport's details card — no duplicate here.)
 */
export default function MakingChapter({
    records,
    ownerId,
    horseId,
    showControls = false,
    defaultOpen = false,
    canAddCredit = false,
}: {
    records: WorkRecordView[];
    ownerId: string | null;
    horseId: string;
    showControls?: boolean;
    defaultOpen?: boolean;
    /** Owner-viewer: offer the "Add a credit" door (chains, off-platform artists). */
    canAddCredit?: boolean;
}) {
    if (records.length === 0 && !canAddCredit) return null;

    // The empty state IS the invitation (the registry-notes lesson).
    if (records.length === 0) {
        return (
            <div className="mt-6 flex flex-wrap items-baseline justify-between gap-2 rounded-2xl border border-dashed border-input bg-card px-5 py-4">
                <span className="text-sm text-muted-foreground">
                    🖌️ No making-of story yet — know who sculpted, prepped, painted or restored her?{" "}
                    <Link href="/studio" className="font-semibold text-forest no-underline hover:underline">
                        Or find an artist →
                    </Link>
                </span>
                <OwnerCreditDialog horseId={horseId} />
            </div>
        );
    }

    const momentCount = records.reduce((n, r) => n + r.moments.reduce((k, m) => k + m.imageUrls.length, 0), 0);
    const pending = records.filter((r) => r.awaitingOwner).length;

    // The chain, oldest work first — "Prep — X · Paint — Y ✓ · Restored — Z".
    const chain = [...records]
        .sort((a, b) =>
            (a.dateCompleted ?? a.claimedStart ?? "9999").localeCompare(b.dateCompleted ?? b.claimedStart ?? "9999"),
        )
        .map((r) => ({
            key: r.id,
            text: `${r.workType} — ${r.artistAlias ?? "unknown"}`,
            verified: creditLabel({
                recordedBy: r.recordedBy,
                ownerConfirmedAt: r.ownerConfirmedAt,
                artistIsOwner: r.artistIsOwner ?? (!!r.artistUserId && r.artistUserId === ownerId),
            }).verified,
        }));

    return (
        <details className="mt-6 rounded-2xl border border-input bg-card shadow-md" open={defaultOpen || pending > 0}>
            <summary className="flex cursor-pointer list-none flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-4 [&::-webkit-details-marker]:hidden">
                <span className="font-serif text-lg font-bold text-foreground">🖌️ The Making</span>
                <span className="text-sm text-muted-foreground">
                    {pending > 0 ? (
                        <span className="font-semibold text-forest">
                            {pending} record{pending === 1 ? "" : "s"} awaiting your review ·{" "}
                        </span>
                    ) : null}
                    {momentCount > 0 ? `${momentCount} photo${momentCount === 1 ? "" : "s"} · ` : ""}
                    open ▾
                </span>
            </summary>
            <div className="px-5 pb-5">
                {/* The credits chain */}
                <div className="mb-4 flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-dashed border-border-tan/30 pb-3 text-sm text-secondary-foreground">
                    {chain.map((c, i) => (
                        <span key={c.key}>
                            {i > 0 && <span className="mr-2 text-muted-foreground">·</span>}
                            {c.text}
                            {c.verified && <span className="font-bold text-forest"> ✓</span>}
                        </span>
                    ))}
                    {canAddCredit && (
                        <span className="ml-auto">
                            <OwnerCreditDialog horseId={horseId} />
                        </span>
                    )}
                </div>

                <MakingReel records={records} ownerId={ownerId} showControls={showControls} />
                <div className="mt-3 text-right">
                    <Link
                        href={`/community/${horseId}/making`}
                        className="text-sm font-semibold text-forest hover:underline"
                    >
                        Full story →
                    </Link>
                </div>
            </div>
        </details>
    );
}
