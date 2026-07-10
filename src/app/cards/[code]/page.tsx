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

import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { verifyCard } from "@/lib/shows/verifyCard";
import { showYearLabel } from "@/lib/shows/showYear";
import type { CardStatus } from "@/lib/shows/types";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Verify a Qualification Card — Model Horse Hub",
    description:
        "Check the authenticity of a Model Horse Hub qualification card by its short code.",
};

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

    return (
        <main className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col justify-center px-4 py-12">
            <div className="brass-heading mb-6">
                <span className="brass-heading-bar" aria-hidden="true" />
                <h1 className="m-0 text-xl text-foreground">Card Verification</h1>
            </div>

            {card ? (
                <div className="brass-plaque px-6 py-5" data-testid="card-verified">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <span className="text-engraved-brass font-mono text-2xl font-bold tracking-[0.2em]">
                            {card.code}
                        </span>
                        <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide uppercase ${
                                STATUS_COPY[card.status].valid
                                    ? "bg-forest text-primary-foreground"
                                    : "bg-destructive/15 text-destructive"
                            }`}
                        >
                            {STATUS_COPY[card.status].label}
                        </span>
                    </div>
                    <p className="text-engraved-brass mt-1 mb-4 text-sm font-semibold">
                        MHH Qualification Card
                    </p>

                    <div className="rounded-md bg-[color:var(--paper-lit)] px-4 py-2 text-[color:var(--paper-lit-ink)]">
                        {card.horseName && <Row label="Horse" value={card.horseName} />}
                        <Row label="Earned" value={card.earnedPlace === 1 ? "1st place" : "2nd place"} />
                        <Row label="Class" value={card.className} />
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

                    <p className="mt-4 mb-0 text-xs text-[color:var(--brass-ink)] opacity-80">
                        {STATUS_COPY[card.status].detail}
                    </p>
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
