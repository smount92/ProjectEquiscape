import "server-only";

/**
 * Recent unresolved Sentry issues, for the admin Ops tab.
 *
 * Sentry has no push integration we can receive without a webhook
 * endpoint and an alert rule, so this is a pull: the admin page asks
 * Sentry's REST API for the project's unresolved issues from the last
 * 24 hours. Needs three server-only variables (never NEXT_PUBLIC_):
 *
 *   SENTRY_AUTH_TOKEN  an organisation auth token with project:read
 *                      and event:read (Sentry → Settings → Auth Tokens)
 *   SENTRY_ORG         the organisation slug from the Sentry URL
 *   SENTRY_PROJECT     the project slug
 *
 * Absent any of them, the card explains what to add instead of failing.
 * Errors talking to Sentry are reported in the card, never thrown: the
 * console must render even when the error tracker is down.
 */

export interface SentryIssue {
    id: string;
    title: string;
    /** Where it happened, as Sentry names it (a route, a function). */
    culprit: string | null;
    level: string;
    /** Occurrences in the period. */
    count: number;
    /** Distinct users affected. */
    userCount: number;
    firstSeen: string;
    lastSeen: string;
    permalink: string;
}

export type SentryStatus =
    | { configured: false; missing: string[] }
    | { configured: true; ok: true; issues: SentryIssue[]; fetchedAt: string; period: string }
    | { configured: true; ok: false; error: string };

const PERIOD = "24h";

export async function getSentryIssues(): Promise<SentryStatus> {
    const token = process.env.SENTRY_AUTH_TOKEN;
    const org = process.env.SENTRY_ORG;
    const project = process.env.SENTRY_PROJECT;
    const missing = [
        !token && "SENTRY_AUTH_TOKEN",
        !org && "SENTRY_ORG",
        !project && "SENTRY_PROJECT",
    ].filter((x): x is string => typeof x === "string");
    if (missing.length > 0) return { configured: false, missing };

    const url =
        `https://sentry.io/api/0/projects/${encodeURIComponent(org!)}/${encodeURIComponent(project!)}/issues/` +
        `?query=${encodeURIComponent("is:unresolved")}&statsPeriod=${PERIOD}&sort=date&limit=12`;
    try {
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
            signal: AbortSignal.timeout(6000),
        });
        if (!res.ok) {
            const hint =
                res.status === 401 || res.status === 403
                    ? "Sentry refused the token — check its scopes (project:read, event:read) and that SENTRY_ORG / SENTRY_PROJECT are the slugs from the Sentry URL."
                    : `Sentry answered ${res.status}.`;
            return { configured: true, ok: false, error: hint };
        }
        const rows = (await res.json()) as Array<Record<string, unknown>>;
        const issues: SentryIssue[] = (Array.isArray(rows) ? rows : []).map((r) => ({
            id: String(r.id ?? ""),
            title: String(r.title ?? "Untitled"),
            culprit: typeof r.culprit === "string" && r.culprit ? r.culprit : null,
            level: String(r.level ?? "error"),
            count: Number(r.count ?? 0),
            userCount: Number(r.userCount ?? 0),
            firstSeen: String(r.firstSeen ?? ""),
            lastSeen: String(r.lastSeen ?? ""),
            permalink: String(r.permalink ?? ""),
        }));
        return { configured: true, ok: true, issues, fetchedAt: new Date().toISOString(), period: PERIOD };
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { configured: true, ok: false, error: /abort|timeout/i.test(msg) ? "Sentry did not answer within 6 seconds." : msg };
    }
}
