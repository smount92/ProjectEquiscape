"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { sendMessage } from "@/app/actions/messaging";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { UserAvatar } from "@/components/social";

interface ChatMessage {
 id: string;
 senderId: string;
 content: string;
 createdAt: string;
 isMe: boolean;
 attachments?: { url: string; caption: string | null }[];
}

interface ChatThreadProps {
 conversationId: string;
 currentUserId: string;
 currentUserAvatar?: string | null;
 otherAlias: string;
 otherAvatarUrl?: string | null;
 initialMessages: ChatMessage[];
}

import { RISKY_PAYMENT_REGEX } from "@/lib/safety";

export default function ChatThread({ conversationId, currentUserId, currentUserAvatar = null, otherAlias, otherAvatarUrl = null, initialMessages }: ChatThreadProps) {
 const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
 const [newMessage, setNewMessage] = useState("");
 const [sending, setSending] = useState(false);
 const [pendingFiles, setPendingFiles] = useState<File[]>([]);
 const [uploadProgress, setUploadProgress] = useState(false);
 const messagesEndRef = useRef<HTMLDivElement>(null);
 const inputRef = useRef<HTMLTextAreaElement>(null);
 const fileInputRef = useRef<HTMLInputElement>(null);
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
 // Attachments will appear after refresh
 },
 ]);
 // Refresh to get full server data (including attachment signed URLs)
 router.refresh();
 }
 },
 )
 .subscribe();

 return () => {
 supabase.removeChannel(channel);
 };
 }, [conversationId, currentUserId, router]);

 // ── File selection handler ──
 const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
 const files = Array.from(e.target.files || []);
 if (files.length === 0) return;

 if (files.length + pendingFiles.length > 5) {
 alert("Maximum 5 images per message.");
 return;
 }

 // Validate size (5MB max each)
 const oversized = files.find(f => f.size > 5 * 1024 * 1024);
 if (oversized) {
 alert(`${oversized.name} is too large (max 5MB).`);
 return;
 }

 setPendingFiles(prev => [...prev, ...files]);
 inputRef.current?.focus();

 // Reset file input so user can select the same file again
 if (fileInputRef.current) fileInputRef.current.value = "";
 };

 // ── Send handler (with optional uploads) ──
 const handleSend = async () => {
 if ((!newMessage.trim() && pendingFiles.length === 0) || sending) return;

 const content = newMessage.trim();
 setSending(true);
 setNewMessage("");

 let attachments: { storagePath: string; caption?: string }[] | undefined;

 // Upload pending files if any
 if (pendingFiles.length > 0) {
 setUploadProgress(true);
 const supabase = createClient();
 attachments = [];
 const uploadErrors: string[] = [];

 for (const file of pendingFiles) {
 const ext = file.name.split(".").pop() || "jpg";
 const path = `${currentUserId}/${conversationId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

 const { error: uploadError } = await supabase.storage
 .from("chat-attachments")
 .upload(path, file, {
 contentType: file.type,
 upsert: false,
 });

 if (uploadError) {
 console.error("[ChatThread] Upload failed:", uploadError.message, { path, fileSize: file.size, fileType: file.type });
 uploadErrors.push(`${file.name}: ${uploadError.message}`);
 } else {
 attachments.push({ storagePath: path });
 }
 }

 setPendingFiles([]);
 setUploadProgress(false);

 // If ALL uploads failed, abort send and show error
 if (attachments.length === 0 && uploadErrors.length > 0) {
 setSending(false);
 setNewMessage(content);
 alert(`Photo upload failed:\n${uploadErrors.join("\n")}\n\nPlease try again.`);
 return;
 }
 }

 // Optimistic update
 const optimisticMsg: ChatMessage = {
 id: `temp-${Date.now()}`,
 senderId: currentUserId,
 content: content || "📷 Sent a photo",
 createdAt: new Date().toISOString(),
 isMe: true,
 };
 setMessages((prev) => [...prev, optimisticMsg]);

 const result = await sendMessage(
 conversationId,
 content,
 attachments && attachments.length > 0 ? attachments : undefined
 );

 if (!result.success) {
 setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
 setNewMessage(content);
 } else {
 router.refresh(); // Refresh to get real server data with signed URLs
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
 <div className="bg-card border-input mb-4 flex flex-1 flex-col gap-2 overflow-y-auto rounded-lg border p-4">
 {messages.length === 0 ? (
 <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 text-center">
 <div className="text-5xl opacity-50">💬</div>
 <p>
 Start the conversation! Say hello to <strong>@{otherAlias}</strong>.
 </p>
 </div>
 ) : (
 messages.map((msg, i) => {
 const showDate =
 i === 0 ||
 new Date(msg.createdAt).toDateString() !==
 new Date(messages[i - 1].createdAt).toDateString();

 const showAvatar = i === 0 || messages[i - 1].senderId !== msg.senderId;

 return (
 <div key={msg.id}>
 {showDate && (
 <div className="text-muted-foreground py-2 text-center text-xs font-medium">
 {new Date(msg.createdAt).toLocaleDateString("en-US", {
 weekday: "short",
 month: "short",
 day: "numeric",
 })}
 </div>
 )}
 <div className={`flex items-end gap-2 ${msg.isMe ? "flex-row-reverse" : ""}`}>
 {!msg.isMe && (
 showAvatar ? (
 <UserAvatar
 src={otherAvatarUrl}
 alias={otherAlias}
 size="xs"
 href={`/profile/${encodeURIComponent(otherAlias)}`}
 />
 ) : (
 <div className="h-6 w-6 shrink-0" />
 )
 )}
 <div
 className={`max-w-[75%] animate-[bubbleIn_0.2s_ease] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm max-md:max-w-[85%] ${msg.isMe ? "rounded-br-[4px] bg-[#2C5545] text-white" : "border-input rounded-bl-[4px] border bg-card text-foreground"}`}
 >
 <div className="break-words whitespace-pre-wrap">{msg.content}</div>

 {/* Inline photo attachments */}
 {msg.attachments && msg.attachments.length > 0 && (
 <div className={`mt-2 grid gap-1.5 ${msg.attachments.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
 {msg.attachments.map((att, idx) => (
 <a
 key={idx}
 href={att.url}
 target="_blank"
 rel="noopener noreferrer"
 className="block overflow-hidden rounded-lg"
 >
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img
 src={att.url}
 alt={att.caption || `Photo ${idx + 1}`}
 className="max-h-[200px] w-full object-cover transition-transform hover:scale-105"
 loading="lazy"
 />
 </a>
 ))}
 </div>
 )}

 <div
 className={`mt-1 text-[0.6rem] ${msg.isMe ? "text-right text-white/60" : "text-muted-foreground"}`}
 >
 {formatTime(msg.createdAt)}
 </div>
 </div>
 {msg.isMe && (
 showAvatar ? (
 <UserAvatar
 src={currentUserAvatar}
 alias="You"
 size="xs"
 />
 ) : (
 <div className="h-6 w-6 shrink-0" />
 )
 )}
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
 className="mx-4 flex animate-[fadeInUp_0.2s_ease] items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-xs leading-relaxed text-[#f59e0b]"
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

 {/* Pending file preview strip */}
 {pendingFiles.length > 0 && (
 <div className="mx-4 mb-2 flex items-center gap-2 overflow-x-auto rounded-lg border border-[#E0D5C1] bg-[#F4EFE6] p-2">
 {pendingFiles.map((file, i) => (
 <div key={i} className="relative shrink-0">
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img
 src={URL.createObjectURL(file)}
 alt={file.name}
 className="h-16 w-16 rounded-md object-cover"
 />
 <button
 onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))}
 className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white hover:bg-red-600"
 aria-label={`Remove ${file.name}`}
 >
 ✕
 </button>
 </div>
 ))}
 <span className="self-center text-xs text-muted-foreground">
 {pendingFiles.length} photo{pendingFiles.length > 1 ? "s" : ""}
 </span>
 </div>
 )}

 {/* Upload progress indicator */}
 {uploadProgress && (
 <div className="mx-4 mb-2 flex items-center gap-2 text-xs text-muted-foreground">
 <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-forest border-t-transparent" />
 Uploading photos…
 </div>
 )}

 {/* Input area */}
 <div className="bg-card border-input shrink-0 rounded-lg border p-4">
 <div className="flex items-end gap-2">
 {/* Attach photo button */}
 <label
 className="flex h-[42px] w-[42px] shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#E0D5C1] bg-[#FEFCF8] text-muted-foreground transition-all hover:bg-[#F4EFE6] hover:text-foreground"
 title="Attach photo"
 >
 <input
 ref={fileInputRef}
 type="file"
 accept="image/jpeg,image/png,image/webp,image/gif"
 multiple
 className="hidden"
 onChange={handleFileSelect}
 disabled={sending}
 id="chat-file-input"
 title="Select photos to attach"
 />
 <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
 stroke="currentColor" strokeWidth="2" strokeLinecap="round"
 strokeLinejoin="round" aria-hidden="true">
 <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
 </svg>
 </label>

 <textarea
 ref={inputRef}
 className="border-input text-foreground font-inherit placeholder:text-muted-foreground max-h-[120px] min-h-[42px] flex-1 resize-none rounded-lg border bg-card px-3.5 py-2.5 text-sm transition-colors focus:border-emerald-500 focus:shadow-[0_0_0_3px_rgba(44,85,69,0.1)] focus:outline-none"
 value={newMessage}
 onChange={(e) => setNewMessage(e.target.value)}
 onKeyDown={handleKeyDown}
 placeholder={pendingFiles.length > 0 ? "Add a caption (optional)…" : "Type a message…"}
 rows={1}
 maxLength={2000}
 disabled={sending}
 id="chat-message-input"
 />
 <button
 className="bg-forest flex h-[42px] w-[42px] shrink-0 cursor-pointer items-center justify-center rounded-full border-none text-white transition-all hover:enabled:scale-105 hover:enabled:shadow-[0_4px_16px_rgba(44,85,69,0.4)] disabled:cursor-not-allowed disabled:opacity-40"
 onClick={handleSend}
 disabled={(!newMessage.trim() && pendingFiles.length === 0) || sending}
 aria-label="Send message"
 id="chat-send-button"
 >
 {sending ? (
 <span
 className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
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
 <div className="text-muted-foreground mt-1.5 text-center text-[0.6rem]">
 Press Enter to send · Shift+Enter for new line · 📎 for photos
 </div>
 </div>
 </>
 );
}
