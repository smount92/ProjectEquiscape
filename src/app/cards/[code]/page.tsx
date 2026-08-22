/**
 * /cards/[code] — public MHH qualification-card verification
 * (Phase F). The trust feature: anyone — buyer, showholder, anon
 * visitor — can check a card is real before money changes hands.
 *
 * DELIBERATELY NOT flag-gated: cards only exist if the flag-gated
 * shows-v2 system issued them, and a shared verification link must
 * never 404 because a UI flag flipped. Reads go through the
 * SECURITY DEFINER verify_qualification_card RPC (migration 118),
 * so anon gets exactly one card's public face per code — the table
 * is never crawlable. "/cards" is in the middleware public paths.
 *
 * Copy rule (design doc §6): MHH platform qualification — never
 * imply NAMHSA/NAN.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { createAnonClient } from "@/lib/supabase/anon";
import { verifyCard } from "@/lib/shows/verifyCard";
import { showYearLabel } from "@/lib/shows/showYear";
import type { CardStatus } from "@/lib/shows/types";

export const dynamic = "force-dynamic";

/**
 * Per-card link preview text.
 *
 * A card link is the thing a seller pastes into a sale thread, so the
 * preview should say what was won, not "Verify a Qualification Card"
 * over and over. Follows the same rule as the image beside it: state
 * the card's CLAIMS, never its verdict — scrapers cache previews, and
 * a card can be voided after the cache is written. Valid/Void lives on
 * the live page only.
 */
export async function generateMetadata({
    params,
}: {
    params: Promise<{ code: string }>;
}): Promise<Metadata> {
    const fallback: Metadata = {
        title: "Verify a Qualification Card",
        description:
            "Check the authenticity of a Model Horse Hub qualification card by its short code.",
    };

    try {
        const { code } = await params;
        const card = await verifyCard(createAnonClient(), code);
        if (!card || "error" in card) return fallback;

        const place = card.earnedPlace === 1 ? "1st" : "2nd";
        const horse = card.horseName?.trim();
        const year = card.showYear === null ? null : showYearLabel(card.showYear);

        // "1st of 12" when we know the field, plain "1st" on older cards.
        const against = card.classEntryCount ? `${place} of ${card.classEntryCount}` : place;
        const title = horse
            ? `${horse} — ${against} in ${card.className}`
            : `${against} in ${card.className}`;

        const description = [
            `${card.showTitle}${year ? ` (${year})` : ""}.`,
            card.isStakes ? "Stakes class." : null,
            "Qualification card issued by Model Horse Hub — check it here.",
        ]
            .filter(Boolean)
            .join(" ");

        return {
            title,
            description,
            openGraph: { title, description },
            twitter: { card: "summary_large_image", title, description },
        };
    } catch {
        return fallback;
    }
}

const STATUS_COPY: Record<CardStatus, { label: string; valid: boolean; detail: string }> = {
    issued: {
        label: "Valid",
        valid: true,
        detail: "This card is authentic and held by the owner who earned it.",
    },
    transferred: {
        label: "Valid — transferred",
        valid: true,
        detail:
            "This card is authentic. The horse has changed hands since the card was earned, and the card traveled with it.",
    },
    redeemed: {
        label: "Redeemed",
        valid: false,
        detail: "This card was authentic but has already been redeemed.",
    },
    void: {
        label: "Void",
        valid: false,
        detail: "This card has been voided and is no longer valid.",
    },
};

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-baseline justify-between gap-4 border-b border-dashed border-border-tan/30 py-2.5 last:border-0">
            <span className="text-xs font-semibold tracking-widest text-secondary-foreground uppercase">
                {label}
            </span>
            <span className="text-right text-sm font-semibold text-foreground">{value}</span>
        </div>
    );
}

export default async function CardVerifyPage({
    params,
}: {
    params: Promise<{ code: string }>;
}) {
    const { code } = await params;
    const supabase = await createClient();
    const result = await verifyCard(supabase, decodeURIComponent(code));

    const card = result && !("error" in result) ? result : null;
    const failed = result !== null && typeof result === "object" && "error" in result;

    // Cards minted before the gates (migration 153) carry no field counts,
    // so they can only state the place.
    const earnedLine = card
        ? card.classEntryCount !== null && card.classExhibitorCount !== null
            ? `${card.earnedPlace === 1 ? "1st" : "2nd"} of ${card.classEntryCount} — ${card.classExhibitorCount} exhibitor${card.classExhibitorCount === 1 ? "" : "s"}`
            : card.earnedPlace === 1
              ? "1st place"
              : "2nd place"
        : "";

    return (
        <main className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col justify-center px-4 py-12">
            <div className="brass-heading mb-6">
                <span className="brass-heading-bar" aria-hidden="true" />
                <h1 className="m-0 text-xl text-foreground">Card Verification</h1>
            </div>

            {card ? (
                <div className="brass-plaque px-6 py-5" data-testid="card-verified">
                    {/* The plaque leads with what was WON. The code is a
                        random uniqueness string — it belongs at the bottom
                        as a reference, not as the headline. */}
                    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                        <div className="min-w-0">
                            <p className="text-engraved-brass m-0 text-sm font-semibold tracking-wide uppercase">
                                {card.isStakes
                                    ? "MHH Qualification Card — STAKES"
                                    : "MHH Qualification Card"}
                            </p>
                            {card.horseName && (
                                <p className="text-engraved-brass mt-0.5 mb-0 font-serif text-2xl leading-tight font-bold">
                                    {card.horseName}
                                </p>
                            )}
                            <p className="text-engraved-brass mt-0.5 mb-0 text-base font-semibold">
                                {earnedLine} · {card.className}
                            </p>
                        </div>
                        <span
                            className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide uppercase ${
                                STATUS_COPY[card.status].valid
                                    ? "bg-forest text-primary-foreground"
                                    : "bg-destructive text-primary-foreground"
                            }`}
                        >
                            {STATUS_COPY[card.status].label}
                        </span>
                    </div>
                    <div className="mb-4" />

                    <div className="lit-paper rounded-md bg-[color:var(--paper-lit)] px-4 py-2 text-[color:var(--paper-lit-ink)]">
                        {/* Horse, placing and class are the headline above —
                            these rows carry the rest of the provenance. */}
                        <Row label="Show" value={card.showTitle} />
                        {card.showYear !== null && (
                            <Row label="Show year" value={showYearLabel(card.showYear)} />
                        )}
                        <Row
                            label="Issued"
                            value={new Date(card.issuedAt).toLocaleDateString("en-US", {
                                month: "long",
                                day: "numeric",
                                year: "numeric",
                            })}
                        />
                    </div>

                    {/* Authenticity line and the reference code both used to
                        sit in dark ink on the darkest end of the brass
                        gradient, which is where the plaque stopped being
                        readable. They ride the lit-paper panel instead. */}
                    <div className="mt-3 lit-paper rounded-md bg-[color:var(--paper-lit)] px-4 py-3 text-[color:var(--paper-lit-ink)]">
                        <p className="m-0 text-xs leading-relaxed">
                            {STATUS_COPY[card.status].detail}
                        </p>
                        <p className="mt-2 mb-0 flex items-baseline gap-2 text-xs">
                            <span className="font-semibold tracking-widest uppercase opacity-70">
                                Card
                            </span>
                            <span className="font-mono tracking-[0.15em] select-all">
                                {card.code}
                            </span>
                        </p>
                    </div>
                </div>
            ) : (
                <div
                    className="rounded-lg border border-border bg-card px-6 py-8 text-center"
                    data-testid="card-not-found"
                >
                    <span className="mb-2 block text-4xl" aria-hidden="true">
                        🔍
                    </span>
                    <h2 className="mb-2 text-lg font-semibold text-foreground">
                        {failed ? "Verification is temporarily unavailable" : "No card found"}
                    </h2>
                    <p className="m-0 text-sm text-muted-foreground">
                        {failed
                            ? "Something went wrong checking this code. Please try again in a moment."
                            : "No qualification card matches this code. Check the code and try again — codes are 8 characters and case-sensitive."}
                    </p>
                </div>
            )}

            <p className="mt-6 text-center text-xs text-muted-foreground">
                MHH Qualification Cards are platform qualifications earned on Model Horse
                Hub (1st or 2nd in a qualifying class at a qualifying show). They are{" "}
                <strong>not</strong> NAMHSA/NAN cards. Cards transfer automatically when a
                horse changes hands through Safe-Trade.
            </p>
            <p className="mt-2 text-center text-xs">
                <Link href="/" className="font-semibold text-forest hover:underline">
                    Model Horse Hub
                </Link>
            </p>
        </main>
    );
}
