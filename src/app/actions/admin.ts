"use server";

import { logger } from "@/lib/logger";

import { createClient } from "@supabase/supabase-js";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { Resend } from "resend";

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

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background-color:#0f0f23;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
    
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="margin:0;font-size:24px;font-weight:700;">
        <span style="color:#818cf8;">🐴</span>
        <span style="color:#e2e8f0;"> Model Horse Hub</span>
      </h1>
    </div>

    <div style="background:linear-gradient(135deg,rgba(30,30,60,0.9),rgba(20,20,50,0.95));border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px;margin-bottom:24px;">
      
      <p style="color:#94a3b8;font-size:14px;margin:0 0 8px 0;">
        Hi ${escapeHtml(recipientName)},
      </p>

      <div style="color:#e2e8f0;font-size:15px;line-height:1.7;margin:0 0 24px 0;white-space:pre-wrap;">${escapeHtml(replyBody.trim())}</div>

      <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:20px;margin-top:20px;">
        <p style="color:#64748b;font-size:12px;margin:0 0 8px 0;font-weight:600;">Your original message:</p>
        <div style="background:rgba(255,255,255,0.04);border-left:3px solid #475569;border-radius:0 8px 8px 0;padding:12px 16px;">
          <p style="color:#94a3b8;font-size:13px;line-height:1.5;margin:0;font-style:italic;">${escapeHtml(originalMessage)}</p>
        </div>
      </div>
    </div>

    <div style="text-align:center;">
      <p style="color:#64748b;font-size:12px;margin:0;">
        Model Horse Hub · 
        <a href="https://modelhorsehub.com" style="color:#818cf8;text-decoration:none;">modelhorsehub.com</a>
      </p>
    </div>
  </div>
</body>
</html>`.trim();

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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Suspend a user site-wide (v4 safety, migration 148). Two stamps:
 * app_metadata.is_suspended (requireAuth throws on it — takes effect
 * on the user's next server-validated request, no extra query) and
 * users.is_suspended (RLS backstop on the entries INSERT policy +
 * the admin list). Suspension blocks every mutation but leaves
 * content readable; it is fully reversible via unsuspendUser.
 */
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
