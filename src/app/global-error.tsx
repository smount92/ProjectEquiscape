"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        Sentry.captureException(error);
    }, [error]);

    return (
        <html>
            <body>
                <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 bg-[#F4EFE6]">
                    <h2 className="text-2xl font-bold text-ink">Something went wrong</h2>
                    <p className="text-muted">We&apos;ve been notified and are looking into it.</p>
                    <button onClick={reset} className="btn btn-primary">
                        Try Again
                    </button>
                </div>
            </body>
        </html>
    );
}
