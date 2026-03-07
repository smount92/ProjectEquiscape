import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import ChatThread from "@/components/ChatThread";

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
        .select("id, buyer_id, seller_id, horse_id")
        .eq("id", conversationId)
        .single<ConversationData>();

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
        </div>
    );
}
