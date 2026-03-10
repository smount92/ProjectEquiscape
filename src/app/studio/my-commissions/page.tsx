import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getClientCommissions } from "@/app/actions/art-studio";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "My Commissions — Model Horse Hub",
};

const STATUS_COLORS: Record<string, string> = {
    requested: "#6b7280",
    accepted: "#3b82f6",
    in_progress: "#f59e0b",
    review: "#8b5cf6",
    revision: "#f97316",
    completed: "#22c55e",
    delivered: "#14b8a6",
    declined: "#ef4444",
    cancelled: "#ef4444",
};

export default async function MyCommissionsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const commissions = await getClientCommissions();

    // Group by status
    const active = commissions.filter(c => ["requested", "accepted", "in_progress", "review", "revision"].includes(c.status));
    const completed = commissions.filter(c => ["completed", "delivered"].includes(c.status));
    const closed = commissions.filter(c => ["declined", "cancelled"].includes(c.status));

    const renderGroup = (title: string, items: typeof commissions, emoji: string) => {
        if (items.length === 0) return null;
        return (
            <div style={{ marginBottom: "var(--space-xl)" }}>
                <h2 style={{ fontSize: "calc(1.1rem * var(--font-scale))", marginBottom: "var(--space-md)" }}>
                    {emoji} {title} ({items.length})
                </h2>
                <div className="studio-commission-grid">
                    {items.map(c => (
                        <Link
                            key={c.id}
                            href={`/studio/commission/${c.id}`}
                            className="studio-commission-card"
                            style={{ textDecoration: "none", color: "inherit" }}
                        >
                            <div className="studio-commission-header">
                                <span className="studio-commission-type">{c.commissionType}</span>
                                <span
                                    className="commission-status-badge"
                                    style={{ backgroundColor: `${STATUS_COLORS[c.status]}20`, color: STATUS_COLORS[c.status], border: `1px solid ${STATUS_COLORS[c.status]}40` }}
                                >
                                    {c.statusLabel}
                                </span>
                            </div>
                            <div className="studio-commission-meta">
                                <span>🎨 @{c.artistAlias}</span>
                                {c.priceQuoted && <span>💰 ${c.priceQuoted}</span>}
                            </div>
                            <p className="studio-commission-desc">
                                {c.description.length > 100 ? c.description.substring(0, 100) + "…" : c.description}
                            </p>
                            <div style={{ marginTop: "auto", paddingTop: "var(--space-sm)", fontSize: "calc(0.7rem * var(--font-scale))", color: "var(--color-text-muted)" }}>
                                Last updated {new Date(c.lastUpdateAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="page-container">
            {/* Header */}
            <div className="community-hero animate-fade-in-up">
                <div className="community-hero-content">
                    <h1>
                        🎨 <span className="text-gradient">My Commissions</span>
                    </h1>
                    <p className="community-hero-subtitle">
                        Track commissions you&apos;ve requested from artists.
                    </p>
                </div>
            </div>

            {commissions.length === 0 ? (
                <div className="card animate-fade-in-up" style={{ padding: "var(--space-2xl)", textAlign: "center" }}>
                    <p style={{ fontSize: "2rem", marginBottom: "var(--space-md)" }}>🎨</p>
                    <p style={{ color: "var(--color-text-muted)" }}>You haven&apos;t requested any commissions yet.</p>
                    <Link href="/discover" className="btn btn-primary" style={{ marginTop: "var(--space-lg)" }}>
                        Browse Artists →
                    </Link>
                </div>
            ) : (
                <div className="animate-fade-in-up">
                    {renderGroup("Active", active, "🎨")}
                    {renderGroup("Completed", completed, "✅")}
                    {renderGroup("Closed", closed, "🚫")}
                </div>
            )}
        </div>
    );
}
