import { createClient } from"@/lib/supabase/server";
import { getAdminClient } from"@/lib/supabase/admin";
import { redirect } from"next/navigation";
import { getPhotoShows } from"@/app/actions/shows";
import { getOpenReports } from"@/app/actions/moderation";
import { listPendingExternalShows } from"@/app/actions/external-shows";
import {
 getAdminPulse,
 getMigrationStatus,
 listLegacySuggestions,
 listSanctioningRequests,
} from"@/app/actions/admin";
import AdminTabs from"@/components/AdminTabs";
import CommandCenterLayout from"@/components/layouts/CommandCenterLayout";
import { Zap, Shield } from "lucide-react";

export const metadata = {
 title:"Admin Console",
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

 // One batched load. Everything below is either a service-role read or
 // a server action that re-gates on ADMIN_EMAIL — nothing admin-shaped
 // is ever fetched with the client key.
 const [
 unreadResult,
 messagesResult,
 allShows,
 legacyResult,
 reports,
 externalShowsResult,
 pulseResult,
 migrationsResult,
 sanctioningResult,
 catalogSuggestionsResult,
 ] = await Promise.all([
 supabaseAdmin.from("contact_messages").select("id", { count:"exact", head: true }).eq("is_read", false),
 supabaseAdmin
  .from("contact_messages")
  .select("id, name, email, subject, message, is_read, created_at")
  .order("created_at", { ascending: false })
  .limit(100),
 getPhotoShows(),
 // Legacy database_suggestions queue. Read through the service role
 // now: migration 020's only SELECT policy is "your own rows", so the
 // previous RLS-client read hid every other member's submission from
 // the admin — a queue that looks drained while rows sit in it.
 listLegacySuggestions(),
 getOpenReports(),
 // Calendar of record: pending external-show listings. The action
 // re-gates with requireAdmin() and degrades to [] pre-migration.
 listPendingExternalShows(),
 getAdminPulse(),
 getMigrationStatus(),
 listSanctioningRequests(),
 supabaseAdmin
  .from("catalog_suggestions")
  .select("id, user_id, catalog_item_id, suggestion_type, field_changes, reason, status, upvotes, downvotes, created_at")
  .eq("status","pending")
  .order("created_at", { ascending: true })
  .limit(50),
 ]);

 const unreadMessages = unreadResult.count ?? 0;
 const messages = (messagesResult.data as ContactMessage[]) ?? [];
 const pendingSuggestions = legacyResult.success ? legacyResult.suggestions : [];
 const pendingExternalShows = externalShowsResult.success ? externalShowsResult.shows : [];
 const pulse = pulseResult.success ? pulseResult.pulse : null;
 const migrations = migrationsResult.success ? migrationsResult.migrations : [];
 const sanctioningCount = sanctioningResult.success ? sanctioningResult.requests.length : 0;

 // Enrich catalog suggestions with their author — one keyed read, not
 // one per row.
 const catalogSuggestionRows = catalogSuggestionsResult.data ?? [];
 const authorIds = [...new Set(catalogSuggestionRows.map((r) => r.user_id as string))];
 const authorById = new Map<string, { alias_name: string | null; approved_suggestions_count: number | null }>();
 if (authorIds.length > 0) {
 const { data: authors } = await supabaseAdmin
  .from("users")
  .select("id, alias_name, approved_suggestions_count")
  .in("id", authorIds);
 for (const a of authors ?? []) {
  authorById.set(a.id as string, {
  alias_name: a.alias_name as string | null,
  approved_suggestions_count: a.approved_suggestions_count as number | null,
  });
 }
 }
 const catalogSuggestions = catalogSuggestionRows.map((row) => {
 const author = authorById.get(row.user_id as string);
 return {
  ...row,
  field_changes: (row.field_changes ?? {}) as Record<string, unknown>,
  author_alias: author?.alias_name ?? "Unknown",
  author_approved_count: author?.approved_suggestions_count ?? 0,
 };
 });

 return (
 <CommandCenterLayout
  title={<span className="inline-flex items-center gap-2 text-forest"><Zap className="h-6 w-6" /> Admin Console</span>}
  description="Founder's Command Center — Full system overview"
  headerActions={
  <div className="inline-flex items-center gap-2 rounded-full border border-forest/20 bg-forest/10 px-3 py-1.5 text-xs font-semibold text-forest">
   <Shield className="h-3.5 w-3.5" />
   Service Role Access
  </div>
  }
  mainContent={
  /*
   * One console, three layers: the pulse (what the house is doing and
   * what is waiting on you), the queues (one tab per thing that needs
   * a decision), and the read-only ops corner. The four cards that used
   * to float above the tabs with no context now live in the tab that
   * owns their subject — moderation under Members, sanctioning in its
   * own tab, catalog merge under Catalog, announcements under Content.
   */
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
   externalShows={pendingExternalShows}
   pulse={pulse}
   migrations={migrations}
   sanctioningCount={sanctioningCount}
  />
  }
 />
 );
}
