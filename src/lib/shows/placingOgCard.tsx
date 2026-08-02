/**
 * SHARE-YOUR-PLACING — the rosette OG card JSX (1200×630).
 *
 * Lives outside the opengraph-image route so the route stays a
 * thin fetch-and-render shell and the card can be rendered
 * standalone (dev harness / visual verification) with mock data.
 *
 * ImageResponse JSX renders to a PNG off-DOM — app CSS tokens
 * don't exist here, so the brand hexes are deliberate literals
 * (same rule as the show OG card). Ribbon colors come in via
 * props: the hobby's convention, never themed. Satori quirks:
 * every box is display:flex, no clip-path — the ribbon tails are
 * plain rotated rectangles tucked behind the medallion.
 */

import type { Place } from "./types";

export const PLACING_OG_SIZE = { width: 1200, height: 630 };

const PARCHMENT = "#F5EFDF";
const INK = "#2B2418";
const FOREST = "#2F5E40";
const BRASS = "#B8860B";
const LEATHER = "#3E2B1D";

export interface PlacingOgCardProps {
    horseName: string;
    /** "1st" … "6th" (placeLabel output). */
    placeText: string;
    /** ribbonHex(place) — the rosette's color. */
    ribbonColor: string;
    /** Yellow/white rosettes need ink centers; the rest white. */
    place: Place;
    className: string;
    showTitle: string;
    /** "1st of 9 entries" / "1st place". */
    fieldLine: string;
    /** Public entry-photo URL; null renders the 🐴 block. */
    photoUrl: string | null;
    /** e.g. "September 6, 2026"; null omits the line. */
    dateLabel: string | null;
}

function rosetteInk(place: Place): string {
    return place === 3 || place === 4 ? INK : "#FFFFFF";
}

/** Concentric-circle rosette with ribbon tails, ~290px tall. */
function Rosette({
    color,
    text,
    ink,
}: {
    color: string;
    text: string;
    ink: string;
}) {
    const SIZE = 210;
    return (
        <div
            style={{
                display: "flex",
                position: "relative",
                width: SIZE,
                height: SIZE + 80,
            }}
        >
            {/* Ribbon tails */}
            <div
                style={{
                    display: "flex",
                    position: "absolute",
                    left: SIZE / 2 - 46,
                    top: SIZE * 0.45,
                    width: 46,
                    height: 165,
                    backgroundColor: color,
                    border: "2px solid rgba(0, 0, 0, 0.3)",
                    transform: "rotate(-16deg)",
                }}
            />
            <div
                style={{
                    display: "flex",
                    position: "absolute",
                    left: SIZE / 2,
                    top: SIZE * 0.45,
                    width: 46,
                    height: 165,
                    backgroundColor: color,
                    border: "2px solid rgba(0, 0, 0, 0.3)",
                    transform: "rotate(16deg)",
                }}
            />
            {/* Outer disc → parchment ring → center disc */}
            <div
                style={{
                    display: "flex",
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: SIZE,
                    height: SIZE,
                    borderRadius: 9999,
                    backgroundColor: color,
                    border: "4px solid rgba(0, 0, 0, 0.35)",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        width: SIZE * 0.8,
                        height: SIZE * 0.8,
                        borderRadius: 9999,
                        backgroundColor: color,
                        border: `6px solid ${PARCHMENT}`,
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            fontSize: 64,
                            fontWeight: 800,
                            color: ink,
                        }}
                    >
                        {text}
                    </div>
                </div>
            </div>
        </div>
    );
}

function Wordmark() {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
                style={{
                    display: "flex",
                    width: 16,
                    height: 16,
                    borderRadius: 9999,
                    backgroundColor: BRASS,
                }}
            />
            <div
                style={{
                    display: "flex",
                    fontSize: 26,
                    fontWeight: 700,
                    letterSpacing: "0.22em",
                    color: PARCHMENT,
                }}
            >
                MODEL HORSE HUB
            </div>
        </div>
    );
}

/** Brand fallback for anything that shouldn't render a placing. */
export function PlacingGenericCard() {
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
                backgroundColor: LEATHER,
            }}
        >
            <Wordmark />
            <div
                style={{
                    display: "flex",
                    fontSize: 44,
                    color: PARCHMENT,
                    fontWeight: 700,
                }}
            >
                The digital home for the model horse hobby
            </div>
        </div>
    );
}

export function PlacingOgCard(props: PlacingOgCardProps) {
    const ink = rosetteInk(props.place);
    const nameSize = props.horseName.length > 22 ? 52 : 64;
    const titleLine = `${props.className} · ${props.showTitle}`;

    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                backgroundColor: LEATHER,
                padding: 36,
            }}
        >
            <div
                style={{
                    flex: 1,
                    display: "flex",
                    border: `4px solid ${BRASS}`,
                    borderRadius: 18,
                    padding: "36px 44px",
                    gap: 40,
                }}
            >
                {/* Left column: rosette + the sentence + wordmark */}
                <div
                    style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
                        <Rosette color={props.ribbonColor} text={props.placeText} ink={ink} />
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 6,
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    fontSize: 40,
                                    fontWeight: 800,
                                    color: PARCHMENT,
                                }}
                            >
                                {props.fieldLine}
                            </div>
                            {props.dateLabel && (
                                <div
                                    style={{
                                        display: "flex",
                                        fontSize: 26,
                                        color: "#CBB88F",
                                    }}
                                >
                                    {props.dateLabel}
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <div
                            style={{
                                display: "flex",
                                fontSize: nameSize,
                                fontWeight: 800,
                                lineHeight: 1.05,
                                color: PARCHMENT,
                            }}
                        >
                            {props.horseName}
                        </div>
                        <div
                            style={{
                                display: "flex",
                                fontSize: 28,
                                fontWeight: 600,
                                lineHeight: 1.25,
                                color: "#CBB88F",
                            }}
                        >
                            {titleLine.length > 90 ? `${titleLine.slice(0, 87)}…` : titleLine}
                        </div>
                    </div>

                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 18,
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                height: 4,
                                width: "100%",
                                backgroundColor: BRASS,
                                borderRadius: 2,
                            }}
                        />
                        <Wordmark />
                    </div>
                </div>

                {/* Right side: the horse, large */}
                <div
                    style={{
                        display: "flex",
                        width: 400,
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    {props.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={props.photoUrl}
                            alt=""
                            width={400}
                            height={490}
                            style={{
                                width: 400,
                                height: 490,
                                objectFit: "cover",
                                borderRadius: 16,
                                border: `5px solid ${PARCHMENT}`,
                            }}
                        />
                    ) : (
                        <div
                            style={{
                                display: "flex",
                                width: 400,
                                height: 490,
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: 16,
                                border: `5px solid ${PARCHMENT}`,
                                backgroundColor: FOREST,
                                fontSize: 160,
                            }}
                        >
                            🐴
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
