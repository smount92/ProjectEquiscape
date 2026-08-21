"use server";

import { logger } from "@/lib/logger";

import { createClient } from "@supabase/supabase-js";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { Resend } from "resend";

import { escapeEmailHtml, renderBrandedEmail, renderEmailQuote } from "@/lib/email/layout";
import { formEngineEnabled } from "@/lib/forms/flag";
import { showStandingsEnabled } from "@/lib/shows/flags";
import {
  attachLoad,
  groupDuplicates,
  MAX_DUPLICATE_GROUPS,
  type DuplicateCandidate,
  type DuplicateGroup,
  type ItemLoad,
} from "@/lib/admin/catalogDuplicates";
import {
  buildNudgeContent,
  canNudgeAgain,
  classifyOverdueShow,
  cutoffDate,
  cutoffIso,
  nudgeLinkFor,
  sortOverdue,
  ENTRIES_CLOSED_STALLED_DAYS,
  JUDGING_NO_DEADLINE_DAYS,
  NUDGE_COOLDOWN_DAYS,
  RESULTS_REVIEW_STALLED_DAYS,
  RUNNING_IDLE_DAYS,
  RUNNING_PAST_DATE_DAYS,
  type OverdueReason,
  type OverdueShowInput,
} from "@/lib/admin/overdueShows";

async function verifyAdmin() {
  const authClient = await createAuthClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  const adminEmail = process.env.ADMIN_EMAIL;

  if (!user || !user.email || !adminEmail) return null;
  if (user.email.toLowerCase() !== adminEmail.toLowerCase()) return null;

  return user;
}

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Toggle a contact message's is_read status.
 */
export async function toggleMessageRead(
  messageId: string,
  isRead: boolean
): Promise<{ success: boolean; error?: string }> {
  const user = await verifyAdmin();
  if (!user) return { success: false, error: "Unauthorized" };

  const { error } = await getAdminSupabase()
    .from("contact_messages")
    .update({ is_read: isRead })
    .eq("id", messageId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Delete a contact message permanently.
 */
export async function deleteContactMessage(
  messageId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await verifyAdmin();
  if (!user) return { success: false, error: "Unauthorized" };

  const { error } = await getAdminSupabase()
    .from("contact_messages")
    .delete()
    .eq("id", messageId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Reply to a contact message via Resend email — sent directly from the admin console.
 * Auto-marks the original message as read after sending.
 */
export async function replyToContactMessage(
  messageId: string,
  recipientEmail: string,
  recipientName: string,
  originalSubject: string | null,
  originalMessage: string,
  replyBody: string
): Promise<{ success: boolean; error?: string }> {
  const user = await verifyAdmin();
  if (!user) return { success: false, error: "Unauthorized" };

  if (!replyBody.trim()) return { success: false, error: "Reply cannot be empty." };

  const resend = new Resend(process.env.RESEND_API_KEY);
  const fromEmail = process.env.RESEND_FROM_EMAIL || "Model Horse Hub <noreply@modelhorsehub.com>";
  const replyToEmail = user.email || process.env.ADMIN_EMAIL || "";

  const subject = `Re: ${originalSubject || "Your message to Model Horse Hub"}`;

  // Shared branded shell. This template predated lib/email/layout.ts and
  // carried the retired indigo palette plus its own escapeHtml. No CTA —
  // the member replies to this mail, they don't click through — and no
  // "Notification settings" link, because an answer to a message you sent
  // us is not something you can switch off.
  const html = renderBrandedEmail({
    title: subject,
    heading: "A reply from Model Horse Hub",
    bodyHtml: `
      <p style="margin:0 0 14px 0;">Hi ${escapeEmailHtml(recipientName)},</p>
      <div style="white-space:pre-wrap;margin:0 0 22px 0;">${escapeEmailHtml(replyBody.trim())}</div>
      ${renderEmailQuote(originalMessage, "Your original message")}`,
    footerNote: "You're getting this because you wrote to Model Horse Hub. Just reply to answer.",
    hideSettingsLink: true,
  });

  try {
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: recipientEmail,
      replyTo: replyToEmail,
      subject,
      html,
    });

    if (error) {
      logger.error("Admin Reply", "Resend error", error);
      return { success: false, error: `Email failed: ${error.message}` };
    }
  } catch (err) {
    logger.error("Admin Reply", "Unexpected error", err);
    return { success: false, error: "Failed to send email. Check Resend configuration." };
  }

  // Auto-mark as read after replying
  await getAdminSupabase()
    .from("contact_messages")
    .update({ is_read: true })
    .eq("id", messageId);

  return { success: true };
}

/**
 * Feature a horse (Horse of the Week / spotlight).
 * Admin-only — uses Service Role to insert into featured_horses.
 */
export async function featureHorse(data: {
  horseId: string;
  title: string;
  description?: string;
  expiresAt?: string;
}): Promise<{ success: boolean; error?: string }> {
  const user = await verifyAdmin();
  if (!user) return { success: false, error: "Unauthorized" };

  if (!data.horseId.trim() || !data.title.trim()) {
    return { success: false, error: "Horse ID and title are required." };
  }

  // Verify horse exists and is public
  const supabaseAdmin = getAdminSupabase();
  const { data: horse } = await supabaseAdmin
    .from("user_horses")
    .select("id, is_public")
    .eq("id", data.horseId)
    .single();

  if (!horse) return { success: false, error: "Horse not found." };
  if (!(horse as { is_public: boolean }).is_public) {
    return { success: false, error: "Horse must be public to be featured." };
  }

  const { error } = await supabaseAdmin
    .from("featured_horses")
    .insert({
      horse_id: data.horseId,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      expires_at: data.expiresAt || null,
      created_by: user.id,
    });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Suspend a user site-wide (v4 safety, migration 148). Two stamps:
 * app_metadata.is_suspended (requireAuth throws on it — takes effect
 * on the user's next server-validated request, no extra query) and
 * users.is_suspended (RLS backstop on the entries INSERT policy +
 * the admin list). Suspension blocks every mutation but leaves
 * content readable; it is fully reversible via unsuspendUser.
 */
// ── Announcements (banner phase 1 — owner-authored) ──

export interface AdminAnnouncement {
  id: string;
  message: string;
  linkUrl: string | null;
  placement: string;
  startsAt: string;
  endsAt: string | null;
}

/** Untyped access until 165 is in generated types. */
type AnnouncementsTable = (table: "announcements") => {
  select: (cols: string) => {
    order: (
      col: string,
      opts: { ascending: boolean },
    ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  };
  insert: (row: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }>;
  delete: () => {
    eq: (col: string, val: string) => PromiseLike<{ error: { message: string } | null }>;
  };
};

export async function listAnnouncements(): Promise<
  { success: true; announcements: AdminAnnouncement[] } | { success: false; error: string }
> {
  const user = await verifyAdmin();
  if (!user) return { success: false, error: "Unauthorized" };
  const from = getAdminSupabase().from.bind(getAdminSupabase()) as unknown as AnnouncementsTable;
  const { data, error } = await from("announcements")
    .select("id, message, link_url, placement, starts_at, ends_at")
    .order("created_at", { ascending: false });
  if (error) return { success: false, error: error.message };
  const rows = (Array.isArray(data) ? data : []) as {
    id: string;
    message: string;
    link_url: string | null;
    placement: string;
    starts_at: string;
    ends_at: string | null;
  }[];
  return {
    success: true,
    announcements: rows.map((r) => ({
      id: r.id,
      message: r.message,
      linkUrl: r.link_url,
      placement: r.placement,
      startsAt: r.starts_at,
      endsAt: r.ends_at,
    })),
  };
}

export async function createAnnouncement(input: {
  message: string;
  linkUrl?: string;
  endsAt?: string;
  placement?: "site" | "stable" | "shows";
}): Promise<{ success: boolean; error?: string }> {
  const user = await verifyAdmin();
  if (!user) return { success: false, error: "Unauthorized" };
  const message = input.message.trim();
  if (!message || message.length > 300) {
    return { success: false, error: "Announcement text must be 1–300 characters." };
  }
  const from = getAdminSupabase().from.bind(getAdminSupabase()) as unknown as AnnouncementsTable;
  const { error } = await from("announcements").insert({
    message,
    link_url: input.linkUrl?.trim() || null,
    ends_at: input.endsAt || null,
    placement: input.placement ?? "site",
    created_by: user.id,
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deleteAnnouncement(id: string): Promise<{ success: boolean; error?: string }> {
  const user = await verifyAdmin();
  if (!user) return { success: false, error: "Unauthorized" };
  const from = getAdminSupabase().from.bind(getAdminSupabase()) as unknown as AnnouncementsTable;
  const { error } = await from("announcements").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function suspendUser(
  userId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const user = await verifyAdmin();
  if (!user) return { success: false, error: "Unauthorized" };
  if (userId === user.id) return { success: false, error: "You cannot suspend yourself." };
  const trimmedReason = reason.trim();
  if (!trimmedReason) return { success: false, error: "Give a reason — it lands on the audit trail." };

  const admin = getAdminSupabase();

  const { data: target, error: fetchError } = await admin.auth.admin.getUserById(userId);
  if (fetchError || !target?.user) return { success: false, error: "User not found." };

  const { error: authError } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { ...target.user.app_metadata, is_suspended: true },
  });
  if (authError) return { success: false, error: authError.message };

  const { error: dbError } = await admin
    .from("users")
    .update({
      is_suspended: true,
      suspended_at: new Date().toISOString(),
      suspended_reason: trimmedReason,
    })
    .eq("id", userId);
  if (dbError) {
    logger.error("Admin", `users.is_suspended write failed for ${userId} (app_metadata IS set)`, dbError);
    return { success: false, error: "Suspension partially applied — retry to sync the database flag." };
  }

  // Kill live sessions (audit S5): app_metadata only lands in NEW
  // tokens — an open tab keeps a valid JWT until expiry, which let a
  // just-suspended user keep voting/judging via direct PostgREST.
  // signOut revokes their refresh tokens; access tokens then die at
  // their (short) natural expiry. Best-effort — the suspension stands.
  try {
    await admin.auth.admin.signOut(userId, "global");
  } catch (err) {
    logger.error("Admin", `session revocation failed for suspended user ${userId}`, err);
  }

  return { success: true };
}

/** Reverse suspendUser — clears both stamps. */
export async function unsuspendUser(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await verifyAdmin();
  if (!user) return { success: false, error: "Unauthorized" };

  const admin = getAdminSupabase();

  const { data: target, error: fetchError } = await admin.auth.admin.getUserById(userId);
  if (fetchError || !target?.user) return { success: false, error: "User not found." };

  const { error: authError } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { ...target.user.app_metadata, is_suspended: false },
  });
  if (authError) return { success: false, error: authError.message };

  const { error: dbError } = await admin
    .from("users")
    .update({ is_suspended: false, suspended_at: null, suspended_reason: null })
    .eq("id", userId);
  if (dbError) return { success: false, error: dbError.message };

  return { success: true };
}

/** Alias-based wrappers so the admin console doesn't need a user-id lookup UI. */
export async function suspendUserByAlias(
  alias: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const user = await verifyAdmin();
  if (!user) return { success: false, error: "Unauthorized" };
  const { data: target } = await getAdminSupabase()
    .from("users")
    .select("id, alias_name")
    .ilike("alias_name", alias.trim())
    .maybeSingle();
  if (!target) return { success: false, error: `No user with alias "${alias.trim()}".` };
  return suspendUser((target as { id: string }).id, reason);
}

export async function unsuspendUserByAlias(
  alias: string
): Promise<{ success: boolean; error?: string }> {
  const user = await verifyAdmin();
  if (!user) return { success: false, error: "Unauthorized" };
  const { data: target } = await getAdminSupabase()
    .from("users")
    .select("id")
    .ilike("alias_name", alias.trim())
    .maybeSingle();
  if (!target) return { success: false, error: `No user with alias "${alias.trim()}".` };
  return unsuspendUser((target as { id: string }).id);
}

/**
 * Merge a duplicate catalog item into its canonical entry — the North
 * Light repair (two suggestion batches created the same sculpts under
 * different makers), as a button instead of owner SQL. Repoints every
 * reference (horses, wishlists, id-suggestions, catalog suggestions,
 * changelog, child molds), logs to the changelog, then deletes the
 * duplicate. Accepts UUIDs or slugs.
 */
export async function mergeCatalogItems(
  duplicateRef: string,
  canonicalRef: string
): Promise<{ success: boolean; error?: string; summary?: string }> {
  const user = await verifyAdmin();
  if (!user) return { success: false, error: "Unauthorized" };

  const admin = getAdminSupabase();
  const resolve = async (ref: string) => {
    const clean = ref.trim();
    if (!clean) return null;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);
    const { data } = await admin
      .from("catalog_items")
      .select("id, title, maker, slug")
      .eq(isUuid ? "id" : "slug", isUuid ? clean : clean.toLowerCase())
      .maybeSingle();
    return data as { id: string; title: string; maker: string | null; slug: string | null } | null;
  };

  const dup = await resolve(duplicateRef);
  if (!dup) return { success: false, error: `Duplicate "${duplicateRef}" not found (id or slug).` };
  const canonical = await resolve(canonicalRef);
  if (!canonical) return { success: false, error: `Canonical "${canonicalRef}" not found (id or slug).` };
  if (dup.id === canonical.id) return { success: false, error: "Those are the same entry." };

  const repoints: [string, string][] = [
    ["user_horses", "catalog_id"],
    ["user_wishlists", "catalog_id"],
    ["id_suggestions", "catalog_id"],
    ["catalog_suggestions", "catalog_item_id"],
    ["catalog_changelog", "catalog_item_id"],
    ["catalog_items", "parent_id"],
  ];
  let moved = 0;
  for (const [table, column] of repoints) {
    const { data, error } = await admin
      .from(table)
      .update({ [column]: canonical.id })
      .eq(column, dup.id)
      .select("id");
    if (error) return { success: false, error: `Repointing ${table}.${column} failed: ${error.message}` };
    moved += data?.length ?? 0;
  }

  const { error: logError } = await admin.from("catalog_changelog").insert({
    catalog_item_id: canonical.id,
    change_type: "removal",
    change_summary: `Merged duplicate "${dup.title}" (${dup.maker ?? "unknown"}) into "${canonical.title}" — references repointed.`,
    contributed_by: user.id,
    contributor_alias: "Admin",
    approved_by: user.id,
  });
  if (logError) logger.error("Admin", "Merge changelog write failed (continuing)", logError);

  const { error: deleteError } = await admin.from("catalog_items").delete().eq("id", dup.id);
  if (deleteError) return { success: false, error: `Delete failed: ${deleteError.message}` };

  return {
    success: true,
    summary: `Merged "${dup.title}" into "${canonical.title}" — ${moved} reference${moved === 1 ? "" : "s"} repointed.`,
  };
}

// ── MHH sanctioning requests (Season 1 manual approval) ──
// createShow tags a non-admin host's request by appending
// "[Host requested MHH sanctioning]" to sanctioning_note and forcing
// is_mhh_qualifying=false. These actions surface that queue on /admin
// and grant (or dismiss) the request via the service role.

const SANCTIONING_REQUEST_MARKER = "[Host requested MHH sanctioning]";

export interface SanctioningRequestRow {
  showId: string;
  title: string;
  status: string;
  showYear: number | null;
  hostAlias: string;
  createdAt: string;
  /** The host's own note text, marker stripped. */
  note: string | null;
}

export async function listSanctioningRequests(): Promise<
  { success: true; requests: SanctioningRequestRow[] } | { success: false; error: string }
> {
  const user = await verifyAdmin();
  if (!user) return { success: false, error: "Unauthorized" };

  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("shows")
    .select("id, title, status, show_year, host_id, sanctioning_note, created_at")
    .eq("is_mhh_qualifying", false)
    .ilike("sanctioning_note", `%${SANCTIONING_REQUEST_MARKER}%`)
    .order("created_at", { ascending: true });
  if (error) return { success: false, error: error.message };

  const rows = data ?? [];
  const hostIds = [...new Set(rows.map((s) => s.host_id as string))];
  const aliasById = new Map<string, string>();
  if (hostIds.length > 0) {
    const { data: hosts } = await admin.from("users").select("id, alias_name").in("id", hostIds);
    for (const h of hosts ?? []) {
      if (h.alias_name) aliasById.set(h.id as string, h.alias_name as string);
    }
  }

  return {
    success: true,
    requests: rows.map((s) => ({
      showId: s.id as string,
      title: (s.title as string) ?? "Untitled show",
      status: (s.status as string) ?? "draft",
      showYear: (s.show_year as number | null) ?? null,
      hostAlias: aliasById.get(s.host_id as string) ?? "Unknown host",
      createdAt: s.created_at as string,
      note:
        ((s.sanctioning_note as string | null) ?? "")
          .replace(SANCTIONING_REQUEST_MARKER, "")
          .trim() || null,
    })),
  };
}

/**
 * Resolve a sanctioning request: grant flips is_mhh_qualifying on and
 * notifies the host; dismiss just clears the request marker (the host
 * can ask again via show settings). Both strip the marker so the show
 * leaves the queue either way.
 */
export async function resolveSanctioningRequest(
  showId: string,
  decision: "grant" | "dismiss"
): Promise<{ success: boolean; error?: string }> {
  const user = await verifyAdmin();
  if (!user) return { success: false, error: "Unauthorized" };
  if (decision !== "grant" && decision !== "dismiss") {
    return { success: false, error: "Unknown decision." };
  }

  const admin = getAdminSupabase();
  const { data: show, error: readError } = await admin
    .from("shows")
    .select("id, title, host_id, sanctioning_note, is_mhh_qualifying")
    .eq("id", showId)
    .maybeSingle();
  if (readError) return { success: false, error: readError.message };
  if (!show) return { success: false, error: "Show not found." };

  const strippedNote =
    ((show.sanctioning_note as string | null) ?? "")
      .replace(SANCTIONING_REQUEST_MARKER, "")
      .trim() || null;

  const { error: updateError } = await admin
    .from("shows")
    .update({
      sanctioning_note: strippedNote,
      ...(decision === "grant" ? { is_mhh_qualifying: true } : {}),
    })
    .eq("id", showId);
  if (updateError) return { success: false, error: updateError.message };

  if (decision === "grant") {
    // House pattern: dynamic import + try/catch — createNotification is
    // server-only and must never take the action down with it.
    try {
      const { createNotification } = await import("@/lib/notifications/createNotification");
      await createNotification({
        userId: show.host_id as string,
        type: "show_moderation",
        content: `🏅 "${show.title}" is now MHH Sanctioned — placings there earn Championship Series points and can mint qualification cards.`,
        linkUrl: `/shows/host/${showId}`,
      });
    } catch (err) {
      logger.error("Admin", "Sanctioning grant notification failed (continuing)", err);
    }
  }

  return { success: true };
}

// ══════════════════════════════════════════════════════════════
// Legacy database_suggestions queue (migration 020)
//
// WHY THIS LIVES HERE AND NOT IN actions/suggestions.ts
// ─────────────────────────────────────────────────────
// The owner reported a pending row in Admin → Content that would not
// clear no matter how often Approve or Reject was pressed. The cause is
// in the legacy `reviewSuggestion` (actions/suggestions.ts): its status
// UPDATE writes `reviewed_at`, a column `database_suggestions` has
// NEVER had. Migration 020 creates exactly id / submitted_by /
// suggestion_type / name / details / status / admin_notes / created_at.
// `reviewed_at` belongs to the NEWER pipelines (catalog_suggestions,
// external_shows) and was copied across. PostgREST answers an unknown
// column with PGRST204 ("Could not find the 'reviewed_at' column … in
// the schema cache"), the UPDATE affects zero rows, the row stays
// 'pending' forever — and AdminSuggestionsPanel discarded the error, so
// the button just blinked. On Approve it was worse than a no-op: the
// catalog_items INSERT ran and SUCCEEDED first, so every retry minted
// another duplicate catalog row before failing to clear the queue.
//
// These replacements go through verifyAdmin + the service role like the
// rest of the console, never write reviewed_at, surface their errors,
// de-duplicate the approve insert, and add a Dismiss that touches
// nothing but the status.
// ══════════════════════════════════════════════════════════════

/** Postgres check_violation — the status CHECK refused the value. */
const CHECK_VIOLATION = "23514";

export interface LegacySuggestionRow {
  id: string;
  suggestionType: string;
  name: string;
  details: string | null;
  createdAt: string;
  submitterAlias: string;
}

/**
 * The legacy queue, read with the service role.
 *
 * The old reader used the request-scoped (RLS) client, and 020's only
 * SELECT policy is `submitted_by = auth.uid()` — no admin arm. So the
 * admin queue never showed anybody's suggestions but the admin's own:
 * a queue that looks drained while other members' rows sit in it.
 */
export async function listLegacySuggestions(): Promise<
  { success: true; suggestions: LegacySuggestionRow[] } | { success: false; error: string }
> {
  const user = await verifyAdmin();
  if (!user) return { success: false, error: "Unauthorized" };

  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("database_suggestions")
    .select("id, suggestion_type, name, details, created_at, submitted_by")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(200);

  // Feature-detect: if the table was ever dropped the console must not
  // 500 — the section is meant to retire, after all.
  if (error) {
    logger.error("Admin", "Legacy suggestion queue read failed", error);
    return { success: true, suggestions: [] };
  }

  const rows = (data ?? []) as {
    id: string;
    suggestion_type: string;
    name: string;
    details: string | null;
    created_at: string;
    submitted_by: string;
  }[];
  if (rows.length === 0) return { success: true, suggestions: [] };

  const aliasById = new Map<string, string>();
  const submitterIds = [...new Set(rows.map((r) => r.submitted_by))];
  const { data: submitters } = await admin
    .from("users")
    .select("id, alias_name")
    .in("id", submitterIds);
  for (const s of (submitters ?? []) as { id: string; alias_name: string | null }[]) {
    if (s.alias_name) aliasById.set(s.id, s.alias_name);
  }

  return {
    success: true,
    suggestions: rows.map((r) => ({
      id: r.id,
      suggestionType: r.suggestion_type,
      name: r.name,
      details: r.details,
      createdAt: r.created_at,
      submitterAlias: aliasById.get(r.submitted_by) ?? "Unknown member",
    })),
  };
}

const LEGACY_ITEM_TYPES: Record<string, string> = {
  mold: "plastic_mold",
  release: "plastic_release",
  resin: "artist_resin",
};

/**
 * Clear one legacy suggestion.
 *
 * approve  — mints the catalog entry (skipped if an identical
 *            title + item_type already exists, because the broken
 *            version could mint one on every failed retry), then
 *            stamps the row 'approved'.
 * reject   — stamps 'rejected'. No catalog write.
 * dismiss  — junk / duplicate / no-longer-relevant. NO side effects at
 *            all. Prefers a 'dismissed' status and falls back to
 *            'rejected' + an admin_notes marker when 020's CHECK
 *            (pending | approved | rejected) refuses it, so the row can
 *            always be cleared without a migration.
 */
export async function resolveLegacySuggestion(
  id: string,
  decision: "approve" | "reject" | "dismiss",
  adminNotes?: string
): Promise<{ success: boolean; error?: string }> {
  const user = await verifyAdmin();
  if (!user) return { success: false, error: "Unauthorized" };
  if (decision !== "approve" && decision !== "reject" && decision !== "dismiss") {
    return { success: false, error: "Unknown decision." };
  }

  const admin = getAdminSupabase();
  const { data: row, error: readError } = await admin
    .from("database_suggestions")
    .select("id, suggestion_type, name, details, status")
    .eq("id", id)
    .maybeSingle();
  if (readError) return { success: false, error: readError.message };
  if (!row) return { success: false, error: "Suggestion not found — it may already be cleared." };

  const suggestion = row as {
    suggestion_type: string;
    name: string;
    details: string | null;
    status: string;
  };

  if (decision === "approve") {
    const itemType = LEGACY_ITEM_TYPES[suggestion.suggestion_type];
    if (!itemType) {
      return {
        success: false,
        error: `Unknown suggestion type "${suggestion.suggestion_type}" — use Dismiss to clear it.`,
      };
    }

    const title = suggestion.name.trim();
    // The maker guess is the legacy behaviour, preserved: first line or
    // first comma-segment of the free-text details.
    const makerGuess = (suggestion.details ?? "").split(/[,\n]/)[0]?.trim() || "Unknown";

    const { data: existing } = await admin
      .from("catalog_items")
      .select("id")
      .eq("item_type", itemType)
      .ilike("title", title)
      .limit(1);

    if (!existing || existing.length === 0) {
      const { data: inserted, error: insertError } = await admin
        .from("catalog_items")
        .insert({ item_type: itemType, title, maker: makerGuess })
        .select("id")
        .single();
      if (insertError) {
        return { success: false, error: `Catalog insert failed: ${insertError.message}` };
      }
      // Leave a changelog trail (the old path never did — approvals were
      // invisible in the Registry's history and weekly counts). Best
      // effort: a missing id or failed log never blocks the approve.
      const newId = (inserted as { id: string } | null)?.id ?? null;
      if (newId) {
        const { error: logError } = await admin.from("catalog_changelog").insert({
          catalog_item_id: newId,
          change_type: "addition",
          change_summary: `Added "${title}" (${itemType}) from the legacy suggestion queue.`,
          contributed_by: user.id,
          contributor_alias: "Admin",
          approved_by: user.id,
        });
        if (logError) {
          logger.error("Admin", "Legacy-approve changelog write failed (continuing)", logError);
        }
      }
    }
  }

  const note =
    adminNotes?.trim() ||
    (decision === "dismiss" ? "Dismissed from the legacy queue — no catalog change." : null);

  // ROOT-CAUSE FIX: no `reviewed_at`. The column does not exist on this
  // table and writing it is what jammed the queue.
  const stamp = async (status: string, notes: string | null) =>
    admin.from("database_suggestions").update({ status, admin_notes: notes }).eq("id", id);

  const targetStatus =
    decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "dismissed";

  let { error } = await stamp(targetStatus, note);

  if (error && decision === "dismiss" && (error as { code?: string }).code === CHECK_VIOLATION) {
    // 020's CHECK predates 'dismissed'. Land the row as 'rejected' with
    // a marker — same outcome for the queue, no migration required.
    ({ error } = await stamp("rejected", `[dismissed] ${note ?? ""}`.trim()));
  }

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ══════════════════════════════════════════════════════════════
// Members — alias search + suspension state
//
// `users.is_suspended` (148) was deliberately never granted to the
// client key, so this read MUST be service-role; that is exactly why it
// lives behind verifyAdmin here instead of in a client component.
// ══════════════════════════════════════════════════════════════

export interface AdminMemberRow {
  id: string;
  alias: string;
  email: string | null;
  createdAt: string | null;
  isSuspended: boolean;
  suspendedAt: string | null;
  suspendedReason: string | null;
  isSupporter: boolean;
  horseCount: number;
}

/**
 * Search members by alias (substring, case-insensitive). An empty query
 * returns the newest members, so the tab is useful before you type.
 */
export async function searchMembers(
  query: string
): Promise<{ success: true; members: AdminMemberRow[] } | { success: false; error: string }> {
  const user = await verifyAdmin();
  if (!user) return { success: false, error: "Unauthorized" };

  const admin = getAdminSupabase();
  const trimmed = query.trim();

  let request = admin
    .from("users")
    .select(
      "id, alias_name, email, created_at, is_suspended, suspended_at, suspended_reason, is_supporter"
    );
  if (trimmed) request = request.ilike("alias_name", `%${trimmed}%`);

  const { data, error } = await request.order("created_at", { ascending: false }).limit(25);
  if (error) return { success: false, error: error.message };

  const rows = (data ?? []) as {
    id: string;
    alias_name: string | null;
    email: string | null;
    created_at: string | null;
    is_suspended: boolean | null;
    suspended_at: string | null;
    suspended_reason: string | null;
    is_supporter: boolean | null;
  }[];
  if (rows.length === 0) return { success: true, members: [] };

  // One grouped count instead of N head-counts.
  const horseCounts = new Map<string, number>();
  const { data: horses } = await admin
    .from("user_horses")
    .select("owner_id")
    .in(
      "owner_id",
      rows.map((r) => r.id)
    );
  for (const h of (horses ?? []) as { owner_id: string }[]) {
    horseCounts.set(h.owner_id, (horseCounts.get(h.owner_id) ?? 0) + 1);
  }

  return {
    success: true,
    members: rows.map((r) => ({
      id: r.id,
      alias: r.alias_name ?? "(no alias)",
      email: r.email,
      createdAt: r.created_at,
      isSuspended: r.is_suspended === true,
      suspendedAt: r.suspended_at,
      suspendedReason: r.suspended_reason,
      isSupporter: r.is_supporter === true,
      horseCount: horseCounts.get(r.id) ?? 0,
    })),
  };
}

// ══════════════════════════════════════════════════════════════
// The pulse — launch-week numbers, one batched service-role load
//
// Honest counts only: no timeseries store, no sampling, no derived
// "engagement". Every number is a COUNT the admin could run by hand,
// and every one of them feature-detects to null rather than throwing,
// because several of the tables behind them arrive with hand-pasted
// migrations that may not be applied yet.
// ══════════════════════════════════════════════════════════════

/** Statuses that mean "this show is live business right now". */
const OPEN_SHOW_STATUSES = [
  "published",
  "entries_open",
  "entries_closed",
  "running",
  "judging",
  "results_review",
];

export interface AdminPulse {
  totalMembers: number;
  newMembers7d: number | null;
  totalHorses: number;
  posts7d: number | null;
  liveListings: number | null;
  openShows: number | null;
  openShowEntries: number | null;
  pending: {
    reports: number | null;
    sanctioning: number | null;
    barnJoinRequests: number | null;
    catalogSuggestions: number | null;
    contactMessages: number | null;
    legacySuggestions: number | null;
    externalShows: number | null;
  };
}

type CountResult = { count: number | null; error: unknown };

/** A head-count that answers null instead of throwing when the shape isn't there. */
function countOf(result: PromiseSettledResult<CountResult>): number | null {
  if (result.status !== "fulfilled") return null;
  if (result.value.error) return null;
  return result.value.count ?? 0;
}

export async function getAdminPulse(): Promise<
  { success: true; pulse: AdminPulse } | { success: false; error: string }
> {
  const user = await verifyAdmin();
  if (!user) return { success: false, error: "Unauthorized" };

  const admin = getAdminSupabase();
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const head = (table: string) => admin.from(table).select("id", { count: "exact", head: true });

  // Barn join requests waiting on the admin specifically: pending rows
  // in barns where the admin is staff. Two steps — the barns first,
  // then the requests — because PostgREST cannot join for a head count.
  const adminStaffBarns = (async (): Promise<CountResult> => {
    const { data: memberships, error: mErr } = await admin
      .from("group_memberships")
      .select("group_id, role")
      .eq("user_id", user.id)
      .in("role", ["owner", "admin", "moderator"]);
    if (mErr) return { count: null, error: mErr };
    const groupIds = (memberships ?? []).map((m) => (m as { group_id: string }).group_id);
    if (groupIds.length === 0) return { count: 0, error: null };
    const { count, error } = await admin
      .from("barn_join_requests")
      .select("user_id", { count: "exact", head: true })
      .eq("status", "pending")
      .in("group_id", groupIds);
    return { count, error };
  })();

  // Open shows, and the entries sitting in them.
  const openShowsAndEntries = (async (): Promise<{
    shows: number | null;
    entries: number | null;
  }> => {
    const { data, error } = await admin
      .from("shows")
      .select("id")
      .in("status", OPEN_SHOW_STATUSES)
      .limit(500);
    if (error) return { shows: null, entries: null };
    const ids = (data ?? []).map((s) => (s as { id: string }).id);
    if (ids.length === 0) return { shows: 0, entries: 0 };
    const { count, error: entryError } = await admin
      .from("show_class_entries")
      .select("id", { count: "exact", head: true })
      .in("show_id", ids);
    return { shows: ids.length, entries: entryError ? null : (count ?? 0) };
  })();

  const [
    authUsers,
    newMembers,
    horses,
    posts,
    listings,
    reports,
    catalogSuggestions,
    contactMessages,
    legacySuggestions,
    externalShows,
    barnRequests,
    shows,
    sanctioning,
  ] = await Promise.allSettled([
    admin.auth.admin.listUsers({ perPage: 1000, page: 1 }),
    head("users").gte("created_at", since7d) as unknown as Promise<CountResult>,
    head("user_horses") as unknown as Promise<CountResult>,
    head("posts").gte("created_at", since7d) as unknown as Promise<CountResult>,
    head("user_horses").eq("trade_status", "For Sale") as unknown as Promise<CountResult>,
    head("user_reports").eq("status", "open") as unknown as Promise<CountResult>,
    head("catalog_suggestions").eq("status", "pending") as unknown as Promise<CountResult>,
    head("contact_messages").eq("is_read", false) as unknown as Promise<CountResult>,
    head("database_suggestions").eq("status", "pending") as unknown as Promise<CountResult>,
    head("external_shows").eq("status", "pending") as unknown as Promise<CountResult>,
    adminStaffBarns,
    openShowsAndEntries,
    (async (): Promise<CountResult> => {
      const { count, error } = await admin
        .from("shows")
        .select("id", { count: "exact", head: true })
        .eq("is_mhh_qualifying", false)
        .ilike("sanctioning_note", `%${SANCTIONING_REQUEST_MARKER}%`);
      return { count, error };
    })(),
  ]);

  const showsValue =
    shows.status === "fulfilled"
      ? (shows.value as { shows: number | null; entries: number | null })
      : { shows: null, entries: null };

  return {
    success: true,
    pulse: {
      totalMembers:
        authUsers.status === "fulfilled"
          ? ((authUsers.value as { data?: { users?: unknown[] } }).data?.users?.length ?? 0)
          : 0,
      newMembers7d: countOf(newMembers as PromiseSettledResult<CountResult>),
      totalHorses: countOf(horses as PromiseSettledResult<CountResult>) ?? 0,
      posts7d: countOf(posts as PromiseSettledResult<CountResult>),
      liveListings: countOf(listings as PromiseSettledResult<CountResult>),
      openShows: showsValue.shows,
      openShowEntries: showsValue.entries,
      pending: {
        reports: countOf(reports as PromiseSettledResult<CountResult>),
        sanctioning: countOf(sanctioning as PromiseSettledResult<CountResult>),
        barnJoinRequests: countOf(barnRequests as PromiseSettledResult<CountResult>),
        catalogSuggestions: countOf(catalogSuggestions as PromiseSettledResult<CountResult>),
        contactMessages: countOf(contactMessages as PromiseSettledResult<CountResult>),
        legacySuggestions: countOf(legacySuggestions as PromiseSettledResult<CountResult>),
        externalShows: countOf(externalShows as PromiseSettledResult<CountResult>),
      },
    },
  };
}

// ══════════════════════════════════════════════════════════════
// Ops corner — which hand-pasted migrations are actually applied
//
// Migrations here are pasted into the Supabase SQL editor by hand, so
// the running schema and the repo can legitimately disagree. Each entry
// carries ONE cheap probe: selecting a missing column is a PostgREST
// 42703 and a missing table 42P01, so a single `limit(1)` per migration
// answers "is this in?" without a schema-introspection grant.
//
// Some migrations only widen a CHECK or replace a function body. Those
// are honestly reported as "can't tell from here" rather than guessed.
// ══════════════════════════════════════════════════════════════

type MigrationProbe =
  | { kind: "column"; table: string; column: string }
  | { kind: "rpc"; fn: string }
  | { kind: "none"; why: string };

interface MigrationSpec {
  id: string;
  title: string;
  summary: string;
  probe: MigrationProbe;
}

const PENDING_MIGRATIONS: MigrationSpec[] = [
  {
    id: "166",
    title: "Social spine",
    summary: "posts.kind + posts.visibility — one feed, per-post audience.",
    probe: { kind: "column", table: "posts", column: "kind" },
  },
  {
    id: "167",
    title: "Barns",
    summary: "groups.is_private + barn_join_requests + private-barn RLS.",
    probe: { kind: "column", table: "groups", column: "is_private" },
  },
  {
    id: "168",
    title: "Events rework",
    summary: "Widens the event_type CHECK for external_show + club.",
    probe: {
      kind: "none",
      why: "CHECK-constraint widening — nothing to select. createEvent already degrades to 'other'/'meetup' until it's in.",
    },
  },
  {
    id: "169",
    title: "Market completion",
    summary: "get_market_listings RPC, mv_trusted_sellers, anon favourite counts.",
    probe: { kind: "rpc", fn: "get_market_listings_total" },
  },
  {
    id: "170",
    title: "Art studio",
    summary: "artist_profiles terms/services/waitlist + three RLS gap fixes.",
    probe: { kind: "column", table: "artist_profiles", column: "services" },
  },
  {
    id: "171",
    title: "Profile customization",
    summary: "users.profile_customization jsonb (theme, tagline, featured).",
    probe: { kind: "column", table: "users", column: "profile_customization" },
  },
  {
    id: "172",
    title: "Commerce bugfixes",
    summary: "Widens chk_trade_status; rewrites respond_to_offer_atomic.",
    probe: {
      kind: "none",
      why: "A CHECK widening and a function body — neither is visible to a select. Verify by flagging a horse 'Stolen/Missing' or declining an offer.",
    },
  },
  {
    id: "173",
    title: "Deal room",
    summary: "messages.kind/payload, conversation_participants, deal terms.",
    probe: { kind: "column", table: "messages", column: "kind" },
  },
];

export interface MigrationStatusRow {
  id: string;
  title: string;
  summary: string;
  /** true = probe found it, false = probe says it's missing, null = not probe-able. */
  applied: boolean | null;
  /** Present when applied is null — why the probe can't answer. */
  note?: string;
}

export async function getMigrationStatus(): Promise<
  { success: true; migrations: MigrationStatusRow[] } | { success: false; error: string }
> {
  const user = await verifyAdmin();
  if (!user) return { success: false, error: "Unauthorized" };

  const admin = getAdminSupabase();

  const probes = await Promise.allSettled(
    PENDING_MIGRATIONS.map(async (m): Promise<boolean | null> => {
      if (m.probe.kind === "none") return null;
      if (m.probe.kind === "rpc") {
        const { error } = await admin.rpc(m.probe.fn);
        // PGRST202 = "function not found in schema cache". Any other
        // error means the function EXISTS and simply objected.
        if (!error) return true;
        const code = (error as { code?: string }).code;
        return code === "PGRST202" || code === "42883" ? false : true;
      }
      const { error } = await admin.from(m.probe.table).select(m.probe.column).limit(1);
      if (!error) return true;
      const code = (error as { code?: string }).code;
      // 42703 undefined_column, 42P01 undefined_table, PGRST204 schema cache.
      if (code === "42703" || code === "42P01" || code === "PGRST204") return false;
      return null;
    })
  );

  return {
    success: true,
    migrations: PENDING_MIGRATIONS.map((m, i) => {
      const probe = probes[i];
      const applied = probe.status === "fulfilled" ? probe.value : null;
      return {
        id: m.id,
        title: m.title,
        summary: m.summary,
        applied,
        note:
          applied === null
            ? m.probe.kind === "none"
              ? m.probe.why
              : "The probe itself errored — check the schema by hand."
            : undefined,
      };
    }),
  };
}

// ══════════════════════════════════════════════════════════════
// Ops corner — what the SERVER actually sees for the launch switches
//
// Every flag on this site ships dark and its surfaces degrade quietly,
// which is correct and also means nothing on the site ever tells you
// which shape you are running. Same telltale idea as the migration
// probes, one layer up: the env.
//
// TWO HARD RULES, both about not leaking:
//   1. Secrets are reported as SET / NOT SET. Never the value, never a
//      prefix, never a length — a length is a fingerprint.
//   2. NEXT_PUBLIC_* is read through the SAME predicate the feature
//      uses (formEngineEnabled / showStandingsEnabled), not a
//      re-implementation, so this panel cannot drift from the gate it
//      is describing. Those values are inlined at BUILD time, so a
//      Vercel env var changed after the last deploy will still read
//      here as its old value until a rebuild — the card says so.
// ══════════════════════════════════════════════════════════════

export interface EnvFlagRow {
  key: string;
  /** Public switch value, never a secret. Truncated defensively. */
  value: string | null;
  /** What the app's own gate resolves to right now. */
  on: boolean;
  label: string;
  /** What being off actually costs a visitor. */
  effect: string;
}

export interface EnvSecretRow {
  key: string;
  /** Presence ONLY. The value never leaves the server. */
  present: boolean;
  label: string;
  /** What breaks when it is missing. */
  impact: string;
}

export interface EnvFlagStatus {
  flags: EnvFlagRow[];
  secrets: EnvSecretRow[];
  nodeEnv: string;
  /** Vercel's environment name (production / preview / development), when deployed. */
  vercelEnv: string | null;
  /** Short SHA of the running build, when Vercel provides it. */
  commitSha: string | null;
}

/** Set AND non-blank. An empty string is not configuration. */
function isSet(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** Public values only. Caps length so a mis-pasted blob can't spill into the page. */
function publicValue(value: string | undefined): string | null {
  if (!isSet(value)) return null;
  const clean = value!.trim();
  return clean.length > 24 ? `${clean.slice(0, 24)}…` : clean;
}

export async function getEnvFlagStatus(): Promise<
  { success: true; status: EnvFlagStatus } | { success: false; error: string }
> {
  const user = await verifyAdmin();
  if (!user) return { success: false, error: "Unauthorized" };

  // Static property access, deliberately: Next.js inlines
  // `process.env.NEXT_PUBLIC_X` at build time and a computed lookup
  // (`process.env[key]`) would read undefined in the bundle.
  const flags: EnvFlagRow[] = [
    {
      key: "NEXT_PUBLIC_FORM_ENGINE",
      value: publicValue(process.env.NEXT_PUBLIC_FORM_ENGINE),
      on: formEngineEnabled(),
      label: "Premium form engine",
      effect: "Off = the three legacy add/edit forms serve every route.",
    },
    {
      key: "NEXT_PUBLIC_SHOW_STANDINGS",
      value: publicValue(process.env.NEXT_PUBLIC_SHOW_STANDINGS),
      on: showStandingsEnabled(),
      label: "Season standings",
      effect: "Off = /standings 404s and its links stay hidden.",
    },
    {
      key: "NEXT_PUBLIC_WANTED_NUDGE",
      // No shared helper for this one — actions/wishlist.ts compares the
      // literal "1" inline. Mirrored exactly rather than loosened.
      value: publicValue(process.env.NEXT_PUBLIC_WANTED_NUDGE),
      on: process.env.NEXT_PUBLIC_WANTED_NUDGE === "1",
      label: "Wanted nudge",
      effect: "Off = wishlist adds stay passive counts and notify nobody.",
    },
  ];

  const secrets: EnvSecretRow[] = [
    {
      key: "SUPABASE_SERVICE_ROLE_KEY",
      present: isSet(process.env.SUPABASE_SERVICE_ROLE_KEY),
      label: "Supabase service role",
      impact: "Missing = this whole console, every cron, and all admin reads fail.",
    },
    {
      key: "STRIPE_SECRET_KEY",
      present: isSet(process.env.STRIPE_SECRET_KEY),
      label: "Stripe",
      impact: "Missing = supporter checkout and every billing call fail.",
    },
    {
      key: "RESEND_API_KEY",
      present: isSet(process.env.RESEND_API_KEY),
      label: "Resend",
      impact: "Missing = no transactional mail: replies, deadline emails, results.",
    },
    {
      key: "ADMIN_EMAIL",
      present: isSet(process.env.ADMIN_EMAIL),
      label: "Admin identity",
      impact: "Missing = verifyAdmin refuses everyone, including you.",
    },
  ];

  return {
    success: true,
    status: {
      flags,
      secrets,
      nodeEnv: process.env.NODE_ENV ?? "unknown",
      vercelEnv: process.env.VERCEL_ENV ?? null,
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    },
  };
}

// ══════════════════════════════════════════════════════════════
// Catalog sweeper — finding what the broken approve path minted
//
// resolveLegacySuggestion's ancestor ran its catalog INSERT before a
// status UPDATE that could never succeed, so every press of Approve on
// the same suggestion minted another catalog_items row. The fix stops
// new ones; it cannot find the ones already in the table. This does.
//
// READ-ONLY. It proposes groups and a suggested keeper; the only write
// available from here is the EXISTING mergeCatalogItems action, run by
// hand from the merge card with the pair pre-filled.
//
// Cost discipline: one scan query, then exactly one `in` per
// referencing table — six more, whatever the group count is. Never a
// count per row.
// ══════════════════════════════════════════════════════════════

/** Newest N catalog rows examined per sweep. Beyond this the report says it stopped. */
const CATALOG_SWEEP_ROW_LIMIT = 2000;

/** Rows one reference tally reads before it stops being exact. */
const REFERENCE_ROW_LIMIT = 5000;

const REFERENCE_TABLES: { table: string; column: string; bucket: keyof ItemLoad }[] = [
  { table: "user_horses", column: "catalog_id", bucket: "horses" },
  { table: "user_wishlists", column: "catalog_id", bucket: "wishlists" },
  { table: "id_suggestions", column: "catalog_id", bucket: "otherRefs" },
  { table: "catalog_suggestions", column: "catalog_item_id", bucket: "otherRefs" },
  { table: "catalog_changelog", column: "catalog_item_id", bucket: "otherRefs" },
  { table: "catalog_items", column: "parent_id", bucket: "otherRefs" },
];

export interface CatalogDuplicateReport {
  groups: DuplicateGroup[];
  /** Catalog rows actually examined. */
  scanned: number;
  /** true = the scan hit its row cap; older entries were NOT looked at. */
  scanCapped: boolean;
  /** Groups found in total — `groups` may be a capped slice of this. */
  totalGroups: number;
  /** Set when the reference counts are incomplete. Null = every count is exact. */
  loadNote: string | null;
}

export async function findCatalogDuplicates(): Promise<
  { success: true; report: CatalogDuplicateReport } | { success: false; error: string }
> {
  const user = await verifyAdmin();
  if (!user) return { success: false, error: "Unauthorized" };

  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("catalog_items")
    .select("id, title, maker, item_type, slug, created_at")
    .order("created_at", { ascending: false })
    .limit(CATALOG_SWEEP_ROW_LIMIT);
  if (error) return { success: false, error: error.message };

  const rows = (data ?? []) as {
    id: string;
    title: string | null;
    maker: string | null;
    item_type: string | null;
    slug: string | null;
    created_at: string;
  }[];

  const candidates: DuplicateCandidate[] = rows.map((r) => ({
    id: r.id,
    title: r.title ?? "",
    maker: r.maker,
    itemType: r.item_type ?? "",
    slug: r.slug,
    createdAt: r.created_at,
  }));

  const { groups, totalGroups } = groupDuplicates(candidates, MAX_DUPLICATE_GROUPS);
  const scanned = rows.length;
  const scanCapped = scanned >= CATALOG_SWEEP_ROW_LIMIT;

  const ids = groups.flatMap((g) => g.members.map((m) => m.id));
  if (ids.length === 0) {
    return {
      success: true,
      report: { groups: [], scanned, scanCapped, totalGroups, loadNote: null },
    };
  }

  const tallies = await Promise.all(
    REFERENCE_TABLES.map(async (ref) => {
      const { data: refRows, error: refError } = await admin
        .from(ref.table)
        .select(ref.column)
        .in(ref.column, ids)
        .limit(REFERENCE_ROW_LIMIT);
      if (refError) {
        logger.error("Admin", `Duplicate sweep could not read ${ref.table}.${ref.column}`, refError);
        return { ref, counts: null, capped: false };
      }
      // The column name is dynamic, so PostgREST's generated types
      // can't narrow the row shape — read it as the string map it is.
      const list = (refRows ?? []) as unknown as Record<string, string | null>[];
      const counts = new Map<string, number>();
      for (const row of list) {
        const key = row[ref.column];
        if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return { ref, counts, capped: list.length >= REFERENCE_ROW_LIMIT };
    })
  );

  const load = new Map<string, ItemLoad>();
  for (const id of ids) load.set(id, { horses: 0, wishlists: 0, otherRefs: 0 });

  const unreadable: string[] = [];
  let tallyCapped = false;
  for (const tally of tallies) {
    if (!tally.counts) {
      unreadable.push(tally.ref.table);
      continue;
    }
    if (tally.capped) tallyCapped = true;
    for (const [id, n] of tally.counts) {
      const entry = load.get(id);
      if (entry) entry[tally.ref.bucket] = entry[tally.ref.bucket] + n;
    }
  }

  // Counts drive the suggested merge direction, so a partial count has
  // to say so rather than let a "0 references" row look safe to delete.
  const notes: string[] = [];
  if (unreadable.length > 0) {
    notes.push(`counts exclude ${unreadable.join(", ")} (unreadable this load)`);
  }
  if (tallyCapped) {
    notes.push(`a tally hit its ${REFERENCE_ROW_LIMIT}-row cap, so some counts are a floor`);
  }

  return {
    success: true,
    report: {
      groups: attachLoad(groups, load),
      scanned,
      scanCapped,
      totalGroups,
      loadNote: notes.length > 0 ? `Reference ${notes.join("; ")}.` : null,
    },
  };
}

// ══════════════════════════════════════════════════════════════
// Overdue shows — the queue nothing else owns
//
// The hourly cron flips published → entries_open and entries_open →
// entries_closed, and nudges shows past judging_ends_at. It never
// force-flips out of judging (a community-vote show has no placings
// until the host finalizes the tally — audit S11) and it has no opinion
// at all about entries_closed, running, or results_review.
//
// So this queue reads, and it nudges. It NEVER writes shows.status:
// the state machine is the single authority on the lifecycle and a
// forced flip here would mint or destroy results. The predicates and
// their thresholds live in lib/admin/overdueShows.ts, shared with the
// nudge so a show can never be nudged for a reason it no longer has.
//
// Cost: five status queries (one per predicate, each capped) plus three
// batched `in` lookups — aliases, entry counts, prior nudges.
// ══════════════════════════════════════════════════════════════

/** Rows per predicate. Hitting it marks the queue capped. */
const OVERDUE_PER_PREDICATE_LIMIT = 50;

const OVERDUE_SHOW_COLUMNS =
  "id, title, host_id, status, judging_ends_at, entries_close_at, show_date, updated_at";

export interface OverdueShowRow {
  showId: string;
  title: string;
  hostAlias: string;
  status: string;
  reason: OverdueReason;
  /** The deadline (or last-touched stamp) the overdue count is measured from. */
  since: string;
  overdueDays: number;
  /** Live entries — scratched ones are history and are not counted. */
  entryCount: number;
  /** When the host was last nudged about THIS reason, cron or console. */
  nudgedAt: string | null;
  /** True while the cooldown is still running. */
  nudgeOnCooldown: boolean;
  hostConsoleUrl: string;
}

export interface OverdueShowsReport {
  rows: OverdueShowRow[];
  /** true = at least one predicate filled its slot; there may be more. */
  capped: boolean;
}

type OverdueShowRecord = {
  id: string;
  title: string | null;
  host_id: string;
  status: string;
  judging_ends_at: string | null;
  entries_close_at: string | null;
  show_date: string | null;
  updated_at: string;
};

export async function listOverdueShows(): Promise<
  { success: true; report: OverdueShowsReport } | { success: false; error: string }
> {
  const user = await verifyAdmin();
  if (!user) return { success: false, error: "Unauthorized" };

  const admin = getAdminSupabase();
  const now = new Date();
  const nowIso = now.toISOString();
  const base = () => admin.from("shows").select(OVERDUE_SHOW_COLUMNS);

  const settled = await Promise.allSettled([
    // 1. Past its judging deadline — the cron's own predicate, verbatim.
    base()
      .eq("status", "judging")
      .not("judging_ends_at", "is", null)
      .lte("judging_ends_at", nowIso)
      .order("judging_ends_at", { ascending: true })
      .limit(OVERDUE_PER_PREDICATE_LIMIT),
    // 2. Judging with NO deadline — the cron's `.not(... is null)` filter
    //    means these can never be nudged by the clock.
    base()
      .eq("status", "judging")
      .is("judging_ends_at", null)
      .lte("updated_at", cutoffIso(now, JUDGING_NO_DEADLINE_DAYS))
      .order("updated_at", { ascending: true })
      .limit(OVERDUE_PER_PREDICATE_LIMIT),
    // 3. Entries closed and never advanced. `or` because a hand-closed
    //    show can have no entries_close_at on file at all.
    base()
      .eq("status", "entries_closed")
      .or(
        `entries_close_at.lte.${cutoffIso(now, ENTRIES_CLOSED_STALLED_DAYS)},updated_at.lte.${cutoffIso(now, ENTRIES_CLOSED_STALLED_DAYS)}`
      )
      .order("updated_at", { ascending: true })
      .limit(OVERDUE_PER_PREDICATE_LIMIT),
    // 4. Live show still running. show_date is a DATE, updated_at a
    //    timestamp — two cutoffs, two shapes.
    base()
      .eq("status", "running")
      .or(
        `show_date.lte.${cutoffDate(now, RUNNING_PAST_DATE_DAYS)},updated_at.lte.${cutoffIso(now, RUNNING_IDLE_DAYS)}`
      )
      .order("updated_at", { ascending: true })
      .limit(OVERDUE_PER_PREDICATE_LIMIT),
    // 5. Results sitting in review, unpublished.
    base()
      .eq("status", "results_review")
      .lte("updated_at", cutoffIso(now, RESULTS_REVIEW_STALLED_DAYS))
      .order("updated_at", { ascending: true })
      .limit(OVERDUE_PER_PREDICATE_LIMIT),
  ]);

  let capped = false;
  const byId = new Map<string, OverdueShowRecord>();
  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    const { data, error } = result.value as { data: unknown; error: unknown };
    if (error) continue; // a predicate that can't run must not blank the queue
    const rows = (Array.isArray(data) ? data : []) as OverdueShowRecord[];
    if (rows.length >= OVERDUE_PER_PREDICATE_LIMIT) capped = true;
    for (const row of rows) byId.set(row.id, row);
  }

  // Re-check every row through the shared classifier: `or` filters are
  // broader than the real predicate (a running show edited yesterday
  // with a stale show_date matches the query but may not be stalled).
  const classified: { record: OverdueShowRecord; input: OverdueShowInput; reason: OverdueReason; since: string; overdueDays: number }[] = [];
  for (const record of byId.values()) {
    const input: OverdueShowInput = {
      id: record.id,
      title: record.title ?? "Untitled show",
      hostId: record.host_id,
      status: record.status,
      judgingEndsAt: record.judging_ends_at,
      entriesCloseAt: record.entries_close_at,
      showDate: record.show_date,
      updatedAt: record.updated_at,
    };
    const verdict = classifyOverdueShow(input, now);
    if (!verdict) continue;
    classified.push({ record, input, ...verdict });
  }

  if (classified.length === 0) {
    return { success: true, report: { rows: [], capped } };
  }

  const showIds = classified.map((c) => c.record.id);
  const hostIds = [...new Set(classified.map((c) => c.record.host_id))];
  const links = classified.map((c) => nudgeLinkFor(c.record.id, c.reason));

  const [hosts, entries, nudges] = await Promise.allSettled([
    admin.from("users").select("id, alias_name").in("id", hostIds),
    admin.from("show_class_entries").select("show_id, status").in("show_id", showIds),
    admin
      .from("notifications")
      .select("user_id, link_url, created_at")
      .eq("type", "show_deadline")
      .in("link_url", links)
      .order("created_at", { ascending: false }),
  ]);

  const aliasById = new Map<string, string>();
  if (hosts.status === "fulfilled") {
    const rows = ((hosts.value as { data: unknown }).data ?? []) as {
      id: string;
      alias_name: string | null;
    }[];
    for (const h of rows) {
      if (h.alias_name) aliasById.set(h.id, h.alias_name);
    }
  }

  const entryCounts = new Map<string, number>();
  if (entries.status === "fulfilled") {
    const rows = ((entries.value as { data: unknown }).data ?? []) as {
      show_id: string;
      status: string;
    }[];
    for (const e of rows) {
      if (e.status === "scratched") continue;
      entryCounts.set(e.show_id, (entryCounts.get(e.show_id) ?? 0) + 1);
    }
  }

  // Newest-first from the query, so the first hit per key is the latest.
  const nudgedAtByKey = new Map<string, string>();
  if (nudges.status === "fulfilled") {
    const rows = ((nudges.value as { data: unknown }).data ?? []) as {
      user_id: string;
      link_url: string | null;
      created_at: string;
    }[];
    for (const n of rows) {
      if (!n.link_url) continue;
      const key = `${n.user_id}|${n.link_url}`;
      if (!nudgedAtByKey.has(key)) nudgedAtByKey.set(key, n.created_at);
    }
  }

  const rows: OverdueShowRow[] = classified.map((c) => {
    const link = nudgeLinkFor(c.record.id, c.reason);
    const nudgedAt = nudgedAtByKey.get(`${c.record.host_id}|${link}`) ?? null;
    return {
      showId: c.record.id,
      title: c.input.title,
      hostAlias: aliasById.get(c.record.host_id) ?? "Unknown host",
      status: c.record.status,
      reason: c.reason,
      since: c.since,
      overdueDays: c.overdueDays,
      entryCount: entryCounts.get(c.record.id) ?? 0,
      nudgedAt,
      nudgeOnCooldown: !canNudgeAgain(nudgedAt, now),
      hostConsoleUrl: `/shows/host/${c.record.id}`,
    };
  });

  return { success: true, report: { rows: sortOverdue(rows), capped } };
}

export interface NudgeHostResult {
  success: boolean;
  error?: string;
  /** true = a notification row was written. */
  sent?: boolean;
  /** Human-readable outcome when nothing was sent but nothing failed either. */
  note?: string;
}

/**
 * Nudge one overdue host. The ONLY write this queue offers.
 *
 * It reuses the cron's notification type ('show_deadline') and, for
 * judging shows, the cron's exact link — so the two dedupe against each
 * other and a host is never pinged twice for the same stall.
 *
 * Anti-spam is a real cooldown, not a disabled button: a matching
 * notification inside NUDGE_COOLDOWN_DAYS refuses politely and names
 * the date. (A host who has muted show_deadline notifications produces
 * no row for the cooldown to see; that path reports "muted, nothing
 * sent" rather than pretending it worked.)
 *
 * Never flips shows.status. Results integrity belongs to the state
 * machine and to the host, not to this console.
 */
export async function nudgeOverdueShowHost(showId: string): Promise<NudgeHostResult> {
  const user = await verifyAdmin();
  if (!user) return { success: false, error: "Unauthorized" };

  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("shows")
    .select(OVERDUE_SHOW_COLUMNS)
    .eq("id", showId)
    .maybeSingle();
  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: "Show not found." };

  const record = data as OverdueShowRecord;
  const now = new Date();
  const input: OverdueShowInput = {
    id: record.id,
    title: record.title ?? "Untitled show",
    hostId: record.host_id,
    status: record.status,
    judgingEndsAt: record.judging_ends_at,
    entriesCloseAt: record.entries_close_at,
    showDate: record.show_date,
    updatedAt: record.updated_at,
  };

  const verdict = classifyOverdueShow(input, now);
  if (!verdict) {
    return {
      success: true,
      sent: false,
      note: "That show is no longer overdue — the host has moved it on. Nothing sent.",
    };
  }

  const link = nudgeLinkFor(record.id, verdict.reason);
  const { data: priorRows } = await admin
    .from("notifications")
    .select("created_at")
    .eq("type", "show_deadline")
    .eq("user_id", record.host_id)
    .eq("link_url", link)
    .order("created_at", { ascending: false })
    .limit(1);
  const lastNudgedAt = ((priorRows ?? [])[0] as { created_at: string } | undefined)?.created_at ?? null;

  if (!canNudgeAgain(lastNudgedAt, now)) {
    return {
      success: true,
      sent: false,
      note: `Already nudged ${new Date(lastNudgedAt!).toLocaleDateString()} — the cooldown is ${NUDGE_COOLDOWN_DAYS} days.`,
    };
  }

  // House pattern: dynamic import + try/catch. A notification sink must
  // never take an admin action down with it.
  let delivered = 0;
  try {
    const { createNotificationsBulk } = await import("@/lib/notifications/createNotification");
    delivered = await createNotificationsBulk([
      {
        userId: record.host_id,
        type: "show_deadline",
        // System event, not the admin poking a member: the self-guard
        // must not fire if the admin happens to host the show.
        actorId: null,
        content: buildNudgeContent(input.title, verdict),
        linkUrl: link,
      },
    ]);
  } catch (err) {
    logger.error("Admin", "Overdue-show nudge failed", err);
    return { success: false, error: "Could not send the nudge — check the logs." };
  }

  if (delivered === 0) {
    return {
      success: true,
      sent: false,
      note: "Nothing sent — the host has show-deadline notifications muted.",
    };
  }

  return { success: true, sent: true };
}
