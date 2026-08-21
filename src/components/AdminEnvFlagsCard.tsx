"use client";

/**
 * Admin → Ops. Read-only, alongside the migration probes.
 *
 * Same telltale idea one layer up from the schema: every feature flag
 * on this site ships dark and its surfaces degrade quietly, so nothing
 * a visitor can see ever says which shape the deploy is running in.
 * This does.
 *
 * SECRETS ARE NEVER RENDERED. The server sends a boolean per key and
 * nothing else — no value, no prefix, no length (a length is a
 * fingerprint). If you ever find yourself wanting to "just show the
 * first four characters" here, don't.
 *
 * The build-time caveat is the point of the footnote: NEXT_PUBLIC_*
 * values are inlined when the bundle is built, so changing one in the
 * Vercel dashboard does nothing until the next deploy — and this card
 * will keep honestly reporting the OLD value until then.
 */

import type { EnvFlagStatus } from "@/app/actions/admin";

function OnPill({ on }: { on: boolean }) {
    return on ? (
        <span className="inline-flex shrink-0 items-center rounded-full border border-forest/30 bg-forest/10 px-2.5 py-0.5 text-[0.7rem] font-bold tracking-wide text-forest uppercase">
            On
        </span>
    ) : (
        <span className="inline-flex shrink-0 items-center rounded-full border border-input px-2.5 py-0.5 text-[0.7rem] font-bold tracking-wide text-muted-foreground uppercase">
            Dark
        </span>
    );
}

function SetPill({ present }: { present: boolean }) {
    return present ? (
        <span className="inline-flex shrink-0 items-center rounded-full border border-forest/30 bg-forest/10 px-2.5 py-0.5 text-[0.7rem] font-bold tracking-wide text-forest uppercase">
            Set
        </span>
    ) : (
        <span className="inline-flex shrink-0 items-center rounded-full bg-destructive px-2.5 py-0.5 text-[0.7rem] font-bold tracking-wide text-white uppercase">
            Not set
        </span>
    );
}

export default function AdminEnvFlagsCard({ status }: { status: EnvFlagStatus | null }) {
    if (!status) {
        return (
            <div className="rounded-lg border border-input bg-card px-6 py-8 text-center">
                <h3 className="m-0 text-base font-bold">Environment unavailable</h3>
                <p className="m-0 mt-1 text-sm text-muted-foreground">
                    The env read did not return this load. Nothing is broken by this — it is a
                    read-only view.
                </p>
            </div>
        );
    }

    const missing = status.secrets.filter((s) => !s.present);

    return (
        <div className="flex flex-col gap-4">
            <div>
                <h3 className="mt-0 mb-1 flex items-center gap-2 text-base font-bold">
                    🔌 Environment &amp; flags
                </h3>
                <p className="mt-0 mb-0 text-xs text-muted-foreground">
                    What the <strong>server</strong> is seeing right now, on this build. Flag values
                    are public switches; the keys below them are reported as set-or-not and nothing
                    else — no value ever leaves the server.
                </p>
            </div>

            <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 rounded-lg border border-input bg-card px-4 py-2.5 text-xs text-muted-foreground">
                <span>
                    NODE_ENV <span className="font-mono text-foreground">{status.nodeEnv}</span>
                </span>
                {status.vercelEnv && (
                    <span>
                        VERCEL_ENV{" "}
                        <span className="font-mono text-foreground">{status.vercelEnv}</span>
                    </span>
                )}
                {status.commitSha && (
                    <span>
                        build <span className="font-mono text-foreground">{status.commitSha}</span>
                    </span>
                )}
            </p>

            {missing.length > 0 && (
                <p className="m-0 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-2.5 text-sm font-semibold text-destructive">
                    {missing.length} key{missing.length === 1 ? "" : "s"} not set:{" "}
                    {missing.map((s) => s.key).join(", ")}
                </p>
            )}

            <div>
                <h4 className="mt-0 mb-2 text-sm font-bold text-foreground">Launch switches</h4>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {status.flags.map((flag) => (
                        <li
                            key={flag.key}
                            className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-input bg-card px-4 py-3"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold text-foreground">
                                    {flag.label}{" "}
                                    <span className="font-mono text-xs text-muted-foreground">
                                        {flag.key}
                                    </span>
                                </div>
                                <div className="mt-0.5 text-xs text-muted-foreground">
                                    {flag.effect}
                                </div>
                                <div className="mt-0.5 text-xs text-secondary-foreground">
                                    Value:{" "}
                                    <span className="font-mono">
                                        {flag.value === null ? "unset" : flag.value}
                                    </span>
                                    {flag.value !== null && !flag.on && (
                                        <span className="text-destructive">
                                            {" "}
                                            — set, but not the literal &ldquo;1&rdquo; the gate
                                            requires
                                        </span>
                                    )}
                                </div>
                            </div>
                            <OnPill on={flag.on} />
                        </li>
                    ))}
                </ul>
            </div>

            <div>
                <h4 className="mt-0 mb-2 text-sm font-bold text-foreground">
                    Keys the server needs
                </h4>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {status.secrets.map((secret) => (
                        <li
                            key={secret.key}
                            className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-input bg-card px-4 py-3"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold text-foreground">
                                    {secret.label}{" "}
                                    <span className="font-mono text-xs text-muted-foreground">
                                        {secret.key}
                                    </span>
                                </div>
                                <div className="mt-0.5 text-xs text-muted-foreground">
                                    {secret.impact}
                                </div>
                            </div>
                            <SetPill present={secret.present} />
                        </li>
                    ))}
                </ul>
            </div>

            <p className="m-0 text-xs text-muted-foreground">
                <strong>NEXT_PUBLIC_* values are baked at build time.</strong> Changing one in the
                Vercel dashboard does nothing until the next deploy — until then this card keeps
                reporting the value that was compiled in, which is exactly what the site is
                actually running on. The keys underneath are read live per request.
            </p>
        </div>
    );
}
