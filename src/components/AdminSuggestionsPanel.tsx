"use client";

import { useState, useTransition } from"react";
import { reviewSuggestion } from"@/app/actions/suggestions";

interface Suggestion {
 id: string;
 suggestion_type:"mold" |"release" |"resin";
 name: string;
 details: string | null;
 status: string;
 created_at: string;
 submitted_by: string;
 admin_notes: string | null;
}

export default function AdminSuggestionsPanel({ suggestions }: { suggestions: Suggestion[] }) {
 const [items, setItems] = useState(suggestions);
 const [isPending, startTransition] = useTransition();
 const [processingId, setProcessingId] = useState<string | null>(null);

 const handleReview = (id: string, status:"approved" |"rejected") => {
 setProcessingId(id);
 startTransition(async () => {
 const { success } = await reviewSuggestion(id, status);
 if (success) {
 setItems((prev) => prev.filter((s) => s.id !== id));
 }
 setProcessingId(null);
 });
 };

 const typeEmoji: Record<string, string> = {
 mold:"🐴",
 release:"📦",
 resin:"🎨",
 };

 const typeLabel: Record<string, string> = {
 mold:"Mold",
 release:"Release",
 resin:"Artist Resin",
 };

 if (items.length === 0) {
 return (
 <div
 className="bg-card border-edge rounded-lg border px-8 py-12 text-center shadow-md transition-all"
 style={{ textAlign:"center" }}
 >
 <div className="mb-4 text-5xl">✅</div>
 <h2>No Pending Suggestions</h2>
 <p>All database suggestions have been reviewed.</p>
 </div>
 );
 }

 return (
 <div className="flex flex-col gap-2">
 {items.map((s) => (
 <div
 key={s.id}
 className="bg-glass border-edge admin-message hover:opacity-[1]-unread rounded-lg border px-6 py-4 transition-all"
 >
 <div className="bg-glass border-edge sticky top-[var(--header-height)] z-40 border-b border-edge bg-parchment-dark">
 <div className="rounded-lg border border-edge bg-glass px-6 py-4 transition-all">
 <span className="rounded-lg border border-edge bg-glass px-6 py-4 transition-all">
 {typeEmoji[s.suggestion_type] ||"📝"}{""}
 {typeLabel[s.suggestion_type] || s.suggestion_type}
 </span>
 <span
 className="rounded-lg border border-edge bg-glass px-6 py-4 transition-all"
 style={{ cursor:"default" }}
 >
 {s.name}
 </span>
 </div>
 <div className="rounded-lg border border-edge bg-glass px-6 py-4 transition-all">
 <span className="rounded-lg border border-edge bg-glass px-6 py-4 transition-all">
 {new Date(s.created_at).toLocaleDateString("en-US", {
 month:"short",
 day:"numeric",
 hour:"numeric",
 minute:"2-digit",
 hour12: true,
 })}
 </span>
 </div>
 </div>
 {s.details && (
 <div className="rounded-lg border border-edge bg-glass px-6 py-4 transition-all">
 {s.details}
 </div>
 )}
 <div className="flex gap-2 rounded-lg border border-edge bg-glass px-6 py-4 transition-all">
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 onClick={() => handleReview(s.id,"approved")}
 disabled={isPending && processingId === s.id}
 >
 {isPending && processingId === s.id ?"…" :"✅ Approve"}
 </button>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 onClick={() => handleReview(s.id,"rejected")}
 disabled={isPending && processingId === s.id}
 style={{ color:"var(--color-text-muted)" }}
 >
 ❌ Reject
 </button>
 </div>
 </div>
 ))}
 </div>
 );
}
