import Link from "next/link";
import MakingReel from "@/components/making/MakingReel";
import type { WorkRecordView } from "@/app/actions/work-records";

/**
 * "The Making" — the passport chapter. Lives in the LEFT column under
 * the gallery (owner's decision 2026-09-01): the visual column reads
 * top to bottom as what she looks like now, then how she came to be.
 *
 * Rendered as a zero-JS <details> fold (the Survey pattern) so a
 * 7-moment reel never shoves the Hoofprint below it — collapsed, it
 * is one honest line; open, it is the whole biography. The standalone
 * /making page is the shareable, full-width version.
 */
export default function MakingChapter({
    records,
    ownerId,
    horseId,
    showControls = false,
    defaultOpen = false,
}: {
    records: WorkRecordView[];
    ownerId: string | null;
    horseId: string;
    showControls?: boolean;
    defaultOpen?: boolean;
}) {
    if (records.length === 0) return null;

    const momentCount = records.reduce(
        (n, r) => n + r.moments.reduce((k, m) => k + m.imageUrls.length, 0),
        0,
    );
    const pending = records.some((r) => r.awaitingOwner);
    const artists = [...new Set(records.map((r) => r.artistAlias).filter(Boolean))] as string[];

    return (
        <details
            className="border-input bg-card mt-6 rounded-2xl border shadow-md"
            open={defaultOpen || pending}
        >
            <summary className="flex cursor-pointer list-none flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-4 [&::-webkit-details-marker]:hidden">
                <span className="text-foreground font-serif text-lg font-bold">
                    🖌️ The Making
                    {artists.length > 0 && (
                        <span className="text-secondary-foreground font-sans text-sm font-normal">
                            {" "}· by {artists.join(", ")}
                        </span>
                    )}
                </span>
                <span className="text-muted-foreground text-sm">
                    {pending ? (
                        <span className="text-forest font-semibold">1 record awaiting your review · </span>
                    ) : null}
                    {momentCount > 0 ? `${momentCount} moment${momentCount === 1 ? "" : "s"} · ` : ""}
                    open ▾
                </span>
            </summary>
            <div className="px-5 pb-5">
                <MakingReel records={records} ownerId={ownerId} showControls={showControls} />
                <div className="mt-3 text-right">
                    <Link
                        href={`/community/${horseId}/making`}
                        className="text-forest text-sm font-semibold hover:underline"
                    >
                        Full story →
                    </Link>
                </div>
            </div>
        </details>
    );
}
