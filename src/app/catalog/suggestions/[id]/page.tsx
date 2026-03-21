import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import SuggestionVoteButtons from "@/components/SuggestionVoteButtons";
import SuggestionCommentThread from "@/components/SuggestionCommentThread";
import SuggestionAdminActions from "@/components/SuggestionAdminActions";

interface Props {
    params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    return {
        title: "Suggestion Detail — Model Horse Hub",
        description: "View, vote on, and discuss a catalog suggestion.",
    };
}

export const dynamic = "force-dynamic";

export default async function SuggestionDetailPage({ params }: Props) {
    const { id } = await params;
    const supabase = await createClient();

    // Fetch suggestion
    const { data: suggestion, error } = await supabase
        .from("catalog_suggestions")
        .select("*")
        .eq("id", id)
        .single();

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
        const { data } = await supabase
            .from("catalog_items")
            .select("*")
            .eq("id", s.catalog_item_id)
            .single();
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
        const { data: profile } = await supabase
            .from("users")
            .select("role")
            .eq("id", user.id)
            .single();
        isAdmin = (profile as { role: string } | null)?.role === "admin";
    }

    // Status display
    const statusConfig: Record<string, { icon: string; className: string; label: string }> = {
        pending: { icon: "🟡", className: "ref-status-pending", label: "Pending Review" },
        under_review: { icon: "🔍", className: "ref-status-pending", label: "Under Review" },
        approved: { icon: "✅", className: "ref-status-approved", label: "Approved" },
        auto_approved: { icon: "⚡", className: "ref-status-auto", label: "Auto-Approved" },
        rejected: { icon: "❌", className: "ref-status-rejected", label: "Rejected" },
    };
    const st = statusConfig[s.status] ?? statusConfig.pending;

    // Curator badge
    const curatorCount = authorInfo?.approved_suggestions_count ?? 0;
    const curatorIcon =
        curatorCount >= 200 ? "🥇" : curatorCount >= 50 ? "🥈" : curatorCount >= 10 ? "🥉" : curatorCount >= 1 ? "📘" : "";
    const curatorLabel =
        curatorCount >= 200
            ? "Gold Curator"
            : curatorCount >= 50
              ? "Silver Curator"
              : curatorCount >= 10
                ? "Bronze Curator"
                : curatorCount >= 1
                  ? "Catalog Contributor"
                  : "";

    return (
        <div className="max-w-[var(--max-width)] mx-auto py-[0] px-6">
            <nav className="flex items-center gap-1 text-[calc(0.85rem*var(--font-scale))] text-muted mb-6">
                <Link href="/catalog">📚 Reference Catalog</Link>
                <span className="flex items-center gap-1 text-[calc(0.85rem*var(--font-scale))] text-muted mb-6-sep">›</span>
                <Link href="/catalog/suggestions">Suggestions</Link>
                <span className="flex items-center gap-1 text-[calc(0.85rem*var(--font-scale))] text-muted mb-6-sep">›</span>
                <span>Detail</span>
            </nav>

            <div className="ref-suggestion-detail">
                {/* Vote Panel + Main Content */}
                <div className="grid grid-cols-[60px 1fr] gap-4">
                    {/* Vote Panel */}
                    <div className="flex flex-col items-center sticky top-[80px]">
                        {user ? (
                            <SuggestionVoteButtons
                                suggestionId={s.id}
                                currentVote={currentVote}
                                upvotes={s.upvotes}
                                downvotes={s.downvotes}
                            />
                        ) : (
                            <div className="flex flex-col items-center gap-1 text-muted">
                                <span className="ref-font-semibold">▲ {s.upvotes}</span>
                                <span className="ref-font-semibold">▼ {s.downvotes}</span>
                            </div>
                        )}
                    </div>

                    {/* Main Content */}
                    <div className="flex flex-col gap-4">
                        {/* Header */}
                        <div className="bg-card border border-edge rounded-lg p-12 shadow-md transition-all p-6">
                            <div className="flex justify-between items-center flex-wrap gap-2 mb-4">
                                <div>
                                    <span className={`ref-status-badge ${st.className}`}>
                                        {st.icon} {st.label}
                                    </span>
                                    <span className="text-[1.2rem]-label">
                                        {s.suggestion_type === "correction"
                                            ? "🔧 Correction"
                                            : s.suggestion_type === "addition"
                                              ? "📗 New Entry"
                                              : s.suggestion_type === "photo"
                                                ? "📸 Photo"
                                                : "🗑 Removal"}
                                    </span>
                                </div>
                                <span className="text-muted text-[calc(0.85rem*var(--font-scale))]">
                                    {new Date(s.created_at).toLocaleDateString("en-US", {
                                        year: "numeric",
                                        month: "long",
                                        day: "numeric",
                                    })}
                                </span>
                            </div>

                            {/* Author */}
                            <div className="font-semibold-row">
                                <span>
                                    Suggested by{" "}
                                    <Link
                                        href={`/profile/${authorInfo?.alias_name ?? ""}`}
                                        className="text-forest font-semibold"
                                    >
                                        @{authorInfo?.alias_name ?? "Unknown"}
                                    </Link>
                                    {curatorIcon && (
                                        <span
                                            className="ref-curator-inline"
                                            title={`${curatorLabel} — ${curatorCount} approved contributions`}
                                        >
                                            {" "}
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
                            {s.suggestion_type === "correction" && s.field_changes && (
                                <div className="m-[var(--space-md) 0]">
                                    <h3>Changes</h3>
                                    <table className="py-1 px-2 border-b border-edge">
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
                                                            {key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                                                        </td>
                                                        <td className="ref-diff-from">{v.from}</td>
                                                        <td className="text-center text-muted">→</td>
                                                        <td className="text-[#66bb6a] font-bold">{v.to}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Addition Details */}
                            {s.suggestion_type === "addition" && (
                                <div className="m-[var(--space-md) 0]">
                                    <h3>Proposed Entry</h3>
                                    <div className="grid grid-cols-[repeat(auto-fill, minmax(200px, 1fr))] gap-4 mb-6">
                                        {Object.entries(s.field_changes)
                                            .filter(([, v]) => v != null && v !== "")
                                            .map(([k, v]) => (
                                                <div key={k} className="flex flex-col gap-[2px]">
                                                    <span className="text-[calc(0.75rem*var(--font-scale))] text-muted uppercase tracking-[0.05em] font-semibold">
                                                        {k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                                                    </span>
                                                    <span className="text-[calc(0.95rem*var(--font-scale))] font-medium text-[#66bb6a] font-bold">
                                                        {String(v)}
                                                    </span>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )}

                            {/* Reason */}
                            <div className="m-[var(--space-md) 0]">
                                <h3>Reason</h3>
                                <blockquote className="border-l-[3px] border-forest py-2 px-4 bg-glass rounded-[0 var(--radius-md) var(--radius-md) 0] italic text-[var(--color-text)]">
                                    {s.reason}
                                </blockquote>
                            </div>

                            {/* Admin Notes */}
                            {s.admin_notes && (
                                <div className="border-l-[3px] border-[#f9a825] py-2 px-4 bg-[rgba(255, 193, 7, 0.05)] rounded-[0 var(--radius-md) var(--radius-md) 0] m-[var(--space-md) 0]">
                                    <h3>Admin Notes</h3>
                                    <p>{s.admin_notes}</p>
                                </div>
                            )}
                        </div>

                        {/* Discussion Thread */}
                        <div className="bg-card border border-edge rounded-lg p-12 shadow-md transition-all p-6">
                            <h3>
                                💬 Discussion ({(comments ?? []).length})
                            </h3>
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
                        {isAdmin && s.status === "pending" && (
                            <div className="bg-card border border-edge rounded-lg p-12 shadow-md transition-all p-6 border border-[#ffc107]">
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
