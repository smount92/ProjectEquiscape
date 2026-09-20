import Link from "next/link";

import type { FinishedHorse } from "@/app/actions/art-studio";
import { EmptyNote, Panel, RecordSummary } from "./StudioBits";

/**
 * THE RECEIPTS WALL.
 *
 * The horses this artist finished, and what those horses went on to win.
 * No other commission platform can render this, because no other
 * commission platform owns the show database — a portfolio elsewhere is
 * photographs the artist chose; this is a competitive record they didn't.
 *
 * Horses with a record come first (see decorateHorses), because the
 * ribbons are the argument.
 */
export default function ReceiptsWall({
    horses,
    studioName,
    isOwner,
}: {
    horses: FinishedHorse[];
    studioName: string;
    isOwner: boolean;
}) {
    const decorated = horses.filter((h) => h.showCount > 0 || h.titles.length > 0);
    const totalShows = horses.reduce((sum, h) => sum + h.showCount, 0);
    // One horse can carry several records (prep, then finishwork); the
    // count is horses, the cards are records.
    const distinctHorses = new Set(horses.map((h) => h.horseId)).size;
    const totalNan = horses.reduce((sum, h) => sum + h.nanQualifyingCount, 0);

    if (horses.length === 0) {
        return (
            <Panel title="Finished work" icon="🐎">
                <EmptyNote>
                    {isOwner ? (
                        <>
                            Nothing here yet.{" "}
                            <Link href="/studio/log-work" className="text-forest font-semibold hover:underline">
                                Log past work
                            </Link>{" "}
                            to put your finished horses here — and every commission you deliver on
                            Model Horse Hub lands here on its own, with every ribbon the horse goes
                            on to win.
                        </>
                    ) : (
                        `${studioName} hasn't had finished work recorded on Model Horse Hub yet.`
                    )}
                </EmptyNote>
            </Panel>
        );
    }

    return (
        <Panel
            title="Finished work"
            icon="🐎"
            actions={
                <span className="text-muted-foreground text-xs">
                    {distinctHorses} horse{distinctHorses === 1 ? "" : "s"}
                    {horses.length !== distinctHorses && ` · ${horses.length} records`}
                    {totalShows > 0 && ` · ${totalShows} show result${totalShows === 1 ? "" : "s"}`}
                </span>
            }
        >
            {decorated.length > 0 && (
                <p className="text-secondary-foreground mb-4 text-sm leading-relaxed">
                    <strong>{decorated.length}</strong> of these horses{" "}
                    {decorated.length === 1 ? "has" : "have"} competed since leaving this studio
                    {totalNan > 0 && (
                        <>
                            , earning <strong>{totalNan}</strong> NAN-qualifying result
                            {totalNan === 1 ? "" : "s"}
                        </>
                    )}
                    . These records come from the horses&rsquo; own passports — not from the artist.
                </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
                {horses.map((horse) => (
                    <HorseCard key={horse.logId ?? horse.horseId} horse={horse} />
                ))}
            </div>
        </Panel>
    );
}

function HorseCard({ horse }: { horse: FinishedHorse }) {
    const cover = horse.imageUrls[0];
    // A private horse still counts toward the artist's record, but it has
    // no page a visitor may open.
    const body = (
        <>
            {cover ? (
                <div className="border-input bg-muted mb-3 aspect-[4/3] overflow-hidden rounded-md border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={cover}
                        alt={`${horse.horseName}, finished by this studio`}
                        loading="lazy"
                        className="h-full w-full object-cover"
                    />
                </div>
            ) : (
                <div className="border-input bg-muted text-muted-foreground mb-3 grid aspect-[4/3] place-items-center rounded-md border text-3xl">
                    🐎
                </div>
            )}

            <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="font-serif text-base font-bold">{horse.horseName}</span>
                {horse.verified && (
                    <span
                        className="border-success/40 bg-success/10 text-success rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold"
                        title="This credit was recorded by a commission completed on Model Horse Hub"
                    >
                        ✓ Verified credit
                    </span>
                )}
                {!horse.logId && (
                    <span
                        className="border-input text-secondary-foreground rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold"
                        title="The horse's passport names this artist; no work record has been logged for it yet"
                    >
                        Passport credit
                    </span>
                )}
            </div>

            {horse.workType && (
                <div className="text-muted-foreground mb-2 text-xs">
                    {horse.workType}
                    {horse.dateCompleted && ` · ${horse.dateCompleted.slice(0, 7)}`}
                </div>
            )}

            <RecordSummary
                showCount={horse.showCount}
                nanQualifyingCount={horse.nanQualifyingCount}
                bestPlacing={horse.bestPlacing}
                titles={horse.titles}
            />
            {horse.isPublic && horse.imageUrls.length > 0 && (
                <span className="text-forest mt-2 block text-xs font-semibold">
                    The Making →
                </span>
            )}
        </>
    );

    const shell =
        "border-input bg-muted/40 rounded-lg border p-4 transition-all";

    if (!horse.isPublic) {
        return (
            <div className={shell}>
                {body}
                <div className="text-muted-foreground mt-2 text-[0.65rem]">
                    🔒 This horse&rsquo;s passport is private
                </div>
            </div>
        );
    }

    return (
        <Link
            href={horse.imageUrls.length > 0 ? `/community/${horse.horseId}/making` : `/community/${horse.horseId}`}
            className={`${shell} block no-underline hover:-translate-y-0.5 hover:shadow-md`}
        >
            {body}
        </Link>
    );
}
