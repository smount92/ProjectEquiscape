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
            replyText,
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
            <button
                className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-6 py-2 text-sm font-semibold no-underline transition-all"
                onClick={() => setIsOpen(true)}
            >
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
            <div className="mb-2 flex items-center justify-between">
                <span className="text-muted text-xs">
                    To: <strong>{recipientName}</strong> &lt;{recipientEmail}&gt;
                </span>
                <button
                    className="bg-[rgba(0, 0, 0, 0.05)] text-muted flex h-[24px] w-[24px] cursor-pointer items-center justify-center rounded-full border-0 text-[0.7rem] transition-all"
                    onClick={() => {
                        setIsOpen(false);
                        setStatus(null);
                    }}
                    aria-label="Close reply form"
                >
                    ✕
                </button>
            </div>
            <div className="bg-[rgba(0, 0, 0, 0.03)] border-[rgba(44, 85, 69, 0.4)] rounded-[0 var(--radius-md) var(--radius-md) 0] mb-2 border-l-[3px] px-[14px] py-[10px]">
                <div className="bg-[rgba(0, 0, 0, 0.03)] border-[rgba(44, 85, 69, 0.4)] rounded-[0 var(--radius-md) var(--radius-md) 0]-label mb-2 border-l-[3px] px-[14px] py-[10px]">
                    {originalSubject ? `Re: ${originalSubject}` : "Original message"}
                </div>
                <div className="bg-[rgba(0, 0, 0, 0.03)] border-[rgba(44, 85, 69, 0.4)] rounded-[0 var(--radius-md) var(--radius-md) 0]-body mb-2 border-l-[3px] px-[14px] py-[10px]">
                    {originalMessage}
                </div>
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
            <div className="mt-2 flex items-center gap-2">
                <button
                    className="bg-forest inline-flex cursor-pointer items-center gap-[6px] rounded-full border-0 px-[16px] py-[7px] font-[inherit] text-xs font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-[0.5]"
                    onClick={handleSend}
                    disabled={sending || !replyText.trim()}
                >
                    {sending ? (
                        <>
                            <span
                                className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-6 py-2 text-sm font-semibold no-underline transition-all"
                                aria-hidden="true"
                            />
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
                    className="border-edge text-muted hover:0.05)] hover:text-ink cursor-pointer rounded-full border bg-transparent px-[14px] py-[7px] font-[inherit] text-xs font-medium transition-all"
                    onClick={() => {
                        setIsOpen(false);
                        setStatus(null);
                    }}
                    disabled={sending}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}
