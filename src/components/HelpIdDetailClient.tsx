"use client";

import { useState } from"react";
import {
 upvoteSuggestion,
 acceptSuggestion,
 addIdentifiedHorse,
 createSuggestion,
 deleteIdRequest,
} from"@/app/actions/help-id";
import { useRouter } from"next/navigation";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/social";

interface Suggestion {
 id: string;
 user_id: string;
 free_text: string | null;
 upvotes: number;
 created_at: string;
 userName: string;
 releaseDisplay: string | null;
 resinDisplay: string | null;
 isAccepted: boolean;
}

interface HelpIdDetailClientProps {
 requestId: string;
 isOwner: boolean;
 isResolved: boolean;
 acceptedSuggestionId: string | null;
 suggestions: Suggestion[];
}

export default function HelpIdDetailClient({
 requestId,
 isOwner,
 isResolved,
 acceptedSuggestionId,
 suggestions: initialSuggestions,
}: HelpIdDetailClientProps) {
 const router = useRouter();
 const [suggestions, setSuggestions] = useState(initialSuggestions);
 const [showSuggestForm, setShowSuggestForm] = useState(false);
 const [suggestText, setSuggestText] = useState("");
 const [submitting, setSubmitting] = useState(false);
 const [addingHorse, setAddingHorse] = useState<string | null>(null);

 const handleUpvote = async (suggestionId: string) => {
 // Optimistic update
 setSuggestions((prev) => prev.map((s) => (s.id === suggestionId ? { ...s, upvotes: s.upvotes + 1 } : s)));
 await upvoteSuggestion(suggestionId);
 };

 const handleAccept = async (suggestionId: string) => {
 const result = await acceptSuggestion(requestId, suggestionId);
 if (result.success) {
 router.refresh();
 }
 };

 const handleAddToStable = async (suggestionId: string) => {
 setAddingHorse(suggestionId);
 const result = await addIdentifiedHorse(suggestionId);
 setAddingHorse(null);
 if (result.success) {
 router.push(`/dashboard?toast=Horse added to your stable!`);
 }
 };

 const handleSuggest = async () => {
 if (!suggestText.trim()) return;
 setSubmitting(true);
 const result = await createSuggestion(requestId, { freeText: suggestText });
 setSubmitting(false);
 if (result.success) {
 setSuggestText("");
 setShowSuggestForm(false);
 router.refresh();
 }
 };

 return (
 <div>
 {/* Suggestion List */}
 <h2 className="mt-12 mb-6 text-lg font-bold">💬 Suggestions ({suggestions.length})</h2>

 {suggestions.length === 0 ? (
 <div
 className="rounded-lg border border-input bg-card p-8 text-center shadow-md transition-all"
 >
 <p className="text-muted-foreground font-medium my-4">No suggestions yet. Be the first to help!</p>
 </div>
 ) : (
 <div className="flex flex-col gap-4">
 {suggestions.map((s) => (
 <div
 key={s.id}
 className={`help-id-suggestion-card ${s.isAccepted ?"accepted" :""}`}
 id={`suggestion-${s.id}`}
 >
 <div className="mb-4 flex flex-wrap items-center gap-4">
 <UserAvatar src={null} alias={s.userName} size="sm" />
 <span className="text-foreground text-sm font-semibold">{s.userName}</span>
 {s.isAccepted && (
 <span className="bg-emerald-100 text-success rounded-full px-[10px] py-[2px] text-xs font-semibold">
 ✅ Accepted Answer
 </span>
 )}
 <span className="text-muted-foreground ml-auto text-xs">
 {new Date(s.created_at).toLocaleDateString()}
 </span>
 </div>

 <div className="mb-4">
 {s.releaseDisplay && (
 <p className="text-forest mb-1 text-sm font-semibold">🏷️ {s.releaseDisplay}</p>
 )}
 {s.resinDisplay && (
 <p className="text-forest mb-1 text-sm font-semibold">🎨 {s.resinDisplay}</p>
 )}
 {s.free_text && (
 <p className="text-sm leading-[1.6] text-muted-foreground">
 {s.free_text}
 </p>
 )}
 </div>

 <div className="flex items-center gap-4">
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-8 py-2 text-sm font-semibold text-muted-foreground no-underline transition-all"
 onClick={() => handleUpvote(s.id)}
 title="Upvote this suggestion"
 >
 👍 {s.upvotes}
 </button>

 {isOwner && !isResolved && (
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
 onClick={() => handleAccept(s.id)}
 >
 ✅ Accept
 </button>
 )}

 {s.isAccepted && (
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
 onClick={() => handleAddToStable(s.id)}
 disabled={addingHorse === s.id}
 >
 {addingHorse === s.id ? (
 <>
 <span className="spinner-inline" /> Adding…
 </>
 ) : (
"🐴 Add to My Stable"
 )}
 </button>
 )}
 </div>
 </div>
 ))}
 </div>
 )}

 {/* Add Suggestion */}
 {!isResolved && (
 <div className="mt-8">
 {!showSuggestForm ? (
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
 onClick={() => setShowSuggestForm(true)}
 id="add-suggestion-btn"
 >
 💡 I Know This Model
 </button>
 ) : (
 <div className="rounded-lg border border-input bg-card p-6 shadow-md transition-all">
 <h3 className="mb-4">Your Suggestion</h3>
 <div className="mb-6">
 <Textarea
 rows={3}
 value={suggestText}
 onChange={(e) => setSuggestText(e.target.value)}
 placeholder="What model do you think this is? Include manufacturer, mold name, release name, model number if known..."
 className="resize-y"
 />
 </div>
 <div className="flex gap-4">
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-8 py-2 text-sm font-semibold text-muted-foreground no-underline transition-all"
 onClick={() => {
 setShowSuggestForm(false);
 setSuggestText("");
 }}
 >
 Cancel
 </button>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
 onClick={handleSuggest}
 disabled={submitting || !suggestText.trim()}
 >
 {submitting ? (
 <>
 <span className="spinner-inline" /> Submitting…
 </>
 ) : (
"Submit Suggestion"
 )}
 </button>
 </div>
 </div>
 )}
 </div>
 )}
 {/* Owner: Delete Request */}
 {isOwner && (
 <div className="mt-8 text-right">
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-8 py-2 text-sm font-semibold text-red-700 no-underline transition-all"
 onClick={async () => {
 if (confirm("Delete this Help ID request? This cannot be undone.")) {
 const result = await deleteIdRequest(requestId);
 if (result.success) {
 router.push("/community/help-id");
 } else {
 alert(result.error ||"Failed to delete");
 }
 }
 }}
 >
 🗑️ Delete Request
 </button>
 </div>
 )}
 </div>
 );
}
