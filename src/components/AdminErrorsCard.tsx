import type { SentryStatus } from "@/lib/sentry/issues";

/**
 * Ops corner: what Sentry has caught in the last day. Pulled from
 * Sentry's API at render (lib/sentry/issues); the card is the setup
 * guide until the three server variables exist.
 */
export default function AdminErrorsCard({ status }: { status: SentryStatus | null }) {
    return (
        <section className="border-input bg-card rounded-lg border p-5 shadow-sm" aria-labelledby="admin-errors-heading">
            <h3 id="admin-errors-heading" className="mt-0 mb-1 flex items-center gap-2 text-base font-bold">
                🚨 Errors (Sentry, last 24h)
            </h3>

            {!status || !status.configured ? (
                <div className="text-secondary-foreground text-sm leading-relaxed">
                    <p className="m-0 mb-2">
                        Not connected yet. Sentry is recording errors, but this console cannot read them until three
                        server variables exist in Vercel (Settings → Environment Variables, production):
                    </p>
                    <ul className="m-0 mb-2 list-disc pl-5">
                        <li>
                            <code>SENTRY_AUTH_TOKEN</code> — Sentry → Settings → Auth Tokens → create one with{" "}
                            <code>project:read</code> and <code>event:read</code>.
                        </li>
                        <li>
                            <code>SENTRY_ORG</code> and <code>SENTRY_PROJECT</code> — the two slugs in the Sentry URL,{" "}
                            <code>sentry.io/organizations/&lt;org&gt;/projects/&lt;project&gt;/</code>.
                        </li>
                    </ul>
                    {status && !status.configured && status.missing.length > 0 && (
                        <p className="m-0 mb-2">
                            Missing right now: <code>{status.missing.join(", ")}</code>.
                        </p>
                    )}
                    <p className="m-0">
                        For alerts that reach you when you are not looking at this page, add an alert rule in Sentry
                        (Alerts → Create Alert → issue alert, &ldquo;a new issue is created&rdquo;, action: email). That
                        part lives in Sentry, not here.
                    </p>
                </div>
            ) : !status.ok ? (
                <p className="text-destructive m-0 text-sm">{status.error}</p>
            ) : status.issues.length === 0 ? (
                <p className="text-secondary-foreground m-0 text-sm">Nothing unresolved in the last {status.period}. Quiet house.</p>
            ) : (
                <ul className="m-0 list-none divide-y divide-input p-0">
                    {status.issues.map((i) => (
                        <li key={i.id} className="py-2 first:pt-0 last:pb-0">
                            <div className="flex flex-wrap items-baseline gap-x-2">
                                <a href={i.permalink} target="_blank" rel="noopener noreferrer" className="text-forest font-semibold no-underline hover:underline">
                                    {i.title}
                                </a>
                                <span className="text-secondary-foreground text-xs uppercase">{i.level}</span>
                            </div>
                            <div className="text-secondary-foreground text-xs">
                                {i.culprit && <span className="mr-2">{i.culprit}</span>}
                                <span>
                                    {i.count} event{i.count === 1 ? "" : "s"} · {i.userCount} user{i.userCount === 1 ? "" : "s"} · last{" "}
                                    {new Date(i.lastSeen).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                                </span>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
