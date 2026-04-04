"use client";

import { useState } from "react";
import UserAvatar from "./UserAvatar";
import { Input } from "@/components/ui/input";

interface ReplyComposerProps {
    /** Current user's avatar URL */
    currentUserAvatar: string | null;
    /** Current user's alias */
    currentUserAlias: string;
    /** Callback when reply is submitted */
    onSubmit: (content: string) => Promise<void>;
    /** Placeholder text */
    placeholder?: string;
    /** Max character length */
    maxLength?: number;
    /** Optional "replying to @user" context */
    replyingTo?: string | null;
    /** Whether submission is in progress */
    isPending?: boolean;
}

export default function ReplyComposer({
    currentUserAvatar,
    currentUserAlias,
    onSubmit,
    placeholder = "Reply…",
    maxLength = 500,
    replyingTo,
    isPending = false,
}: ReplyComposerProps) {
    const [text, setText] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!text.trim() || submitting) return;
        setSubmitting(true);
        await onSubmit(text.trim());
        setText("");
        setSubmitting(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const isDisabled = isPending || submitting || !text.trim();

    return (
        <div className="mt-2">
            {replyingTo && (
                <div className="mb-1 flex items-center gap-1 text-xs text-muted">
                    <span>↩ Replying to</span>
                    <span className="font-semibold text-ink">@{replyingTo}</span>
                </div>
            )}
            <div className="flex items-center gap-2">
                <UserAvatar src={currentUserAvatar} alias={currentUserAlias} size="xs" />
                <Input
                    className="flex-1 border-edge bg-card text-sm"
                    placeholder={placeholder}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    maxLength={maxLength}
                />
                <button
                    className="inline-flex min-h-[36px] cursor-pointer items-center justify-center rounded-md border-0 bg-forest px-4 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={handleSubmit}
                    disabled={isDisabled}
                >
                    {submitting ? "…" : "Reply"}
                </button>
            </div>
            {text.length > maxLength * 0.8 && (
                <span className="mt-0.5 block text-right text-[0.65rem] text-muted">
                    {text.length}/{maxLength}
                </span>
            )}
        </div>
    );
}
