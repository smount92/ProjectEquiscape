import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Calendar, MessageCircle, Package, Star } from "lucide-react";

import DealThread from "@/components/inbox/DealThread";
import ThreadActions from "@/components/inbox/ThreadActions";
import DealStrip from "@/components/deals/DealStrip";
import TermsPanel from "@/components/deals/TermsPanel";
import PaymentPlanPanel from "@/components/deals/PaymentPlanPanel";
import DealRecordPanel from "@/components/deals/DealRecordPanel";
import RatingForm from "@/components/RatingForm";
import TransactionActions from "@/components/TransactionActions";
import BlockButton from "@/components/BlockButton";

import { getConversationAttachments } from "@/app/actions/messaging";
import { loadDealRoom } from "@/app/inbox/reads";
import { agreedPrice as priceFromTerms, formatMoney } from "@/lib/deals/terms";
import { ledgerSummary } from "@/lib/deals/ledger";
import { otherParty, payerParty, roleLabel } from "@/lib/deals/vocabulary";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return {
        title: "Conversation",
        description: `Private message thread ${id}.`,
    };
}

/**
 * THE DEAL ROOM.
 *
 * Three layers stacked in one thread, exactly as the plan describes:
 *
 *   1. the pinned header — who, and what this is about;
 *   2. the deal strip — the current state in one line, with the one
 *      action available now;
 *   3. the transcript — messages AND events, in one chronological
 *      stream, where every state change leaves a permanent entry.
 *
 * A plain member-to-member DM is this same page with layers 2 and 3's
 * deal machinery simply absent: no strip, no panels, no clutter. That
 * is the requirement the owner set — the deal machinery must never make
 * ordinary chatting worse — and it is why every deal panel below is
 * behind `isDeal`.
 */
export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: conversationId } = await params;
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const room = await loadDealRoom(conversationId, user.id);
    if (!room) notFound();

    const attachmentMap = await getConversationAttachments(conversationId);

    const entries = room.entries.map((e) => ({
        ...e,
        isMine: e.senderId === user.id,
        attachments: attachmentMap[e.id] || undefined,
    }));

    const labels = room.kind
        ? { a: roleLabel(room.kind, "a"), b: roleLabel(room.kind, "b") }
        : { a: "Them", b: "You" };

    const isDeal = !!room.transaction || !!room.subject || room.terms.boxes.length > 0;
    const frozen = !!room.disputed;
    const ledger = ledgerSummary(room.installments);
    const agreed = priceFromTerms(room.terms);

    const payer = room.kind ? payerParty(room.kind) : room.transaction ? "b" : null;
    const memberSince = room.otherMemberSince
        ? new Date(room.otherMemberSince).toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
          })
        : null;

    const composerDisabledReason = room.isBlocked
        ? "You can no longer message this person."
        : null;

    const vaultMeta = room.transaction?.metadata ?? null;

    return (
        <div className="mx-auto flex min-h-[calc(100dvh-var(--header-height))] max-w-6xl flex-col px-4 md:px-8">
            {/* ── 1. The pinned header ── */}
            <div className="bg-card border-input animate-fade-in-up mb-2 flex shrink-0 flex-wrap items-center gap-3 rounded-lg border px-4 py-3 sm:mb-4 sm:gap-4 sm:px-6 sm:py-4">
                <Link
                    href="/inbox"
                    className="text-muted-foreground flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full bg-black/5 no-underline transition-all"
                    aria-label="Back to inbox"
                >
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </Link>

                <div className="flex min-w-[13rem] flex-1 basis-52 flex-col">
                    <div className="flex items-center gap-2">
                        <Link href={`/profile/${encodeURIComponent(room.otherAlias)}`}>
                            @{room.otherAlias}
                        </Link>
                        {/* The role label reads off the TRANSACTION, so a seller
                            who opened the thread is no longer called the buyer. */}
                        {room.kind && (
                            <span className="bg-success/10 text-forest rounded-full px-[8px] py-[2px] text-xs font-medium">
                                {room.otherLabel}
                            </span>
                        )}
                    </div>
                    {room.subject ? (
                        <span className="text-muted-foreground mt-0.5 text-xs">
                            🐴 Re: {room.subject.title}
                        </span>
                    ) : (
                        <span className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs opacity-70">
                            <MessageCircle className="h-3 w-3" /> Direct message
                        </span>
                    )}
                </div>

                <div className="mt-0.5 hidden flex-wrap gap-1 sm:flex">
                    {memberSince && (
                        <TrustChip title="Account age">
                            <Calendar className="h-3 w-3" /> Member since {memberSince}
                        </TrustChip>
                    )}
                    <TrustChip title="Completed Hoofprint transfers">
                        <Package className="h-3 w-3" /> {room.otherTransferCount} transfer
                        {room.otherTransferCount !== 1 ? "s" : ""}
                    </TrustChip>
                    {room.otherAvgRating !== null && (
                        <TrustChip title="Average review score">
                            <Star className="h-3 w-3 fill-current" /> {room.otherAvgRating} (
                            {room.otherRatingCount})
                        </TrustChip>
                    )}
                </div>

                <ThreadActions
                    conversationId={conversationId}
                    muted={room.muted}
                    archived={room.archived}
                    enabled={room.support.participants}
                />
                <BlockButton
                    targetId={room.otherId}
                    targetAlias={room.otherAlias}
                    initialBlocked={room.isBlocked}
                />
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
                {/* The pinned subject */}
                {room.subject && room.subject.horseId && (
                    <Link
                        href={`/community/${room.subject.horseId}`}
                        className="group border-input bg-card text-foreground animate-fade-in-up mb-2 flex shrink-0 items-center gap-4 rounded-xl border p-3 no-underline shadow-sm transition-all hover:-translate-y-px hover:shadow-md sm:mb-4 sm:p-4"
                        id="chat-horse-link"
                    >
                        {room.subject.thumbUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={room.subject.thumbUrl}
                                alt={room.subject.title}
                                className="h-10 w-10 shrink-0 rounded-md object-cover sm:h-14 sm:w-14"
                            />
                        ) : (
                            <div className="bg-card flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-xl sm:h-14 sm:w-14 sm:text-2xl">
                                🐴
                            </div>
                        )}
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="overflow-hidden text-sm font-bold text-ellipsis whitespace-nowrap">
                                {room.subject.title}
                            </span>
                            {room.subject.reference && (
                                <span className="text-muted-foreground overflow-hidden text-xs text-ellipsis whitespace-nowrap">
                                    {room.subject.reference}
                                </span>
                            )}
                            <div className="flex flex-wrap items-center gap-1.5">
                                {agreed !== null ? (
                                    <span className="border-forest/25 bg-forest/5 text-forest inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold">
                                        Agreed {formatMoney(agreed)}
                                    </span>
                                ) : room.subject.listingPrice ? (
                                    <span className="bg-success/10 text-success inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-bold">
                                        {formatMoney(room.subject.listingPrice)}
                                    </span>
                                ) : null}
                                {room.subject.tradeStatus === "Pending Sale" && (
                                    <span className="bg-info/10 text-info inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-bold">
                                        Pending sale
                                    </span>
                                )}
                            </div>
                        </div>
                        <span className="text-muted-foreground group-hover:text-forest shrink-0 text-[1.1rem] transition-transform group-hover:translate-x-[3px]">
                            →
                        </span>
                    </Link>
                )}

                {/* ── 2. The deal strip ── */}
                {room.transaction && room.stage && (
                    <DealStrip
                        conversationId={conversationId}
                        transaction={room.transaction}
                        party={room.party}
                        kind={room.kind}
                        stage={room.stage}
                        planComplete={ledger.count > 0 && ledger.allConfirmed}
                        hasPlan={ledger.count > 0}
                        frozen={frozen}
                    />
                )}

                {/* ── 3. The transcript ── */}
                <div className="min-h-[50dvh]">
                    <DealThread
                        conversationId={conversationId}
                        currentUserId={user.id}
                        currentUserAvatar={room.myAvatarUrl}
                        otherAlias={room.otherAlias}
                        otherAvatarUrl={room.otherAvatarUrl}
                        initialMessages={entries}
                        composerDisabledReason={composerDisabledReason}
                    />
                </div>

                {/* ── The contract, the ledger, the record ── */}
                {isDeal && (
                    <div className="mt-4 flex flex-col gap-4 sm:mt-6 sm:gap-6">
                        {room.support.conversationDeal ? (
                            <>
                                <TermsPanel
                                    conversationId={conversationId}
                                    terms={room.terms}
                                    party={room.party}
                                    labels={labels}
                                    readOnly={frozen}
                                    readOnlyReason={
                                        frozen
                                            ? "This deal is disputed — the terms are frozen as they stood."
                                            : null
                                    }
                                />
                                {room.support.installments && (
                                    <PaymentPlanPanel
                                        conversationId={conversationId}
                                        installments={room.installments}
                                        party={room.party}
                                        payer={payer}
                                        labels={labels}
                                        agreedPrice={agreed ?? room.transaction?.offerAmount ?? null}
                                        readOnly={frozen}
                                        readOnlyReason={
                                            frozen
                                                ? "This deal is disputed — the ledger is frozen as it stood."
                                                : null
                                        }
                                    />
                                )}
                                <DealRecordPanel
                                    conversationId={conversationId}
                                    disputed={room.disputed}
                                    canDispute={!!room.transaction}
                                    vault={{
                                        offered:
                                            room.party === "b" &&
                                            room.transaction?.status === "completed" &&
                                            !!room.subject?.horseId,
                                        alreadyFiled: !!vaultMeta?.vault_recorded_at,
                                        amount:
                                            agreed ??
                                            (typeof vaultMeta?.agreed_price === "number"
                                                ? (vaultMeta.agreed_price as number)
                                                : null) ??
                                            room.transaction?.offerAmount ??
                                            null,
                                        horseId: room.subject?.horseId ?? null,
                                        horseName: room.subject?.title ?? null,
                                    }}
                                />
                            </>
                        ) : (
                            <div className="border-input bg-muted/40 text-muted-foreground rounded-lg border p-4 text-sm leading-relaxed">
                                Agreed terms, payment plans and the exportable deal record arrive
                                with the next database update. Offers and Safe-Trade work exactly as
                                they do today until then.
                            </div>
                        )}
                    </div>
                )}

                {/* Legacy conversation-completion flow, only when no Safe-Trade row */}
                {!room.transaction && (
                    <div className="mt-4 shrink-0">
                        <TransactionActions
                            conversationId={conversationId}
                            initialStatus={room.legacyStatus}
                            hasRating={!!room.existingReview}
                        />
                    </div>
                )}

                {room.transaction && (
                    <div className="mt-4 shrink-0">
                        <RatingForm
                            transactionId={room.transaction.id}
                            targetId={room.otherId}
                            targetAlias={room.otherAlias}
                            existingRating={room.existingReview}
                            hasVerifiedTransfer={room.mutualTransfers > 0}
                        />
                    </div>
                )}

                <div className="text-muted-foreground mt-6 mb-8 text-center text-[0.65rem]">
                    Private between you and @{room.otherAlias}
                    {room.kind ? ` · you are the ${roleLabel(room.kind, room.party)}` : ""} ·{" "}
                    {room.kind
                        ? `they are the ${roleLabel(room.kind, otherParty(room.party))}`
                        : "Model Horse Hub never holds funds"}
                </div>
            </div>
        </div>
    );
}

function TrustChip({ children, title }: { children: React.ReactNode; title: string }) {
    return (
        <span
            className="border-input text-muted-foreground bg-card inline-flex items-center gap-[3px] rounded-sm border px-2 py-0.5 text-xs whitespace-nowrap"
            title={title}
        >
            {children}
        </span>
    );
}
