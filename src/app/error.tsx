"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isStaleDeploymentError } from "@/lib/staleDeployment";

/**
 * Route-level error boundary — the page a member actually sees when
 * something throws. It gets the same leather identity as the 404, plus the
 * two things an error page owes you: a retry that really re-renders the
 * segment, and a way out that isn't the back button.
 *
 * `digest` is Next's server-side error id and matches the one in Sentry, so
 * it's shown — it's the only thing that makes "it broke" actionable when
 * someone reports it.
 *
 * Static by construction: no data reads, because this is what catches the
 * failures of the pages that do read.
 *
 * One failure is not ours: a tab opened before a deploy calls a server
 * action by an id the new build no longer has ("Failed to find Server
 * Action" / UnrecognizedActionError). Retrying re-runs the same stale
 * call, so that case gets a reload button and goes to Sentry as info,
 * tagged, instead of as an error we chase (see lib/staleDeployment).
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    const stale = isStaleDeploymentError(error);

    useEffect(() => {
        if (stale) {
            Sentry.captureException(error, { level: "info", tags: { stale_deployment: "true" } });
        } else {
            Sentry.captureException(error);
        }
    }, [error, stale]);

    if (stale) {
        return (
            <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 md:py-16">
                <div className="leather-band stitched mb-6 rounded-xl px-6 py-8 text-center">
                    <p
                        className="relative z-[1] m-0 font-serif text-[0.7rem] tracking-[0.22em] uppercase"
                        style={{ color: "var(--leather-text-muted)" }}
                    >
                        The site was updated
                    </p>
                    <h1
                        className="relative z-[1] m-0 mt-2 font-serif text-3xl font-bold tracking-[0.06em] md:text-4xl"
                        style={{ color: "var(--leather-text)" }}
                    >
                        A new version went live under this tab
                    </h1>
                    <p
                        className="relative z-[1] mx-auto m-0 mt-3 max-w-md text-sm leading-relaxed"
                        style={{ color: "var(--leather-text-soft)" }}
                    >
                        This page was open when Model Horse Hub changed, so the button you pressed
                        talked to the old version. Reload once and carry on &mdash; nothing you had
                        already saved is lost.
                    </p>
                </div>

                <div className="ledger-paper py-6 text-center">
                    <div className="flex flex-wrap items-center justify-center gap-3">
                        <Button onClick={() => window.location.reload()} id="error-reload">
                            <RefreshCw size={15} strokeWidth={1.75} />
                            Reload this page
                        </Button>
                        <Button asChild variant="outline">
                            <Link href="/dashboard">My Stable</Link>
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 md:py-16">
            <div className="leather-band stitched mb-6 rounded-xl px-6 py-8 text-center">
                <p
                    className="relative z-[1] m-0 font-serif text-[0.7rem] tracking-[0.22em] uppercase"
                    style={{ color: "var(--leather-text-muted)" }}
                >
                    Something threw a shoe
                </p>
                <h1
                    className="relative z-[1] m-0 mt-2 font-serif text-3xl font-bold tracking-[0.06em] md:text-4xl"
                    style={{ color: "var(--leather-text)" }}
                >
                    This page didn&rsquo;t load
                </h1>
                <p
                    className="relative z-[1] mx-auto m-0 mt-3 max-w-md text-sm leading-relaxed"
                    style={{ color: "var(--leather-text-soft)" }}
                >
                    The error has been logged and we can see it. Nothing you were looking at has been
                    lost — try again, and if it keeps happening, tell us.
                </p>
            </div>

            <div className="ledger-paper py-6 text-center">
                <div className="flex flex-wrap items-center justify-center gap-3">
                    <Button onClick={reset} id="error-retry">
                        <RotateCcw size={15} strokeWidth={1.75} />
                        Try again
                    </Button>
                    <Button asChild variant="outline">
                        <Link href="/dashboard">My Stable</Link>
                    </Button>
                    <Button asChild variant="outline">
                        <Link href="/">Home</Link>
                    </Button>
                </div>

                <p className="text-muted-foreground m-0 mt-4 text-xs">
                    Still stuck?{" "}
                    <Link href="/contact" className="text-forest font-semibold">
                        Tell us what broke
                    </Link>
                    {error.digest ? (
                        <>
                            {" "}
                            and quote reference{" "}
                            <span className="text-secondary-foreground font-mono">{error.digest}</span>
                        </>
                    ) : null}
                    .
                </p>
            </div>
        </div>
    );
}
