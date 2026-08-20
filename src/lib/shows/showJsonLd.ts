import type { PublicShow } from "@/lib/shows/public";

/** Event JSON-LD — built only from data the show page already fetched
 *  (no extra queries). https://schema.org/Event */
export function buildShowJsonLd(show: PublicShow) {
    const startDate = show.mode === "live" ? show.showDate : show.entriesOpenAt;
    return {
        "@context": "https://schema.org",
        "@type": "Event",
        name: show.title,
        ...(startDate ? { startDate } : {}),
        eventAttendanceMode:
            show.mode === "live"
                ? "https://schema.org/OfflineEventAttendanceMode"
                : "https://schema.org/OnlineEventAttendanceMode",
        eventStatus: "https://schema.org/EventScheduled",
        organizer: { "@type": "Person", name: show.hostAlias },
        location:
            show.mode === "live"
                ? { "@type": "Place", name: show.venueName ?? undefined, address: show.venueAddress ?? undefined }
                : { "@type": "VirtualLocation", url: `${process.env.NEXT_PUBLIC_APP_URL || "https://modelhorsehub.com"}/shows/${show.id}` },
    };
}
