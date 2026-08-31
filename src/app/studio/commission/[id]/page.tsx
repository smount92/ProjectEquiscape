import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getCommission, getCommissionUpdates } from "@/app/actions/art-studio";
import GuestLinkButton from "@/components/GuestLinkButton";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import PageMasthead from "@/components/layouts/PageMasthead";
import RatingForm from "@/components/RatingForm";
import ArtistControls from "@/components/studio/ArtistControls";
import CommissionActions from "@/components/studio/CommissionActions";
import {
    CommissionPill,
    LedgerRow,
    OffPlatformNote,
    Panel,
} from "@/components/studio/StudioBits";
import VaultHandoff from "@/components/studio/VaultHandoff";
import WipThread from "@/components/studio/WipThread";
import WorkbenchLedger from "@/components/studio/WorkbenchLedger";
import { createClient } from "@/lib/supabase/server";
import { progress, revisionState, type Party } from "@/lib/studio/pipeline";
import { formatMoney, termsLines, turnaroundLabel } from "@/lib/studio/terms";

export const metadata: Metadata = {
    title: "Commission",
    robots: { index: false },
};

/**
 * The commission room — one page holding the whole agreement.
 *
 * Both sides see the same record: what was asked for, what was quoted,
 * what was agreed and when, how many revisions have been spent, and every
 * progress update. Neither side can rewrite it (migration 170's
 * immutability trigger), which is what makes it worth pointing at.
 *
 * Guest mode survives from v1 and is genuinely good: an artist can share
 * a commission with a client who isn't on the platform, read-only.
 */
export default async function CommissionPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ token?: string }>;
}) {
    const { id: commissionId } = await params;
    const { token } = await searchParams;
    const supabase = await createClient();

    let isGuest = false;
    let userId: string | null = null;

    if (token) {
        // Token validation happens inside getCommission via the admin
        // client — the old user-client lookup here always came back
        // empty for logged-out guests (RLS is TO authenticated) and the
        // share link 404'd for the exact audience it was built for.
        isGuest = true;
    } else {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) redirect(`/login?redirectTo=%2Fstudio%2Fcommission%2F${commissionId}`);
        userId = user.id;
    }

    const commission = await getCommission(commissionId, isGuest ? { guestToken: token } : undefined);
    if (!commission) notFound();

    let party: Party | null = null;
    if (!isGuest && userId) {
        party =
            commission.artistId === userId
                ? "artist"
                : commission.clientId === userId
                  ? "client"
                  : null;
        if (!party) notFound();
    }

    const updates = await getCommissionUpdates(commissionId, isGuest ? { guestToken: token } : undefined);
    const isArtist = party === "artist";
    const isClient = party === "client";
    const revisions = revisionState(commission.revisionsUsed, commission.revisionsIncluded);
    const snapshot = commission.termsSnapshot;

    // Reviews unlock on delivery — the transaction is written by the
    // delivery hook, and each side rates the other.
    let transactionId: string | null = null;
    let existingRating: {
        id: string;
        stars: number;
        reviewText: string | null;
        createdAt: string;
    } | null = null;
    const targetId = isArtist ? commission.clientId : commission.artistId;
    const targetAlias = isArtist
        ? (commission.clientAlias ?? "the commissioner")
        : commission.artistAlias;

    if (!isGuest && (commission.status === "delivered" || commission.status === "received") && targetId && userId) {
        const { data: txn } = await supabase
            .from("transactions")
            .select("id")
            .eq("commission_id", commissionId)
            .eq("type", "commission")
            .maybeSingle();
        if (txn) {
            transactionId = (txn as { id: string }).id;
            const { data: review } = await supabase
                .from("reviews")
                .select("id, stars, content, created_at")
                .eq("transaction_id", transactionId)
                .eq("reviewer_id", userId)
                .maybeSingle();
            if (review) {
                const rv = review as {
                    id: string;
                    stars: number;
                    content: string | null;
                    created_at: string;
                };
                existingRating = {
                    id: rv.id,
                    stars: rv.stars,
                    reviewText: rv.content,
                    createdAt: rv.created_at,
                };
            }
        }
    }

    const counterparty = isArtist
        ? `@${commission.clientAlias ?? "guest"}`
        : `@${commission.artistAlias}`;

    return (
        <ExplorerLayout noHeader>
            <PageMasthead
                compact
                icon="📜"
                title={commission.commissionType}
                subtitle={
                    isGuest
                        ? `Shared by @${commission.artistAlias}`
                        : `${isArtist ? "For" : "With"} ${counterparty}`
                }
                backHref={isArtist ? "/studio/dashboard" : "/studio/my-commissions"}
                backLabel={isArtist ? "Dashboard" : "My commissions"}
                actions={
                    isArtist && commission.guestToken ? (
                        <GuestLinkButton
                            commissionId={commission.id}
                            guestToken={commission.guestToken}
                        />
                    ) : null
                }
            />

            {/* ── Where it stands ── */}
            <div className="border-input bg-card mb-6 rounded-lg border p-6 shadow-md">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                    <CommissionPill status={commission.status} />
                    {commission.isWaitlist && commission.status === "requested" && (
                        <span className="text-muted-foreground text-xs">waitlist request</span>
                    )}
                    {commission.modelReceived && (
                        <span className="text-muted-foreground text-xs">📦 model received</span>
                    )}
                    <span className="text-muted-foreground ml-auto text-xs">
                        Opened{" "}
                        {new Date(commission.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                        })}
                    </span>
                </div>

                <div
                    className="bg-muted h-1.5 overflow-hidden rounded-full"
                    role="progressbar"
                    aria-valuenow={Math.round(progress(commission.status) * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Commission progress"
                >
                    <div
                        className="bg-studio h-full rounded-full transition-all"
                        style={{ width: `${Math.max(4, progress(commission.status) * 100)}%` }}
                    />
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                <div className="grid gap-6">
                    {party && <CommissionActions commission={commission} party={party} />}

                    {/* The vault hand-off, at the moment the commissioner
                        knows the number and cares about it. */}
                    {isClient &&
                        (commission.status === "completed" ||
                            commission.status === "delivered" ||
                            commission.status === "received") && (
                            <VaultHandoff
                                commissionId={commission.id}
                                horseId={commission.horseId}
                                horseName={null}
                                price={commission.agreedPrice}
                                alreadyRecorded={commission.vaultRecorded}
                            />
                        )}

                    <WorkbenchLedger commission={commission} updates={updates} />

                    <WipThread
                        commissionId={commission.id}
                        updates={updates}
                        party={party}
                        canPost={!!party && commission.status !== "declined"}
                    />

                    {transactionId && targetId && (
                        <Panel title={`Rate ${targetAlias}`} icon="⭐">
                            <RatingForm
                                transactionId={transactionId}
                                targetId={targetId}
                                targetAlias={targetAlias}
                                existingRating={existingRating}
                            />
                        </Panel>
                    )}
                </div>

                <div className="grid gap-6">
                    {/* ── The brief ── */}
                    <Panel title="The brief" icon="📝">
                        <p className="text-secondary-foreground m-0 text-sm leading-relaxed whitespace-pre-wrap">
                            {commission.description}
                        </p>

                        {commission.referenceImages.length > 0 && (
                            <div className="mt-4">
                                <span className="text-muted-foreground mb-2 block text-xs font-semibold">
                                    References
                                </span>
                                <div className="flex flex-wrap gap-2">
                                    {commission.referenceImages.map((url, i) => (
                                        <a
                                            key={url}
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="border-input block h-20 w-20 overflow-hidden rounded-md border"
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={url}
                                                alt={`Reference ${i + 1}`}
                                                loading="lazy"
                                                className="h-full w-full object-cover"
                                            />
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="mt-4 grid">
                            {commission.serviceScale && (
                                <LedgerRow label="Scale" value={commission.serviceScale} />
                            )}
                            {commission.budgetAmount != null && (
                                <LedgerRow
                                    label="Their budget"
                                    value={formatMoney(commission.budgetAmount)}
                                />
                            )}
                            {commission.horseId && (
                                <LedgerRow
                                    label="Horse"
                                    value={
                                        <Link
                                            href={`/community/${commission.horseId}`}
                                            className="text-forest hover:underline"
                                        >
                                            View passport →
                                        </Link>
                                    }
                                />
                            )}
                        </div>
                    </Panel>

                    {/* ── The agreement ── */}
                    <Panel
                        title={commission.acceptedAt ? "The agreement" : "The quote"}
                        icon="🤝"
                    >
                        {commission.agreedPrice == null ? (
                            <p className="text-muted-foreground m-0 text-sm">
                                No quote yet.{" "}
                                {isArtist
                                    ? "Send one and the commissioner decides."
                                    : "The artist will send one."}
                            </p>
                        ) : (
                            <>
                                <div className="grid">
                                    <LedgerRow
                                        label={commission.acceptedAt ? "Agreed price" : "Quoted"}
                                        value={formatMoney(commission.agreedPrice)}
                                    />
                                    {commission.depositAmount != null && (
                                        <LedgerRow
                                            label="Deposit"
                                            value={formatMoney(commission.depositAmount)}
                                            hint={commission.depositPaid ? "received" : "unpaid"}
                                        />
                                    )}
                                    {commission.estimatedCompletion && (
                                        <LedgerRow
                                            label="Estimated completion"
                                            value={commission.estimatedCompletion}
                                        />
                                    )}
                                    {commission.revisionsIncluded > 0 && (
                                        <LedgerRow
                                            label="Revisions"
                                            value={revisions.label}
                                        />
                                    )}
                                    {commission.acceptedAt && (
                                        <LedgerRow
                                            label="Agreed on"
                                            value={new Date(
                                                commission.acceptedAt,
                                            ).toLocaleDateString("en-US", {
                                                month: "short",
                                                day: "numeric",
                                                year: "numeric",
                                            })}
                                        />
                                    )}
                                </div>

                                {commission.quoteNote && (
                                    <p className="text-secondary-foreground mt-4 text-sm leading-relaxed whitespace-pre-wrap">
                                        {commission.quoteNote}
                                    </p>
                                )}

                                {/* The frozen terms. The artist may have
                                    changed their studio terms since; these
                                    are the ones that were agreed. */}
                                {snapshot && (
                                    <div className="border-input mt-4 border-t pt-4">
                                        <div className="text-muted-foreground mb-2 text-xs font-semibold">
                                            TERMS AS AGREED
                                            {snapshot.snapshotAt && (
                                                <>
                                                    {" · "}
                                                    {new Date(
                                                        snapshot.snapshotAt,
                                                    ).toLocaleDateString("en-US", {
                                                        month: "short",
                                                        day: "numeric",
                                                        year: "numeric",
                                                    })}
                                                </>
                                            )}
                                        </div>
                                        <div className="grid">
                                            {termsLines(snapshot).map((line) => (
                                                <LedgerRow
                                                    key={line.label}
                                                    label={line.label}
                                                    value={line.value}
                                                />
                                            ))}
                                            <LedgerRow
                                                label="Turnaround"
                                                value={turnaroundLabel(snapshot)}
                                            />
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        <div className="border-input mt-4 border-t pt-4">
                            <OffPlatformNote />
                        </div>
                    </Panel>

                    {commission.closeReason && (
                        <Panel title="Why it ended" icon="📕">
                            <p className="text-secondary-foreground m-0 text-sm leading-relaxed whitespace-pre-wrap">
                                {commission.closeReason}
                            </p>
                        </Panel>
                    )}

                    {isArtist && <ArtistControls commission={commission} />}
                </div>
            </div>

            {isGuest && (
                <div className="border-input bg-card/60 mt-8 rounded-lg border p-6 text-xs leading-relaxed backdrop-blur-sm">
                    <p className="m-0">
                        You&rsquo;re viewing this commission through a share link from @
                        {commission.artistAlias}. It&rsquo;s read-only.{" "}
                        <Link href="/signup" className="text-forest hover:underline">
                            A free Model Horse Hub account
                        </Link>{" "}
                        lets you approve work, request revisions and keep the record.
                    </p>
                </div>
            )}
        </ExplorerLayout>
    );
}
