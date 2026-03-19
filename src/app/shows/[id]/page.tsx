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

export async function generateMetadata({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    return {
        title: `Photo Show — Model Horse Hub`,
        description: `Virtual photo show ${id}.`,
    };
}

export const dynamic = "force-dynamic";

export default async function ShowDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id: showId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
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
    const isJudge = eventJudges.some(j => j.userId === user.id);

    // Fetch divisions/classes for the entry form
    const divisions = await getEventDivisions(showId);
    const classOptions = divisions.flatMap(d =>
        d.classes.map(c => ({
            id: c.id,
            name: c.classNumber ? `${c.classNumber}: ${c.name}` : c.name,
            divisionName: d.name,
            allowedScales: c.allowedScales,
            isNanQualifying: c.isNanQualifying,
            maxEntries: c.maxEntries,
            currentEntryCount: c.entryCount || 0,
        }))
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
        <div className="page-container">
            {/* Hero */}
            <div className="community-hero animate-fade-in-up">
                <div className="community-hero-content">
                    <h1>
                        📸 <span className="text-gradient">{show.title}</span>
                    </h1>
                    {show.theme && (
                        <p className="community-hero-subtitle">
                            Theme: {show.theme}
                        </p>
                    )}
                    {show.description && (
                        <p className="community-hero-subtitle">
                            {show.description}
                        </p>
                    )}
                    {show.endAt && (
                        <p className="community-hero-subtitle" style={{
                            color: new Date(show.endAt) > new Date() ? "var(--color-accent, #f59e0b)" : "var(--color-text-muted)"
                        }}>
                            ⏰ {new Date(show.endAt) > new Date()
                                ? `Entries close: ${new Date(show.endAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}`
                                : "Entries are closed"
                            }
                        </p>
                    )}
                    {show.creatorAlias && (
                        <p className="community-hero-subtitle" style={{ fontSize: "calc(var(--font-size-sm) * var(--font-scale))" }}>
                            Hosted by @{show.creatorAlias}
                        </p>
                    )}
                </div>
                <div className="community-stats">
                    <div className="community-stat">
                        <span className="community-stat-number">{entries.length}</span>
                        <span className="community-stat-label">Entries</span>
                    </div>
                    <div className="community-stat">
                        <span className="community-stat-number show-status-badge-lg">
                            {show.status === "open" ? "🟢" : show.status === "judging" ? "🟡" : "🔴"}
                        </span>
                        <span className="community-stat-label">{show.status.charAt(0).toUpperCase() + show.status.slice(1)}</span>
                    </div>
                    <div className="community-stat">
                        <span className="community-stat-number">
                            {isExpertJudged ? "🏅" : "🗳️"}
                        </span>
                        <span className="community-stat-label">
                            {isExpertJudged ? "Expert Judge" : "Community Vote"}
                        </span>
                    </div>
                </div>
            </div>

            {/* Creator Actions */}
            {(isCreator || isAdmin) && (
                <div className="animate-fade-in-up" style={{ display: "flex", gap: "var(--space-sm)", justifyContent: "flex-end", marginBottom: "var(--space-md)" }}>
                    <Link href={`/community/events/${showId}/manage`} className="btn btn-ghost">
                        ⚙️ Manage Classes
                    </Link>
                </div>
            )}

            {/* Judge Assignment Banner — always visible to assigned judges */}
            {isJudge && !isCreator && (
                <div className="card animate-fade-in-up" style={{
                    marginBottom: "var(--space-lg)",
                    padding: "var(--space-lg)",
                    background: "linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(245, 158, 11, 0.1))",
                    border: "1px solid rgba(139, 92, 246, 0.3)",
                    textAlign: "center",
                }}>
                    <div style={{ fontSize: "2rem", marginBottom: "var(--space-sm)" }}>🏅</div>
                    <h3 style={{ marginBottom: "var(--space-sm)" }}>
                        You Are an Assigned Judge
                    </h3>
                    {show.status === "open" ? (
                        <p style={{ color: "var(--color-text-muted)", fontSize: "calc(var(--font-size-sm) * var(--font-scale))" }}>
                            This show is still accepting entries. Once the host transitions it to <strong>&quot;Judging&quot;</strong> status, the judging panel will appear here for you to assign placings.
                        </p>
                    ) : show.status === "judging" ? (
                        <p style={{ color: "var(--color-text-muted)", fontSize: "calc(var(--font-size-sm) * var(--font-scale))" }}>
                            The judging panel is available below. Scroll down to assign placings to each entry.
                        </p>
                    ) : (
                        <p style={{ color: "var(--color-text-muted)", fontSize: "calc(var(--font-size-sm) * var(--font-scale))" }}>
                            Judging is complete. Results are final.
                        </p>
                    )}
                </div>
            )}

            {/* Entry Form */}
            {isOpen && (
                <div className="show-entry-section animate-fade-in-up">
                    <h2 style={{ fontSize: "calc(1.1rem * var(--font-scale))", marginBottom: "var(--space-md)" }}>
                        Enter Your Horse
                    </h2>
                    <ShowEntryForm showId={showId} userHorses={horseOptions} classes={classOptions.length > 0 ? classOptions : undefined} />
                </div>
            )}

            {/* Breadcrumb */}
            <nav className="passport-breadcrumb animate-fade-in-up" style={{ marginBottom: "var(--space-lg)" }}>
                <Link href="/shows">← All Shows</Link>
            </nav>

            {/* Winner Podium for closed shows */}
            {show.status === "closed" && entries.length > 0 && (() => {
                const RIBBON_MAP: Record<string, string> = {
                    "1st": "blue", "2nd": "red", "3rd": "yellow", "4th": "white",
                    "5th": "pink", "6th": "green", "HM": "green",
                    "Champion": "blue", "Reserve Champion": "red",
                    "Grand Champion": "blue", "Reserve Grand Champion": "red",
                };
                const MEDAL_MAP: Record<string, string> = {
                    "1st": "🥇", "2nd": "🥈", "3rd": "🥉", "HM": "🎗️",
                    "Champion": "🏆", "Reserve Champion": "🥈",
                    "Grand Champion": "🏆", "Reserve Grand Champion": "🥈",
                };
                const PLACE_ORDER: Record<string, number> = {
                    "Grand Champion": 0, "Reserve Grand Champion": 1,
                    "Champion": 2, "Reserve Champion": 3,
                    "1st": 4, "2nd": 5, "3rd": 6, "4th": 7, "5th": 8, "6th": 9, "HM": 10,
                };

                // Champions first
                const champions = sortedEntries.filter(e =>
                    e.placing && ["Champion", "Reserve Champion", "Grand Champion", "Reserve Grand Champion"].includes(e.placing)
                );
                // Top placed
                const topPlaced = isExpertJudged
                    ? sortedEntries.filter(e => e.placing && !["Champion", "Reserve Champion", "Grand Champion", "Reserve Grand Champion"].includes(e.placing))
                        .sort((a, b) => (PLACE_ORDER[a.placing!] ?? 99) - (PLACE_ORDER[b.placing!] ?? 99))
                        .slice(0, 6)
                    : sortedEntries.slice(0, 3);
                const podiumEntries = topPlaced.slice(0, 3);

                return (
                    <div className="card animate-fade-in-up" style={{
                        padding: "var(--space-xl)",
                        marginBottom: "var(--space-lg)",
                    }}>
                        <h2 style={{ fontSize: "calc(1.3rem * var(--font-scale))", marginBottom: "var(--space-sm)", textAlign: "center" }}>
                            🏆 <span className="text-gradient">Results</span>
                        </h2>

                        {/* Champion Banners */}
                        {champions.map(entry => (
                            <div key={entry.id} className="champion-banner animate-fade-in-up">
                                <div className="champion-banner-title">
                                    {MEDAL_MAP[entry.placing!] || "🏆"} {entry.placing}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-md)" }}>
                                    {entry.thumbnailUrl && (
                                        <div style={{ width: 60, height: 60, borderRadius: "var(--radius-md)", overflow: "hidden", flexShrink: 0 }}>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={entry.thumbnailUrl} alt={entry.horseName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                        </div>
                                    )}
                                    <div>
                                        <Link href={`/community/${entry.horseId}`} style={{ fontWeight: 700, fontSize: "calc(1rem * var(--font-scale))" }}>
                                            🐴 {entry.horseName}
                                        </Link>
                                        <div style={{ color: "var(--color-text-muted)", fontSize: "calc(0.8rem * var(--font-scale))" }}>
                                            by <Link href={`/profile/${encodeURIComponent(entry.ownerAlias)}`}>@{entry.ownerAlias}</Link>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Podium */}
                        <div className="results-podium">
                            {podiumEntries.map((entry, i) => {
                                const placing = isExpertJudged ? entry.placing! : ["1st", "2nd", "3rd"][i];
                                const ribbon = RIBBON_MAP[placing] || "blue";
                                const medal = MEDAL_MAP[placing] || "🏅";
                                return (
                                    <div key={entry.id} className={`podium-card ${i === 0 ? "podium-card-first" : ""}`}>
                                        <div className={`podium-ribbon podium-ribbon-${ribbon}`} />
                                        {entry.thumbnailUrl && (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={entry.thumbnailUrl} alt={entry.horseName} className="podium-photo" />
                                        )}
                                        <div className="podium-card-body">
                                            <div className="podium-medal">{medal}</div>
                                            <Link href={`/community/${entry.horseId}`} className="podium-horse-name">
                                                {entry.horseName}
                                            </Link>
                                            <div className="podium-owner">
                                                by <Link href={`/profile/${encodeURIComponent(entry.ownerAlias)}`}>@{entry.ownerAlias}</Link>
                                                {!isExpertJudged && ` · ${entry.votes} vote${entry.votes !== 1 ? "s" : ""}`}
                                            </div>
                                            <div className="podium-placing">{placing}</div>
                                            {entry.caption && (
                                                <div className="podium-caption">&ldquo;{entry.caption}&rdquo;</div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Remaining placed entries below podium */}
                        {topPlaced.length > 3 && (
                            <div style={{ marginTop: "var(--space-md)" }}>
                                <h3 style={{ fontSize: "calc(0.9rem * var(--font-scale))", marginBottom: "var(--space-sm)", color: "var(--color-text-muted)" }}>Also Placed</h3>
                                {topPlaced.slice(3).map(entry => {
                                    const placing = entry.placing!;
                                    const ribbon = RIBBON_MAP[placing] || "green";
                                    return (
                                        <div key={entry.id} style={{
                                            display: "flex", alignItems: "center", gap: "var(--space-md)",
                                            padding: "var(--space-sm) var(--space-md)",
                                            borderLeft: `3px solid var(--podium-${ribbon}, #22c55e)`,
                                            marginBottom: "var(--space-xs)",
                                        }}>
                                            {entry.thumbnailUrl && (
                                                <div style={{ width: 36, height: 36, borderRadius: "var(--radius-sm)", overflow: "hidden", flexShrink: 0 }}>
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={entry.thumbnailUrl} alt={entry.horseName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                                </div>
                                            )}
                                            <div style={{ flex: 1 }}>
                                                <Link href={`/community/${entry.horseId}`} style={{ fontWeight: 600 }}>{entry.horseName}</Link>
                                                <span style={{ color: "var(--color-text-muted)", marginLeft: "var(--space-xs)", fontSize: "calc(0.75rem * var(--font-scale))" }}>
                                                    by @{entry.ownerAlias}
                                                </span>
                                            </div>
                                            <span style={{ fontWeight: 700, color: "var(--color-accent, #f59e0b)", fontSize: "calc(0.85rem * var(--font-scale))" }}>
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
                <div className="card animate-fade-in-up" style={{
                    textAlign: "center",
                    padding: "var(--space-lg)",
                    marginBottom: "var(--space-lg)",
                    background: "rgba(245, 158, 11, 0.1)",
                    border: "1px solid rgba(245, 158, 11, 0.3)",
                }}>
                    <div style={{ fontSize: "2rem" }}>🟡</div>
                    <h3>Judging in Progress</h3>
                    <p style={{ color: "var(--color-text-muted)" }}>
                        {isExpertJudged
                            ? ((isCreator || isJudge)
                                ? "Use the judging panel below to assign placings."
                                : "The judges are reviewing entries. Results will be announced soon!")
                            : "Voting is closed. Results will be announced soon!"
                        }
                    </p>
                </div>
            )}

            {/* Expert Judging Panel — host or assigned judge, during judging */}
            {isExpertJudged && isJudging && (isCreator || isJudge) && (
                <ExpertJudgingPanel
                    showId={showId}
                    entries={entries.map(e => ({
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
            {canClose && (
                <CloseShowButton showId={showId} />
            )}

            {/* Host Override Panel — creator can adjust placings on closed shows */}
            {isCreator && show.status === "closed" && (
                <ExpertJudgingPanel
                    showId={showId}
                    overrideMode
                    entries={entries.map(e => ({
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
                <div className="card shelf-empty animate-fade-in-up">
                    <div className="shelf-empty-icon">📸</div>
                    <h2>No Entries Yet</h2>
                    <p>Be the first to enter this show!</p>
                </div>
            ) : (
                <div className="show-entries-grid animate-fade-in-up">
                    {sortedEntries.map((entry, index) => (
                        <div key={entry.id} className="show-entry-card">
                            <div className="show-entry-rank">
                                {isExpertJudged && show.status === "closed" && entry.placing
                                    ? entry.placing
                                    : `#${index + 1}`
                                }
                            </div>
                            {entry.thumbnailUrl && (
                                <div className="show-entry-thumb">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={entry.thumbnailUrl} alt={entry.horseName} loading="lazy" />
                                </div>
                            )}
                            <div className="show-entry-info">
                                <Link
                                    href={`/community/${entry.horseId}`}
                                    className="show-entry-horse-name"
                                >
                                    🐴 {entry.horseName}
                                </Link>
                                <span className="show-entry-owner">
                                    by{" "}
                                    <Link href={`/profile/${encodeURIComponent(entry.ownerAlias)}`}>
                                        @{entry.ownerAlias}
                                    </Link>
                                    {" · "}{entry.finishType}
                                    {entry.className && (
                                        <span style={{ marginLeft: "var(--space-xs)", color: "var(--color-accent-primary)" }}>
                                            · {entry.divisionName && `${entry.divisionName} / `}{entry.className}
                                        </span>
                                    )}
                                </span>
                                {entry.caption && (
                                    <p style={{
                                        fontSize: "calc(0.75rem * var(--font-scale))",
                                        color: "var(--color-text-secondary)",
                                        margin: "var(--space-xs) 0 0",
                                        fontStyle: "italic",
                                        lineHeight: 1.4,
                                    }}>
                                        &ldquo;{entry.caption}&rdquo;
                                    </p>
                                )}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
                                {isExpertJudged ? (
                                    entry.placing && show.status === "closed" ? (
                                        <span style={{
                                            fontSize: "calc(var(--font-size-sm) * var(--font-scale))",
                                            padding: "var(--space-xs) var(--space-sm)",
                                            borderRadius: "var(--radius-sm)",
                                            background: "rgba(245, 158, 11, 0.15)",
                                            color: "var(--color-accent, #f59e0b)",
                                            fontWeight: 600,
                                        }}>
                                            {entry.placing}
                                        </span>
                                    ) : isJudging ? (
                                        <span style={{ color: "var(--color-text-muted)", fontSize: "calc(0.75rem * var(--font-scale))" }}>
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
