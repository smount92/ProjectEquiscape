"use client";

import { useState, useTransition } from"react";
import { addSuggestionComment, deleteSuggestionComment } from"@/app/actions/catalog-suggestions";
import { useRouter } from"next/navigation";

interface Comment {
 id: string;
 user_id: string;
 user_alias: string;
 body: string;
 created_at: string;
}

interface Props {
 suggestionId: string;
 comments: Comment[];
 currentUserId: string | null;
}

export default function SuggestionCommentThread({ suggestionId, comments: initialComments, currentUserId }: Props) {
 const router = useRouter();
 const [isPending, startTransition] = useTransition();
 const [newComment, setNewComment] = useState("");
 const [error, setError] = useState("");

 const handleSubmit = () => {
 if (!newComment.trim()) return;
 if (!currentUserId) return;

 setError("");
 startTransition(async () => {
 const result = await addSuggestionComment(suggestionId, newComment.trim());
 if (result.success) {
 setNewComment("");
 router.refresh();
 } else {
 setError(result.error ??"Failed to post comment.");
 }
 });
 };

 const handleDelete = (commentId: string) => {
 startTransition(async () => {
 await deleteSuggestionComment(commentId);
 router.refresh();
 });
 };

 const timeAgo = (dateStr: string) => {
 const diff = Date.now() - new Date(dateStr).getTime();
 const mins = Math.floor(diff / 60000);
 if (mins < 60) return `${mins}m ago`;
 const hours = Math.floor(mins / 60);
 if (hours < 24) return `${hours}h ago`;
 const days = Math.floor(hours / 24);
 return `${days}d ago`;
 };

 return (
 <div className="mt-4">
 {/* Comment List */}
 {initialComments.length === 0 && (
 <p className="mt-4-empty">No comments yet. Be the first to discuss this suggestion.</p>
 )}
 {initialComments.map((comment) => (
 <div key={comment.id} className="border-edge border-b px-[0] py-2">
 <div className="sticky top-[var(--header-height)] z-40 border-b border-edge bg-parchment-dark">
 <span className="border-edge-author border-b px-[0] py-2">@{comment.user_alias}</span>
 <span className="border-edge-time border-b px-[0] py-2">{timeAgo(comment.created_at)}</span>
 {currentUserId === comment.user_id && (
 <button
 className="border-edge-delete border-b px-[0] py-2"
 onClick={() => handleDelete(comment.id)}
 disabled={isPending}
 title="Delete comment"
 >
 🗑
 </button>
 )}
 </div>
 <p className="border-edge-body border-b px-[0] py-2">{comment.body}</p>
 </div>
 ))}

 {/* Add Comment */}
 {currentUserId ? (
 <div className="border-edge-form border-b px-[0] py-2">
 <textarea
 className="input border-edge-textarea border-b px-[0] py-2"
 placeholder="Share evidence, discuss this change…"
 value={newComment}
 onChange={(e) => setNewComment(e.target.value)}
 rows={2}
 maxLength={2000}
 />
 {error && (
 <p className="text-danger mt-2 flex items-center gap-2 rounded-md border border-[rgba(240,108,126,0.3)] bg-[rgba(240,108,126,0.1)] px-4 py-2 text-sm">
 {error}
 </p>
 )}
 <div className="border-edge-form-actions border-b px-[0] py-2">
 <span className="border-edge-charcount border-b px-[0] py-2">{newComment.length}/2000</span>
 <button
 className="inline-flex min-h-[32px] max-md:min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-4 py-1 text-xs font-semibold text-inverse no-underline shadow-sm transition-all"
 onClick={handleSubmit}
 disabled={isPending || !newComment.trim()}
 >
 {isPending ?"Posting…" :"Post Comment"}
 </button>
 </div>
 </div>
 ) : (
 <p className="mt-4-login">
 <a href="/login">Log in</a> to join the discussion.
 </p>
 )}
 </div>
 );
}
