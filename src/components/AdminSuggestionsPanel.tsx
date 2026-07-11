"use client";

import { useState, useTransition } from"react";
import { reviewSuggestion } from"@/app/actions/suggestions";
import { Button } from "@/components/ui/button";

interface Suggestion {
 id: string;
 suggestion_type: string;
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
 className="bg-card border-input rounded-lg border px-8 py-12 text-center shadow-md transition-all"
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
 className="bg-card border-input rounded-lg border px-6 py-4 transition-all"
 >
 <div className="mb-2 flex items-center justify-between gap-2">
 <span className="text-sm font-semibold text-foreground">
 {typeEmoji[s.suggestion_type] ||"📝"}{" "}
 {typeLabel[s.suggestion_type] || s.suggestion_type}
 {s.name ? ` — ${s.name}` :""}
 </span>
 <span className="text-muted-foreground text-xs whitespace-nowrap">
 {new Date(s.created_at).toLocaleDateString("en-US", {
 month:"short",
 day:"numeric",
 hour:"numeric",
 minute:"2-digit",
 hour12: true,
 })}
 </span>
 </div>
 {s.details && (
 <div className="mb-3 text-sm leading-relaxed text-secondary-foreground whitespace-pre-wrap">
 {s.details}
 </div>
 )}
 <div className="flex gap-2">
 <Button
 onClick={() => handleReview(s.id,"approved")}
 disabled={isPending && processingId === s.id}
 >
 {isPending && processingId === s.id ?"…" :"✅ Approve"}
 </Button>
 <Button variant="outline" size="wide" className="text-muted-foreground"
 onClick={() => handleReview(s.id,"rejected")}
 disabled={isPending && processingId === s.id}
 >
 ❌ Reject
 </Button>
 </div>
 </div>
 ))}
 </div>
 );
}
