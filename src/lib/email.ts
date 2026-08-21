import { Resend } from "resend";

import {
    EMAIL_FROM,
    escapeEmailHtml,
    renderBrandedEmail,
    renderBrandedEmailText,
    renderEmailQuote,
} from "@/lib/email/layout";

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send an email notification when a user receives a new direct message.
 * Designed to fail gracefully — never throws, only logs errors.
 *
 * Rendered by the shared branded layout. This template predated
 * `lib/email/layout.ts` and still carried the retired indigo palette
 * (#0f0f23 / #818cf8) plus a private fourth copy of `escapeHtml`; the
 * showEmails tests already treat those hexes as a regression. Triggers,
 * recipients, subject and send call are untouched — this is the shell.
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

    const horseContext = horseName
        ? ` regarding <strong>${escapeEmailHtml(horseName)}</strong>`
        : "";

    const subject = horseName
        ? `New message from @${senderName} about ${horseName}`
        : `New message from @${senderName}`;

    const card = {
        title: subject,
        heading: `You have a new message from @${senderName}`,
        bodyHtml: `
      <p style="margin:0 0 14px 0;">Hi ${escapeEmailHtml(recipientName)} — @${escapeEmailHtml(senderName)} wrote to you${horseContext}.</p>
      ${renderEmailQuote(truncatedSnippet)}`,
        ctaLabel: "Reply in your inbox",
        ctaUrl: `/inbox/${conversationId}`,
        footerNote: "You're getting this because someone messaged you on Model Horse Hub.",
    };

    try {
        const { error } = await resend.emails.send({
            from: EMAIL_FROM,
            to: toEmail,
            subject,
            html: renderBrandedEmail(card),
            text: renderBrandedEmailText(card),
        });

        if (error) {
            console.error("[Email] Failed to send notification:", error);
        }
    } catch (err) {
        console.error("[Email] Unexpected error sending notification:", err);
    }
}
