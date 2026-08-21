/**
 * Shared branded email layout — the leather/parchment brand in
 * email-safe inline styles (email HTML can't read CSS tokens, so
 * the palette hexes live here and ONLY here: parchment #F5EFDF,
 * ink #2B2418, forest #2F5E40, brass #B8860B).
 *
 * Pure string builders — unit-tested; the senders in showEmails.ts
 * wrap them with Resend I/O.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://modelhorsehub.com";

/** Escape HTML special characters to prevent XSS in email templates. */
export function escapeEmailHtml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

export interface BrandedEmailInput {
    /** <title> + preheader fallback. Escaped here. */
    title: string;
    /** Card heading. Escaped here. */
    heading: string;
    /** Pre-built card body — MUST already be escaped by the caller. */
    bodyHtml: string;
    /** Omit for a card with no button (e.g. a reply the member just reads). */
    ctaLabel?: string;
    /** Absolute or site-relative URL; relative gets APP_URL prefixed. */
    ctaUrl?: string;
    /** One-liner above the fine print, e.g. why the user got this. Escaped here. */
    footerNote: string;
    /**
     * Suppress the "Notification settings" footer link. Not every email is a
     * preference-gated notification — an admin replying to a contact message
     * must not imply the member can switch replies off.
     */
    hideSettingsLink?: boolean;
}

/** Absolute URL for links in emails (deep-links arrive site-relative). */
export function absoluteUrl(url: string): string {
    return url.startsWith("http") ? url : `${APP_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

/**
 * A quoted block — a message snippet, or the original message an admin is
 * replying to. Escapes its own text, unlike `bodyHtml`.
 */
export function renderEmailQuote(text: string, label?: string): string {
    const quoted = escapeEmailHtml(text).replace(/\r?\n/g, "<br />");
    const heading = label
        ? `<p style="color:#6B5E48;font-size:12px;font-weight:700;margin:0 0 6px 0;">${escapeEmailHtml(label)}</p>`
        : "";
    return `${heading}<div style="background-color:#F5EFDF;border-left:3px solid #2F5E40;border-radius:0 6px 6px 0;padding:14px 16px;margin:0 0 18px 0;">
      <p style="color:#4A4030;font-size:14px;line-height:1.6;margin:0;font-style:italic;">${quoted}</p>
    </div>`;
}

/**
 * A row of headline figures.
 *
 * A `<table>`, deliberately: the monthly report used `display:flex`, which
 * Outlook on Windows ignores, so its three tiles stacked into a column for
 * every desktop Outlook subscriber. Tables are the one layout every mail
 * client still agrees on.
 */
export function renderEmailStats(stats: { label: string; value: string }[]): string {
    if (stats.length === 0) return "";
    const width = Math.floor(100 / stats.length);
    const cells = stats
        .map(
            (s) => `<td width="${width}%" style="padding:4px;" valign="top">
          <div style="background-color:#F5EFDF;border:1px solid #E4D9BF;border-radius:6px;padding:12px 8px;text-align:center;">
            <div style="color:#6B5E48;font-size:10px;text-transform:uppercase;letter-spacing:1px;">${escapeEmailHtml(s.label)}</div>
            <div style="color:#2B2418;font-size:20px;font-weight:700;padding-top:2px;">${escapeEmailHtml(s.value)}</div>
          </div>
        </td>`,
        )
        .join("");
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0;"><tr>${cells}</tr></table>`;
}

export function renderBrandedEmail(input: BrandedEmailInput): string {
    const title = escapeEmailHtml(input.title);
    const heading = escapeEmailHtml(input.heading);
    const footerNote = escapeEmailHtml(input.footerNote);
    const cta =
        input.ctaLabel && input.ctaUrl
            ? `
      <!-- CTA -->
      <div style="text-align:center;margin-top:28px;">
        <a href="${absoluteUrl(input.ctaUrl)}"
           style="display:inline-block;padding:13px 32px;background-color:#B8860B;color:#FFFDF6;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;letter-spacing:0.3px;">
          ${escapeEmailHtml(input.ctaLabel)}
        </a>
      </div>`
            : "";
    const settingsLink = input.hideSettingsLink
        ? ""
        : `<a href="${APP_URL}/settings" style="color:#2F5E40;text-decoration:none;">Notification settings</a>
        &nbsp;&middot;&nbsp;
        `;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#F5EFDF;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">

    <!-- Masthead -->
    <div style="text-align:center;margin-bottom:28px;">
      <h1 style="margin:0;font-size:22px;font-weight:700;letter-spacing:0.5px;">
        <img src="https://modelhorsehub.com/logo.png" alt="MHH" width="32" height="32" style="vertical-align:middle;margin-right:8px;" />
        <span style="color:#2B2418;">Model Horse Hub</span>
      </h1>
    </div>

    <!-- Ledger card -->
    <div style="background-color:#FFFDF6;border:1px solid #D9CDB2;border-top:4px solid #2F5E40;border-radius:10px;padding:32px;margin-bottom:24px;">
      <h2 style="color:#2F5E40;font-size:19px;font-weight:700;margin:0 0 18px 0;line-height:1.4;">
        ${heading}
      </h2>

      <div style="color:#2B2418;font-size:15px;line-height:1.7;">
        ${input.bodyHtml}
      </div>
${cta}
    </div>

    <!-- Footer -->
    <div style="text-align:center;">
      <p style="color:#6B5E48;font-size:12px;margin:0 0 8px 0;">
        ${footerNote}
      </p>
      <p style="color:#8A7C63;font-size:11px;margin:0;">
        ${settingsLink}<a href="${APP_URL}" style="color:#2F5E40;text-decoration:none;">modelhorsehub.com</a>
      </p>
    </div>

  </div>
</body>
</html>`.trim();
}
