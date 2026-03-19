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
        d.classes.map(c => ({ id: c.id, name: c.name, divisionName: d.name }))
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
            {show.status === "closed" && entries.length > 0 && (
                <div className="card animate-fade-in-up" style={{
                    textAlign: "center",
                    padding: "var(--space-xl)",
                    marginBottom: "var(--space-lg)",
                }}>
                    <h2 style={{ fontSize: "calc(1.3rem * var(--font-scale))", marginBottom: "var(--space-lg)" }}>
                        🏆 <span className="text-gradient">Results</span>
                    </h2>
                    <div style={{ display: "flex", justifyContent: "center", gap: "var(--space-xl)", flexWrap: "wrap" }}>
                        {isExpertJudged ? (
                            // Expert-judged: show entries that have a placing assigned
                            entries.filter(e => e.placing).slice(0, 5).map((entry) => {
                                const medals: Record<string, string> = { "1st": "🥇", "2nd": "🥈", "3rd": "🥉", "HM": "🎗️" };
                                return (
                                    <div key={entry.id} style={{ textAlign: "center", minWidth: "120px" }}>
                                        <div style={{ fontSize: "2.5rem" }}>{medals[entry.placing!] || "🏅"}</div>
                                        {entry.thumbnailUrl && (
                                            <div className="show-entry-thumb" style={{ width: "80px", height: "80px", margin: "var(--space-sm) auto" }}>
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={entry.thumbnailUrl} alt={entry.horseName} />
                                            </div>
                                        )}
                                        <div style={{ fontWeight: 600, fontSize: "calc(0.9rem * var(--font-scale))" }}>
                                            {entry.horseName}
                                        </div>
                                        <div style={{ color: "var(--color-text-muted)", fontSize: "calc(0.75rem * var(--font-scale))" }}>
                                            by @{entry.ownerAlias}
                                        </div>
                                        <div style={{ fontWeight: 700, color: "var(--color-accent, #f59e0b)", fontSize: "calc(0.8rem * var(--font-scale))" }}>
                                            {entry.placing}
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            // Community vote: show top 3 by vote count
                            entries.slice(0, 3).map((entry, i) => {
                                const medals = ["🥇", "🥈", "🥉"];
                                const labels = ["1st Place", "2nd Place", "3rd Place"];
                                return (
                                    <div key={entry.id} style={{ textAlign: "center", minWidth: "120px" }}>
                                        <div style={{ fontSize: "2.5rem" }}>{medals[i]}</div>
                                        {entry.thumbnailUrl && (
                                            <div className="show-entry-thumb" style={{ width: "80px", height: "80px", margin: "var(--space-sm) auto" }}>
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={entry.thumbnailUrl} alt={entry.horseName} />
                                            </div>
                                        )}
                                        <div style={{ fontWeight: 600, fontSize: "calc(0.9rem * var(--font-scale))" }}>
                                            {entry.horseName}
                                        </div>
                                        <div style={{ color: "var(--color-text-muted)", fontSize: "calc(0.75rem * var(--font-scale))" }}>
                                            by @{entry.ownerAlias} · {entry.votes} vote{entry.votes !== 1 ? "s" : ""}
                                        </div>
                                        <div style={{ fontWeight: 700, color: "var(--color-accent, #f59e0b)", fontSize: "calc(0.8rem * var(--font-scale))" }}>
                                            {labels[i]}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

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
