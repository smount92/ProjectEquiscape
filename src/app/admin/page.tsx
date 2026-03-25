import { createClient } from"@/lib/supabase/server";
import { getAdminClient } from"@/lib/supabase/admin";
import { redirect } from"next/navigation";
import { getPhotoShows } from"@/app/actions/shows";
import { getPendingSuggestions } from"@/app/actions/suggestions";
import { getOpenReports } from"@/app/actions/moderation";
import AdminTabs from"@/components/AdminTabs";

export const metadata = {
 title:"Admin Console — Model Horse Hub",
 description:"Founder's Command Center.",
};


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
 const [usersResult, horsesResult, unreadResult, messagesResult] = await Promise.all([
 supabaseAdmin.auth.admin.listUsers({ perPage: 1000, page: 1 }),
 supabaseAdmin.from("user_horses").select("id", { count:"exact", head: true }),
 supabaseAdmin.from("contact_messages").select("id", { count:"exact", head: true }).eq("is_read", false),
 supabaseAdmin
 .from("contact_messages")
 .select("id, name, email, subject, message, is_read, created_at")
 .order("created_at", { ascending: false })
 .limit(100),
 ]);

 const totalUsers = usersResult.data?.users?.length ?? 0;
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
 .eq("status","pending")
 .order("created_at", { ascending: true })
 .limit(50);

 // Enrich with author info
 const catalogSuggestions = [];
 for (const row of catalogSuggestionRows ?? []) {
 const { data: author } = await supabaseAdmin
 .from("users")
 .select("alias_name, approved_suggestions_count")
 .eq("id", row.user_id)
 .single();
 catalogSuggestions.push({
 ...row,
 field_changes: (row.field_changes ?? {}) as Record<string, unknown>,
 author_alias: author?.alias_name ?? "Unknown",
 author_approved_count: author?.approved_suggestions_count ?? 0,
 });
 }

 return (
 <div className="mx-auto max-w-[var(--max-width)] px-6 py-12">
 <div className="animate-fade-in-up">
 {/* Header */}
 <div className="sticky top-[var(--header-height)] z-40 flex items-center justify-between border-b border-edge bg-parchment-dark px-6 py-4">
 <div>
 <h1>
 <span className="text-forest">⚡ Admin Console</span>
 </h1>
 <p className="mt-1 text-muted">
 Founder&apos;s Command Center — Full system overview
 </p>
 </div>
 <div className="inline-flex items-center gap-2 rounded-full border border-edge bg-[rgba(44,85,69,0.1)] px-3 py-1.5 text-xs font-semibold text-forest max-md:hidden">
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
 <div className="grid-cols-[repeat(auto-fit,minmax(200px,1fr))] mb-8 grid gap-4">
 <div className="bg-glass border-edge rounded-lg border p-6 text-center transition-all">
 <div className="mb-1 text-[2rem]">👥</div>
 <div className="text-ink text-3xl leading-none font-bold">{totalUsers}</div>
 <div className="text-muted mt-1 text-xs font-medium">Registered Users</div>
 </div>
 <div className="bg-glass border-edge rounded-lg border p-6 text-center transition-all">
 <div className="mb-1 text-[2rem]">🐴</div>
 <div className="text-ink text-3xl leading-none font-bold">{totalHorses.toLocaleString()}</div>
 <div className="text-muted mt-1 text-xs font-medium">Horses in Database</div>
 </div>
 <div className="bg-glass border-edge rounded-lg border p-6 text-center text-[#ef4444] transition-all">
 <div className="mb-1 text-[2rem]">📨</div>
 <div className="text-ink text-3xl leading-none font-bold">{unreadMessages}</div>
 <div className="text-muted mt-1 text-xs font-medium">Unread Messages</div>
 </div>
 </div>

 {/* Tabbed sections */}
 <AdminTabs
 messages={messages}
 unreadCount={unreadMessages}
 shows={allShows.map((s) => ({
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
