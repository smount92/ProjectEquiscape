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
            <div className="admin-reply-form-header">
                <span className="admin-reply-form-to">
                    To: <strong>{recipientName}</strong> &lt;{recipientEmail}&gt;
                </span>
                <button
                    className="admin-reply-form-close"
                    onClick={() => { setIsOpen(false); setStatus(null); }}
                    aria-label="Close reply form"
                >
                    ✕
                </button>
            </div>
            <div className="admin-reply-original">
                <div className="admin-reply-original-label">
                    {originalSubject ? `Re: ${originalSubject}` : "Original message"}
                </div>
                <div className="admin-reply-original-body">{originalMessage}</div>
            </div>
            <textarea
                className="admin-reply-textarea"
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
            <div className="admin-reply-form-actions">
                <button
                    className="admin-reply-send-btn"
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
                    className="admin-reply-cancel-btn"
                    onClick={() => { setIsOpen(false); setStatus(null); }}
                    disabled={sending}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}
