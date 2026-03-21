"use client";

import { useState } from "react";
import { replyToContactMessage } from "@/app/actions/admin";
import { useRouter } from "next/navigation";

export default function AdminReplyForm({
    messageId,
    recipientEmail,
    recipientName,
    originalSubject,
    originalMessage,
}: {
    messageId: string;
    recipientEmail: string;
    recipientName: string;
    originalSubject: string | null;
    originalMessage: string;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [replyText, setReplyText] = useState("");
    const [sending, setSending] = useState(false);
    const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
    const router = useRouter();

    const handleSend = async () => {
        if (!replyText.trim() || sending) return;
        setSending(true);
        setStatus(null);

        const result = await replyToContactMessage(
            messageId,
            recipientEmail,
            recipientName,
            originalSubject,
            originalMessage,
            replyText
        );

        if (result.success) {
            setStatus({ type: "success", msg: "✅ Reply sent successfully!" });
            setReplyText("");
            setTimeout(() => {
                setIsOpen(false);
                setStatus(null);
                router.refresh();
            }, 1500);
        } else {
            setStatus({ type: "error", msg: result.error || "Failed to send" });
        }
        setSending(false);
    };

    if (!isOpen) {
        return (
            <button className="admin-reply-btn" onClick={() => setIsOpen(true)}>
                <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <polyline points="9 17 4 12 9 7" />
                    <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
                </svg>
                Reply
            </button>
        );
    }

    return (
        <div className="admin-reply-form">
            <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-muted">
                    To: <strong>{recipientName}</strong> &lt;{recipientEmail}&gt;
                </span>
                <button
                    className="flex items-center justify-center w-[24px] h-[24px] rounded-full bg-[rgba(0, 0, 0, 0.05)] border-0 text-muted cursor-pointer text-[0.7rem] transition-all"
                    onClick={() => { setIsOpen(false); setStatus(null); }}
                    aria-label="Close reply form"
                >
                    ✕
                </button>
            </div>
            <div className="mb-2 py-[10px] px-[14px] bg-[rgba(0, 0, 0, 0.03)] border-l-[3px] border-[rgba(44, 85, 69, 0.4)] rounded-[0 var(--radius-md) var(--radius-md) 0]">
                <div className="mb-2 py-[10px] px-[14px] bg-[rgba(0, 0, 0, 0.03)] border-l-[3px] border-[rgba(44, 85, 69, 0.4)] rounded-[0 var(--radius-md) var(--radius-md) 0]-label">
                    {originalSubject ? `Re: ${originalSubject}` : "Original message"}
                </div>
                <div className="mb-2 py-[10px] px-[14px] bg-[rgba(0, 0, 0, 0.03)] border-l-[3px] border-[rgba(44, 85, 69, 0.4)] rounded-[0 var(--radius-md) var(--radius-md) 0]-body">{originalMessage}</div>
            </div>
            <textarea
                className="text-muted"
                placeholder={`Write your reply to ${recipientName}…`}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={4}
                disabled={sending}
            />
            {status && (
                <div className={`admin-reply-status ${status.type === "success" ? "status-success" : "status-error"}`}>
                    {status.msg}
                </div>
            )}
            <div className="flex items-center gap-2 mt-2">
                <button
                    className="inline-flex items-center gap-[6px] py-[7px] px-[16px] bg-forest border-0 rounded-full text-white text-xs font-semibold cursor-pointer font-[inherit] transition-all disabled:opacity-[0.5] disabled:cursor-not-allowed"
                    onClick={handleSend}
                    disabled={sending || !replyText.trim()}
                >
                    {sending ? (
                        <>
                            <span className="btn-spinner" style={{ width: 12, height: 12 }} aria-hidden="true" />
                            Sending…
                        </>
                    ) : (
                        <>
                            <svg
                                width="14"
                                height="14"
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
                            Send Reply
                        </>
                    )}
                </button>
                <button
                    className="py-[7px] px-[14px] bg-transparent border border-edge rounded-full text-muted text-xs font-medium cursor-pointer font-[inherit] transition-all hover:0.05)] hover:text-ink"
                    onClick={() => { setIsOpen(false); setStatus(null); }}
                    disabled={sending}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}
