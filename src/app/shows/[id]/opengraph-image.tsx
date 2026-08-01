/**
 * /shows/[id]/opengraph-image — the link-preview card for a show.
 *
 * A parchment/ledger-styled card: show title, host alias, mode
 * (Live/Online), the date that matters, class count, MHH wordmark.
 * Fetched with the same cookie-less anon client pattern as the page's
 * generateMetadata — never a session-bound read. Legacy event ids and
 * drafts fall back to a generic brand card.
 *
 * Static brand colors are deliberate here: ImageResponse JSX renders
 * to a PNG off-DOM, so app CSS tokens don't exist. This is not app
 * styling — day/night theming doesn't apply to a link preview.
 */

import { ImageResponse } from "next/og";

import { getAliases } from "@/lib/shows/queries";
import { createAnonClient } from "@/lib/supabase/anon";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Show details on Model Horse Hub";

const PARCHMENT = "#F5EFDF";
const FOREST = "#2F5E40";
const BRASS = "#B8860B";
const INK = "#2B2418";

function Wordmark() {
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
            }}
        >
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
                    fontSize: 30,
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
                The digital home for the model horse hobby
            </div>
        </div>
    );
}

export default async function OpengraphImage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const anon = createAnonClient();
    const { data: show } = await anon
        .from("shows")
        .select("title, mode, status, host_id, show_date, entries_close_at")
        .eq("id", id)
        .maybeSingle();

    if (!show || show.status === "draft") {
        return new ImageResponse(<GenericCard />, size);
    }

    // Host alias via the anon-granted RPC (same as the page).
    const aliases = await getAliases(anon, [show.host_id as string]);
    const hostAlias =
        aliases instanceof Map ? (aliases.get(show.host_id as string) ?? "unknown") : "unknown";

    // Enterable classlist size — the division→section→class chain,
    // cancelled/combined excluded (mirrors getPublicShows).
    let classCount = 0;
    const { data: divisionRows } = await anon.from("show_divisions").select("id").eq("show_id", id);
    const divisionIds = (divisionRows ?? []).map((d: { id: string }) => d.id);
    if (divisionIds.length > 0) {
        const { data: sectionRows } = await anon
            .from("show_sections")
            .select("id")
            .in("division_id", divisionIds);
        const sectionIds = (sectionRows ?? []).map((s: { id: string }) => s.id);
        if (sectionIds.length > 0) {
            const { data: classRows } = await anon
                .from("show_classes")
                .select("id, status")
                .in("section_id", sectionIds);
            classCount = (classRows ?? []).filter(
                (c: { status: string }) => c.status !== "cancelled" && c.status !== "combined",
            ).length;
        }
    }

    const isLive = show.mode === "live";
    const dateIso = (isLive ? show.show_date : show.entries_close_at) as string | null;
    // Live show dates are calendar dates (UTC keeps the printed day
    // honest). Entries-close is an instant: a static image can't know
    // the viewer's zone, so print the time and NAME the zone (UTC) —
    // never a bare wall-clock time.
    const dateLabel = dateIso
        ? isLive
            ? new Date(dateIso).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "UTC",
              })
            : `${new Date(dateIso).toLocaleString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  timeZone: "UTC",
              })} UTC`
        : null;

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
                    {/* Header row: wordmark + mode stamp */}
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
                                border: `3px solid ${FOREST}`,
                                borderRadius: 10,
                                padding: "6px 22px",
                                fontSize: 28,
                                fontWeight: 700,
                                letterSpacing: "0.14em",
                                color: FOREST,
                                transform: "rotate(-2deg)",
                            }}
                        >
                            {isLive ? "LIVE SHOW" : "ONLINE SHOW"}
                        </div>
                    </div>

                    {/* Title + host */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                        <div
                            style={{
                                display: "flex",
                                fontSize: show.title.length > 40 ? 56 : 68,
                                fontWeight: 800,
                                lineHeight: 1.1,
                                color: INK,
                            }}
                        >
                            {show.title}
                        </div>
                        <div
                            style={{
                                display: "flex",
                                fontSize: 32,
                                color: FOREST,
                                fontWeight: 600,
                            }}
                        >
                            Hosted by @{hostAlias}
                        </div>
                    </div>

                    {/* Footer facts over a brass rule */}
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
                                fontSize: 30,
                                color: INK,
                            }}
                        >
                            <div style={{ display: "flex" }}>
                                {dateLabel
                                    ? `${isLive ? "Show date" : "Entries close"} — ${dateLabel}`
                                    : "Dates on the show page"}
                            </div>
                            <div style={{ display: "flex", color: FOREST, fontWeight: 700 }}>
                                {classCount} class{classCount === 1 ? "" : "es"}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        ),
        size,
    );
}
