/**
 * Dashboard slot for the exhibitor's championship line — the same
 * My Season card /shows renders, self-fetching so it can drop into
 * any server surface (Suspense-friendly). MHH-first by placement:
 * it renders ABOVE the legacy NAN widget, which stays for members
 * who track NAN — our season simply leads.
 */

import { getMySeason } from "@/app/actions/standings";
import { showStandingsEnabled, showsV2Enabled } from "@/lib/shows/flags";
import MySeasonCard from "./MySeasonCard";

export default async function MhhSeasonWidget() {
    if (!showsV2Enabled()) return null;
    const season = await getMySeason();
    if (!season) return null;
    return <MySeasonCard season={season} standingsLive={showStandingsEnabled()} />;
}
