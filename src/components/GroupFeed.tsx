"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createGroupPost, replyToPost, deleteGroupPost, type GroupPost } from "@/app/actions/groups";

interface Props {
    groupId: string;
    posts: GroupPost[];
    userId: string;
}

export default function GroupFeed({ groupId, posts, userId }: Props) {
    const router = useRouter();
    const [content, setContent] = useState("");
    const [posting, setPosting] = useState(false);
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyContent, setReplyContent] = useState("");
    const [error, setError] = useState("");

    async function handlePost() {
        if (!content.trim()) return;
        setPosting(true);
        setError("");
        const result = await createGroupPost(groupId, content);
        if (result.success) {
            setContent("");
            router.refresh();
        } else {
            setError(result.error || "Failed to post");
        }
        setPosting(false);
    }

    async function handleReply(postId: string) {
        if (!replyContent.trim()) return;
        setPosting(true);
        const result = await replyToPost(postId, replyContent);
        if (result.success) {
            setReplyContent("");
            setReplyingTo(null);
            router.refresh();
        } else {
            setError(result.error || "Failed to reply");
        }
        setPosting(false);
    }

    return (
        <div style={{ marginTop: "var(--space-xl)" }}>
            {/* Compose */}
            <div className="glass-card" style={{ padding: "var(--space-lg)", marginBottom: "var(--space-lg)" }}>
                <textarea
                    className="form-input"
                    rows={3}
                    placeholder="Share something with the group..."
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    style={{ resize: "vertical" }}
                />
                {error && <p className="form-error" style={{ marginTop: "var(--space-xs)" }}>{error}</p>}
                <button className="btn btn-primary btn-sm" onClick={handlePost} disabled={posting || !content.trim()} style={{ marginTop: "var(--space-sm)" }}>
                    {posting ? "Posting..." : "Post"}
                </button>
            </div>

            {/* Feed */}
            {posts.length === 0 ? (
                <div className="empty-state"><p>No posts yet. Be the first to share!</p></div>
            ) : (
                <div className="group-feed">
                    {posts.map(post => (
                        <div key={post.id} className={`group-post-card ${post.isPinned ? "pinned" : ""}`}>
                            <div className="group-post-header">
                                <strong>@{post.userAlias}</strong>
                                <span className="group-post-date">
                                    {new Date(post.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </span>
                                {post.isPinned && <span className="group-post-pin">📌 Pinned</span>}
                            </div>
                            <div className="activity-post-content">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
                            </div>
                            {post.horseName && (
                                <Link href={`/community/${post.horseId}`} className="group-post-horse-link">
                                    🐴 {post.horseName}
                                </Link>
                            )}
                            <div className="group-post-actions">
                                <button className="btn btn-ghost btn-sm" onClick={() => setReplyingTo(replyingTo === post.id ? null : post.id)}>
                                    💬 {post.replies.length > 0 ? post.replies.length : "Reply"}
                                </button>
                                {userId === post.userId && (
                                    <button className="btn btn-ghost btn-sm" onClick={() => { if (confirm("Delete post?")) { deleteGroupPost(post.id).then(() => router.refresh()); } }}>🗑️ Delete</button>
                                )}
                            </div>

                            {/* Replies */}
                            {(post.replies.length > 0 || replyingTo === post.id) && (
                                <div className="group-post-replies">
                                    {post.replies.map(reply => (
                                        <div key={reply.id} className="group-reply">
                                            <strong>@{reply.userAlias}</strong>
                                            <span className="group-post-date">
                                                {new Date(reply.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                            </span>
                                            <p><ReactMarkdown remarkPlugins={[remarkGfm]}>{reply.content}</ReactMarkdown></p>
                                        </div>
                                    ))}
                                    {replyingTo === post.id && (
                                        <div className="group-reply-form">
                                            <input
                                                className="form-input"
                                                placeholder="Write a reply..."
                                                value={replyContent}
                                                onChange={e => setReplyContent(e.target.value)}
                                                onKeyDown={e => e.key === "Enter" && handleReply(post.id)}
                                            />
                                            <button className="btn btn-primary btn-sm" onClick={() => handleReply(post.id)} disabled={posting}>Send</button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
