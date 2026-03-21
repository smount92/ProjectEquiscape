import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getPhotoShows } from "@/app/actions/shows";
import { getPendingSuggestions } from "@/app/actions/suggestions";
import { getOpenReports } from "@/app/actions/moderation";
import AdminTabs from "@/components/AdminTabs";

export const metadata = {
    title: "Admin Console — Model Horse Hub",
    description: "Founder's Command Center.",
};

export const dynamic = "force-dynamic";

interface ContactMessage {
    id: string;
    name: string;
    email: string;
    subject: string | null;
    message: string;
    is_read: boolean;
    created_at: string;
}

export default async function AdminPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    // CRITICAL: Security gate — only ADMIN_EMAIL can access (case-insensitive)
    if (!user || user.email?.toLowerCase() !== process.env.ADMIN_EMAIL?.toLowerCase()) {
        redirect("/dashboard");
    }

    // Service role client to bypass RLS
    const supabaseAdmin = getAdminClient();

    // Fetch metrics in parallel
    const [usersResult, horsesResult, unreadResult, messagesResult] =
        await Promise.all([
            supabaseAdmin.auth.admin.listUsers({ perPage: 1, page: 1 }),
            supabaseAdmin
                .from("user_horses")
                .select("id", { count: "exact", head: true }),
            supabaseAdmin
                .from("contact_messages")
                .select("id", { count: "exact", head: true })
                .eq("is_read", false),
            supabaseAdmin
                .from("contact_messages")
                .select("id, name, email, subject, message, is_read, created_at")
                .order("created_at", { ascending: false })
                .limit(100),
        ]);

    const totalUsers =
        (usersResult.data as unknown as { users: unknown[]; total?: number })
            ?.total ?? 0;
    const totalHorses = horsesResult.count ?? 0;
    const unreadMessages = unreadResult.count ?? 0;
    const messages = (messagesResult.data as ContactMessage[]) ?? [];

    const allShows = await getPhotoShows();
    const pendingSuggestions = await getPendingSuggestions();
    const reports = await getOpenReports();

    // Fetch pending catalog curation suggestions
    const { data: catalogSuggestionRows } = await supabaseAdmin
        .from("catalog_suggestions")
        .select("id, user_id, suggestion_type, field_changes, reason, status, upvotes, downvotes, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(50);

    // Enrich with author info
    const catalogSuggestions = [];
    for (const row of (catalogSuggestionRows ?? []) as {
        id: string; user_id: string; suggestion_type: string;
        field_changes: Record<string, unknown>; reason: string;
        status: string; upvotes: number; downvotes: number; created_at: string;
    }[]) {
        const { data: author } = await supabaseAdmin
            .from("users")
            .select("alias_name, approved_suggestions_count")
            .eq("id", row.user_id)
            .single();
        catalogSuggestions.push({
            ...row,
            author_alias: (author as { alias_name: string } | null)?.alias_name ?? "Unknown",
            author_approved_count: (author as { approved_suggestions_count: number } | null)?.approved_suggestions_count ?? 0,
        });
    }

    return (
        <div className="page-container form-page">
            <div className="animate-fade-in-up">
                {/* Header */}
                <div className="shelf-header">
                    <div>
                        <h1>
                            <span className="text-gradient">⚡ Admin Console</span>
                        </h1>
                        <p
                            style={{
                                color: "var(--color-text-muted)",
                                marginTop: "var(--space-xs)",
                            }}
                        >
                            Founder&apos;s Command Center — Full system overview
                        </p>
                    </div>
                    <div className="admin-shield-badge">
                        <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                        Service Role Access
                    </div>
                </div>

                {/* Metrics Row — always visible */}
                <div className="grid grid-cols-[repeat(auto-fit, minmax(200px, 1fr))] gap-4 mb-8">
                    <div className="p-6 bg-glass border border-edge rounded-lg text-center transition-all">
                        <div className="text-[2rem] mb-1">👥</div>
                        <div className="admin-metric-value">{totalUsers}</div>
                        <div className="admin-metric-label">Registered Users</div>
                    </div>
                    <div className="p-6 bg-glass border border-edge rounded-lg text-center transition-all">
                        <div className="text-[2rem] mb-1">🐴</div>
                        <div className="admin-metric-value">
                            {totalHorses.toLocaleString()}
                        </div>
                        <div className="admin-metric-label">Horses in Database</div>
                    </div>
                    <div className="p-6 bg-glass border border-edge rounded-lg text-center transition-all text-[#ef4444]">
                        <div className="text-[2rem] mb-1">📨</div>
                        <div className="admin-metric-value">{unreadMessages}</div>
                        <div className="admin-metric-label">Unread Messages</div>
                    </div>
                </div>

                {/* Tabbed sections */}
                <AdminTabs
                    messages={messages}
                    unreadCount={unreadMessages}
                    shows={allShows.map(s => ({
                        id: s.id,
                        title: s.title,
                        status: s.status,
                        endAt: s.endAt,
                        entryCount: s.entryCount,
                    }))}
                    suggestions={pendingSuggestions}
                    reports={reports}
                    catalogSuggestions={catalogSuggestions}
                />
            </div>
        </div>
    );
}
