import { Resend } from "resend";

import {
    EMAIL_FROM,
    escapeEmailHtml,
    renderBrandedEmail,
    renderBrandedEmailText,
    type BrandedEmailInput,
} from "@/lib/email/layout";

/**
 * Commission emails. The in-app bell is the record; this is what makes
 * a request reach an artist whose intake today is Facebook Messenger
 * pushing to her phone. Every commission event that pings the other
 * party's bell also sends one of these — same words, a button back to
 * the commission room.
 *
 * `buildCommissionEmailCard` is pure so the wording is tested once;
 * `sendCommissionEmail` never throws (a failed email must not take a
 * commission action down with it).
 */

export interface CommissionEmailInput {
    recipientName: string;
    /** The subject line — a sentence, not a label. */
    subject: string;
    /** The same sentence the bell shows. */
    body: string;
    /** Relative or absolute URL of the commission room. */
    ctaUrl: string;
    ctaLabel?: string;
}

export function buildCommissionEmailCard(input: CommissionEmailInput): BrandedEmailInput {
    return {
        title: input.subject,
        heading: input.subject,
        bodyHtml: `
      <p style="margin:0 0 14px 0;">Hi ${escapeEmailHtml(input.recipientName)} — ${escapeEmailHtml(input.body)}</p>
      <p style="margin:0;color:#6b6b6b;font-size:13px;">Everything you two agree stays on the record in the commission room. Model Horse Hub never handles the money.</p>`,
        ctaLabel: input.ctaLabel ?? "Open the commission",
        ctaUrl: input.ctaUrl,
        footerNote:
            "You're getting this because you're a party to a commission on Model Horse Hub.",
    };
}

export async function sendCommissionEmail(
    input: CommissionEmailInput & { toEmail: string },
): Promise<void> {
    const card = buildCommissionEmailCard(input);
    try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const { error } = await resend.emails.send({
            from: EMAIL_FROM,
            to: input.toEmail,
            subject: input.subject,
            html: renderBrandedEmail(card),
            text: renderBrandedEmailText(card),
        });
        if (error) console.error("[Email] Commission email failed:", error);
    } catch (err) {
        console.error("[Email] Commission email threw:", err);
    }
}
