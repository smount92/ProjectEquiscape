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
            <div className="mb-8" >
                <h2 className="text-[calc(1.1rem*var(--font-scale))] mb-4" >
                    {emoji} {title} ({items.length})
                </h2>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] max-md:grid-cols-1 gap-4">
                    {items.map(c => (
                        <Link
                            key={c.id}
                            href={`/studio/commission/${c.id}`}
                            className="flex flex-col p-6 rounded-lg bg-[var(--color-bg-elevated)] border border-edge transition-all hover:border-[rgba(139,92,246,0.3)] hover:-translate-y-[1px]"
                            style={{ textDecoration: "none", color: "inherit" }}
                        >
                            <div className="flex justify-between items-center mb-2 gap-2">
                                <span className="font-bold text-[calc(0.95rem*var(--font-scale))]">{c.commissionType}</span>
                                <span
                                    className="inline-flex items-center py-[3px] px-[10px] rounded-full text-[calc(0.7rem*var(--font-scale))] font-semibold whitespace-nowrap"
                                    style={{ backgroundColor: `${STATUS_COLORS[c.status]}20`, color: STATUS_COLORS[c.status], border: `1px solid ${STATUS_COLORS[c.status]}40` }}
                                >
                                    {c.statusLabel}
                                </span>
                            </div>
                            <div className="flex gap-4 text-[calc(0.8rem*var(--font-scale))] text-muted mb-2">
                                <span>🎨 @{c.artistAlias}</span>
                                {c.priceQuoted && <span>💰 ${c.priceQuoted}</span>}
                            </div>
                            <p className="text-[calc(0.85rem*var(--font-scale))] text-ink-light leading-normal mb-2">
                                {c.description.length > 100 ? c.description.substring(0, 100) + "…" : c.description}
                            </p>
                            <div className="pt-2 text-[calc(0.7rem*var(--font-scale))] text-muted" style={{ marginTop: "auto" }}>
                                Last updated {new Date(c.lastUpdateAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-[var(--max-width)] mx-auto py-[0] px-6">
            {/* Header */}
            <div className="text-[calc(2.2rem*var(--font-scale))] font-extrabold tracking-[-0.03em] mb-2 animate-fade-in-up">
                <div className="text-[calc(2.2rem*var(--font-scale))] font-extrabold tracking-[-0.03em] mb-2-content">
                    <h1>
                        🎨 <span className="text-forest">My Commissions</span>
                    </h1>
                    <p className="text-[calc(2.2rem*var(--font-scale))] font-extrabold tracking-[-0.03em] mb-2-subtitle">
                        Track commissions you&apos;ve requested from artists.
                    </p>
                </div>
            </div>

            {commissions.length === 0 ? (
                <div className="bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all animate-fade-in-up p-12" style={{ textAlign: "center" }}>
                    <p className="text-[2rem] mb-4" >🎨</p>
                    <p className="text-muted" >You haven&apos;t requested any commissions yet.</p>
                    <Link href="/discover" className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm mt-6">
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
