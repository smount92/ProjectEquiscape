import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCommission, getCommissionUpdates } from "@/app/actions/art-studio";
import CommissionTimeline from "@/components/CommissionTimeline";
import RatingForm from "@/components/RatingForm";
import GuestLinkButton from "@/components/GuestLinkButton";
import LinkHorseToCommission from "@/components/LinkHorseToCommission";

export const dynamic = "force-dynamic";

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

export default async function CommissionDetailPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ token?: string }>;
}) {
    const { id: commissionId } = await params;
    const { token } = await searchParams;
    const supabase = await createClient();

    let isGuestMode = false;
    let isArtist = false;
    let isClient = false;
    let userId: string | null = null;

    if (token) {
        // Guest mode — verify token
        const { data: guestCheck } = await supabase
            .from("commissions")
            .select("id, guest_token")
            .eq("id", commissionId)
            .eq("guest_token", token)
            .maybeSingle();

        if (!guestCheck) notFound();
        isGuestMode = true;
    } else {
        // Normal auth flow
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) redirect("/login");
        userId = user.id;
    }

    const commission = await getCommission(commissionId);
    if (!commission) notFound();

    if (!isGuestMode && userId) {
        isArtist = commission.artistId === userId;
        isClient = commission.clientId === userId;
        if (!isArtist && !isClient) notFound();
    }

    const updates = await getCommissionUpdates(commissionId);

    // Review prompt: if delivered, look up the transaction for this commission
    let transactionId: string | null = null;
    let existingRating: { id: string; stars: number; reviewText: string | null; createdAt: string } | null = null;
    const targetId = isArtist ? commission.clientId : commission.artistId;
    const targetAlias = isArtist ? (commission.clientAlias || "Client") : commission.artistAlias;

    if (!isGuestMode && commission.status === "delivered" && targetId && userId) {
        const { data: txn } = await supabase
            .from("transactions")
            .select("id")
            .eq("commission_id", commissionId)
            .eq("type", "commission")
            .maybeSingle();

        if (txn) {
            transactionId = (txn as { id: string }).id;

            const { data: rawReview } = await supabase
                .from("reviews")
                .select("id, stars, content, created_at")
                .eq("transaction_id", transactionId)
                .eq("reviewer_id", userId)
                .maybeSingle();

            if (rawReview) {
                const rv = rawReview as { id: string; stars: number; content: string | null; created_at: string };
                existingRating = {
                    id: rv.id,
                    stars: rv.stars,
                    reviewText: rv.content,
                    createdAt: rv.created_at,
                };
            }
        }
    }

    return (
        <div className="page-container">
            {/* Header */}
            <div className="card animate-fade-in-up" style={{ padding: "var(--space-lg)", marginBottom: "var(--space-lg)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "var(--space-md)" }}>
                    <div>
                        <h1 style={{ fontSize: "calc(1.3rem * var(--font-scale))", margin: 0 }}>
                            {commission.commissionType}
                        </h1>
                        <div style={{ display: "flex", gap: "var(--space-md)", marginTop: "var(--space-xs)", fontSize: "calc(0.85rem * var(--font-scale))", color: "var(--color-text-muted)" }}>
                            {isArtist && commission.clientAlias && (
                                <span>👤 Client: @{commission.clientAlias}</span>
                            )}
                            {isClient && (
                                <span>🎨 Artist: @{commission.artistAlias}</span>
                            )}
                            <span>📅 {new Date(commission.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                        </div>
                    </div>
                    <span
                        className="commission-status-badge"
                        style={{
                            backgroundColor: `${STATUS_COLORS[commission.status]}20`,
                            color: STATUS_COLORS[commission.status],
                            border: `1px solid ${STATUS_COLORS[commission.status]}40`,
                            fontSize: "calc(0.85rem * var(--font-scale))",
                            padding: "var(--space-xs) var(--space-md)",
                        }}
                    >
                        {commission.statusLabel}
                    </span>
                </div>

                {/* Description */}
                <div style={{ marginTop: "var(--space-lg)", padding: "var(--space-md)", borderRadius: "var(--radius-md)", background: "var(--color-bg-card)" }}>
                    <h3 style={{ fontSize: "calc(0.85rem * var(--font-scale))", marginBottom: "var(--space-xs)", color: "var(--color-text-muted)" }}>Description</h3>
                    <p style={{ lineHeight: 1.6, whiteSpace: "pre-wrap", fontSize: "calc(0.9rem * var(--font-scale))" }}>
                        {commission.description}
                    </p>
                </div>

                {/* Details Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "var(--space-md)", marginTop: "var(--space-lg)" }}>
                    {commission.priceQuoted && (
                        <div>
                            <span style={{ fontSize: "calc(0.75rem * var(--font-scale))", color: "var(--color-text-muted)", display: "block" }}>Price Quoted</span>
                            <span style={{ fontWeight: 700, fontSize: "calc(1rem * var(--font-scale))" }}>${commission.priceQuoted}</span>
                        </div>
                    )}
                    {commission.depositAmount && (
                        <div>
                            <span style={{ fontSize: "calc(0.75rem * var(--font-scale))", color: "var(--color-text-muted)", display: "block" }}>Deposit</span>
                            <span style={{ fontWeight: 700 }}>
                                ${commission.depositAmount}
                                {commission.depositPaid ? " ✅" : " ⏳"}
                            </span>
                        </div>
                    )}
                    {commission.estimatedCompletion && (
                        <div>
                            <span style={{ fontSize: "calc(0.75rem * var(--font-scale))", color: "var(--color-text-muted)", display: "block" }}>Est. Completion</span>
                            <span style={{ fontWeight: 600 }}>
                                {new Date(commission.estimatedCompletion).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                        </div>
                    )}
                    {commission.slotNumber && (
                        <div>
                            <span style={{ fontSize: "calc(0.75rem * var(--font-scale))", color: "var(--color-text-muted)", display: "block" }}>Slot</span>
                            <span style={{ fontWeight: 700 }}>#{commission.slotNumber}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Link Horse (for artist when no horse is linked) */}
            {!isGuestMode && !commission.horseId && isArtist && (
                <LinkHorseToCommission commissionId={commission.id} />
            )}

            {/* Guest Link (for artist) */}
            {!isGuestMode && isArtist && (commission as unknown as { guest_token?: string }).guest_token && (
                <div style={{ marginBottom: "var(--space-md)" }}>
                    <GuestLinkButton commissionId={commission.id} guestToken={(commission as unknown as { guest_token: string }).guest_token} />
                </div>
            )}

            {/* Timeline */}
            <CommissionTimeline
                commissionId={commissionId}
                updates={updates}
                isArtist={isArtist}
                isClient={isClient}
                commissionStatus={commission.status}
            />

            {/* Review Prompt (after delivery) */}
            {transactionId && targetId && (
                <div className="animate-fade-in-up" style={{ marginTop: "var(--space-lg)" }}>
                    <RatingForm
                        transactionId={transactionId}
                        targetId={targetId}
                        targetAlias={targetAlias}
                        existingRating={existingRating}
                    />
                </div>
            )}

            {/* Navigation */}
            <div style={{ display: "flex", gap: "var(--space-sm)", marginTop: "var(--space-lg)", flexWrap: "wrap" }}>
                {isArtist && (
                    <Link href="/studio/dashboard" className="btn btn-ghost">← Dashboard</Link>
                )}
                {isClient && (
                    <Link href="/studio/my-commissions" className="btn btn-ghost">← My Commissions</Link>
                )}
            </div>
        </div>
    );
}
