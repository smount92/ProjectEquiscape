"use client";

import { useState, useRef, useEffect, useMemo } from"react";
import { sendMessage } from"@/app/actions/messaging";
import { createClient } from"@/lib/supabase/client";
import { useRouter } from"next/navigation";

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

import { RISKY_PAYMENT_REGEX } from"@/lib/safety";

export default function ChatThread({ conversationId, currentUserId, otherAlias, initialMessages }: ChatThreadProps) {
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
 messagesEndRef.current?.scrollIntoView({ behavior:"smooth" });
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
 event:"INSERT",
 schema:"public",
 table:"messages",
 filter: `conversation_id=eq.${conversationId}`,
 },
 (payload) => {
 const newMsg = payload.new as {
 id: string;
 content: string;
 sender_id: string;
 created_at: string;
 };
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
 },
 )
 .subscribe();

 return () => {
 supabase.removeChannel(channel);
 };
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
 if (e.key ==="Enter" && !e.shiftKey) {
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
 hour:"numeric",
 minute:"2-digit",
 hour12: true,
 });

 if (isToday) return time;

 const dateLabel = date.toLocaleDateString("en-US", {
 month:"short",
 day:"numeric",
 });

 return `${dateLabel}, ${time}`;
 }

 return (
 <>
 {/* Message area */}
 <div className="bg-surface-glass border-edge mb-4 flex flex-1 flex-col gap-2 overflow-y-auto rounded-lg border p-4">
 {messages.length === 0 ? (
 <div className="text-muted flex flex-1 flex-col items-center justify-center gap-2 text-center">
 <div className="text-5xl opacity-50">💬</div>
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
 <div className="text-muted py-2 text-center text-xs font-medium">
 {new Date(msg.createdAt).toLocaleDateString("en-US", {
 weekday:"short",
 month:"short",
 day:"numeric",
 })}
 </div>
 )}
 <div className={`flex ${msg.isMe ?"justify-end" :"justify-start"}`}>
 <div
 className={`text-ink max-w-[75%] animate-[bubbleIn_0.2s_ease] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed max-md:max-w-[85%] ${msg.isMe ?"rounded-br-[4px] border border-[rgba(44,85,69,0.3)] bg-[linear-gradient(135deg,rgba(44,85,69,0.3),rgba(139,92,246,0.3))]" :"border-edge rounded-bl-[4px] border bg-black/[0.05]"}`}
 >
 <div className="break-words whitespace-pre-wrap">{msg.content}</div>
 <div
 className={`text-muted mt-1 text-[0.6rem] ${msg.isMe ?"text-right" :""}`}
 >
 {formatTime(msg.createdAt)}
 </div>
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
 <div
 className="mx-4 flex animate-[fadeInUp_0.2s_ease] items-start gap-2 rounded-md border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.12)] px-4 py-2 text-xs leading-relaxed text-[#f59e0b]"
 role="alert"
 >
 <span className="mt-px shrink-0 text-[1.2rem]">🛡️</span>
 <span>
 <strong>Protect yourself:</strong> Always use PayPal Goods &amp; Services for off-platform
 payments. Venmo, Zelle, and PayPal Friends &amp; Family offer{""}
 <strong>no buyer protection</strong>.
 </span>
 </div>
 )}

 {/* Input area */}
 <div className="bg-surface-glass border-edge shrink-0 rounded-lg border p-4">
 <div className="flex items-end gap-2">
 <textarea
 ref={inputRef}
 className="border-edge text-ink font-inherit placeholder:text-muted max-h-[120px] min-h-[42px] flex-1 resize-none rounded-lg border bg-black/[0.05] px-3.5 py-2.5 text-sm transition-colors focus:border-[rgba(44,85,69,0.5)] focus:shadow-[0_0_0_3px_rgba(44,85,69,0.1)] focus:outline-none"
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
 className="bg-forest flex h-[42px] w-[42px] shrink-0 cursor-pointer items-center justify-center rounded-full border-none text-white transition-all hover:enabled:scale-105 hover:enabled:shadow-[0_4px_16px_rgba(44,85,69,0.4)] disabled:cursor-not-allowed disabled:opacity-40"
 onClick={handleSend}
 disabled={!newMessage.trim() || sending}
 aria-label="Send message"
 id="chat-send-button"
 >
 {sending ? (
 <span
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-6 py-2 text-sm font-semibold no-underline transition-all"
 aria-hidden="true"
 />
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
 <div className="text-muted mt-1.5 text-center text-[0.6rem]">
 Press Enter to send · Shift+Enter for new line
 </div>
 </div>
 </>
 );
}
