import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getArtistProfileBySlug } from "@/app/actions/art-studio";
import ShareButton from "@/components/ShareButton";

export const dynamic = "force-dynamic";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const profile = await getArtistProfileBySlug(slug);
    return {
        title: profile
            ? `${profile.studioName} — Art Studio | Model Horse Hub`
            : "Studio Not Found — Model Horse Hub",
        description: profile
            ? `${profile.studioName} — ${profile.specialties.join(", ") || "Model horse artist"}`
            : "This studio could not be found.",
    };
}

const STATUS_EMOJI: Record<string, string> = {
    open: "🟢",
    waitlist: "🟡",
    closed: "🔴",
};

const STATUS_LABEL: Record<string, string> = {
    open: "Open for Commissions",
    waitlist: "Waitlist Open",
    closed: "Commissions Closed",
};

export default async function PublicStudioPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const profile = await getArtistProfileBySlug(slug);
    if (!profile) notFound();

    const isOwner = user.id === profile.userId;

    // Fetch public queue (active commissions)
    const { data: rawQueue } = await supabase
        .from("commissions")
        .select("id, commission_type, status, slot_number, is_public_in_queue")
        .eq("artist_id", profile.userId)
        .eq("is_public_in_queue", true)
        .in("status", ["accepted", "in_progress", "review"])
        .order("slot_number", { ascending: true });

    const queue = (rawQueue ?? []) as {
        id: string; commission_type: string; status: string;
        slot_number: number | null; is_public_in_queue: boolean;
    }[];

    // Count active commissions for slots info
    const { count: activeCount } = await supabase
        .from("commissions")
        .select("id", { count: "exact", head: true })
        .eq("artist_id", profile.userId)
        .in("status", ["accepted", "in_progress", "review"]);

    const slotsUsed = activeCount || 0;

    const COMMISSION_STATUS_LABELS: Record<string, { label: string; emoji: string }> = {
        accepted: { label: "Queued", emoji: "📋" },
        in_progress: { label: "In Progress", emoji: "🎨" },
        review: { label: "Review", emoji: "👁️" },
    };

    return (
        <div className="max-w-[var(--max-width)] mx-auto py-[0] px-6">
            {/* Hero */}
            <div className="py-8 px-6 rounded-lg bg-[linear-gradient(135deg,rgba(139,92,246,0.08),rgba(236,72,153,0.06))] border border-[rgba(139,92,246,0.15)] animate-fade-in-up">
                <div className="max-w-[800px]">
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", flexWrap: "wrap" }}>
                        <h1 style={{ fontSize: "calc(1.8rem * var(--font-scale))", margin: 0 }}>
                            <span className="text-forest">{profile.studioName}</span>
                        </h1>
                        <span className={`studio-status-badge status-${profile.status}`}>
                            {STATUS_EMOJI[profile.status]} {STATUS_LABEL[profile.status]}
                        </span>
                    </div>
                    <p style={{ color: "var(--color-text-muted)", marginTop: "var(--space-xs)", fontSize: "calc(0.9rem * var(--font-scale))" }}>
                        by <Link href={`/profile/${encodeURIComponent(profile.ownerAlias)}`} style={{ color: "var(--color-accent-primary)" }}>
                            @{profile.ownerAlias}
                        </Link>
                    </p>

                    {profile.bioArtist && (
                        <p style={{ marginTop: "var(--space-md)", lineHeight: 1.6, maxWidth: 600, color: "var(--color-text-secondary)" }}>
                            {profile.bioArtist}
                        </p>
                    )}

                    {profile.specialties.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-xs)", marginTop: "var(--space-md)" }}>
                            {profile.specialties.map(s => (
                                <span key={s} className="inline-block py-[3px] px-[10px] rounded-full text-xs font-semibold bg-[rgba(139,92,246,0.15)] text-[#a78bfa] border border-[rgba(139,92,246,0.25)]">{s}</span>
                            ))}
                        </div>
                    )}

                    <div style={{ display: "flex", gap: "var(--space-sm)", marginTop: "var(--space-lg)", flexWrap: "wrap" }}>
                        {profile.status !== "closed" && !isOwner && (
                            <Link href={`/studio/${slug}/request`} className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm" id="request-commission-btn">
                                🎨 Request a Commission
                            </Link>
                        )}
                        {isOwner && (
                            <>
                                <Link href="/studio/dashboard" className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm">
                                    📊 Dashboard
                                </Link>
                                <Link href="/studio/setup" className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge">
                                    ✏️ Edit Studio
                                </Link>
                            </>
                        )}
                        <ShareButton
                            title={`${profile.studioName} — Model Horse Hub`}
                            text={`Check out ${profile.studioName} on Model Horse Hub!`}
                            label="Share"
                            variant="full"
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 max-md:grid-cols-1 gap-8 mt-8 animate-fade-in-up">
                {/* Left: Details */}
                <div>
                    {/* Pricing & Turnaround */}
                    <div className="bg-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-12 shadow-md transition-all" style={{ padding: "var(--space-lg)", marginBottom: "var(--space-lg)" }}>
                        <h2 style={{ fontSize: "calc(1.1rem * var(--font-scale))", marginBottom: "var(--space-md)" }}>
                            💰 Pricing & Timeline
                        </h2>
                        <div className="grid gap-2">
                            {(profile.priceRangeMin || profile.priceRangeMax) && (
                                <div className="flex justify-between items-center py-1">
                                    <span className="text-[calc(0.8rem*var(--font-scale))] text-muted">Price Range</span>
                                    <span className="font-bold text-[calc(0.9rem*var(--font-scale))]">
                                        {profile.priceRangeMin && profile.priceRangeMax
                                            ? `$${profile.priceRangeMin} – $${profile.priceRangeMax}`
                                            : profile.priceRangeMin
                                                ? `From $${profile.priceRangeMin}`
                                                : `Up to $${profile.priceRangeMax}`}
                                    </span>
                                </div>
                            )}
                            {(profile.turnaroundMinDays || profile.turnaroundMaxDays) && (
                                <div className="flex justify-between items-center py-1">
                                    <span className="text-[calc(0.8rem*var(--font-scale))] text-muted">Turnaround</span>
                                    <span className="font-bold text-[calc(0.9rem*var(--font-scale))]">
                                        {profile.turnaroundMinDays && profile.turnaroundMaxDays
                                            ? `${profile.turnaroundMinDays}–${profile.turnaroundMaxDays} days`
                                            : profile.turnaroundMinDays
                                                ? `Min ${profile.turnaroundMinDays} days`
                                                : `Up to ${profile.turnaroundMaxDays} days`}
                                    </span>
                                </div>
                            )}
                            <div className="flex justify-between items-center py-1">
                                <span className="text-[calc(0.8rem*var(--font-scale))] text-muted">Commission Slots</span>
                                <span className="font-bold text-[calc(0.9rem*var(--font-scale))]">
                                    {slotsUsed} / {profile.maxSlots} filled
                                </span>
                            </div>
                        </div>

                        {profile.mediums.length > 0 && (
                            <div style={{ marginTop: "var(--space-md)" }}>
                                <span className="text-[calc(0.8rem*var(--font-scale))] text-muted" style={{ display: "block", marginBottom: "var(--space-xs)" }}>Mediums</span>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-xs)" }}>
                                    {profile.mediums.map(m => (
                                        <span key={m} className="inline-block py-[3px] px-[10px] rounded-full text-xs font-semibold bg-[rgba(44,85,69,0.1)] text-[#2C5545] border border-[rgba(44,85,69,0.2)]">{m}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {profile.scalesOffered.length > 0 && (
                            <div style={{ marginTop: "var(--space-md)" }}>
                                <span className="text-[calc(0.8rem*var(--font-scale))] text-muted" style={{ display: "block", marginBottom: "var(--space-xs)" }}>Scales</span>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-xs)" }}>
                                    {profile.scalesOffered.map(s => (
                                        <span key={s} className="inline-block py-[3px] px-[10px] rounded-full text-xs font-semibold bg-[rgba(44,85,69,0.1)] text-[#2C5545] border border-[rgba(44,85,69,0.2)]">{s}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Terms */}
                    {profile.termsText && (
                        <div className="bg-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-12 shadow-md transition-all" style={{ padding: "var(--space-lg)" }}>
                            <h2 style={{ fontSize: "calc(1.1rem * var(--font-scale))", marginBottom: "var(--space-md)" }}>
                                📄 Terms & Conditions
                            </h2>
                            <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, color: "var(--color-text-secondary)", fontSize: "calc(0.85rem * var(--font-scale))" }}>
                                {profile.termsText}
                            </p>
                        </div>
                    )}
                </div>

                {/* Right: Commission Queue */}
                <div>
                    <div className="bg-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-12 shadow-md transition-all" style={{ padding: "var(--space-lg)" }}>
                        <h2 style={{ fontSize: "calc(1.1rem * var(--font-scale))", marginBottom: "var(--space-md)" }}>
                            📋 Commission Queue
                        </h2>
                        {queue.length === 0 ? (
                            <p style={{ color: "var(--color-text-muted)", fontSize: "calc(0.85rem * var(--font-scale))" }}>
                                No active commissions in the queue.
                            </p>
                        ) : (
                            <div style={{ display: "grid", gap: "var(--space-sm)" }}>
                                {queue.map((item, i) => {
                                    const st = COMMISSION_STATUS_LABELS[item.status] || { label: item.status, emoji: "📋" };
                                    return (
                                        <div key={item.id} className="flex items-center gap-2 py-2 px-4 rounded-md bg-[rgba(0,0,0,0.03)]">
                                            <span className="text-xs font-bold text-forest min-w-[50px]">
                                                Slot {item.slot_number || i + 1}
                                            </span>
                                            <span className="flex-1 text-[calc(0.85rem*var(--font-scale))] font-semibold">{item.commission_type}</span>
                                            <span className={`commission-status-badge status-${item.status.replace("_", "-")}`}>
                                                {st.emoji} {st.label}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Accepting */}
                    {profile.acceptingTypes.length > 0 && (
                        <div className="bg-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-12 shadow-md transition-all" style={{ padding: "var(--space-lg)", marginTop: "var(--space-lg)" }}>
                            <h2 style={{ fontSize: "calc(1.1rem * var(--font-scale))", marginBottom: "var(--space-md)" }}>
                                ✅ Currently Accepting
                            </h2>
                            <div style={{ display: "grid", gap: "var(--space-xs)" }}>
                                {profile.acceptingTypes.map(t => (
                                    <div key={t} style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", padding: "var(--space-xs) 0" }}>
                                        <span style={{ color: "#22c55e" }}>✓</span>
                                        <span style={{ fontSize: "calc(0.9rem * var(--font-scale))" }}>{t}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
