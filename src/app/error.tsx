"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

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
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        Sentry.captureException(error);
    }, [error]);

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
