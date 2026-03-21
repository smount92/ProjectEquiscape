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
        <div className="max-w-[var(--max-width)] mx-auto py-[0] px-6">
            {/* Header */}
            <div className="py-8 px-6 rounded-lg bg-[linear-gradient(135deg,rgba(139,92,246,0.08),rgba(236,72,153,0.06))] border border-[rgba(139,92,246,0.15)] animate-fade-in-up" style={{ marginBottom: "var(--space-xl)" }}>
                <div className="max-w-[800px]">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-md)" }}>
                        <div>
                            <h1 style={{ fontSize: "calc(1.5rem * var(--font-scale))", margin: 0 }}>
                                <span className="text-forest">{profile.studioName}</span>
                            </h1>
                            <p style={{ color: "var(--color-text-muted)", marginTop: "var(--space-xs)", fontSize: "calc(0.85rem * var(--font-scale))" }}>
                                Studio Dashboard
                            </p>
                        </div>
                        <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
                            <Link href={`/studio/${profile.studioSlug}`} className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge" style={{ fontSize: "calc(0.8rem * var(--font-scale))" }}>
                                👁️ Public Page
                            </Link>
                            <Link href="/studio/setup" className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge" style={{ fontSize: "calc(0.8rem * var(--font-scale))" }}>
                                ✏️ Edit Studio
                            </Link>
                        </div>
                    </div>

                    {/* Stats Bar */}
                    <div className="flex gap-6 mt-6 pt-6 border-t border-[rgba(0,0,0,0.06)] flex-wrap">
                        <div className="flex flex-col items-center gap-[2px]">
                            <span className="text-[calc(1.3rem*var(--font-scale))] font-extrabold text-forest">{activeCommissions.length}/{profile.maxSlots}</span>
                            <span className="text-[calc(0.7rem*var(--font-scale))] text-muted uppercase tracking-wider">Slots Filled</span>
                        </div>
                        <div className="flex flex-col items-center gap-[2px]">
                            <span className="text-[calc(1.3rem*var(--font-scale))] font-extrabold text-forest" style={{ color: pendingRequests.length > 0 ? "var(--color-accent-warm)" : undefined }}>
                                {pendingRequests.length}
                            </span>
                            <span className="text-[calc(0.7rem*var(--font-scale))] text-muted uppercase tracking-wider">Pending Requests</span>
                        </div>
                        <div className="flex flex-col items-center gap-[2px]">
                            <span className="text-[calc(1.3rem*var(--font-scale))] font-extrabold text-forest">{completedTotal.length}</span>
                            <span className="text-[calc(0.7rem*var(--font-scale))] text-muted uppercase tracking-wider">Completed</span>
                        </div>
                        <div className="flex flex-col items-center gap-[2px]">
                            <span className={`studio-status-badge status-${profile.status}`} style={{ fontSize: "calc(0.75rem * var(--font-scale))" }}>
                                {profile.status === "open" ? "🟢" : profile.status === "waitlist" ? "🟡" : "🔴"} {profile.status.charAt(0).toUpperCase() + profile.status.slice(1)}
                            </span>
                            <span className="text-[calc(0.7rem*var(--font-scale))] text-muted uppercase tracking-wider">Status</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Commission Board */}
            <CommissionBoard commissions={commissions} />
        </div>
    );
}
