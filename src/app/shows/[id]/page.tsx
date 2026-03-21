import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { getShowEntries } from "@/app/actions/shows";
import { getEventJudges } from "@/app/actions/events";
import { getEventDivisions } from "@/app/actions/competition";
import { getPosts } from "@/app/actions/posts";
import Link from "next/link";
import VoteButton from "@/components/VoteButton";
import ShowEntryForm from "@/components/ShowEntryForm";
import WithdrawButton from "@/components/WithdrawButton";
import UniversalFeed from "@/components/UniversalFeed";
import CloseShowButton from "@/components/CloseShowButton";
import ExpertJudgingPanel from "@/components/ExpertJudgingPanel";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return {
        title: `Photo Show — Model Horse Hub`,
        description: `Virtual photo show ${id}.`,
    };
}

export const dynamic = "force-dynamic";

export default async function ShowDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: showId } = await params;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { show, entries } = await getShowEntries(showId);
    if (!show) notFound();

    const showComments = await getPosts({ eventId: showId }, { includeReplies: true });

    // Fetch user's public horses for entry form
    const { data: userHorses } = await supabase
        .from("user_horses")
        .select("id, custom_name")
        .eq("owner_id", user.id)
        .eq("is_public", true);

    const horseOptions = (userHorses ?? []).map((h: { id: string; custom_name: string }) => ({
        id: h.id,
        name: h.custom_name,
    }));

    const isOpen = show.status === "open";
    const isCreator = show.createdBy === user.id;
    const isAdmin = user.email?.toLowerCase() === process.env.ADMIN_EMAIL?.toLowerCase();
    const isExpired = show.endAt ? new Date(show.endAt) < new Date() : false;
    const canClose = (isCreator || isAdmin) && show.status !== "closed" && (isExpired || show.status === "judging");

    // Expert judge flags
    const isExpertJudged = show.judgingMethod === "expert_judge";
    const isJudging = show.status === "judging";

    // Check if user is assigned judge
    const eventJudges = isExpertJudged ? await getEventJudges(showId) : [];
    const isJudge = eventJudges.some((j) => j.userId === user.id);

    // Fetch divisions/classes for the entry form
    const divisions = await getEventDivisions(showId);
    const classOptions = divisions.flatMap((d) =>
        d.classes.map((c) => ({
            id: c.id,
            name: c.classNumber ? `${c.classNumber}: ${c.name}` : c.name,
            divisionName: d.name,
            allowedScales: c.allowedScales,
            isNanQualifying: c.isNanQualifying,
            maxEntries: c.maxEntries,
            currentEntryCount: c.entryCount || 0,
        })),
    );

    // Sort entries by division → class → entry order
    const sortedEntries = [...entries].sort((a, b) => {
        const divA = a.divisionName || "zzz";
        const divB = b.divisionName || "zzz";
        if (divA !== divB) return divA.localeCompare(divB);
        const clsA = a.className || "zzz";
        const clsB = b.className || "zzz";
        if (clsA !== clsB) return clsA.localeCompare(clsB);
        return 0;
    });

    return (
        <div className="mx-auto max-w-[var(--max-width)] px-6 py-[0]">
            {/* Hero */}
            <div className="animate-fade-in-up mb-2 text-[calc(2.2rem*var(--font-scale))] font-extrabold tracking-[-0.03em]">
                <div className="mb-2-content text-[calc(2.2rem*var(--font-scale))] font-extrabold tracking-[-0.03em]">
                    <h1>
                        📸 <span className="text-forest">{show.title}</span>
                    </h1>
                    {show.theme && (
                        <p className="mb-2-subtitle text-[calc(2.2rem*var(--font-scale))] font-extrabold tracking-[-0.03em]">
                            Theme: {show.theme}
                        </p>
                    )}
                    {show.description && (
                        <p className="mb-2-subtitle text-[calc(2.2rem*var(--font-scale))] font-extrabold tracking-[-0.03em]">
                            {show.description}
                        </p>
                    )}
                    {show.endAt && (
                        <p
                            className="mb-2-subtitle text-[calc(2.2rem*var(--font-scale))] font-extrabold tracking-[-0.03em]"
                            style={{
                                color:
                                    new Date(show.endAt) > new Date()
                                        ? "var(--color-accent, #f59e0b)"
                                        : "var(--color-text-muted)",
                            }}
                        >
                            ⏰{" "}
                            {new Date(show.endAt) > new Date()
                                ? `Entries close: ${new Date(show.endAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}`
                                : "Entries are closed"}
                        </p>
                    )}
                    {show.creatorAlias && (
                        <p className="mb-2-subtitle text-sm text-[calc(2.2rem*var(--font-scale))] font-extrabold tracking-[-0.03em]">
                            Hosted by @{show.creatorAlias}
                        </p>
                    )}
                </div>
                <div className="mt-8 flex justify-center gap-8">
                    <div className="flex flex-col items-center">
                        <span className="items-center-number flex flex-col">{entries.length}</span>
                        <span className="items-center-label flex flex-col">Entries</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="items-center-number whitespace-nowrap-lg flex flex-col rounded-sm px-[10px] py-[3px] text-[calc(0.7rem*var(--font-scale))] font-semibold">
                            {show.status === "open" ? "🟢" : show.status === "judging" ? "🟡" : "🔴"}
                        </span>
                        <span className="items-center-label flex flex-col">
                            {show.status.charAt(0).toUpperCase() + show.status.slice(1)}
                        </span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="items-center-number flex flex-col">{isExpertJudged ? "🏅" : "🗳️"}</span>
                        <span className="items-center-label flex flex-col">
                            {isExpertJudged ? "Expert Judge" : "Community Vote"}
                        </span>
                    </div>
                </div>
            </div>

            {/* Creator Actions */}
            {(isCreator || isAdmin) && (
                <div className="animate-fade-in-up mb-4 justify-end gap-2" style={{ display: "flex" }}>
                    <Link
                        href={`/community/events/${showId}/manage`}
                        className="hover:no-underline-min-h)] text-ink-light border-edge inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] bg-transparent px-8 py-2 font-sans text-base leading-none font-semibold no-underline transition-all duration-150"
                    >
                        ⚙️ Manage Classes
                    </Link>
                </div>
            )}

            {/* Judge Assignment Banner — always visible to assigned judges */}
            {isJudge && !isCreator && (
                <div
                    className="bg-card border-edge animate-fade-in-up rounded-lg border p-12 shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]"
                    style={{
                        marginBottom: "var(--space-lg)",
                        padding: "var(--space-lg)",
                        background: "linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(245, 158, 11, 0.1))",
                        border: "1px solid rgba(139, 92, 246, 0.3)",
                        textAlign: "center",
                    }}
                >
                    <div className="mb-2 text-[2rem]">🏅</div>
                    <h3 className="mb-2">You Are an Assigned Judge</h3>
                    {show.status === "open" ? (
                        <p className="text-muted text-sm">
                            This show is still accepting entries. Once the host transitions it to{" "}
                            <strong>&quot;Judging&quot;</strong> status, the judging panel will appear here for you to
                            assign placings.
                        </p>
                    ) : show.status === "judging" ? (
                        <p className="text-muted text-sm">
                            The judging panel is available below. Scroll down to assign placings to each entry.
                        </p>
                    ) : (
                        <p className="text-muted text-sm">Judging is complete. Results are final.</p>
                    )}
                </div>
            )}

            {/* Entry Form */}
            {isOpen && (
                <div className="bg-[rgba(129, 140, 248, 0.04)] border-[rgba(129, 140, 248, 0.15)] animate-fade-in-up mb-8 rounded-lg border p-6">
                    <h2 className="mb-4 text-[calc(1.1rem*var(--font-scale))]">Enter Your Horse</h2>
                    <ShowEntryForm
                        showId={showId}
                        userHorses={horseOptions}
                        classes={classOptions.length > 0 ? classOptions : undefined}
                    />
                </div>
            )}

            {/* Breadcrumb */}
            <nav className="text-muted animate-fade-in-up mb-6 flex items-center gap-2 text-sm">
                <Link href="/shows">← All Shows</Link>
            </nav>

            {/* Winner Podium for closed shows */}
            {show.status === "closed" &&
                entries.length > 0 &&
                (() => {
                    const RIBBON_MAP: Record<string, string> = {
                        "1st": "blue",
                        "2nd": "red",
                        "3rd": "yellow",
                        "4th": "white",
                        "5th": "pink",
                        "6th": "green",
                        HM: "green",
                        Champion: "blue",
                        "Reserve Champion": "red",
                        "Grand Champion": "blue",
                        "Reserve Grand Champion": "red",
                    };
                    const MEDAL_MAP: Record<string, string> = {
                        "1st": "🥇",
                        "2nd": "🥈",
                        "3rd": "🥉",
                        HM: "🎗️",
                        Champion: "🏆",
                        "Reserve Champion": "🥈",
                        "Grand Champion": "🏆",
                        "Reserve Grand Champion": "🥈",
                    };
                    const PLACE_ORDER: Record<string, number> = {
                        "Grand Champion": 0,
                        "Reserve Grand Champion": 1,
                        Champion: 2,
                        "Reserve Champion": 3,
                        "1st": 4,
                        "2nd": 5,
                        "3rd": 6,
                        "4th": 7,
                        "5th": 8,
                        "6th": 9,
                        HM: 10,
                    };

                    // Champions first
                    const champions = sortedEntries.filter(
                        (e) =>
                            e.placing &&
                            ["Champion", "Reserve Champion", "Grand Champion", "Reserve Grand Champion"].includes(
                                e.placing,
                            ),
                    );
                    // Top placed
                    const topPlaced = isExpertJudged
                        ? sortedEntries
                              .filter(
                                  (e) =>
                                      e.placing &&
                                      ![
                                          "Champion",
                                          "Reserve Champion",
                                          "Grand Champion",
                                          "Reserve Grand Champion",
                                      ].includes(e.placing),
                              )
                              .sort((a, b) => (PLACE_ORDER[a.placing!] ?? 99) - (PLACE_ORDER[b.placing!] ?? 99))
                              .slice(0, 6)
                        : sortedEntries.slice(0, 3);
                    const podiumEntries = topPlaced.slice(0, 3);

                    return (
                        <div
                            className="bg-card border-edge animate-fade-in-up rounded-lg border p-12 shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]"
                            style={{
                                padding: "var(--space-xl)",
                                marginBottom: "var(--space-lg)",
                            }}
                        >
                            <h2 className="mb-2 text-[calc(1.3rem*var(--font-scale))]" style={{ textAlign: "center" }}>
                                🏆 <span className="text-forest">Results</span>
                            </h2>

                            {/* Champion Banners */}
                            {champions.map((entry) => (
                                <div key={entry.id} className="champion-banner animate-fade-in-up">
                                    <div className="mb-2 text-[calc(1.2rem*var(--font-scale))] font-extrabold">
                                        {MEDAL_MAP[entry.placing!] || "🏆"} {entry.placing}
                                    </div>
                                    <div
                                        className="gap-4"
                                        style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                                    >
                                        {entry.thumbnailUrl && (
                                            <div
                                                className="h-[60] w-[60] shrink-0 rounded-md"
                                                style={{ overflow: "hidden" }}
                                            >
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={entry.thumbnailUrl}
                                                    alt={entry.horseName}
                                                    className="h-full w-full"
                                                    style={{ objectFit: "cover" }}
                                                />
                                            </div>
                                        )}
                                        <div>
                                            <Link
                                                href={`/community/${entry.horseId}`}
                                                className="text-[calc(1rem*var(--font-scale))] font-bold"
                                            >
                                                🐴 {entry.horseName}
                                            </Link>
                                            <div className="text-muted text-[calc(0.8rem*var(--font-scale))]">
                                                by{" "}
                                                <Link href={`/profile/${encodeURIComponent(entry.ownerAlias)}`}>
                                                    @{entry.ownerAlias}
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Podium */}
                            <div className="flex flex-wrap items-end justify-center gap-8 px-[0] py-8">
                                {podiumEntries.map((entry, i) => {
                                    const placing = isExpertJudged ? entry.placing! : ["1st", "2nd", "3rd"][i];
                                    const ribbon = RIBBON_MAP[placing] || "blue";
                                    const medal = MEDAL_MAP[placing] || "🏅";
                                    return (
                                        <div
                                            key={entry.id}
                                            className={`podium-card ${i === 0 ? "podium-card-first" : ""}`}
                                        >
                                            <div className={`podium-ribbon podium-ribbon-${ribbon}`} />
                                            {entry.thumbnailUrl && (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={entry.thumbnailUrl}
                                                    alt={entry.horseName}
                                                    className="aspect-[4/3] w-full object-cover"
                                                />
                                            )}
                                            <div className="bg-elevated transition-transform-body max-w-[220px] min-w-[160px] overflow-hidden rounded-lg text-center shadow-lg">
                                                <div className="mb-1 text-[2rem]">{medal}</div>
                                                <Link
                                                    href={`/community/${entry.horseId}`}
                                                    className="text-ink block text-[calc(0.9rem*var(--font-scale))] font-bold no-underline hover:underline"
                                                >
                                                    {entry.horseName}
                                                </Link>
                                                <div className="text-muted mt-[2px] text-[calc(0.75rem*var(--font-scale))]">
                                                    by{" "}
                                                    <Link href={`/profile/${encodeURIComponent(entry.ownerAlias)}`}>
                                                        @{entry.ownerAlias}
                                                    </Link>
                                                    {!isExpertJudged &&
                                                        ` · ${entry.votes} vote${entry.votes !== 1 ? "s" : ""}`}
                                                </div>
                                                <div className="text-[var(--color-accent, #f59e0b)] mt-1 text-[calc(0.85rem*var(--font-scale))] font-extrabold">
                                                    {placing}
                                                </div>
                                                {entry.caption && (
                                                    <div className="text-ink-light mt-1 text-[calc(0.7rem*var(--font-scale))] leading-snug italic">
                                                        &ldquo;{entry.caption}&rdquo;
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Remaining placed entries below podium */}
                            {topPlaced.length > 3 && (
                                <div className="mt-4">
                                    <h3 className="text-muted mb-2 text-[calc(0.9rem*var(--font-scale))]">
                                        Also Placed
                                    </h3>
                                    {topPlaced.slice(3).map((entry) => {
                                        const placing = entry.placing!;
                                        const ribbon = RIBBON_MAP[placing] || "green";
                                        return (
                                            <div
                                                key={entry.id}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "var(--space-md)",
                                                    padding: "var(--space-sm) var(--space-md)",
                                                    borderLeft: `3px solid var(--podium-${ribbon}, #22c55e)`,
                                                    marginBottom: "var(--space-xs)",
                                                }}
                                            >
                                                {entry.thumbnailUrl && (
                                                    <div
                                                        className="h-[36] w-[36] shrink-0 rounded-sm"
                                                        style={{ overflow: "hidden" }}
                                                    >
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img
                                                            src={entry.thumbnailUrl}
                                                            alt={entry.horseName}
                                                            className="h-full w-full"
                                                            style={{ objectFit: "cover" }}
                                                        />
                                                    </div>
                                                )}
                                                <div className="flex-1">
                                                    <Link
                                                        href={`/community/${entry.horseId}`}
                                                        className="font-semibold"
                                                    >
                                                        {entry.horseName}
                                                    </Link>
                                                    <span className="text-muted ml-1 text-[calc(0.75rem*var(--font-scale))]">
                                                        by @{entry.ownerAlias}
                                                    </span>
                                                </div>
                                                <span className="text-[var(--color-accent, #f59e0b)] text-[calc(0.85rem*var(--font-scale))] font-bold">
                                                    {MEDAL_MAP[placing] || "🏅"} {placing}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })()}

            {/* Judging Banner */}
            {isJudging && (
                <div
                    className="bg-card border-edge animate-fade-in-up rounded-lg border p-12 shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]"
                    style={{
                        textAlign: "center",
                        padding: "var(--space-lg)",
                        marginBottom: "var(--space-lg)",
                        background: "rgba(245, 158, 11, 0.1)",
                        border: "1px solid rgba(245, 158, 11, 0.3)",
                    }}
                >
                    <div className="text-[2rem]">🟡</div>
                    <h3>Judging in Progress</h3>
                    <p className="text-muted">
                        {isExpertJudged
                            ? isCreator || isJudge
                                ? "Use the judging panel below to assign placings."
                                : "The judges are reviewing entries. Results will be announced soon!"
                            : "Voting is closed. Results will be announced soon!"}
                    </p>
                </div>
            )}

            {/* Expert Judging Panel — host or assigned judge, during judging */}
            {isExpertJudged && isJudging && (isCreator || isJudge) && (
                <ExpertJudgingPanel
                    showId={showId}
                    entries={entries.map((e) => ({
                        id: e.id,
                        horseName: e.horseName,
                        ownerAlias: e.ownerAlias,
                        thumbnailUrl: e.thumbnailUrl,
                        placing: e.placing,
                        classId: null,
                    }))}
                />
            )}

            {/* Close Show Button — creator/admin only, when expired */}
            {canClose && <CloseShowButton showId={showId} />}

            {/* Host Override Panel — creator can adjust placings on closed shows */}
            {isCreator && show.status === "closed" && (
                <ExpertJudgingPanel
                    showId={showId}
                    overrideMode
                    entries={entries.map((e) => ({
                        id: e.id,
                        horseName: e.horseName,
                        ownerAlias: e.ownerAlias,
                        thumbnailUrl: e.thumbnailUrl,
                        placing: e.placing,
                        classId: null,
                    }))}
                />
            )}

            {/* Entries Grid */}
            {entries.length === 0 ? (
                <div className="bg-card border-edge animate-fade-in-up rounded-lg border p-12 px-8 py-[var(--space-3xl)] text-center shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]">
                    <div className="px-8-icon py-[var(--space-3xl)] text-center">📸</div>
                    <h2>No Entries Yet</h2>
                    <p>Be the first to enter this show!</p>
                </div>
            ) : (
                <div className="border-[var(--color-border, rgba(0, 0, 0, 0.06))] animate-fade-in-up flex flex-col gap-[0] overflow-hidden rounded-lg border">
                    {sortedEntries.map((entry, index) => (
                        <div
                            key={entry.id}
                            className="border-[var(--color-border, rgba(0, 0, 0, 0.06))] flex items-center gap-4 border-b px-6 py-4 transition-colors"
                        >
                            <div className="text-muted min-w-[32px] text-center text-[calc(1.1rem*var(--font-scale))] font-bold">
                                {isExpertJudged && show.status === "closed" && entry.placing
                                    ? entry.placing
                                    : `#${index + 1}`}
                            </div>
                            {entry.thumbnailUrl && (
                                <div className="h-[64px] w-[64px] shrink-0 overflow-hidden rounded-md">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={entry.thumbnailUrl} alt={entry.horseName} loading="lazy" />
                                </div>
                            )}
                            <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                                <Link
                                    href={`/community/${entry.horseId}`}
                                    className="hover:text-forest text-[calc(0.95rem*var(--font-scale))] font-semibold text-inherit no-underline"
                                >
                                    🐴 {entry.horseName}
                                </Link>
                                <span className="text-forest no-underline">
                                    by{" "}
                                    <Link href={`/profile/${encodeURIComponent(entry.ownerAlias)}`}>
                                        @{entry.ownerAlias}
                                    </Link>
                                    {" · "}
                                    {entry.finishType}
                                    {entry.className && (
                                        <span className="text-forest ml-1">
                                            · {entry.divisionName && `${entry.divisionName} / `}
                                            {entry.className}
                                        </span>
                                    )}
                                </span>
                                {entry.caption && (
                                    <p
                                        style={{
                                            fontSize: "calc(0.75rem * var(--font-scale))",
                                            color: "var(--color-text-secondary)",
                                            margin: "var(--space-xs) 0 0",
                                            fontStyle: "italic",
                                            lineHeight: 1.4,
                                        }}
                                    >
                                        &ldquo;{entry.caption}&rdquo;
                                    </p>
                                )}
                            </div>
                            <div className="gap-1" style={{ display: "flex", alignItems: "center" }}>
                                {isExpertJudged ? (
                                    entry.placing && show.status === "closed" ? (
                                        <span
                                            style={{
                                                fontSize: "calc(var(--font-size-sm) * var(--font-scale))",
                                                padding: "var(--space-xs) var(--space-sm)",
                                                borderRadius: "var(--radius-sm)",
                                                background: "rgba(245, 158, 11, 0.15)",
                                                color: "var(--color-accent, #f59e0b)",
                                                fontWeight: 600,
                                            }}
                                        >
                                            {entry.placing}
                                        </span>
                                    ) : isJudging ? (
                                        <span className="text-muted text-[calc(0.75rem*var(--font-scale))]">
                                            🏅 Expert judging
                                        </span>
                                    ) : null
                                ) : (
                                    <VoteButton
                                        entryId={entry.id}
                                        initialVotes={entry.votes}
                                        initialHasVoted={entry.hasVoted}
                                        disabled={show.status !== "open"}
                                    />
                                )}
                                {entry.ownerId === user.id && show.status === "open" && (
                                    <WithdrawButton entryId={entry.id} />
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Show Discussion */}
            <UniversalFeed
                initialPosts={showComments}
                context={{ eventId: showId }}
                currentUserId={user.id}
                showComposer={true}
                composerPlaceholder="Discuss this show…"
                label="Discussion"
            />
        </div>
    );
}
