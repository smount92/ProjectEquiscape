import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://modelhorsehub.com";
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Model Horse Hub <noreply@modelhorsehub.com>";

/**
 * Send an email notification when a user receives a new direct message.
 * Designed to fail gracefully — never throws, only logs errors.
 */
export async function sendNewMessageNotification({
    toEmail,
    recipientName,
    senderName,
    horseName,
    messageSnippet,
    conversationId,
}: {
    toEmail: string;
    recipientName: string;
    senderName: string;
    horseName: string | null;
    messageSnippet: string;
    conversationId: string;
}): Promise<void> {
    const truncatedSnippet =
        messageSnippet.length > 100
            ? messageSnippet.slice(0, 100) + "…"
            : messageSnippet;

    const replyUrl = `${APP_URL}/inbox/${conversationId}`;
    const horseContext = horseName
        ? ` regarding <strong>${escapeHtml(horseName)}</strong>`
        : "";

    const subject = horseName
        ? `New message from @${senderName} about ${horseName}`
        : `New message from @${senderName}`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#0f0f23;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
    
    <!-- Logo / Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="margin:0;font-size:24px;font-weight:700;">
        <img src="https://modelhorsehub.com/logo.png" alt="MHH" width="32" height="32" style="vertical-align:middle;margin-right:8px;" />
        <span style="color:#e2e8f0;"> Model Horse Hub</span>
      </h1>
    </div>

    <!-- Card -->
    <div style="background:linear-gradient(135deg,rgba(30,30,60,0.9),rgba(20,20,50,0.95));border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px;margin-bottom:24px;">
      
      <!-- Greeting -->
      <p style="color:#94a3b8;font-size:14px;margin:0 0 8px 0;">
        Hi ${escapeHtml(recipientName)},
      </p>

      <!-- Main message -->
      <h2 style="color:#e2e8f0;font-size:18px;font-weight:600;margin:0 0 20px 0;line-height:1.4;">
        You have a new message from
        <span style="color:#818cf8;">@${escapeHtml(senderName)}</span>${horseContext}
      </h2>

      <!-- Message snippet -->
      <div style="background:rgba(255,255,255,0.04);border-left:3px solid #818cf8;border-radius:0 8px 8px 0;padding:16px;margin-bottom:28px;">
        <p style="color:#cbd5e1;font-size:14px;line-height:1.6;margin:0;font-style:italic;">
          "${escapeHtml(truncatedSnippet)}"
        </p>
      </div>

      <!-- CTA Button -->
      <div style="text-align:center;">
        <a href="${replyUrl}" 
           style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;text-decoration:none;border-radius:999px;font-weight:600;font-size:15px;">
          Reply in Digital Stable →
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;">
      <p style="color:#64748b;font-size:12px;margin:0 0 8px 0;">
        This email was sent because you received a message on Model Horse Hub.
      </p>
      <p style="color:#475569;font-size:11px;margin:0;">
        <a href="${APP_URL}/inbox" style="color:#818cf8;text-decoration:none;">View all messages</a>
        &nbsp;·&nbsp;
        <a href="${APP_URL}" style="color:#818cf8;text-decoration:none;">modelhorsehub.com</a>
      </p>
    </div>

  </div>
</body>
</html>`.trim();

    try {
        const { error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: toEmail,
            subject,
            html,
        });

        if (error) {
            console.error("[Email] Failed to send notification:", error);
        }
    } catch (err) {
        console.error("[Email] Unexpected error sending notification:", err);
    }
}

/** Escape HTML special characters to prevent XSS in email templates */
function escapeHtml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
