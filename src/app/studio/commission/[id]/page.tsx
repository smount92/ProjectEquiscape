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
    shipping: "#0ea5e9",
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
        const {
            data: { user },
        } = await supabase.auth.getUser();
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
    const targetAlias = isArtist ? commission.clientAlias || "Client" : commission.artistAlias;

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
        <div className="mx-auto max-w-[var(--max-width)] px-6 py-[0]">
            {/* Header */}
            <div className="bg-card border-edge animate-fade-in-up mb-6 rounded-lg border p-6 p-12 shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]">
                <div className="items-start justify-between gap-4" style={{ display: "flex", flexWrap: "wrap" }}>
                    <div>
                        <h1 className="m-0 text-[calc(1.3rem*var(--font-scale))]">{commission.commissionType}</h1>
                        <div
                            className="text-muted mt-1 gap-4 text-[calc(0.85rem*var(--font-scale))]"
                            style={{ display: "flex" }}
                        >
                            {isArtist && commission.clientAlias && <span>👤 Client: @{commission.clientAlias}</span>}
                            {isClient && <span>🎨 Artist: @{commission.artistAlias}</span>}
                            <span>
                                📅{" "}
                                {new Date(commission.createdAt).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                })}
                            </span>
                        </div>
                    </div>
                    <span
                        className="inline-flex items-center rounded-full px-[10px] py-[3px] text-[calc(0.7rem*var(--font-scale))] font-semibold whitespace-nowrap"
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
                <div className="bg-card mt-6 rounded-md p-4">
                    <h3 className="text-muted mb-1 text-[calc(0.85rem*var(--font-scale))]">Description</h3>
                    <p className="text-[calc(0.9rem*var(--font-scale))] leading-[1.6] whitespace-pre-wrap">
                        {commission.description}
                    </p>
                </div>

                {/* Details Grid */}
                <div
                    className="grid-cols-[repeat(auto-fit, minmax(150px, 1fr))] mt-6 gap-4"
                    style={{ display: "grid" }}
                >
                    {commission.priceQuoted && (
                        <div>
                            <span
                                className="text-muted text-[calc(0.75rem*var(--font-scale))]"
                                style={{ display: "block" }}
                            >
                                Price Quoted
                            </span>
                            <span className="text-[calc(1rem*var(--font-scale))] font-bold">
                                ${commission.priceQuoted}
                            </span>
                        </div>
                    )}
                    {commission.depositAmount && (
                        <div>
                            <span
                                className="text-muted text-[calc(0.75rem*var(--font-scale))]"
                                style={{ display: "block" }}
                            >
                                Deposit
                            </span>
                            <span className="font-bold">
                                ${commission.depositAmount}
                                {commission.depositPaid ? " ✅" : " ⏳"}
                            </span>
                        </div>
                    )}
                    {commission.estimatedCompletion && (
                        <div>
                            <span
                                className="text-muted text-[calc(0.75rem*var(--font-scale))]"
                                style={{ display: "block" }}
                            >
                                Est. Completion
                            </span>
                            <span className="font-semibold">
                                {new Date(commission.estimatedCompletion).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                })}
                            </span>
                        </div>
                    )}
                    {commission.slotNumber && (
                        <div>
                            <span
                                className="text-muted text-[calc(0.75rem*var(--font-scale))]"
                                style={{ display: "block" }}
                            >
                                Slot
                            </span>
                            <span className="font-bold">#{commission.slotNumber}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Link Horse (for artist when no horse is linked) */}
            {!isGuestMode && !commission.horseId && isArtist && <LinkHorseToCommission commissionId={commission.id} />}

            {/* Guest Link (for artist) */}
            {!isGuestMode && isArtist && commission.guestToken && (
                <div className="mb-4">
                    <GuestLinkButton commissionId={commission.id} guestToken={commission.guestToken} />
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
                <div className="animate-fade-in-up mt-6">
                    <RatingForm
                        transactionId={transactionId}
                        targetId={targetId}
                        targetAlias={targetAlias}
                        existingRating={existingRating}
                    />
                </div>
            )}

            {/* Navigation */}
            <div className="mt-6 gap-2" style={{ display: "flex", flexWrap: "wrap" }}>
                {isArtist && (
                    <Link
                        href="/studio/dashboard"
                        className="hover:no-underline-min-h)] text-ink-light border-edge inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] bg-transparent px-8 py-2 font-sans text-base leading-none font-semibold no-underline transition-all duration-150"
                    >
                        ← Dashboard
                    </Link>
                )}
                {isClient && (
                    <Link
                        href="/studio/my-commissions"
                        className="hover:no-underline-min-h)] text-ink-light border-edge inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] bg-transparent px-8 py-2 font-sans text-base leading-none font-semibold no-underline transition-all duration-150"
                    >
                        ← My Commissions
                    </Link>
                )}
            </div>
        </div>
    );
}
