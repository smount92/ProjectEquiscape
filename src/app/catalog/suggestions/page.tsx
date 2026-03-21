import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Catalog Suggestions — Model Horse Hub",
    description:
        "View community suggestions for the Model Horse Hub reference catalog. Vote, discuss, and help keep catalog data accurate.",
};

export const dynamic = "force-dynamic";

interface Props {
    searchParams: Promise<{ status?: string; item?: string }>;
}

export default async function SuggestionsPage({ searchParams }: Props) {
    const { status: statusFilter, item: itemFilter } = await searchParams;
    const supabase = await createClient();

    // Two-step fetch: FK goes to auth.users not public.users, so PostgREST can't join
    let query = supabase
        .from("catalog_suggestions")
        .select(
            "id, user_id, catalog_item_id, suggestion_type, field_changes, reason, status, upvotes, downvotes, created_at",
            { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .limit(50);

    if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
    }
    if (itemFilter) {
        query = query.eq("catalog_item_id", itemFilter);
    }

    const { data: suggestions, count } = await query;

    // Enrich with user data from public.users via admin client
    const admin = getAdminClient();
    const userIds = [...new Set((suggestions ?? []).map((s: { user_id: string }) => s.user_id))];
    const userMap: Record<string, { alias_name: string; approved_suggestions_count: number }> = {};
    if (userIds.length > 0) {
        const { data: users } = await admin
            .from("users")
            .select("id, alias_name, approved_suggestions_count")
            .in("id", userIds);
        for (const u of (users ?? []) as { id: string; alias_name: string; approved_suggestions_count: number }[]) {
            userMap[u.id] = { alias_name: u.alias_name, approved_suggestions_count: u.approved_suggestions_count };
        }
    }

    // Get comment counts per suggestion
    const suggestionIds = (suggestions ?? []).map(
        (s: { id: string }) => s.id
    );

    let commentCounts: Record<string, number> = {};
    if (suggestionIds.length > 0) {
        const { data: comments } = await supabase
            .from("catalog_suggestion_comments")
            .select("suggestion_id")
            .in("suggestion_id", suggestionIds);
        for (const c of (comments ?? []) as { suggestion_id: string }[]) {
            commentCounts[c.suggestion_id] =
                (commentCounts[c.suggestion_id] || 0) + 1;
        }
    }

    const currentStatus = statusFilter ?? "all";
    const tabs = [
        { key: "all", label: "All" },
        { key: "pending", label: "🟡 Pending" },
        { key: "approved", label: "✅ Approved" },
        { key: "auto_approved", label: "⚡ Auto" },
        { key: "rejected", label: "❌ Rejected" },
    ];

    return (
        <div className="max-w-[var(--max-width)] mx-auto py-[0] px-6">
            <nav className="flex items-center gap-1 text-[calc(0.85rem*var(--font-scale))] text-muted mb-6">
                <Link href="/catalog">📚 Reference Catalog</Link>
                <span className="flex items-center gap-1 text-[calc(0.85rem*var(--font-scale))] text-muted mb-6-sep">›</span>
                <span>Suggestions</span>
            </nav>

            <h1 className="font-sans text-[calc(1.8rem*var(--font-scale))] mb-1">
                📝 <span className="text-forest">Catalog Suggestions</span>
            </h1>
            <p className="text-muted mb-6">
                Community proposals to improve the reference catalog. Vote and discuss
                to help admins review.
            </p>

            {/* Filter Tabs */}
            <div className="ref-filter-tabs">
                {tabs.map((tab) => (
                    <Link
                        key={tab.key}
                        href={`/catalog/suggestions?status=${tab.key}${itemFilter ? `&item=${itemFilter}` : ""}`}
                        className={`ref-filter-tab ${currentStatus === tab.key ? "ref-filter-tab-active" : ""}`}
                    >
                        {tab.label}
                    </Link>
                ))}
            </div>

            {/* Results */}
            <p className="text-[calc(0.85rem*var(--font-scale))] text-muted mb-2">{count ?? 0} suggestions</p>

            <div className="flex flex-col gap-2">
                {(
                    suggestions as unknown as {
                        id: string;
                        user_id: string;
                        catalog_item_id: string | null;
                        suggestion_type: string;
                        field_changes: Record<string, unknown>;
                        reason: string;
                        status: string;
                        upvotes: number;
                        downvotes: number;
                        created_at: string;
                    }[]
                )?.map((s) => {
                    const userData = userMap[s.user_id];
                    const typeIcon =
                        s.suggestion_type === "correction"
                            ? "🔧"
                            : s.suggestion_type === "addition"
                              ? "📗"
                              : s.suggestion_type === "photo"
                                ? "📸"
                                : "🗑";

                    const statusBadge =
                        s.status === "pending"
                            ? "ref-status-pending"
                            : s.status === "approved"
                              ? "ref-status-approved"
                              : s.status === "auto_approved"
                                ? "ref-status-auto"
                                : s.status === "rejected"
                                  ? "ref-status-rejected"
                                  : "";

                    // Build change summary
                    let changeSummary = "";
                    if (
                        s.suggestion_type === "correction" &&
                        s.field_changes
                    ) {
                        const changes = Object.entries(s.field_changes)
                            .map(([k, v]) => {
                                const val = v as { from: string; to: string };
                                return `${k}: ${val.from} → ${val.to}`;
                            })
                            .join(", ");
                        changeSummary = changes;
                    } else if (s.suggestion_type === "addition") {
                        changeSummary =
                            `New: ${(s.field_changes as { title?: string })?.title ?? "Untitled"}`;
                    }

                    const curatorCount =
                        userData?.approved_suggestions_count ?? 0;
                    const curatorIcon =
                        curatorCount >= 200
                            ? "🥇"
                            : curatorCount >= 50
                              ? "🥈"
                              : curatorCount >= 10
                                ? "🥉"
                                : curatorCount >= 1
                                  ? "📘"
                                  : "";

                    return (
                        <Link
                            key={s.id}
                            href={`/catalog/suggestions/${s.id}`}
                            className="bg-card border border-edge rounded-lg p-12 shadow-md transition-all p-4 no-underline text-[var(--color-text)] transition-transform block"
                        >
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[1.2rem]">
                                    {typeIcon}
                                </span>
                                <span className={`ref-status-badge ${statusBadge}`}>
                                    {s.status.replace(/_/g, " ")}
                                </span>
                            </div>

                            <div className="ref-suggestion-body">
                                {changeSummary && (
                                    <p className="text-[calc(0.9rem*var(--font-scale))] font-medium mb-[4px]">
                                        {changeSummary}
                                    </p>
                                )}
                                <p className="text-[calc(0.8rem*var(--font-scale))] text-muted italic">
                                    &ldquo;{s.reason.slice(0, 120)}
                                    {s.reason.length > 120 ? "…" : ""}&rdquo;
                                </p>
                            </div>

                            <div className="flex items-center gap-4 mt-2 text-[calc(0.8rem*var(--font-scale))] text-muted">
                                <span className="font-semibold">
                                    {curatorIcon} @{userData?.alias_name ?? "Unknown"}
                                </span>
                                <span className="ml-auto">
                                    ▲ {s.upvotes} ▼ {s.downvotes}
                                    {(commentCounts[s.id] ?? 0) > 0 && (
                                        <> · 💬 {commentCounts[s.id]}</>
                                    )}
                                </span>
                                <span className="ref-suggestion-date">
                                    {new Date(s.created_at).toLocaleDateString()}
                                </span>
                            </div>
                        </Link>
                    );
                })}

                {(suggestions ?? []).length === 0 && (
                    <div className="bg-card border border-edge rounded-lg p-12 shadow-md transition-all text-center p-8 text-muted">
                        <p>No suggestions yet. Be the first to contribute!</p>
                        <Link href="/catalog" className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm">
                            Browse Catalog
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
