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
        <div className="max-w-[var(--max-width)] mx-auto py-[0] px-6 py-12 px-[0]">
            <div className="animate-fade-in-up">
                <div className="shelf-sticky top-0 z-[100] h-[var(--header max-sm:py-[0] max-sm:px-4-height)] flex items-center justify-between py-[0] px-8 bg-parchment-dark border-b border-edge transition-all">
                    <div>
                        <h1>
                            <span className="text-forest">✉️ Inbox</span>
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
                    <Link href="/community" className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm" id="browse-showring">
                        🏆 Browse Show Ring
                    </Link>
                </div>

                {inboxItems.length === 0 ? (
                    <div className="bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all text-center py-[var(--space-3xl)] px-8 animate-fade-in-up">
                        <div className="text-center py-[var(--space-3xl)] px-8-icon">✉️</div>
                        <h2>Your Inbox is Empty</h2>
                        <p>
                            Browse the Show Ring and message sellers about models you&apos;re interested in!
                        </p>
                        <Link href="/community" className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm">
                            🏆 Browse the Show Ring
                        </Link>
                    </div>
                ) : (
                    <div className="flex flex-col gap-[2px] bg-surface-glass border border-edge rounded-lg overflow-hidden animate-fade-in-up">
                        {inboxItems.map((item) => (
                            <Link
                                key={item.id}
                                href={`/inbox/${item.id}`}
                                className={`flex items-center gap-4 max-md:gap-2 py-4 max-md:py-2 px-6 max-md:px-4 no-underline text-ink transition-all border-b border-edge last:border-b-0 ${item.unreadCount > 0 ? "bg-[rgba(44,85,69,0.05)] hover:bg-[rgba(44,85,69,0.08)]" : "hover:bg-black/[0.03]"}`}
                                id={`inbox-item-${item.id}`}
                            >
                                <div className="w-11 max-md:w-9 h-11 max-md:h-9 rounded-full bg-[rgba(44,85,69,0.15)] flex items-center justify-center shrink-0 text-saddle">
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
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center gap-2">
                                        <span className={`font-semibold text-sm ${item.unreadCount > 0 ? "text-forest" : "text-ink"}`}>@{item.otherAlias}</span>
                                        {item.isRated && (
                                            <span className="text-[calc(0.7rem*var(--font-scale))] text-[#F59E0B] ml-1">⭐ Rated</span>
                                        )}
                                        <span className="text-xs text-muted shrink-0">
                                            {timeAgo(item.latestTime)}
                                        </span>
                                    </div>
                                    {item.horseName ? (
                                        <div className="text-xs text-muted mt-[2px] flex items-center gap-1">
                                            🐴 Re: {item.horseName}
                                            {item.horseTradeStatus &&
                                                item.horseTradeStatus !== "Not for Sale" && (
                                                    <span
                                                        className={item.horseTradeStatus === "For Sale"
                                                            ? "text-[0.65rem] font-bold py-[1px] px-1.5 rounded-full bg-[rgba(34,197,94,0.15)] text-[#22c55e]"
                                                            : "text-[0.65rem] font-bold py-[1px] px-1.5 rounded-full bg-[rgba(59,130,246,0.15)] text-[#3b82f6]"
                                                        }
                                                    >
                                                        {item.horseTradeStatus === "For Sale"
                                                            ? "💲 For Sale"
                                                            : "🤝 Offers"}
                                                    </span>
                                                )}
                                        </div>
                                    ) : (
                                        <div className="text-xs text-muted mt-[2px] flex items-center gap-1">
                                            💬 Direct Message
                                        </div>
                                    )}
                                    <div className="text-xs text-muted mt-1 whitespace-nowrap overflow-hidden text-ellipsis">
                                        {item.latestMessage ? (
                                            <>
                                                {item.latestSenderIsMe && (
                                                    <span className="font-semibold text-ink">You: </span>
                                                )}
                                                {item.latestMessage.length > 80
                                                    ? item.latestMessage.slice(0, 80) + "…"
                                                    : item.latestMessage}
                                            </>
                                        ) : (
                                            <span className="opacity-[0.5]" >No messages yet</span>
                                        )}
                                    </div>
                                </div>
                                {item.unreadCount > 0 && (
                                    <div className="flex items-center justify-center min-w-[24px] h-6 px-1.5 bg-forest text-white rounded-full text-[0.7rem] font-bold shrink-0">{item.unreadCount}</div>
                                )}
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
