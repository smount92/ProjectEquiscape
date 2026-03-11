import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { getShowEntries } from "@/app/actions/shows";
import { getPosts } from "@/app/actions/posts";
import Link from "next/link";
import VoteButton from "@/components/VoteButton";
import ShowEntryForm from "@/components/ShowEntryForm";
import WithdrawButton from "@/components/WithdrawButton";
import UniversalFeed from "@/components/UniversalFeed";
import CloseShowButton from "@/components/CloseShowButton";

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
                </div>
            </div>

            {/* Entry Form */}
            {isOpen && (
                <div className="show-entry-section animate-fade-in-up">
                    <h2 style={{ fontSize: "calc(1.1rem * var(--font-scale))", marginBottom: "var(--space-md)" }}>
                        Enter Your Horse
                    </h2>
                    <ShowEntryForm showId={showId} userHorses={horseOptions} />
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
                        {entries.slice(0, 3).map((entry, i) => {
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
                        })}
                    </div>
                </div>
            )}

            {/* Judging Banner */}
            {show.status === "judging" && (
                <div className="card animate-fade-in-up" style={{
                    textAlign: "center",
                    padding: "var(--space-lg)",
                    marginBottom: "var(--space-lg)",
                    background: "rgba(245, 158, 11, 0.1)",
                    border: "1px solid rgba(245, 158, 11, 0.3)",
                }}>
                    <div style={{ fontSize: "2rem" }}>🟡</div>
                    <h3>Judging in Progress</h3>
                    <p style={{ color: "var(--color-text-muted)" }}>Voting is closed. Results will be announced soon!</p>
                </div>
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
                    {entries.map((entry, index) => (
                        <div key={entry.id} className="show-entry-card">
                            <div className="show-entry-rank">#{index + 1}</div>
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
                                </span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
                                <VoteButton
                                    entryId={entry.id}
                                    initialVotes={entry.votes}
                                    initialHasVoted={entry.hasVoted}
                                    disabled={show.status !== "open"}
                                />
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
