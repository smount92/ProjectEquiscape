import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getPhotoShows } from "@/app/actions/shows";
import Link from "next/link";

export const metadata = {
    title: "Photo Shows — Model Horse Hub",
    description: "Browse and enter virtual photo shows. Show off your models and vote for favorites!",
};

function statusBadge(status: string) {
    switch (status) {
        case "open": return { label: "🟢 Open", className: "show-status-open" };
        case "judging": return { label: "🟡 Judging", className: "show-status-judging" };
        case "closed": return { label: "🔴 Closed", className: "show-status-closed" };
        default: return { label: status, className: "" };
    }
}

export const dynamic = "force-dynamic";

export default async function ShowsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const shows = await getPhotoShows();

    // Batch-check which shows this user is a judge for
    const showIds = shows.map(s => s.id);
    let judgeShowIds = new Set<string>();
    if (showIds.length > 0) {
        const { data: judgeRows } = await supabase
            .from("event_judges")
            .select("event_id")
            .eq("user_id", user.id)
            .in("event_id", showIds);
        judgeShowIds = new Set((judgeRows ?? []).map((r: { event_id: string }) => r.event_id));
    }

    return (
        <div className="page-container">
            <div className="community-hero animate-fade-in-up">
                <div className="community-hero-content">
                    <h1>
                        📸 <span className="text-gradient">Virtual Photo Shows</span>
                    </h1>
                    <p className="community-hero-subtitle">
                        Enter your models, vote for your favorites, and compete for community glory!
                    </p>
                </div>
                <div className="community-stats">
                    <div className="community-stat">
                        <span className="community-stat-number">
                            {shows.filter((s) => s.status === "open").length}
                        </span>
                        <span className="community-stat-label">Open Shows</span>
                    </div>
                </div>
            </div>

            {shows.length === 0 ? (
                <div className="card shelf-empty animate-fade-in-up">
                    <div className="shelf-empty-icon">📸</div>
                    <h2>No Shows Yet</h2>
                    <p>Check back soon for virtual photo shows!</p>
                </div>
            ) : (
                <div className="shows-grid animate-fade-in-up">
                    {shows.map((show) => {
                        const badge = statusBadge(show.status);
                        const isUserJudge = judgeShowIds.has(show.id);
                        return (
                            <Link
                                key={show.id}
                                href={`/shows/${show.id}`}
                                className="show-card"
                                id={`show-${show.id}`}
                            >
                                <div className="show-card-header">
                                    <h3 className="show-card-title">{show.title}</h3>
                                    <div style={{ display: "flex", gap: "var(--space-xs)", alignItems: "center" }}>
                                        {isUserJudge && (
                                            <span style={{
                                                fontSize: "calc(0.7rem * var(--font-scale))",
                                                padding: "2px 8px",
                                                borderRadius: "var(--radius-sm)",
                                                background: "rgba(139, 92, 246, 0.2)",
                                                color: "#a78bfa",
                                                border: "1px solid rgba(139, 92, 246, 0.3)",
                                                fontWeight: 600,
                                                whiteSpace: "nowrap",
                                            }}>
                                                🏅 Judge
                                            </span>
                                        )}
                                        <span className={`show-status-badge ${badge.className}`}>
                                            {badge.label}
                                        </span>
                                    </div>
                                </div>
                                {show.theme && (
                                    <div className="show-card-theme">Theme: {show.theme}</div>
                                )}
                                {show.description && (
                                    <p className="show-card-desc">{show.description}</p>
                                )}
                                {show.creatorAlias && (
                                    <div style={{ fontSize: "calc(var(--font-size-xs) * var(--font-scale))", color: "var(--color-text-muted)", marginTop: "var(--space-xs)" }}>
                                        Hosted by @{show.creatorAlias}
                                    </div>
                                )}
                                <div className="show-card-footer">
                                    <span>🐴 {show.entryCount} entr{show.entryCount !== 1 ? "ies" : "y"}</span>
                                    {show.endAt && (
                                        <span>
                                            ⏰ {new Date(show.endAt) > new Date()
                                                ? `Closes ${new Date(show.endAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
                                                : "Entries closed"
                                            }
                                        </span>
                                    )}
                                    <span>
                                        {new Date(show.createdAt).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                        })}
                                    </span>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
