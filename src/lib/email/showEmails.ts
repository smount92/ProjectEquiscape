/**
 * Show emails — the two payoff-loop moments worth an inbox visit:
 *   (a) results published → each entrant's placements (or a kind
 *       "results are up") with a link to the show page;
 *   (b) entries closing within 24h → reminder to current entrants.
 *
 * Both respect notification_prefs (show_results / show_deadlines —
 * same keys as the in-app pings, one toggle silences the channel
 * pair), batch through resend.batch.send in ≤100-recipient chunks,
 * and fail gracefully like sendNewMessageNotification: log, never
 * throw into the caller.
 */

import { Resend } from "resend";

import { logger } from "@/lib/logger";
import { getAdminClient } from "@/lib/supabase/admin";
import { isNotificationTypeEnabled, type NotificationPrefs } from "@/lib/notifications/prefs";
// type-only — the runtime dependency points the other way
// (lib/shows/notifications calls the senders below).
import type { EntrantResults } from "@/lib/shows/notifications";
import { placeLabel } from "@/lib/shows/placings";
import type { Place } from "@/lib/shows/types";
import {
    EMAIL_FROM,
    escapeEmailHtml,
    renderBrandedEmail,
    renderBrandedEmailText,
} from "./layout";

/** Resend batch API limit per call. */
export const EMAIL_BATCH_SIZE = 100;

/** Split rows into ≤size chunks (resend.batch.send caps at 100). */
export function chunk<T>(rows: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < rows.length; i += size) {
        chunks.push(rows.slice(i, i + size));
    }
    return chunks;
}

// ── Pure body builders (unit-tested) ──

/** The results card body for one entrant. All inputs escaped here. */
export function buildResultsEmailBody(input: {
    showTitle: string;
    placements: { horseName: string; place: number; className: string }[];
}): string {
    if (input.placements.length === 0) {
        return `<p style="margin:0;">The results of <strong>${escapeEmailHtml(input.showTitle)}</strong> have been published. Thank you for entering — see the full placings on the show page.</p>`;
    }
    const rows = input.placements
        .map(
            (p) =>
                `<li style="margin:0 0 6px 0;"><strong>${escapeEmailHtml(p.horseName)}</strong> placed <strong>${placeLabel(p.place as Place)}</strong> in ${escapeEmailHtml(p.className)}</li>`,
        )
        .join("");
    return `<p style="margin:0 0 12px 0;">Ribbons went up at <strong>${escapeEmailHtml(input.showTitle)}</strong>:</p><ul style="margin:0;padding-left:20px;">${rows}</ul>`;
}

/** The entries-closing reminder body. All inputs escaped here. */
export function buildDeadlineEmailBody(input: {
    showTitle: string;
    entriesCloseAt: string | null;
}): string {
    const when = input.entriesCloseAt
        ? new Date(input.entriesCloseAt).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
              timeZone: "UTC",
              timeZoneName: "short",
          })
        : null;
    return `<p style="margin:0;">Entries for <strong>${escapeEmailHtml(input.showTitle)}</strong> close in less than 24 hours${when ? ` (${escapeEmailHtml(when)})` : ""}. Check your string and make any final entries or scratches before the gate shuts.</p>`;
}

// ── Recipient resolution ──

interface EmailRecipient {
    userId: string;
    email: string;
    alias: string;
}

/**
 * Resolve user ids → email addresses, prefs-filtered by `prefType`.
 *
 * ADMIN CLIENT — required twice over, same pattern as messaging.ts's
 * sendNewMessageNotification caller: (1) recipients' prefs/aliases
 * are other users' rows the acting host can't read under RLS, and
 * (2) addresses only exist in auth.users, reachable solely via
 * auth.admin.getUserById. Addresses never leave the server.
 */
async function resolveRecipients(
    userIds: string[],
    prefType: string,
): Promise<EmailRecipient[]> {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) return [];
    const admin = getAdminClient();

    const { data: users, error } = await admin
        .from("users")
        .select("id, alias_name, notification_prefs")
        .in("id", unique);
    if (error) throw new Error(error.message);

    const wanted = (users ?? []).filter((u) =>
        isNotificationTypeEnabled(prefType, u.notification_prefs as NotificationPrefs),
    );

    const recipients: EmailRecipient[] = [];
    // getUserById per recipient (no batch endpoint) — small parallel
    // chunks so a big show doesn't stampede the auth API.
    for (const group of chunk(wanted, 10)) {
        const resolved = await Promise.all(
            group.map(async (u) => {
                try {
                    const { data } = await admin.auth.admin.getUserById(u.id as string);
                    const email = data?.user?.email;
                    if (!email) return null;
                    return {
                        userId: u.id as string,
                        email,
                        alias: (u.alias_name as string | null) ?? "Collector",
                    };
                } catch {
                    return null;
                }
            }),
        );
        for (const r of resolved) if (r) recipients.push(r);
    }
    return recipients;
}

async function sendBatches(
    payloads: { from: string; to: string; subject: string; html: string; text: string }[],
    label: string,
): Promise<number> {
    if (payloads.length === 0) return 0;
    const resend = new Resend(process.env.RESEND_API_KEY);
    let sent = 0;
    for (const group of chunk(payloads, EMAIL_BATCH_SIZE)) {
        try {
            const { error } = await resend.batch.send(group);
            if (error) {
                logger.error("ShowEmails", `${label} batch failed: ${error.message}`);
            } else {
                sent += group.length;
            }
        } catch (err) {
            logger.error("ShowEmails", `${label} batch threw`, err);
        }
    }
    return sent;
}

// ── Senders ──

/**
 * (a) Results published — one email per entrant with THEIR placements
 * (or the unplaced "results are up"). Respects `show_results`.
 */
export async function sendShowResultsEmails(input: {
    showId: string;
    showTitle: string;
    results: EntrantResults[];
}): Promise<{ sent: number }> {
    try {
        const recipients = await resolveRecipients(
            input.results.map((r) => r.ownerId),
            "show_result",
        );
        if (recipients.length === 0) return { sent: 0 };
        const resultsByOwner = new Map(input.results.map((r) => [r.ownerId, r]));

        const payloads = recipients.map((recipient) => {
            const placements = resultsByOwner.get(recipient.userId)?.placements ?? [];
            const card = {
                title: `Results — ${input.showTitle}`,
                heading:
                    placements.length > 0
                        ? `Congratulations, ${recipient.alias}!`
                        : `Results are up, ${recipient.alias}`,
                bodyHtml: buildResultsEmailBody({
                    showTitle: input.showTitle,
                    placements,
                }),
                ctaLabel: "See the full results",
                ctaUrl: `/shows/${input.showId}`,
                footerNote:
                    "You entered this show on Model Horse Hub, so we let you know when its results published.",
            };
            return {
                from: EMAIL_FROM,
                to: recipient.email,
                subject:
                    placements.length > 0
                        ? `🏆 Your results from ${input.showTitle}`
                        : `Results are up for ${input.showTitle}`,
                html: renderBrandedEmail(card),
                text: renderBrandedEmailText(card),
            };
        });

        const sent = await sendBatches(payloads, "results");
        return { sent };
    } catch (err) {
        logger.error("ShowEmails", "Results emails failed", err);
        return { sent: 0 };
    }
}

/**
 * (b) Entries closing within 24h — reminder to the given entrant
 * owners (the cron dedupes who still needs one). Respects
 * `show_deadlines`.
 */
export async function sendEntriesClosingEmails(input: {
    showId: string;
    showTitle: string;
    entriesCloseAt: string | null;
    recipientIds: string[];
}): Promise<{ sent: number }> {
    try {
        const recipients = await resolveRecipients(input.recipientIds, "show_deadline");
        if (recipients.length === 0) return { sent: 0 };

        const bodyHtml = buildDeadlineEmailBody({
            showTitle: input.showTitle,
            entriesCloseAt: input.entriesCloseAt,
        });
        const payloads = recipients.map((recipient) => {
            const card = {
                title: `Entries closing — ${input.showTitle}`,
                heading: `Last call, ${recipient.alias}`,
                bodyHtml,
                ctaLabel: "Review your entries",
                ctaUrl: `/shows/${input.showId}`,
                footerNote:
                    "You have entries at this show on Model Horse Hub, so we reminded you before its deadline.",
            };
            return {
                from: EMAIL_FROM,
                to: recipient.email,
                subject: `⏰ Entries close soon — ${input.showTitle}`,
                html: renderBrandedEmail(card),
                text: renderBrandedEmailText(card),
            };
        });

        const sent = await sendBatches(payloads, "deadline");
        return { sent };
    } catch (err) {
        logger.error("ShowEmails", "Deadline emails failed", err);
        return { sent: 0 };
    }
}
