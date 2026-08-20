/**
 * Server slot for the announcement strap: one cached read (60s)
 * shared by every page render, so the site-wide banner costs the
 * layout essentially nothing. Renders nothing when no announcement
 * is live (or pre-migration-165).
 */

import { unstable_cache } from "next/cache";

import { getLiveAnnouncements } from "@/lib/announcements";
import AnnouncementBar from "./AnnouncementBar";

const cachedSiteAnnouncements = unstable_cache(
    () => getLiveAnnouncements(["site"]),
    ["announcements-site"],
    { revalidate: 60 },
);

export default async function AnnouncementSlot() {
    const announcements = await cachedSiteAnnouncements();
    if (announcements.length === 0) return null;
    return <AnnouncementBar announcements={announcements} />;
}
