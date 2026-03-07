import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { getShowEntries } from "@/app/actions/shows";
import Link from "next/link";
import VoteButton from "@/components/VoteButton";
import ShowEntryForm from "@/components/ShowEntryForm";

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
                            <VoteButton
                                entryId={entry.id}
                                initialVotes={entry.votes}
                                initialHasVoted={entry.hasVoted}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
