import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getArtistProfile, getArtistCommissions } from "@/app/actions/art-studio";
import CommissionBoard from "@/components/CommissionBoard";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Studio Dashboard — Model Horse Hub",
};

export default async function StudioDashboardPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const profile = await getArtistProfile(user.id);
    if (!profile) redirect("/studio/setup");

    const commissions = await getArtistCommissions();

    // Stats
    const activeStatuses = ["accepted", "in_progress", "review", "revision"];
    const activeCommissions = commissions.filter(c => activeStatuses.includes(c.status));
    const pendingRequests = commissions.filter(c => c.status === "requested");
    const completedTotal = commissions.filter(c => c.status === "completed" || c.status === "delivered");

    return (
        <div className="page-container">
            {/* Header */}
            <div className="py-xl px-lg rounded-lg bg-[linear-gradient(135deg,rgba(139,92,246,0.08),rgba(236,72,153,0.06))] border border-[rgba(139,92,246,0.15)] animate-fade-in-up" style={{ marginBottom: "var(--space-xl)" }}>
                <div className="max-w-[800px]">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-md)" }}>
                        <div>
                            <h1 style={{ fontSize: "calc(1.5rem * var(--font-scale))", margin: 0 }}>
                                <span className="text-gradient">{profile.studioName}</span>
                            </h1>
                            <p style={{ color: "var(--color-text-muted)", marginTop: "var(--space-xs)", fontSize: "calc(0.85rem * var(--font-scale))" }}>
                                Studio Dashboard
                            </p>
                        </div>
                        <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
                            <Link href={`/studio/${profile.studioSlug}`} className="btn btn-ghost" style={{ fontSize: "calc(0.8rem * var(--font-scale))" }}>
                                👁️ Public Page
                            </Link>
                            <Link href="/studio/setup" className="btn btn-ghost" style={{ fontSize: "calc(0.8rem * var(--font-scale))" }}>
                                ✏️ Edit Studio
                            </Link>
                        </div>
                    </div>

                    {/* Stats Bar */}
                    <div className="studio-stats-bar">
                        <div className="studio-stat">
                            <span className="studio-stat-value">{activeCommissions.length}/{profile.maxSlots}</span>
                            <span className="studio-stat-label">Slots Filled</span>
                        </div>
                        <div className="studio-stat">
                            <span className="studio-stat-value" style={{ color: pendingRequests.length > 0 ? "var(--color-accent-warm)" : undefined }}>
                                {pendingRequests.length}
                            </span>
                            <span className="studio-stat-label">Pending Requests</span>
                        </div>
                        <div className="studio-stat">
                            <span className="studio-stat-value">{completedTotal.length}</span>
                            <span className="studio-stat-label">Completed</span>
                        </div>
                        <div className="studio-stat">
                            <span className={`studio-status-badge status-${profile.status}`} style={{ fontSize: "calc(0.75rem * var(--font-scale))" }}>
                                {profile.status === "open" ? "🟢" : profile.status === "waitlist" ? "🟡" : "🔴"} {profile.status.charAt(0).toUpperCase() + profile.status.slice(1)}
                            </span>
                            <span className="studio-stat-label">Status</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Commission Board */}
            <CommissionBoard commissions={commissions} />
        </div>
    );
}
