/**
 * /cards/[code]/opengraph-image — link preview for a qualification
 * card's public verification page.
 *
 * Deliberately shows the card's CLAIMS (horse, class, show, place),
 * never its verdict: scrapers cache these images, and a card can be
 * voided or redeemed after the preview was cached. The live page is
 * the only place the Valid/Void stamp appears. Same cookie-less anon
 * RPC as the page. Static brand colors are fine inside ImageResponse
 * JSX — it renders to a PNG, not app CSS.
 */

import { ImageResponse } from "next/og";

import { verifyCard } from "@/lib/shows/verifyCard";
import { showYearLabel } from "@/lib/shows/showYear";
import { createAnonClient } from "@/lib/supabase/anon";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Qualification card verification on Model Horse Hub";

const PARCHMENT = "#F5EFDF";
const FOREST = "#2F5E40";
const BRASS = "#B8860B";
const INK = "#2B2418";

function Wordmark() {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
                style={{
                    display: "flex",
                    width: 18,
                    height: 18,
                    borderRadius: 9999,
                    backgroundColor: BRASS,
                }}
            />
            <div
                style={{
                    display: "flex",
                    fontSize: 28,
                    fontWeight: 700,
                    letterSpacing: "0.22em",
                    color: FOREST,
                }}
            >
                MODEL HORSE HUB
            </div>
        </div>
    );
}

function GenericCard() {
    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 36,
                backgroundColor: PARCHMENT,
            }}
        >
            <Wordmark />
            <div style={{ display: "flex", fontSize: 44, color: INK, fontWeight: 700 }}>
                Verify a qualification card
            </div>
        </div>
    );
}

export default async function OpengraphImage({ params }: { params: Promise<{ code: string }> }) {
    const { code } = await params;

    const anon = createAnonClient();
    const result = await verifyCard(anon, decodeURIComponent(code));
    const card = result && !("error" in result) ? result : null;

    if (!card) {
        return new ImageResponse(<GenericCard />, size);
    }

    const yearLabel = card.showYear !== null ? showYearLabel(card.showYear) : null;

    return new ImageResponse(
        (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    backgroundColor: PARCHMENT,
                    padding: 40,
                }}
            >
                <div
                    style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        border: `4px solid ${FOREST}`,
                        borderRadius: 18,
                        padding: "44px 56px",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                        }}
                    >
                        <Wordmark />
                        <div
                            style={{
                                display: "flex",
                                border: `3px solid ${BRASS}`,
                                borderRadius: 10,
                                padding: "6px 22px",
                                fontSize: 26,
                                fontWeight: 700,
                                letterSpacing: "0.12em",
                                color: BRASS,
                                transform: "rotate(2deg)",
                            }}
                        >
                            {card.earnedPlace === 1 ? "1ST PLACE" : "2ND PLACE"}
                        </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <div
                            style={{
                                display: "flex",
                                fontSize: 30,
                                fontWeight: 700,
                                letterSpacing: "0.16em",
                                color: FOREST,
                            }}
                        >
                            MHH QUALIFICATION CARD
                        </div>
                        <div
                            style={{
                                display: "flex",
                                fontSize: card.horseName && card.horseName.length > 28 ? 48 : 60,
                                fontWeight: 800,
                                lineHeight: 1.1,
                                color: INK,
                            }}
                        >
                            {card.horseName ?? "Qualification card"}
                        </div>
                        <div style={{ display: "flex", fontSize: 30, color: INK }}>
                            {card.className}
                        </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
                        <div
                            style={{
                                display: "flex",
                                height: 4,
                                width: "100%",
                                backgroundColor: BRASS,
                                borderRadius: 2,
                            }}
                        />
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                fontSize: 28,
                                color: INK,
                            }}
                        >
                            <div style={{ display: "flex" }}>
                                {card.showTitle}
                                {yearLabel ? ` — ${yearLabel}` : ""}
                            </div>
                            <div style={{ display: "flex", color: FOREST, fontWeight: 700 }}>
                                Verify: {card.code}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        ),
        size,
    );
}
