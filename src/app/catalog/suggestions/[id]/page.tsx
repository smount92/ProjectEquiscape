import { createClient } from"@/lib/supabase/server";
import { notFound } from"next/navigation";
import Link from"next/link";
import type { Metadata } from"next";
import SuggestionVoteButtons from"@/components/SuggestionVoteButtons";
import SuggestionCommentThread from"@/components/SuggestionCommentThread";
import SuggestionAdminActions from"@/components/SuggestionAdminActions";

interface Props {
 params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
 return {
 title:"Suggestion Detail — Model Horse Hub",
 description:"View, vote on, and discuss a catalog suggestion.",
 };
}


export default async function SuggestionDetailPage({ params }: Props) {
 const { id } = await params;
 const supabase = await createClient();

 // Fetch suggestion
 const { data: suggestion, error } = await supabase.from("catalog_suggestions").select("*").eq("id", id).single();

 if (error || !suggestion) notFound();

 const s = suggestion as {
 id: string;
 user_id: string;
 catalog_item_id: string | null;
 suggestion_type: string;
 field_changes: Record<string, unknown>;
 reason: string;
 status: string;
 admin_notes: string | null;
 upvotes: number;
 downvotes: number;
 created_at: string;
 };

 // Fetch author info
 const { data: author } = await supabase
 .from("users")
 .select("alias_name, approved_suggestions_count")
 .eq("id", s.user_id)
 .single();

 const authorInfo = author as {
 alias_name: string;
 approved_suggestions_count: number;
 } | null;

 // Fetch catalog item (for corrections)
 let catalogItem = null;
 if (s.catalog_item_id) {
 const { data } = await supabase.from("catalog_items").select("*").eq("id", s.catalog_item_id).single();
 catalogItem = data as {
 id: string;
 title: string;
 maker: string;
 scale: string | null;
 attributes: Record<string, unknown>;
 } | null;
 }

 // Fetch comments
 const { data: comments } = await supabase
 .from("catalog_suggestion_comments")
 .select("*")
 .eq("suggestion_id", id)
 .order("created_at", { ascending: true });

 // Get current user + vote
 const {
 data: { user },
 } = await supabase.auth.getUser();

 let currentVote: string | null = null;
 let isAdmin = false;
 if (user) {
 const { data: vote } = await supabase
 .from("catalog_suggestion_votes")
 .select("vote_type")
 .eq("suggestion_id", id)
 .eq("user_id", user.id)
 .maybeSingle();
 currentVote = vote ? (vote as { vote_type: string }).vote_type : null;

 // Check admin
 const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
 isAdmin = (profile as { role: string } | null)?.role ==="admin";
 }

 // Status display
 const statusConfig: Record<string, { icon: string; className: string; label: string }> = {
 pending: { icon:"🟡", className:"ref-status-pending", label:"Pending Review" },
 under_review: { icon:"🔍", className:"ref-status-pending", label:"Under Review" },
 approved: { icon:"✅", className:"ref-status-approved", label:"Approved" },
 auto_approved: { icon:"⚡", className:"ref-status-auto", label:"Auto-Approved" },
 rejected: { icon:"❌", className:"ref-status-rejected", label:"Rejected" },
 };
 const st = statusConfig[s.status] ?? statusConfig.pending;

 // Curator badge
 const curatorCount = authorInfo?.approved_suggestions_count ?? 0;
 const curatorIcon =
 curatorCount >= 200
 ?"🥇"
 : curatorCount >= 50
 ?"🥈"
 : curatorCount >= 10
 ?"🥉"
 : curatorCount >= 1
 ?"📘"
 :"";
 const curatorLabel =
 curatorCount >= 200
 ?"Gold Curator"
 : curatorCount >= 50
 ?"Silver Curator"
 : curatorCount >= 10
 ?"Bronze Curator"
 : curatorCount >= 1
 ?"Catalog Contributor"
 :"";

 return (
 <div className="mx-auto max-w-[var(--max-width)] px-6 py-8">
 <nav className="text-muted mb-6 flex items-center gap-1 text-sm">
 <Link href="/catalog">📚 Reference Catalog</Link>
 <span className="text-muted mb-6-sep flex items-center gap-1 text-sm">
 ›
 </span>
 <Link href="/catalog/suggestions">Suggestions</Link>
 <span className="text-muted mb-6-sep flex items-center gap-1 text-sm">
 ›
 </span>
 <span>Detail</span>
 </nav>

 <div className="space-y-4">
 {/* Vote Panel + Main Content */}
 <div className="grid-cols-[60px 1fr] grid gap-4">
 {/* Vote Panel */}
 <div className="sticky top-[80px] flex flex-col items-center">
 {user ? (
 <SuggestionVoteButtons
 suggestionId={s.id}
 currentVote={currentVote}
 upvotes={s.upvotes}
 downvotes={s.downvotes}
 />
 ) : (
 <div className="text-muted flex flex-col items-center gap-1">
 <span className="font-semibold">▲ {s.upvotes}</span>
 <span className="font-semibold">▼ {s.downvotes}</span>
 </div>
 )}
 </div>

 {/* Main Content */}
 <div className="flex flex-col gap-4">
 {/* Header */}
 <div className="bg-card border-edge rounded-lg border p-6 shadow-md transition-all">
 <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
 <div>
 <span className={`ref-status-badge ${st.className}`}>
 {st.icon} {st.label}
 </span>
 <span className="text-[1.2rem]-label">
 {s.suggestion_type ==="correction"
 ?"🔧 Correction"
 : s.suggestion_type ==="addition"
 ?"📗 New Entry"
 : s.suggestion_type ==="photo"
 ?"📸 Photo"
 :"🗑 Removal"}
 </span>
 </div>
 <span className="text-muted text-sm">
 {new Date(s.created_at).toLocaleDateString("en-US", {
 year:"numeric",
 month:"long",
 day:"numeric",
 })}
 </span>
 </div>

 {/* Author */}
 <div className="font-semibold-row">
 <span>
 Suggested by{""}
 <Link
 href={`/profile/${authorInfo?.alias_name ??""}`}
 className="text-forest font-semibold"
 >
 @{authorInfo?.alias_name ??"Unknown"}
 </Link>
 {curatorIcon && (
 <span
 className="ref-curator-inline"
 title={`${curatorLabel} — ${curatorCount} approved contributions`}
 >
 {""}
 {curatorIcon}
 </span>
 )}
 </span>
 </div>

 {/* Catalog Item Reference */}
 {catalogItem && (
 <div className="text-forest">
 <span>For: </span>
 <Link href={`/catalog/${catalogItem.id}`}>
 {catalogItem.title} by {catalogItem.maker}
 </Link>
 </div>
 )}

 {/* Diff View */}
 {s.suggestion_type ==="correction" && s.field_changes && (
 <div className="my-3">
 <h3>Changes</h3>
 <table className="border-edge border-b px-2 py-1">
 <thead>
 <tr>
 <th>Field</th>
 <th>Current</th>
 <th></th>
 <th>Proposed</th>
 </tr>
 </thead>
 <tbody>
 {Object.entries(s.field_changes).map(([key, val]) => {
 const v = val as { from: string; to: string };
 return (
 <tr key={key}>
 <td className="font-semibold">
 {key
 .replace(/_/g,"")
 .replace(/\b\w/g, (c) => c.toUpperCase())}
 </td>
 <td className="ref-diff-from">{v.from}</td>
 <td className="text-muted text-center">→</td>
 <td className="font-bold text-[#66bb6a]">{v.to}</td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 )}

 {/* Addition Details */}
 {s.suggestion_type ==="addition" && (
 <div className="my-3">
 <h3>Proposed Entry</h3>
 <div className="grid-cols-[repeat(auto-fill,minmax(200px,1fr))] mb-6 grid gap-4">
 {Object.entries(s.field_changes)
 .filter(([, v]) => v != null && v !=="")
 .map(([k, v]) => (
 <div key={k} className="flex flex-col gap-[2px]">
 <span className="text-muted text-xs font-semibold tracking-[0.05em] uppercase">
 {k.replace(/_/g,"").replace(/\b\w/g, (c) => c.toUpperCase())}
 </span>
 <span className="text-base font-bold text-[#66bb6a]">
 {String(v)}
 </span>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Reason */}
 <div className="my-3">
 <h3>Reason</h3>
 <blockquote className="border-forest bg-glass rounded-r-md border-l-[3px] px-4 py-2 text-[var(--color-text)] italic">
 {s.reason}
 </blockquote>
 </div>

 {/* Admin Notes */}
 {s.admin_notes && (
 <div className="bg-[rgba(255,193,7,0.05)] rounded-r-md my-3 border-l-[3px] border-[#f9a825] px-4 py-2">
 <h3>Admin Notes</h3>
 <p>{s.admin_notes}</p>
 </div>
 )}
 </div>

 {/* Discussion Thread */}
 <div className="bg-card border-edge rounded-lg border p-6 shadow-md transition-all">
 <h3>💬 Discussion ({(comments ?? []).length})</h3>
 <SuggestionCommentThread
 suggestionId={s.id}
 comments={
 (comments ?? []) as {
 id: string;
 user_id: string;
 user_alias: string;
 body: string;
 created_at: string;
 }[]
 }
 currentUserId={user?.id ?? null}
 />
 </div>

 {/* Admin Actions */}
 {isAdmin && s.status ==="pending" && (
 <div className="bg-card border-edge rounded-lg border border-[#ffc107] p-6 shadow-md transition-all">
 <h3>🛡️ Admin Actions</h3>
 <SuggestionAdminActions suggestionId={s.id} />
 </div>
 )}
 </div>
 </div>
 </div>
 </div>
 );
}
