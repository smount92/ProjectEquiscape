"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";

import { sendMessage } from "@/app/actions/messaging";
import { markThreadRead } from "@/app/actions/deals";
import { createClient } from "@/lib/supabase/client";
import { UserAvatar } from "@/components/social";
import { useNotifications } from "@/lib/context/NotificationProvider";
import { RISKY_PAYMENT_REGEX } from "@/lib/safety";
import {
    coerceKind,
    describeEvent,
    isEventKind,
    type MessageKind,
} from "@/lib/deals/transcript";

/**
 * THE MIXED TRANSCRIPT.
 *
 * One chronological stream of two different things: the conversation,
 * which stays exactly as conversational as it always was, and the deal
 * record, which is written into the thread instead of hovering above it
 * in a card the transcript knows nothing about.
 *
 * Chat renders as bubbles. Deal events render as ledger leaves — a
 * ruled strip with a stamp glyph, the site's existing vocabulary for
 * "this is a record, not a remark". Neither crowds the other, and a
 * plain DM with no deal in it looks exactly like a chat app, which is
 * the point: the deal machinery must never make ordinary chatting worse.
 */

export interface ThreadMessage {
    id: string;
    senderId: string | null;
    kind: MessageKind;
    payload: Record<string, unknown>;
    content: string;
    createdAt: string;
    editedAt: string | null;
    isMine: boolean;
    attachments?: { url: string; caption: string | null }[];
}

interface DealThreadProps {
    conversationId: string;
    currentUserId: string;
    currentUserAvatar?: string | null;
    otherAlias: string;
    otherAvatarUrl?: string | null;
    initialMessages: ThreadMessage[];
    /** Blocked or a frozen dispute — read-only, with a reason. */
    composerDisabledReason?: string | null;
}

const TONE_CLASS: Record<string, string> = {
    note: "border-input bg-muted/40 text-secondary-foreground",
    money: "border-forest/30 bg-forest/5 text-foreground",
    good: "border-success/40 bg-success/10 text-foreground",
    warn: "border-warning/40 bg-warning/10 text-foreground",
};

export default function DealThread({
    conversationId,
    currentUserId,
    currentUserAvatar = null,
    otherAlias,
    otherAvatarUrl = null,
    initialMessages,
    composerDisabledReason = null,
}: DealThreadProps) {
    const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages);
    const [newMessage, setNewMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const [uploadProgress, setUploadProgress] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    // Server-rendered entries are the truth on every refresh.
    useEffect(() => {
        setMessages(initialMessages);
    }, [initialMessages]);

    const showPaymentWarning = useMemo(
        () => RISKY_PAYMENT_REGEX.test(newMessage),
        [newMessage],
    );

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        if (!composerDisabledReason) inputRef.current?.focus();
    }, [composerDisabledReason]);

    /**
     * Marking read is an ACTION now, not a side effect of the server
     * rendering a page. It fires once when the thread opens and again
     * whenever the tab regains focus.
     *
     * Then it tells the header to recount. `refreshMessageCount` has
     * existed on the notification context since it was written and had
     * ZERO callers, which is precisely why the badge stayed stale for up
     * to thirty seconds after you read a thread.
     */
    const { refreshMessageCount } = useNotifications();
    useEffect(() => {
        const mark = async () => {
            await markThreadRead(conversationId);
            await refreshMessageCount();
        };
        void mark();
        const onVisible = () => {
            if (document.visibilityState === "visible") void mark();
        };
        document.addEventListener("visibilitychange", onVisible);
        return () => document.removeEventListener("visibilitychange", onVisible);
    }, [conversationId, refreshMessageCount]);

    // Real-time: new entries from the other side, chat and events alike.
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
                    const row = payload.new as {
                        id: string;
                        content: string;
                        sender_id: string;
                        created_at: string;
                        kind?: string;
                        payload?: Record<string, unknown>;
                    };
                    if (row.sender_id === currentUserId) return;
                    setMessages((prev) =>
                        prev.some((m) => m.id === row.id)
                            ? prev
                            : [
                                  ...prev,
                                  {
                                      id: row.id,
                                      senderId: row.sender_id,
                                      kind: coerceKind(row.kind),
                                      payload: row.payload ?? {},
                                      content: row.content,
                                      createdAt: row.created_at,
                                      editedAt: null,
                                      isMine: false,
                                  },
                              ],
                    );
                    // Refresh for signed attachment URLs and any deal state
                    // the entry implies (a new offer moves the deal strip).
                    router.refresh();
                },
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [conversationId, currentUserId, router]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        if (files.length + pendingFiles.length > 5) {
            setError("Maximum 5 images per message.");
            return;
        }
        const oversized = files.find((f) => f.size > 5 * 1024 * 1024);
        if (oversized) {
            setError(`${oversized.name} is too large (max 5MB).`);
            return;
        }
        setError(null);
        setPendingFiles((prev) => [...prev, ...files]);
        inputRef.current?.focus();
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleSend = useCallback(async () => {
        if ((!newMessage.trim() && pendingFiles.length === 0) || sending) return;

        const content = newMessage.trim();
        setSending(true);
        setError(null);
        setNewMessage("");
        if (inputRef.current) inputRef.current.style.height = "";

        let attachments: { storagePath: string; caption?: string }[] | undefined;

        if (pendingFiles.length > 0) {
            setUploadProgress(true);
            const supabase = createClient();
            attachments = [];
            const uploadErrors: string[] = [];

            for (const file of pendingFiles) {
                const ext = file.name.split(".").pop() || "jpg";
                const path = `${currentUserId}/${conversationId}/${Date.now()}_${Math.random()
                    .toString(36)
                    .slice(2)}.${ext}`;
                const { error: uploadError } = await supabase.storage
                    .from("chat-attachments")
                    .upload(path, file, { contentType: file.type, upsert: false });
                if (uploadError) uploadErrors.push(`${file.name}: ${uploadError.message}`);
                else attachments.push({ storagePath: path });
            }

            setPendingFiles([]);
            setUploadProgress(false);

            if (attachments.length === 0 && uploadErrors.length > 0) {
                setSending(false);
                setNewMessage(content);
                setError(`Photo upload failed — ${uploadErrors.join("; ")}`);
                return;
            }
        }

        const optimistic: ThreadMessage = {
            id: `temp-${Date.now()}`,
            senderId: currentUserId,
            kind: attachments && attachments.length > 0 ? "photo" : "chat",
            payload: {},
            content: content || "📷 Sent a photo",
            createdAt: new Date().toISOString(),
            editedAt: null,
            isMine: true,
        };
        setMessages((prev) => [...prev, optimistic]);

        const result = await sendMessage(
            conversationId,
            content,
            attachments && attachments.length > 0 ? attachments : undefined,
        );

        if (!result.success) {
            setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
            setNewMessage(content);
            setError(result.error ?? "Message failed to send.");
        } else {
            router.refresh();
        }

        setSending(false);
        inputRef.current?.focus();
    }, [newMessage, pendingFiles, sending, conversationId, currentUserId, router]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void handleSend();
        }
    };

    return (
        <>
            {/* The stream */}
            <div className="bg-card border-input mb-4 flex flex-1 flex-col gap-2 overflow-y-auto rounded-lg border p-4">
                {messages.length === 0 ? (
                    <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center">
                        <div className="text-5xl opacity-50">💬</div>
                        <p className="m-0">
                            Say hello to <strong>@{otherAlias}</strong>.
                        </p>
                    </div>
                ) : (
                    messages.map((msg, i) => {
                        const showDate =
                            i === 0 ||
                            new Date(msg.createdAt).toDateString() !==
                                new Date(messages[i - 1].createdAt).toDateString();

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
                                {isEventKind(msg.kind) ? (
                                    <EventLeaf
                                        msg={msg}
                                        actorName={msg.isMine ? "You" : `@${otherAlias}`}
                                    />
                                ) : (
                                    <ChatBubble
                                        msg={msg}
                                        showAvatar={
                                            i === 0 ||
                                            messages[i - 1].senderId !== msg.senderId ||
                                            isEventKind(messages[i - 1].kind)
                                        }
                                        otherAlias={otherAlias}
                                        otherAvatarUrl={otherAvatarUrl}
                                        currentUserAvatar={currentUserAvatar}
                                    />
                                )}
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Risky payment advisory — unchanged copy, it is honest and load-bearing */}
            {showPaymentWarning && (
                <div
                    className="border-warning/30 bg-warning/10 text-warning mx-4 mb-2 flex items-start gap-2 rounded-md border px-4 py-2 text-xs leading-relaxed"
                    role="alert"
                >
                    <span className="mt-px shrink-0 text-[1.2rem]">🛡️</span>
                    <span>
                        <strong>Protect yourself:</strong> Always use PayPal Goods &amp; Services for
                        off-platform payments. Venmo, Zelle, and PayPal Friends &amp; Family offer{" "}
                        <strong>no buyer protection</strong>.
                    </span>
                </div>
            )}

            {error && (
                <div className="text-destructive border-destructive/30 bg-destructive/10 mx-4 mb-2 rounded-md border px-4 py-2 text-sm">
                    {error}
                </div>
            )}

            {pendingFiles.length > 0 && (
                <div className="border-input bg-background mx-4 mb-2 flex items-center gap-2 overflow-x-auto rounded-lg border p-2">
                    {pendingFiles.map((file, i) => (
                        <div key={i} className="relative shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={URL.createObjectURL(file)}
                                alt={file.name}
                                className="h-16 w-16 rounded-md object-cover"
                            />
                            <button
                                onClick={() =>
                                    setPendingFiles((prev) => prev.filter((_, j) => j !== i))
                                }
                                className="bg-destructive absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-white"
                                aria-label={`Remove ${file.name}`}
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                    <span className="text-muted-foreground self-center text-xs">
                        {pendingFiles.length} photo{pendingFiles.length > 1 ? "s" : ""}
                    </span>
                </div>
            )}

            {uploadProgress && (
                <div className="text-muted-foreground mx-4 mb-2 flex items-center gap-2 text-xs">
                    <span className="border-forest inline-block h-3 w-3 animate-spin rounded-full border-2 border-t-transparent" />
                    Uploading photos…
                </div>
            )}

            {/* Composer */}
            {composerDisabledReason ? (
                <div className="border-input bg-muted/40 text-muted-foreground shrink-0 rounded-lg border p-4 text-center text-sm">
                    {composerDisabledReason}
                </div>
            ) : (
                <div className="bg-card border-input shrink-0 rounded-lg border p-4">
                    <div className="flex items-end gap-2">
                        <label
                            className="border-input bg-card text-muted-foreground hover:bg-background hover:text-foreground flex h-[42px] w-[42px] shrink-0 cursor-pointer items-center justify-center rounded-full border transition-all"
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
                                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                            </svg>
                        </label>

                        <textarea
                            ref={inputRef}
                            className="border-input text-foreground font-inherit placeholder:text-muted-foreground focus:border-forest max-h-[40dvh] min-h-[42px] flex-1 resize-none overflow-y-auto rounded-lg border bg-card px-3.5 py-2.5 text-sm transition-colors focus:shadow-[0_0_0_3px_var(--color-forest-glow)] focus:outline-none"
                            value={newMessage}
                            onChange={(e) => {
                                setNewMessage(e.target.value);
                                e.target.style.height = "";
                                e.target.style.height = `${e.target.scrollHeight + 2}px`;
                            }}
                            onKeyDown={handleKeyDown}
                            placeholder={
                                pendingFiles.length > 0
                                    ? "Add a caption (optional)…"
                                    : "Type a message…"
                            }
                            rows={1}
                            maxLength={2000}
                            disabled={sending}
                            id="chat-message-input"
                        />
                        <button
                            className="bg-forest flex h-[42px] w-[42px] shrink-0 cursor-pointer items-center justify-center rounded-full border-none text-white transition-all hover:enabled:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
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
            )}
        </>
    );
}

// ── Leaves and bubbles ────────────────────────────────────────────────

/**
 * A deal event, rendered as a ruled entry rather than a speech bubble.
 * It reads as a record because it IS one — nobody said this, the deal
 * did it, and it cannot be edited by either party.
 */
function EventLeaf({ msg, actorName }: { msg: ThreadMessage; actorName: string }) {
    const d = describeEvent(msg.kind, msg.payload, { actorName }, msg.content);
    return (
        <div className="my-2 flex justify-center px-2">
            <div
                className={`w-full max-w-[560px] rounded-md border px-3.5 py-2.5 text-sm ${
                    TONE_CLASS[d.tone] ?? TONE_CLASS.note
                }`}
            >
                <div className="flex items-baseline gap-2">
                    <span aria-hidden="true">{d.icon}</span>
                    <span className="font-semibold">{d.headline}</span>
                    <span className="text-muted-foreground ml-auto shrink-0 text-[0.65rem]">
                        {formatTime(msg.createdAt)}
                    </span>
                </div>
                {d.lines.length > 0 && (
                    <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                        {d.lines.map((line, i) => (
                            <div key={i} className="contents">
                                <dt className="text-muted-foreground">{line.label}</dt>
                                <dd className="m-0 break-words">{line.value}</dd>
                            </div>
                        ))}
                    </dl>
                )}
            </div>
        </div>
    );
}

function ChatBubble({
    msg,
    showAvatar,
    otherAlias,
    otherAvatarUrl,
    currentUserAvatar,
}: {
    msg: ThreadMessage;
    showAvatar: boolean;
    otherAlias: string;
    otherAvatarUrl: string | null;
    currentUserAvatar: string | null;
}) {
    return (
        <div className={`flex items-end gap-2 ${msg.isMine ? "flex-row-reverse" : ""}`}>
            {!msg.isMine &&
                (showAvatar ? (
                    <UserAvatar
                        src={otherAvatarUrl}
                        alias={otherAlias}
                        size="xs"
                        href={`/profile/${encodeURIComponent(otherAlias)}`}
                    />
                ) : (
                    <div className="h-6 w-6 shrink-0" />
                ))}
            <div
                className={`max-w-[75%] animate-[bubbleIn_0.2s_ease] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm max-md:max-w-[85%] ${
                    msg.isMine
                        ? "bg-forest rounded-br-[4px] text-white"
                        : "border-input bg-card text-foreground rounded-bl-[4px] border"
                }`}
            >
                <div className="break-words whitespace-pre-wrap">{msg.content}</div>

                {msg.attachments && msg.attachments.length > 0 && (
                    <div
                        className={`mt-2 grid gap-1.5 ${
                            msg.attachments.length === 1 ? "grid-cols-1" : "grid-cols-2"
                        }`}
                    >
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
                    className={`mt-1 text-[0.6rem] ${
                        msg.isMine ? "text-right text-white/60" : "text-muted-foreground"
                    }`}
                >
                    {formatTime(msg.createdAt)}
                    {msg.editedAt ? " · edited" : ""}
                </div>
            </div>
            {msg.isMine &&
                (showAvatar ? (
                    <UserAvatar src={currentUserAvatar} alias="You" size="xs" />
                ) : (
                    <div className="h-6 w-6 shrink-0" />
                ))}
        </div>
    );
}

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

    return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${time}`;
}
