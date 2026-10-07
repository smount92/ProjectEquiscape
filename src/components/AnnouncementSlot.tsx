/**
 * Server slot for the announcement strap: one cached read shared by
 * every page render, so the site-wide banner costs the layout
 * essentially nothing. Renders nothing when no announcement is live
 * (or pre-migration-165).
 *
 * WHY THE WINDOW IS AN HOUR, NOT A MINUTE. This slot sits in the root
 * layout, so its cache window is inherited by EVERY static page on the
 * site: Next takes the shortest `revalidate` of any cached read in a
 * render as the route's own revalidate. At 60 s, the FAQ, About,
 * Privacy, the landing page and every /reference page were re-rendered
 * and re-written to the ISR cache almost once per request (Vercel ISR
 * writes: 1.35M units in the first six days of October 2026, the
 * largest line on the bill). Freshness now comes from the tag, which
 * the admin actions clear the moment an announcement is created or
 * deleted; the hour is only the backstop for a timed `ends_at`.
 */

import { unstable_cache } from "next/cache";

import { ANNOUNCEMENTS_CACHE_SECONDS, ANNOUNCEMENTS_CACHE_TAG, getLiveAnnouncements } from "@/lib/announcements";
import AnnouncementBar from "./AnnouncementBar";

const cachedSiteAnnouncements = unstable_cache(
    () => getLiveAnnouncements(["site"]),
    ["announcements-site"],
    { revalidate: ANNOUNCEMENTS_CACHE_SECONDS, tags: [ANNOUNCEMENTS_CACHE_TAG] },
);

export default async function AnnouncementSlot() {
    const announcements = await cachedSiteAnnouncements();
    if (announcements.length === 0) return null;
    return <AnnouncementBar announcements={announcements} />;
}
