import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import SuggestionVoteButtons from "@/components/SuggestionVoteButtons";
import SuggestionCommentThread from "@/components/SuggestionCommentThread";
import SuggestionAdminActions from "@/components/SuggestionAdminActions";
import SuggestionRevertAction from "@/components/SuggestionRevertAction";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import { BRONZE_THRESHOLD, CONTRIBUTOR_THRESHOLD, GOLD_THRESHOLD, SILVER_THRESHOLD } from "@/lib/catalog/corrections";
import CatalogSubMasthead from "@/components/catalog/CatalogSubMasthead";
import { referenceHref } from "@/lib/catalog/referenceUrl";
import { SUGGESTION_STATUS_LABELS, claimLine, isOpenSuggestion, liveClaim } from "@/lib/catalog/suggestionStatus";
import { MessageCircle, Shield } from "lucide-react";

interface Props {
    params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    return {
        title: "Suggestion Detail",
        description: "View, vote on, and discuss a catalog suggestion.",
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
        /** Update 242: a moderator's 30-minute claim (absent before it). */
        claimed_by?: string | null;
        claimed_until?: string | null;
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
            maker_slug: string | null;
            slug: string | null;
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
        isAdmin = (profile as { role: string } | null)?.role === "admin";
    }

    // Status display
    const statusConfig: Record<string, { icon: string; className: string; label: string }> = {
        pending: { icon: "🟡", className: "ref-status-pending", label: SUGGESTION_STATUS_LABELS.pending },
        under_review: { icon: "🔍", className: "ref-status-pending", label: SUGGESTION_STATUS_LABELS.under_review },
        approved: { icon: "✅", className: "ref-status-approved", label: "Approved" },
        auto_approved: { icon: "⚡", className: "ref-status-auto", label: "Auto-Approved" },
        rejected: { icon: "❌", className: "ref-status-rejected", label: "Rejected" },
    };
    const st = statusConfig[s.status] ?? statusConfig.pending;

    // A Registry moderator holding it right now (claimed suggestions read
    // under_review): the owner can still decide it, and is told who has it.
    const claim = isAdmin && isOpenSuggestion(s.status) ? liveClaim(s) : null;
    let claimWords: string | null = null;
    if (claim) {
        const { data: holder } = await supabase.from("users").select("alias_name").eq("id", claim.by).maybeSingle();
        const alias = (holder as { alias_name: string | null } | null)?.alias_name ?? "a moderator";
        claimWords = `${claimLine(alias, claim.until)} Deciding it now goes ahead of them.`;
    }

    // Curator badge — thresholds come from the same module that decides
    // auto-approval, so the rank shown here always matches the power it
    // confers. These ternaries previously hard-coded 200/50/10 and would
    // have kept showing the old ladder after the 2026-08-23 recalibration.
    const curatorCount = authorInfo?.approved_suggestions_count ?? 0;
    const curatorIcon =
        curatorCount >= GOLD_THRESHOLD
            ? "🥇"
            : curatorCount >= SILVER_THRESHOLD
              ? "🥈"
              : curatorCount >= BRONZE_THRESHOLD
                ? "🥉"
                : curatorCount >= CONTRIBUTOR_THRESHOLD
                  ? "📘"
                  : "";
    const curatorLabel =
        curatorCount >= GOLD_THRESHOLD
            ? "Gold Curator"
            : curatorCount >= SILVER_THRESHOLD
              ? "Silver Curator"
              : curatorCount >= BRONZE_THRESHOLD
                ? "Bronze Curator"
                : curatorCount >= CONTRIBUTOR_THRESHOLD
                  ? "Catalog Contributor"
                  : "";

    return (
        <ExplorerLayout noHeader>
            <CatalogSubMasthead
                icon="💡"
                title="Suggestion Detail"
                subtitle="Vote and discuss this proposal"
                backHref="/catalog/suggestions"
                backLabel="Suggestions"
            />

            <div className="space-y-4">
                {/* Vote Panel + Main Content */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[60px_1fr]">
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
                            <div className="flex flex-col items-center gap-1 text-muted-foreground">
                                <span className="font-semibold">▲ {s.upvotes}</span>
                                <span className="font-semibold">▼ {s.downvotes}</span>
                            </div>
                        )}
                    </div>

                    {/* Main Content */}
                    <div className="flex flex-col gap-4">
                        {/* Header */}
                        <div className="rounded-lg border border-input bg-card p-6 shadow-md transition-all">
                            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
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
                                                : s.suggestion_type === "duplicate"
                                                  ? "🔁 Duplicate"
                                                  : "🗑 Removal"}
                                    </span>
                                </div>
                                <span className="text-sm text-muted-foreground">
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
                                    Suggested by{""}
                                    <Link
                                        href={`/profile/${authorInfo?.alias_name ?? ""}`}
                                        className="font-semibold text-forest"
                                    >
                                        @{authorInfo?.alias_name ?? "Unknown"}
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
                                    <Link href={referenceHref(catalogItem)}>
                                        {catalogItem.title} by {catalogItem.maker}
                                    </Link>
                                </div>
                            )}

                            {/* Diff View */}
                            {s.suggestion_type === "correction" && s.field_changes && (
                                <div className="my-3">
                                    <h3>Changes</h3>
                                    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm [-webkit-overflow-scrolling:touch]">
                                        <div className="min-w-[500px]">
                                            <div className="grid grid-cols-[1fr_1fr_40px_1fr] border-b border-border bg-background p-3 text-xs font-bold tracking-wider text-muted-foreground uppercase">
                                                <div>Field</div>
                                                <div>Current</div>
                                                <div></div>
                                                <div>Proposed</div>
                                            </div>
                                            <div className="flex flex-col">
                                                {Object.entries(s.field_changes).map(([key, val]) => {
                                                    const v = val as { from: string; to: string };
                                                    return (
                                                        <div
                                                            key={key}
                                                            className="grid grid-cols-[1fr_1fr_40px_1fr] items-center border-b border-border/40 p-3 text-sm transition-colors last:border-0 hover:bg-background/50"
                                                        >
                                                            <div className="font-semibold text-foreground">
                                                                {key
                                                                    .replace(/_/g, " ")
                                                                    .replace(/\b\w/g, (c) => c.toUpperCase())}
                                                            </div>
                                                            <div className="font-mono text-muted-foreground line-through decoration-destructive/50">
                                                                {v.from}
                                                            </div>
                                                            <div className="text-center text-muted-foreground">→</div>
                                                            <div className="font-mono font-bold text-success">
                                                                {v.to}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Duplicate report: which entry stays */}
                            {s.suggestion_type === "duplicate" && (
                                <div className="my-3">
                                    <h3>Duplicate of</h3>
                                    <p className="m-0 text-sm">
                                        This entry would be removed and everything linked to it moved to{" "}
                                        <Link
                                            href={`/catalog/${String((s.field_changes as { duplicate_of?: string })?.duplicate_of ?? "")}`}
                                            className="font-semibold underline hover:no-underline"
                                        >
                                            {(s.field_changes as { duplicate_of_title?: string })?.duplicate_of_title ||
                                                "the entry to keep"}
                                        </Link>
                                        . Approving runs the merge; it cannot be undone.
                                    </p>
                                </div>
                            )}

                            {/* Addition Details */}
                            {s.suggestion_type === "addition" && (
                                <div className="my-3">
                                    <h3>Proposed Entry</h3>
                                    <div className="mb-6 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
                                        {Object.entries(s.field_changes)
                                            .filter(([, v]) => v != null && v !== "")
                                            .map(([k, v]) => (
                                                <div key={k} className="flex flex-col gap-[2px]">
                                                    <span className="text-xs font-semibold tracking-[0.05em] text-muted-foreground uppercase">
                                                        {k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                                                    </span>
                                                    <span className="text-base font-bold text-success">
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
                                <blockquote className="rounded-r-md border-l-[3px] border-forest bg-muted px-4 py-2 text-foreground italic">
                                    {s.reason}
                                </blockquote>
                            </div>

                            {/* Admin Notes */}
                            {s.admin_notes && (
                                <div className="my-3 rounded-r-md border-l-[3px] border-tier-gold bg-warning/10 px-4 py-2">
                                    <h3>Admin Notes</h3>
                                    <p>{s.admin_notes}</p>
                                </div>
                            )}
                        </div>

                        {/* Discussion Thread */}
                        <div className="rounded-lg border border-input bg-card p-6 shadow-md transition-all">
                            <h3 className="flex items-center gap-2">
                                <MessageCircle className="h-5 w-5" /> Discussion ({(comments ?? []).length})
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
                        {/* Waiting, or being looked at by a moderator (a claim reads under_review). */}
                        {isAdmin && isOpenSuggestion(s.status) && (
                            <div className="rounded-lg border border-warning bg-card p-6 shadow-md transition-all">
                                <h3 className="flex items-center gap-2">
                                    <Shield className="h-5 w-5" /> Admin Actions
                                </h3>
                                {claimWords && (
                                    <p className="mt-0 mb-3 text-sm text-secondary-foreground" data-testid="claim-note">
                                        {claimWords}
                                    </p>
                                )}
                                <SuggestionAdminActions suggestionId={s.id} />
                            </div>
                        )}

                        {/* Applied corrections stay revertible — the counterweight to Silver
     auto-approval landing changes with no human in the loop. */}
                        {isAdmin &&
                            s.suggestion_type === "correction" &&
                            (s.status === "approved" || s.status === "auto_approved") && (
                                <div className="rounded-lg border border-warning bg-card p-6 shadow-md transition-all">
                                    <h3 className="flex items-center gap-2">
                                        <Shield className="h-5 w-5" /> Admin Actions
                                    </h3>
                                    <SuggestionRevertAction suggestionId={s.id} />
                                </div>
                            )}
                    </div>
                </div>
            </div>
        </ExplorerLayout>
    );
}
