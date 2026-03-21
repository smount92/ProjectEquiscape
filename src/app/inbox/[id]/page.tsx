import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import ChatThread from "@/components/ChatThread";
import RatingForm from "@/components/RatingForm";
import TransactionActions from "@/components/TransactionActions";
import OfferCard from "@/components/OfferCard";
import BlockButton from "@/components/BlockButton";
import { isBlocked as checkIsBlocked } from "@/app/actions/blocks";
import { getTransactionByConversation } from "@/app/actions/transactions";
import { getPublicImageUrls } from "@/lib/utils/storage";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return {
        title: `Conversation — Model Horse Hub`,
        description: `Private message thread ${id}.`,
    };
}

export const dynamic = "force-dynamic";

interface ConversationData {
    id: string;
    buyer_id: string;
    seller_id: string;
    horse_id: string | null;
}

interface MessageRow {
    id: string;
    sender_id: string;
    content: string;
    is_read: boolean;
    created_at: string;
}

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: conversationId } = await params;
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    // Fetch conversation (RLS ensures user is buyer or seller)
    const { data: conversation } = await supabase
        .from("conversations")
        .select("id, buyer_id, seller_id, horse_id, transaction_status")
        .eq("id", conversationId)
        .single<ConversationData & { transaction_status: string }>();

    if (!conversation) notFound();

    // Get the other user's alias
    const otherId = conversation.buyer_id === user.id ? conversation.seller_id : conversation.buyer_id;

    const { data: otherUser } = await supabase
        .from("users")
        .select("alias_name")
        .eq("id", otherId)
        .single<{ alias_name: string }>();

    const otherAlias = otherUser?.alias_name ?? "Unknown";

    // Check block status for this conversation partner
    const isBlockedUser = await checkIsBlocked(otherId);

    // ── Trust Signals ──
    // Account age
    const { data: otherProfile } = await supabase
        .from("users")
        .select("created_at")
        .eq("id", otherId)
        .single<{ created_at: string }>();

    const memberSince = otherProfile?.created_at
        ? new Date(otherProfile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
        : null;

    // Completed transfers count
    const { count: transferCount } = await supabase
        .from("horse_transfers")
        .select("id", { count: "exact", head: true })
        .eq("status", "claimed")
        .or(`sender_id.eq.${otherId},claimed_by.eq.${otherId}`);

    // Average rating (from universal reviews table)
    const { data: reviewsData } = await supabase.from("reviews").select("stars").eq("target_id", otherId);
    const ratingsArr = (reviewsData ?? []) as { stars: number }[];
    const avgRating =
        ratingsArr.length > 0
            ? Math.round((ratingsArr.reduce((s, r) => s + r.stars, 0) / ratingsArr.length) * 10) / 10
            : null;

    // Get horse context if present
    let horseContext: {
        id: string;
        name: string;
        tradeStatus: string;
        price: number | null;
        thumbnailUrl: string | null;
        refLine: string | null;
    } | null = null;

    if (conversation.horse_id) {
        const { data: horse } = await supabase
            .from("user_horses")
            .select(
                `
                id, custom_name, trade_status, listing_price,
                catalog_items:catalog_id(title, maker),
                horse_images(image_url, angle_profile)
            `,
            )
            .eq("id", conversation.horse_id)
            .single<{
                id: string;
                custom_name: string;
                trade_status: string;
                listing_price: number | null;
                catalog_items: { title: string; maker: string } | null;
                horse_images: { image_url: string; angle_profile: string }[];
            }>();

        if (horse) {
            // Get thumbnail (Primary_Thumbnail or first image)
            const thumb = horse.horse_images?.find((img) => img.angle_profile === "Primary_Thumbnail");
            const firstImg = horse.horse_images?.[0];
            const imgPath = thumb?.image_url || firstImg?.image_url;

            // Sign the URL
            let signedThumb: string | null = null;
            if (imgPath) {
                const urlMap = getPublicImageUrls([imgPath]);
                signedThumb = urlMap.get(imgPath) || null;
            }

            horseContext = {
                id: horse.id,
                name: horse.custom_name,
                tradeStatus: horse.trade_status,
                price: horse.listing_price,
                thumbnailUrl: signedThumb,
                refLine: horse.catalog_items ? `${horse.catalog_items.maker} — ${horse.catalog_items.title}` : null,
            };
        }
    }

    // Fetch all messages
    const { data: rawMessages } = await supabase
        .from("messages")
        .select("id, sender_id, content, is_read, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

    const messages = (rawMessages as MessageRow[]) ?? [];

    // Mark unread messages as read (server-side)
    const unreadIds = messages.filter((m) => m.sender_id !== user.id && !m.is_read).map((m) => m.id);

    if (unreadIds.length > 0) {
        await supabase.from("messages").update({ is_read: true }).in("id", unreadIds);
    }

    const isBuyer = conversation.buyer_id === user.id;

    const txn = await getTransactionByConversation(conversationId);
    const transactionId = txn?.transactionId ?? null;
    const hasCommerceTransaction = !!txn; // Any Safe-Trade transaction exists

    // Check if user has already reviewed via the new reviews table
    let existingRating: { id: string; stars: number; reviewText: string | null; createdAt: string } | null = null;
    if (transactionId) {
        const { data: rawReview } = await supabase
            .from("reviews")
            .select("id, stars, content, created_at")
            .eq("transaction_id", transactionId)
            .eq("reviewer_id", user.id)
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

    // Check for completed transfer between these two users (trust signal)
    const { count: mutualTransfers } = await supabase
        .from("horse_transfers")
        .select("id", { count: "exact", head: true })
        .eq("status", "claimed")
        .or(
            `and(sender_id.eq.${user.id},claimed_by.eq.${otherId}),and(sender_id.eq.${otherId},claimed_by.eq.${user.id})`,
        );

    return (
        <div className="h-[calc(100vh - 70px)] max-h-[calc(100vh - 70px)] mx-auto flex max-w-[var(--max-width)] flex-col overflow-hidden px-6 py-[0]">
            {/* Header */}
            <div className="bg-glass border-edge animate-fade-in-up mb-4 flex shrink-0 items-center gap-4 rounded-lg border px-6 py-4">
                <Link
                    href="/inbox"
                    className="bg-[rgba(0, 0, 0, 0.05)] text-muted flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full no-underline transition-all"
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
                <div className="bg-glass border-edge shrink-0-info mb-4 flex items-center gap-4 rounded-lg border px-6 py-4">
                    <div className="bg-glass border-edge shrink-0-alias mb-4 flex items-center gap-4 rounded-lg border px-6 py-4">
                        <Link href={`/profile/${encodeURIComponent(otherAlias)}`}>@{otherAlias}</Link>
                        <span className="bg-[rgba(44, 85, 69, 0.1)] rounded-full px-[8px] py-[2px] text-xs font-medium text-[#2C5545]">
                            {isBuyer ? "Seller" : "Buyer"}
                        </span>
                    </div>
                    {horseContext ? (
                        <span className="text-muted mt-0.5 text-xs">🐴 Re: {horseContext.name}</span>
                    ) : (
                        <span className="text-muted mt-0.5 text-xs opacity-70">💬 Direct Message</span>
                    )}
                </div>

                {/* Trust Signals */}
                <div className="mt-0.5 flex flex-wrap gap-1">
                    {memberSince && (
                        <span
                            className="border-edge text-muted inline-flex items-center gap-[3px] rounded-sm border bg-[var(--color-bg-elevated)] px-2 py-0.5 text-[calc(0.65rem*var(--font-scale))] whitespace-nowrap"
                            title="Account age"
                        >
                            📅 Member since {memberSince}
                        </span>
                    )}
                    <span
                        className="border-edge text-muted inline-flex items-center gap-[3px] rounded-sm border bg-[var(--color-bg-elevated)] px-2 py-0.5 text-[calc(0.65rem*var(--font-scale))] whitespace-nowrap"
                        title="Completed Hoofprint transfers"
                    >
                        📦 {transferCount || 0} transfer{transferCount !== 1 ? "s" : ""}
                    </span>
                    {avgRating !== null && (
                        <span
                            className="border-edge text-muted inline-flex items-center gap-[3px] rounded-sm border bg-[var(--color-bg-elevated)] px-2 py-0.5 text-[calc(0.65rem*var(--font-scale))] whitespace-nowrap"
                            title="Average user rating"
                        >
                            ⭐ {avgRating} ({ratingsArr.length})
                        </span>
                    )}
                </div>
                <div className="bg-glass border-edge shrink-0-badge mb-4 flex items-center gap-4 rounded-lg border px-6 py-4">
                    <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    Private &amp; Secure
                </div>
                <BlockButton targetId={otherId} targetAlias={otherAlias} initialBlocked={isBlockedUser} />
            </div>

            {/* Horse Context Card — visual banner for horse-linked conversations */}
            {horseContext && (
                <Link
                    href={`/community/${horseContext.id}`}
                    className="group bg-[var(--color-bg-bg-card border-edge transition-all)] border-edge text-ink hover:border-forest animate-fade-in-up mb-4 flex items-center gap-4 rounded-lg border p-4 p-12 no-underline shadow-md transition-all hover:-translate-y-px hover:bg-[var(--color-bg-card-hover)] hover:shadow-md max-[480px]:rounded-[var(--radius-md)]"
                    id="chat-horse-link"
                >
                    {horseContext.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={horseContext.thumbnailUrl}
                            alt={horseContext.name}
                            className="h-14 w-14 shrink-0 rounded-md object-cover"
                        />
                    ) : (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-[var(--color-bg-input)] object-cover text-2xl">
                            🐴
                        </div>
                    )}
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="overflow-hidden text-sm font-bold text-ellipsis whitespace-nowrap">
                            {horseContext.name}
                        </span>
                        {horseContext.refLine && (
                            <span className="text-muted overflow-hidden text-xs text-ellipsis whitespace-nowrap">
                                {horseContext.refLine}
                            </span>
                        )}
                        {horseContext.tradeStatus !== "Not for Sale" && (
                            <span
                                className={`inline-flex w-fit items-center gap-[3px] rounded-full px-2 py-0.5 text-[calc(0.7rem*var(--font-scale))] font-bold ${
                                    horseContext.tradeStatus === "For Sale"
                                        ? "bg-[rgba(34,197,94,0.12)] text-[#22c55e]"
                                        : "bg-[rgba(59,130,246,0.12)] text-[#3b82f6]"
                                }`}
                            >
                                {horseContext.tradeStatus === "For Sale" ? "💲" : "🤝"}{" "}
                                {horseContext.price
                                    ? `$${horseContext.price.toLocaleString("en-US")}`
                                    : horseContext.tradeStatus}
                            </span>
                        )}
                    </div>
                    <span className="text-muted group-hover:text-forest shrink-0 text-[1.1rem] transition-transform group-hover:translate-x-[3px]">
                        →
                    </span>
                </Link>
            )}

            {/* Offer Card — Commerce State Machine (show for ALL transaction states) */}
            {txn && <OfferCard transaction={txn} currentUserId={user.id} />}

            {/* Chat Thread (Client Component) */}
            <ChatThread
                conversationId={conversationId}
                currentUserId={user.id}
                otherAlias={otherAlias}
                initialMessages={messages.map((m) => ({
                    id: m.id,
                    senderId: m.sender_id,
                    content: m.content,
                    createdAt: m.created_at,
                    isMe: m.sender_id === user.id,
                }))}
            />

            {/* Transaction Actions — only show legacy flow if NO Safe-Trade transaction exists */}
            {!hasCommerceTransaction && (
                <TransactionActions
                    conversationId={conversationId}
                    initialStatus={conversation.transaction_status || "open"}
                    hasRating={!!existingRating}
                />
            )}

            {/* Rating Form — only show if a transaction exists (conversation marked complete) */}
            {transactionId && (
                <RatingForm
                    transactionId={transactionId}
                    targetId={otherId}
                    targetAlias={otherAlias}
                    existingRating={existingRating}
                    hasVerifiedTransfer={(mutualTransfers || 0) > 0}
                />
            )}
        </div>
    );
}
