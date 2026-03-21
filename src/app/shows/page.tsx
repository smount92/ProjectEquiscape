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
        case "open":
            return { label: "🟢 Open", className: "show-status-open" };
        case "judging":
            return { label: "🟡 Judging", className: "show-status-judging" };
        case "closed":
            return { label: "🔴 Closed", className: "show-status-closed" };
        default:
            return { label: status, className: "" };
    }
}

export const dynamic = "force-dynamic";

export default async function ShowsPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const shows = await getPhotoShows();

    // Batch-check which shows this user is a judge for
    const showIds = shows.map((s) => s.id);
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
        <div className="mx-auto max-w-[var(--max-width)] px-6 py-[0]">
            <div className="animate-fade-in-up mb-2 text-[calc(2.2rem*var(--font-scale))] font-extrabold tracking-[-0.03em]">
                <div className="mb-2-content text-[calc(2.2rem*var(--font-scale))] font-extrabold tracking-[-0.03em]">
                    <h1>
                        📸 <span className="text-forest">Virtual Photo Shows</span>
                    </h1>
                    <p className="mb-2-subtitle text-[calc(2.2rem*var(--font-scale))] font-extrabold tracking-[-0.03em]">
                        Enter your models, vote for your favorites, and compete for community glory!
                    </p>
                </div>
                <div className="mt-8 flex justify-center gap-8">
                    <div className="flex flex-col items-center">
                        <span className="items-center-number flex flex-col">
                            {shows.filter((s) => s.status === "open").length}
                        </span>
                        <span className="items-center-label flex flex-col">Open Shows</span>
                    </div>
                </div>
            </div>

            {shows.length === 0 ? (
                <div className="bg-card border-edge animate-fade-in-up rounded-lg border p-12 px-8 py-[var(--space-3xl)] text-center shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]">
                    <div className="px-8-icon py-[var(--space-3xl)] text-center">📸</div>
                    <h2>No Shows Yet</h2>
                    <p>Check back soon for virtual photo shows!</p>
                </div>
            ) : (
                <div className="grid-cols-[repeat(auto-fill, minmax(300px, 1fr))] animate-fade-in-up grid gap-6">
                    {shows.map((show) => {
                        const badge = statusBadge(show.status);
                        const isUserJudge = judgeShowIds.has(show.id);
                        return (
                            <Link
                                key={show.id}
                                href={`/shows/${show.id}`}
                                className="rounded-lg border border-edge bg-card p-4 shadow-md transition-all"
                                id={`show-${show.id}`}
                            >
                                <div className="rounded-lg border border-edge bg-card p-4 shadow-md transition-all">
                                    <h3 className="rounded-lg border border-edge bg-card p-4 shadow-md transition-all">
                                        {show.title}
                                    </h3>
                                    <div className="gap-1" style={{ display: "flex", alignItems: "center" }}>
                                        {isUserJudge && (
                                            <span
                                                style={{
                                                    fontSize: "calc(0.7rem * var(--font-scale))",
                                                    padding: "2px 8px",
                                                    borderRadius: "var(--radius-sm)",
                                                    background: "rgba(139, 92, 246, 0.2)",
                                                    color: "#a78bfa",
                                                    border: "1px solid rgba(139, 92, 246, 0.3)",
                                                    fontWeight: 600,
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                🏅 Judge
                                            </span>
                                        )}
                                        <span className={`show-status-badge ${badge.className}`}>{badge.label}</span>
                                    </div>
                                </div>
                                {show.theme && (
                                    <div className="rounded-lg border border-edge bg-card p-4 shadow-md transition-all">
                                        Theme: {show.theme}
                                    </div>
                                )}
                                {show.description && (
                                    <p className="rounded-lg border border-edge bg-card p-4 shadow-md transition-all">
                                        {show.description}
                                    </p>
                                )}
                                {show.creatorAlias && (
                                    <div className="text-muted mt-1 text-xs">Hosted by @{show.creatorAlias}</div>
                                )}
                                <div className="rounded-lg border border-edge bg-card p-4 shadow-md transition-all">
                                    <span>
                                        🐴 {show.entryCount} entr{show.entryCount !== 1 ? "ies" : "y"}
                                    </span>
                                    {show.endAt && (
                                        <span>
                                            ⏰{" "}
                                            {new Date(show.endAt) > new Date()
                                                ? `Closes ${new Date(show.endAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
                                                : "Entries closed"}
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
