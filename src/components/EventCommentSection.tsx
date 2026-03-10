"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addEventComment, deleteEventComment } from "@/app/actions/events";
import RichText from "@/components/RichText";

interface EventComment {
    id: string;
    content: string;
    createdAt: string;
    userId: string;
    userAlias: string;
}

interface Props {
    eventId: string;
    currentUserId: string;
    creatorId: string;
    initialComments: EventComment[];
}

function timeAgo(dateStr: string): string {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function EventCommentSection({ eventId, currentUserId, creatorId, initialComments }: Props) {
    const router = useRouter();
    const [comments, setComments] = useState(initialComments);
    const [text, setText] = useState("");
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!text.trim()) return;
        setError(null);

        startTransition(async () => {
            const result = await addEventComment(eventId, text.trim());
            if (result.success) {
                setText("");
                // Optimistic — add to top of list
                setComments(prev => [{
                    id: crypto.randomUUID(),
                    content: text.trim(),
                    createdAt: new Date().toISOString(),
                    userId: currentUserId,
                    userAlias: "You",
                }, ...prev]);
                router.refresh();
            } else {
                setError(result.error || "Failed to post comment.");
            }
        });
    }

    async function handleDelete(commentId: string) {
        if (!confirm("Delete this comment?")) return;
        startTransition(async () => {
            const result = await deleteEventComment(commentId);
            if (result.success) {
                setComments(prev => prev.filter(c => c.id !== commentId));
                router.refresh();
            }
        });
    }

    return (
        <div className="glass-card" style={{ padding: "var(--space-lg)", marginTop: "var(--space-lg)" }}>
            <h3 style={{ marginBottom: "var(--space-md)" }}>💬 Comments ({comments.length})</h3>

            {/* Compose */}
            <form onSubmit={handleSubmit} style={{ marginBottom: "var(--space-lg)" }}>
                <textarea
                    className="form-input"
                    placeholder="Add a comment…"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    maxLength={500}
                    rows={2}
                    style={{ resize: "vertical", marginBottom: "var(--space-sm)" }}
                    id="event-comment-input"
                />
                {error && <p style={{ color: "var(--color-error)", fontSize: "0.85rem", marginBottom: "var(--space-sm)" }}>{error}</p>}
                <button type="submit" className="btn btn-primary btn-sm" disabled={isPending || !text.trim()}>
                    {isPending ? "Posting…" : "Post Comment"}
                </button>
            </form>

            {/* Comments List */}
            {comments.length === 0 ? (
                <p style={{ color: "var(--color-text-muted)" }}>No comments yet — be the first!</p>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
                    {comments.map(c => (
                        <div key={c.id} style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: "var(--space-sm)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                <Link href={`/profile/${encodeURIComponent(c.userAlias)}`} style={{ fontWeight: 600, fontSize: "calc(0.85rem * var(--font-scale))" }}>
                                    @{c.userAlias}
                                </Link>
                                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                                    <span style={{ color: "var(--color-text-muted)", fontSize: "calc(0.75rem * var(--font-scale))" }}>
                                        {timeAgo(c.createdAt)}
                                    </span>
                                    {(c.userId === currentUserId || currentUserId === creatorId) && (
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => handleDelete(c.id)}
                                            disabled={isPending}
                                            style={{ fontSize: "0.75rem", padding: "2px 6px" }}
                                        >
                                            🗑️
                                        </button>
                                    )}
                                </div>
                            </div>
                            <RichText content={c.content} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
