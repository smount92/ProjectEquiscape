"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * The last resort. `global-error` REPLACES the root layout, so there is no
 * Header, no Footer, and no guarantee the app stylesheet is on the page —
 * this renders when the root layout itself has failed.
 *
 * So every style here is inline, with the leather palette written out in
 * literal hex rather than CSS custom properties: the same discipline the
 * transactional email templates use, and for the same reason. A branded
 * page that depends on a stylesheet that may not have loaded is an unstyled
 * page. Tailwind classes were the previous approach and would have rendered
 * bare in exactly the failure this file exists for.
 *
 * Hexes mirror globals.css: --leather-deep #3E2414, --leather #5C3A20,
 * --leather-hi #7A4E2C, --leather-text #EFDDBB, --brass #B08D3E.
 */
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
        <html lang="en">
            <body
                style={{
                    margin: 0,
                    padding: 0,
                    minHeight: "100dvh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#F5EFDF",
                    fontFamily: "Georgia, 'Times New Roman', serif",
                    color: "#2B2418",
                }}
            >
                <div style={{ width: "100%", maxWidth: 520, padding: "40px 20px" }}>
                    <div
                        style={{
                            borderRadius: 12,
                            padding: "28px 24px",
                            textAlign: "center",
                            background:
                                "linear-gradient(180deg, #7A4E2C 0%, #5C3A20 55%, #3E2414 100%)",
                            boxShadow: "0 6px 18px rgba(62, 36, 20, 0.35)",
                        }}
                    >
                        <p
                            style={{
                                margin: 0,
                                fontSize: 11,
                                letterSpacing: "0.22em",
                                textTransform: "uppercase",
                                color: "#C9AE84",
                            }}
                        >
                            Model Horse Hub
                        </p>
                        <h1
                            style={{
                                margin: "10px 0 0 0",
                                fontSize: 28,
                                fontWeight: 700,
                                letterSpacing: "0.06em",
                                color: "#EFDDBB",
                            }}
                        >
                            The whole barn stumbled
                        </h1>
                        <p
                            style={{
                                margin: "12px 0 0 0",
                                fontSize: 14,
                                lineHeight: 1.6,
                                color: "#D8BE92",
                            }}
                        >
                            Something failed before the page could be built. It has been logged and
                            we can see it — nothing of yours has been lost.
                        </p>
                    </div>

                    <div
                        style={{
                            marginTop: 20,
                            borderRadius: 10,
                            border: "1px solid #D9CDB2",
                            borderTop: "3px solid #2F5E40",
                            backgroundColor: "#FFFDF6",
                            padding: "24px",
                            textAlign: "center",
                        }}
                    >
                        <button
                            onClick={reset}
                            style={{
                                display: "inline-block",
                                padding: "12px 30px",
                                border: "none",
                                borderRadius: 8,
                                backgroundColor: "#B8860B",
                                color: "#FFFDF6",
                                fontFamily: "inherit",
                                fontSize: 15,
                                fontWeight: 700,
                                letterSpacing: "0.03em",
                                cursor: "pointer",
                            }}
                        >
                            Try again
                        </button>
                        <p style={{ margin: "16px 0 0 0", fontSize: 12, color: "#6B5E48" }}>
                            {/* A plain anchor on purpose: the root layout has
                                failed, so a client-side <Link> navigation
                                would re-enter the same broken tree. This
                                needs to be a real page load. */}
                            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                            <a href="/" style={{ color: "#2F5E40", textDecoration: "none", fontWeight: 700 }}>
                                Back to modelhorsehub.com
                            </a>
                            {error.digest ? (
                                <>
                                    {" · reference "}
                                    <span style={{ fontFamily: "ui-monospace, monospace" }}>
                                        {error.digest}
                                    </span>
                                </>
                            ) : null}
                        </p>
                    </div>
                </div>
            </body>
        </html>
    );
}
