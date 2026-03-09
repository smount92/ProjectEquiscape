import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import ChatThread from "@/components/ChatThread";
import RatingForm from "@/components/RatingForm";
import TransactionActions from "@/components/TransactionActions";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
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

export default async function ChatPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
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
    const otherId =
        conversation.buyer_id === user.id
            ? conversation.seller_id
            : conversation.buyer_id;

    const { data: otherUser } = await supabase
        .from("users")
        .select("alias_name")
        .eq("id", otherId)
        .single<{ alias_name: string }>();

    const otherAlias = otherUser?.alias_name ?? "Unknown";

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

    // Average rating
    const { data: ratingsData } = await supabase
        .from("user_ratings")
        .select("stars")
        .eq("reviewed_id", otherId);
    const ratingsArr = (ratingsData ?? []) as { stars: number }[];
    const avgRating = ratingsArr.length > 0
        ? Math.round((ratingsArr.reduce((s, r) => s + r.stars, 0) / ratingsArr.length) * 10) / 10
        : null;

    // Get horse context if present
    let horseContext: {
        id: string;
        name: string;
        tradeStatus: string;
        price: number | null;
    } | null = null;

    if (conversation.horse_id) {
        const { data: horse } = await supabase
            .from("user_horses")
            .select("id, custom_name, trade_status, listing_price")
            .eq("id", conversation.horse_id)
            .single<{
                id: string;
                custom_name: string;
                trade_status: string;
                listing_price: number | null;
            }>();

        if (horse) {
            horseContext = {
                id: horse.id,
                name: horse.custom_name,
                tradeStatus: horse.trade_status,
                price: horse.listing_price,
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
    const unreadIds = messages
        .filter((m) => m.sender_id !== user.id && !m.is_read)
        .map((m) => m.id);

    if (unreadIds.length > 0) {
        await supabase
            .from("messages")
            .update({ is_read: true })
            .in("id", unreadIds);
    }

    const isBuyer = conversation.buyer_id === user.id;

    // Check if user has already rated the other party in this conversation
    const { data: rawRating } = await supabase
        .from("user_ratings")
        .select("id, stars, review_text, created_at")
        .eq("conversation_id", conversationId)
        .eq("reviewer_id", user.id)
        .maybeSingle();

    const existingRating = rawRating ? {
        id: (rawRating as { id: string }).id,
        stars: (rawRating as { stars: number }).stars,
        reviewText: (rawRating as { review_text: string | null }).review_text,
        createdAt: (rawRating as { created_at: string }).created_at,
    } : null;

    // Check for completed transfer between these two users
    const { count: mutualTransfers } = await supabase
        .from("horse_transfers")
        .select("id", { count: "exact", head: true })
        .eq("status", "claimed")
        .or(`and(sender_id.eq.${user.id},claimed_by.eq.${otherId}),and(sender_id.eq.${otherId},claimed_by.eq.${user.id})`);

    return (
        <div className="page-container chat-page">
            {/* Header */}
            <div className="chat-header animate-fade-in-up">
                <Link href="/inbox" className="chat-back" aria-label="Back to inbox">
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
                <div className="chat-header-info">
                    <div className="chat-header-alias">
                        <Link href={`/profile/${encodeURIComponent(otherAlias)}`}>
                            @{otherAlias}
                        </Link>
                        <span className="chat-role-badge">{isBuyer ? "Seller" : "Buyer"}</span>
                    </div>
                    {horseContext && (
                        <Link
                            href={`/community/${horseContext.id}`}
                            className="chat-header-horse"
                        >
                            🐴 {horseContext.name}
                            {horseContext.tradeStatus !== "Not for Sale" && (
                                <span
                                    className={`inbox-item-status ${horseContext.tradeStatus === "For Sale"
                                        ? "status-sale"
                                        : "status-offers"
                                        }`}
                                >
                                    {horseContext.price
                                        ? `$${horseContext.price.toLocaleString("en-US")}`
                                        : horseContext.tradeStatus}
                                </span>
                            )}
                        </Link>
                    )}
                </div>

                {/* Trust Signals */}
                <div className="chat-trust-signals">
                    {memberSince && (
                        <span className="chat-trust-badge" title="Account age">
                            📅 Member since {memberSince}
                        </span>
                    )}
                    <span className="chat-trust-badge" title="Completed Hoofprint transfers">
                        📦 {transferCount || 0} transfer{transferCount !== 1 ? "s" : ""}
                    </span>
                    {avgRating !== null && (
                        <span className="chat-trust-badge" title="Average user rating">
                            ⭐ {avgRating} ({ratingsArr.length})
                        </span>
                    )}
                </div>
                <div className="chat-header-badge">
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
            </div>

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

            {/* Transaction Actions */}
            <TransactionActions
                conversationId={conversationId}
                initialStatus={conversation.transaction_status || "open"}
                hasRating={!!existingRating}
            />

            {/* Rating Form */}
            <RatingForm
                conversationId={conversationId}
                reviewedId={otherId}
                reviewedAlias={otherAlias}
                existingRating={existingRating}
                hasVerifiedTransfer={(mutualTransfers || 0) > 0}
            />
        </div>
    );
}
