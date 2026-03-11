import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export const metadata = {
    title: "Inbox — Model Horse Hub",
    description: "Your private conversations with other collectors.",
};

export const dynamic = "force-dynamic";

interface ConversationRow {
    id: string;
    buyer_id: string;
    seller_id: string;
    horse_id: string | null;
    created_at: string;
    updated_at: string;
}

export default async function InboxPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    // Fetch conversations where user is buyer or seller
    const { data: rawConvos } = await supabase
        .from("conversations")
        .select("id, buyer_id, seller_id, horse_id, created_at, updated_at")
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order("updated_at", { ascending: false });

    const conversations = (rawConvos as ConversationRow[]) ?? [];

    // Collect all user IDs and horse IDs we need to look up
    const otherUserIds = new Set<string>();
    const horseIds = new Set<string>();
    const convoIds = conversations.map((c) => c.id);

    conversations.forEach((c) => {
        const otherId = c.buyer_id === user.id ? c.seller_id : c.buyer_id;
        otherUserIds.add(otherId);
        if (c.horse_id) horseIds.add(c.horse_id);
    });

    // Batch fetch user aliases
    const aliasMap = new Map<string, string>();
    if (otherUserIds.size > 0) {
        const { data: users } = await supabase
            .from("users")
            .select("id, alias_name")
            .in("id", [...otherUserIds]);
        users?.forEach((u: { id: string; alias_name: string }) => {
            aliasMap.set(u.id, u.alias_name);
        });
    }

    // Batch fetch horse names
    const horseMap = new Map<string, { name: string; tradeStatus: string }>();
    if (horseIds.size > 0) {
        const { data: horses } = await supabase
            .from("user_horses")
            .select("id, custom_name, trade_status")
            .in("id", [...horseIds]);
        horses?.forEach(
            (h: { id: string; custom_name: string; trade_status: string }) => {
                horseMap.set(h.id, { name: h.custom_name, tradeStatus: h.trade_status });
            }
        );
    }

    // Fetch latest message per conversation + unread counts
    interface LatestMsg {
        conversation_id: string;
        content: string;
        sender_id: string;
        created_at: string;
        is_read: boolean;
    }

    const latestMessageMap = new Map<
        string,
        { content: string; senderIsMe: boolean; createdAt: string }
    >();
    const unreadCountMap = new Map<string, number>();

    if (convoIds.length > 0) {
        // Get all messages for these convos — we'll process in JS
        const { data: allMessages } = await supabase
            .from("messages")
            .select("conversation_id, content, sender_id, created_at, is_read")
            .in("conversation_id", convoIds)
            .order("created_at", { ascending: false });

        const messages = (allMessages as LatestMsg[]) ?? [];

        // Track latest message per convo
        const seen = new Set<string>();
        for (const msg of messages) {
            if (!seen.has(msg.conversation_id)) {
                seen.add(msg.conversation_id);
                latestMessageMap.set(msg.conversation_id, {
                    content: msg.content,
                    senderIsMe: msg.sender_id === user.id,
                    createdAt: msg.created_at,
                });
            }
            // Count unread
            if (msg.sender_id !== user.id && !msg.is_read) {
                unreadCountMap.set(
                    msg.conversation_id,
                    (unreadCountMap.get(msg.conversation_id) ?? 0) + 1
                );
            }
        }
    }

    // Check which conversations the user has rated (via reviews on linked transactions)
    const ratedConvoIds = new Set<string>();
    if (convoIds.length > 0) {
        // Look up transactions linked to these conversations
        const { data: txns } = await supabase
            .from("transactions")
            .select("id, metadata")
            .or(
                convoIds.map(cid => `metadata->>conversation_id.eq.${cid}`).join(",")
            );

        if (txns && txns.length > 0) {
            const txnIds = (txns as { id: string; metadata: Record<string, unknown> }[]).map(t => t.id);
            const { data: reviews } = await supabase
                .from("reviews")
                .select("transaction_id")
                .eq("reviewer_id", user.id)
                .in("transaction_id", txnIds);

            if (reviews) {
                const reviewedTxnIds = new Set(reviews.map((r: { transaction_id: string }) => r.transaction_id));
                for (const txn of txns as { id: string; metadata: Record<string, unknown> }[]) {
                    if (reviewedTxnIds.has(txn.id) && txn.metadata?.conversation_id) {
                        ratedConvoIds.add(txn.metadata.conversation_id as string);
                    }
                }
            }
        }
    }

    // Build display data
    const inboxItems = conversations.map((c) => {
        const otherId = c.buyer_id === user.id ? c.seller_id : c.buyer_id;
        const otherAlias = aliasMap.get(otherId) ?? "Unknown";
        const horse = c.horse_id ? horseMap.get(c.horse_id) : null;
        const latest = latestMessageMap.get(c.id);
        const unreadCount = unreadCountMap.get(c.id) ?? 0;
        const isBuyer = c.buyer_id === user.id;

        return {
            id: c.id,
            otherAlias,
            otherId,
            horseName: horse?.name ?? null,
            horseTradeStatus: horse?.tradeStatus ?? null,
            isBuyer,
            latestMessage: latest?.content ?? null,
            latestSenderIsMe: latest?.senderIsMe ?? false,
            latestTime: latest?.createdAt ?? c.created_at,
            unreadCount,
            isRated: ratedConvoIds.has(c.id),
        };
    });

    function timeAgo(dateStr: string): string {
        const seconds = Math.floor(
            (Date.now() - new Date(dateStr).getTime()) / 1000
        );
        if (seconds < 60) return "Just now";
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 30) return `${days}d ago`;
        return new Date(dateStr).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
        });
    }

    return (
        <div className="page-container form-page">
            <div className="animate-fade-in-up">
                <div className="shelf-header">
                    <div>
                        <h1>
                            <span className="text-gradient">✉️ Inbox</span>
                        </h1>
                        <p
                            style={{
                                color: "var(--color-text-muted)",
                                marginTop: "var(--space-xs)",
                            }}
                        >
                            Your private conversations —{" "}
                            {inboxItems.length} thread{inboxItems.length !== 1 ? "s" : ""}
                        </p>
                    </div>
                    <Link href="/community" className="btn btn-primary" id="browse-showring">
                        🏆 Browse Show Ring
                    </Link>
                </div>

                {inboxItems.length === 0 ? (
                    <div className="card shelf-empty animate-fade-in-up">
                        <div className="shelf-empty-icon">✉️</div>
                        <h2>Your Inbox is Empty</h2>
                        <p>
                            Browse the Show Ring and message sellers about models you&apos;re interested in!
                        </p>
                        <Link href="/community" className="btn btn-primary">
                            🏆 Browse the Show Ring
                        </Link>
                    </div>
                ) : (
                    <div className="inbox-list animate-fade-in-up">
                        {inboxItems.map((item) => (
                            <Link
                                key={item.id}
                                href={`/inbox/${item.id}`}
                                className={`inbox-item ${item.unreadCount > 0 ? "inbox-item-unread" : ""}`}
                                id={`inbox-item-${item.id}`}
                            >
                                <div className="inbox-item-avatar">
                                    <svg
                                        width="24"
                                        height="24"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                    >
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                        <circle cx="12" cy="7" r="4" />
                                    </svg>
                                </div>
                                <div className="inbox-item-info">
                                    <div className="inbox-item-top">
                                        <span className="inbox-item-alias">@{item.otherAlias}</span>
                                        {item.isRated && (
                                            <span className="inbox-item-rated">⭐ Rated</span>
                                        )}
                                        <span className="inbox-item-time">
                                            {timeAgo(item.latestTime)}
                                        </span>
                                    </div>
                                    {item.horseName && (
                                        <div className="inbox-item-horse">
                                            🐴 Re: {item.horseName}
                                            {item.horseTradeStatus &&
                                                item.horseTradeStatus !== "Not for Sale" && (
                                                    <span
                                                        className={`inbox-item-status ${item.horseTradeStatus === "For Sale"
                                                            ? "status-sale"
                                                            : "status-offers"
                                                            }`}
                                                    >
                                                        {item.horseTradeStatus === "For Sale"
                                                            ? "💲 For Sale"
                                                            : "🤝 Offers"}
                                                    </span>
                                                )}
                                        </div>
                                    )}
                                    <div className="inbox-item-preview">
                                        {item.latestMessage ? (
                                            <>
                                                {item.latestSenderIsMe && (
                                                    <span className="inbox-item-you">You: </span>
                                                )}
                                                {item.latestMessage.length > 80
                                                    ? item.latestMessage.slice(0, 80) + "…"
                                                    : item.latestMessage}
                                            </>
                                        ) : (
                                            <span style={{ opacity: 0.5 }}>No messages yet</span>
                                        )}
                                    </div>
                                </div>
                                {item.unreadCount > 0 && (
                                    <div className="inbox-item-badge">{item.unreadCount}</div>
                                )}
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
