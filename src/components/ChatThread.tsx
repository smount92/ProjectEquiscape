"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { sendMessage } from "@/app/actions/messaging";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface ChatMessage {
    id: string;
    senderId: string;
    content: string;
    createdAt: string;
    isMe: boolean;
}

interface ChatThreadProps {
    conversationId: string;
    currentUserId: string;
    otherAlias: string;
    initialMessages: ChatMessage[];
}

const RISKY_PAYMENT_REGEX = /(venmo|zelle|paypal\s*f\s*(&|and)\s*f|friends\s*and\s*family|cash\s*app|wire\s*transfer)/i;

export default function ChatThread({
    conversationId,
    currentUserId,
    otherAlias,
    initialMessages,
}: ChatThreadProps) {
    const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
    const [newMessage, setNewMessage] = useState("");
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const router = useRouter();

    // Risky payment detection
    const showPaymentWarning = useMemo(() => RISKY_PAYMENT_REGEX.test(newMessage), [newMessage]);

    // Scroll to bottom on mount and new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Auto-focus input
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Real-time: listen for new messages from the other user
    useEffect(() => {
        const supabase = createClient();
        const channel = supabase
            .channel(`chat-${conversationId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "messages",
                    filter: `conversation_id=eq.${conversationId}`,
                },
                (payload) => {
                    const newMsg = payload.new as { id: string; content: string; sender_id: string; created_at: string };
                    // Only add if not from current user (we already added optimistically)
                    if (newMsg.sender_id !== currentUserId) {
                        setMessages((prev) => [
                            ...prev,
                            {
                                id: newMsg.id,
                                senderId: newMsg.sender_id,
                                content: newMsg.content,
                                createdAt: newMsg.created_at,
                                isMe: false,
                            },
                        ]);
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [conversationId, currentUserId]);

    const handleSend = async () => {
        if (!newMessage.trim() || sending) return;

        const content = newMessage.trim();
        setSending(true);
        setNewMessage("");

        // Optimistic update
        const optimisticMsg: ChatMessage = {
            id: `temp-${Date.now()}`,
            senderId: currentUserId,
            content,
            createdAt: new Date().toISOString(),
            isMe: true,
        };
        setMessages((prev) => [...prev, optimisticMsg]);

        const result = await sendMessage(conversationId, content);

        if (!result.success) {
            // Remove optimistic message on failure
            setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
            setNewMessage(content); // Restore the message
        } else {
            // Refresh to get real server data
            router.refresh();
        }

        setSending(false);
        inputRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    function formatTime(dateStr: string): string {
        const date = new Date(dateStr);
        const now = new Date();
        const isToday =
            date.getDate() === now.getDate() &&
            date.getMonth() === now.getMonth() &&
            date.getFullYear() === now.getFullYear();

        const time = date.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });

        if (isToday) return time;

        const dateLabel = date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
        });

        return `${dateLabel}, ${time}`;
    }

    return (
        <>
            {/* Message area */}
            <div className="chat-messages">
                {messages.length === 0 ? (
                    <div className="chat-empty">
                        <div className="chat-empty-icon">💬</div>
                        <p>
                            Start the conversation! Say hello to <strong>@{otherAlias}</strong>.
                        </p>
                    </div>
                ) : (
                    messages.map((msg, i) => {
                        // Show date separator if different day from previous
                        const showDate =
                            i === 0 ||
                            new Date(msg.createdAt).toDateString() !==
                            new Date(messages[i - 1].createdAt).toDateString();

                        return (
                            <div key={msg.id}>
                                {showDate && (
                                    <div className="chat-date-separator">
                                        {new Date(msg.createdAt).toLocaleDateString("en-US", {
                                            weekday: "short",
                                            month: "short",
                                            day: "numeric",
                                        })}
                                    </div>
                                )}
                                <div
                                    className={`chat-bubble-row ${msg.isMe ? "chat-bubble-me" : "chat-bubble-them"}`}
                                >
                                    <div className="chat-bubble">
                                        <div className="chat-bubble-content">{msg.content}</div>
                                        <div className="chat-bubble-time">{formatTime(msg.createdAt)}</div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Risky Payment Warning */}
            {showPaymentWarning && (
                <div className="chat-payment-warning" role="alert">
                    <span className="chat-payment-warning-icon">🛡️</span>
                    <span>
                        <strong>Protect yourself:</strong> Always use PayPal Goods &amp; Services for
                        off-platform payments. Venmo, Zelle, and PayPal Friends &amp; Family offer{" "}
                        <strong>no buyer protection</strong>.
                    </span>
                </div>
            )}

            {/* Input area */}
            <div className="chat-input-area">
                <div className="chat-input-container">
                    <textarea
                        ref={inputRef}
                        className="chat-input"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message…"
                        rows={1}
                        maxLength={2000}
                        disabled={sending}
                        id="chat-message-input"
                    />
                    <button
                        className="chat-send-btn"
                        onClick={handleSend}
                        disabled={!newMessage.trim() || sending}
                        aria-label="Send message"
                        id="chat-send-button"
                    >
                        {sending ? (
                            <span className="btn-spinner" style={{ width: 16, height: 16 }} aria-hidden="true" />
                        ) : (
                            <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <line x1="22" y1="2" x2="11" y2="13" />
                                <polygon points="22 2 15 22 11 13 2 9 22 2" />
                            </svg>
                        )}
                    </button>
                </div>
                <div className="chat-input-hint">
                    Press Enter to send · Shift+Enter for new line
                </div>
            </div>
        </>
    );
}
