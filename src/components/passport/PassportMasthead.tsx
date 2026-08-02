/**
 * Passport v2 masthead (NEXT_PUBLIC_PASSPORT_V2) — the passport finally
 * leads with the horse. Leather band where the H1 is the HORSE'S NAME,
 * not the section ("Show Ring" lived in PageMasthead; the approved mock
 * kills that). Eyebrow "Public Passport · Model Horse Hub" in small
 * caps above; "Owned by @alias · {reference}" line under, with the
 * owner linking to their profile and the reference linking to its
 * catalog page when one is linked.
 *
 * Day-mode trap (same as PageMasthead / StableMasthead): all text on
 * the band uses the --leather-text ramp — never default ink.
 */

import Link from "next/link";

export default function PassportMasthead({
    horseName,
    ownerAlias,
    referenceName,
    referenceHref,
    backHref = "/community",
    backLabel = "Show Ring",
}: {
    horseName: string;
    ownerAlias: string;
    /** "Breyer — Weather Girl" (null → custom/unlisted, line shows owner only). */
    referenceName?: string | null;
    /** Catalog page link — null renders the reference as plain text. */
    referenceHref?: string | null;
    backHref?: string;
    backLabel?: string;
}) {
    return (
        <div className="leather-band stitched relative mb-6 rounded-xl px-6 py-5" data-testid="passport-masthead">
            {backHref && (
                <Link
                    href={backHref}
                    className="relative z-[1] mb-2 inline-block font-serif text-[0.7rem] tracking-[0.18em] uppercase no-underline hover:underline"
                    style={{ color: "var(--leather-text-muted)" }}
                >
                    ← {backLabel}
                </Link>
            )}
            <p
                className="m-0 font-serif text-[0.7rem] tracking-[0.18em] uppercase"
                style={{ color: "var(--leather-text-soft)" }}
            >
                Public Passport · Model Horse Hub
            </p>
            <h1 className="text-engraved-light m-0 mt-1 font-serif text-3xl font-bold break-words tracking-[0.02em] md:text-4xl">
                {horseName}
            </h1>
            <p className="m-0 mt-1.5 text-sm" style={{ color: "var(--leather-text-soft)" }}>
                Owned by{" "}
                <Link
                    href={`/profile/${encodeURIComponent(ownerAlias)}`}
                    className="font-semibold underline decoration-1 underline-offset-2"
                    style={{ color: "var(--leather-text)" }}
                >
                    @{ownerAlias}
                </Link>
                {referenceName && (
                    <>
                        {" · "}
                        {referenceHref ? (
                            <Link
                                href={referenceHref}
                                className="font-semibold underline decoration-1 underline-offset-2"
                                style={{ color: "var(--leather-text)" }}
                            >
                                {referenceName}
                            </Link>
                        ) : (
                            <span style={{ color: "var(--leather-text)" }}>{referenceName}</span>
                        )}
                    </>
                )}
            </p>
        </div>
    );
}
