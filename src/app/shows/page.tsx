import { createClient } from"@/lib/supabase/server";
import { getPhotoShows } from"@/app/actions/shows";
import { getPublicShows } from"@/app/actions/shows-v2";
import { getMyShowLife } from"@/app/actions/show-life";
import Link from"next/link";
import ExplorerLayout from"@/components/layouts/ExplorerLayout";
import PageMasthead from"@/components/layouts/PageMasthead";
import MyShowLifeSection from"@/components/shows/MyShowLifeSection";
import MySeasonCard from"@/components/shows/MySeasonCard";
import { getMySeason } from"@/app/actions/standings";
import { showStandingsEnabled } from"@/lib/shows/flags";
import { EMPTY_SHOW_LIFE } from"@/lib/shows/showLife";
import type { PublicShowSummary } from"@/lib/shows/public";
import type { ShowStatus } from"@/lib/shows/types";
import { formatStatus } from"@/lib/shows/stateMachine";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata = {
 title:"Shows",
 description:"Browse live and online model horse shows — open for entries, upcoming, in judging, and past results. Free to browse.",
};

function statusBadge(status: string) {
 switch (status) {
 case"open":
 return { label:"🟢 Open", className:"show-status-open" };
 case"judging":
 return { label:"🟡 Judging", className:"show-status-judging" };
 case"closed":
 return { label:"🔴 Closed", className:"show-status-closed" };
 default:
 return { label: status, className:"" };
 }
}


function v2ShowDate(show: PublicShowSummary): string | null {
 const iso = show.mode ==="live" ? show.showDate : show.entriesCloseAt;
 if (!iso) return null;
 const d = new Date(iso);
 if (Number.isNaN(d.getTime())) return null;
 const formatted = d.toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" });
 return show.mode ==="live" ? formatted : `Entries close ${formatted}`;
}

/** The browse ledger's shelves — one per lifecycle stage, in the
 *  order a visitor cares about them. */
const V2_GROUPS: { title: string; statuses: ShowStatus[] }[] = [
 { title:"Open now", statuses: ["entries_open"] },
 { title:"Upcoming", statuses: ["published"] },
 { title:"In judging", statuses: ["entries_closed","running","judging","results_review"] },
 { title:"Past", statuses: ["completed"] },
];

/** Phase D — v2 shows as ledger cards, ABOVE the legacy photo-show
 *  list, grouped by lifecycle stage. Links go to the canonical
 *  /shows/[id] route (the Phase E2 resolver renders the v2 page
 *  for v2 ids). */
function V2ShowsSection({ title, shows }: { title: string; shows: PublicShowSummary[] }) {
 if (shows.length === 0) return null;
 const headingId = `v2-shows-${title.toLowerCase().replace(/\s+/g,"-")}`;
 return (
  <section aria-labelledby={headingId} className="mb-10">
   <span className="ledger-tab" id={headingId}>
    {title}
   </span>
   <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
    {shows.map((show) => (
     <Link
      key={show.id}
      href={`/shows/${show.id}`}
      id={`show-${show.id}`}
      className="ledger-card block no-underline transition-all hover:shadow-lg"
     >
      <div className="flex flex-wrap items-center gap-2">
       <h3 className="m-0 text-base font-bold text-foreground">{show.title}</h3>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
       <span className="stamp">{formatStatus(show.status)}</span>
       <Badge variant="secondary">{show.mode ==="live" ?"Live" :"Online"}</Badge>
       {show.judging ==="community_vote" && <Badge variant="secondary">Community vote</Badge>}
       {show.isMhhQualifying && <Badge>🏅 MHH Sanctioned</Badge>}
      </div>
      {/* Findability for votable shows: community-vote shows in their
          judging window are open to EVERY voter — say so on the card. */}
      {show.judging ==="community_vote" && show.status ==="judging" && (
       <p className="mt-2 mb-0 text-sm font-semibold text-forest">
        🗳️ Voting open — everyone can vote
       </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
       <span>Hosted by @{show.hostAlias}</span>
       {v2ShowDate(show) && <span>{v2ShowDate(show)}</span>}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
       <span>
        {show.classCount} class{show.classCount !== 1 ?"es" :""}
       </span>
       <span>
        {show.entryCount} entr{show.entryCount !== 1 ?"ies" :"y"}
       </span>
      </div>
     </Link>
    ))}
   </div>
  </section>
 );
}

export default async function ShowsPage() {
 const supabase = await createClient();
 const {
 data: { user },
 } = await supabase.auth.getUser();

 // The doors are open: anon browses everything public. The legacy
 // photo-show list stays members-only below (its `events` RLS is
 // authed-only), so we only fetch it for signed-in viewers.
 const shows = user ? await getPhotoShows() : [];

 // v2 shows render ABOVE the legacy photo-show list.
 let v2Shows: PublicShowSummary[] = [];
 const v2Result = await getPublicShows();
 if (v2Result.success) v2Shows = v2Result.shows;

 // "My show life" — the signed-in entrant's cross-show strip above
 // the browse shelves. Empty (and hidden) for anon, for members who
 // don't show, and on any data failure.
 const showLife = user ? await getMyShowLife() : EMPTY_SHOW_LIFE;
 // My Season (season-felt wave): the exhibitor's championship line.
 const mySeason = user ? await getMySeason() : null;

 // Batch-check which shows this user is a judge for
 const showIds = shows.map((s) => s.id);
 let judgeShowIds = new Set<string>();
 if (user && showIds.length > 0) {
 const { data: judgeRows } = await supabase
 .from("event_judges")
 .select("event_id")
 .eq("user_id", user.id)
 .in("event_id", showIds);
 judgeShowIds = new Set((judgeRows ?? []).map((r: { event_id: string }) => r.event_id));
 }

 // Honest stat: shows accepting entries RIGHT NOW (v2 entries_open
 // + legacy open), not the legacy-only count that read "0" while v2
 // shows sat open directly above it.
 const openForEntries =
  v2Shows.filter((s) => s.status ==="entries_open").length +
  shows.filter((s) => s.status ==="open").length;

 const signInCta = (
  <>
   <Button asChild variant="outline">
    <Link href={`/login?redirectTo=${encodeURIComponent("/shows")}`}>Log in to enter</Link>
   </Button>
   <Button asChild>
    <Link href="/signup">Create Free Account</Link>
   </Button>
  </>
 );

 return (
 <ExplorerLayout noHeader>
  <PageMasthead
   icon="🏆"
   title="Shows"
   subtitle="Enter your models, vote for your favorites, and compete for community glory!"
   actions={
    <>
     {/* The rules ARE marketing (program §0) — anon sees them too. */}
     <Button asChild variant="outline">
      <Link href="/shows/rules">Rules</Link>
     </Button>
     {showStandingsEnabled() && (
      <Button asChild variant="outline">
       <Link href="/standings">Standings</Link>
      </Button>
     )}
     {user ? (
      <Button asChild variant="outline">
       <Link href="/shows/host">Host a show</Link>
      </Button>
     ) : (
      signInCta
     )}
    </>
   }
  />
  {mySeason && <MySeasonCard season={mySeason} standingsLive={showStandingsEnabled()} />}
  <MyShowLifeSection life={showLife} />

  {V2_GROUPS.map((group) => (
   <V2ShowsSection
    key={group.title}
    title={group.title}
    shows={v2Shows.filter((s) => group.statuses.includes(s.status))}
   />
  ))}

  <div className="mb-6 flex items-baseline gap-2">
  <span className="text-2xl font-bold text-forest">{openForEntries}</span>
  <span className="text-sm font-medium text-secondary-foreground">
   Open for entries right now
  </span>
  </div>

  {!user && (
  <section className="ledger-card mb-10" aria-labelledby="shows-signin-heading">
   <span className="ledger-tab" id="shows-signin-heading">
    Members-only photo shows
   </span>
   <p className="text-sm text-secondary-foreground">
    Classic community photo shows are visible to members. Sign in to browse them, enter
    your models, and vote — a free account is all it takes.
   </p>
   <div className="mt-4 flex flex-wrap gap-3">{signInCta}</div>
  </section>
  )}

  {/* The legacy empty state renders ONLY when there are no shows at
      all — never as a confusing "No Shows Yet" below real v2 cards. */}
  {user && shows.length === 0 && v2Shows.length === 0 ? (
  <div className="bg-card border-input animate-fade-in-up rounded-lg border px-8 py-12 text-center shadow-md transition-all">
   <div className="mb-4 text-5xl">📸</div>
   <h2>No Shows Yet</h2>
   <p>Check back soon for virtual photo shows!</p>
  </div>
  ) : (
  <div className="grid-cols-[repeat(auto-fill,minmax(300px,1fr))] animate-fade-in-up grid gap-6">
   {shows.map((show) => {
   const badge = statusBadge(show.status);
   const isUserJudge = judgeShowIds.has(show.id);
   return (
   <Link
    key={show.id}
    href={`/shows/${show.id}`}
    className="rounded-lg border border-input bg-card p-4 shadow-md transition-all"
    id={`show-${show.id}`}
   >
    <div className="flex flex-wrap items-center justify-between gap-2">
    <h3 className="m-0 text-base font-bold text-foreground">
    {show.title}
    </h3>
    <div className="flex items-center gap-1">
    {isUserJudge && (
    <span className="whitespace-nowrap rounded-sm border border-studio/30 bg-studio/10 px-2 py-0.5 text-[0.7rem] font-semibold text-studio">
     🏅 Judge
    </span>
    )}
    {show.sanctioningBody === "namhsa" && (
    <span className="whitespace-nowrap rounded-sm border border-warning/30 bg-warning/10 px-2 py-0.5 text-[0.7rem] font-semibold text-warning">
     🏛️ NAMHSA
    </span>
    )}
    <span className={`show-status-badge ${badge.className}`}>{badge.label}</span>
    </div>
    </div>
    {show.theme && (
    <div className="mt-2 text-sm text-secondary-foreground">
    Theme: {show.theme}
    </div>
    )}
    {show.description && (
    <p className="mt-2 text-sm text-secondary-foreground">
    {show.description}
    </p>
    )}
    {show.creatorAlias && (
    <div className="text-muted-foreground mt-1 text-xs">Hosted by @{show.creatorAlias}</div>
    )}
    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
    <span>
    🐴 {show.entryCount} entr{show.entryCount !== 1 ?"ies" :"y"}
    </span>
    {show.endAt && (
    <span>
    ⏰{" "}
    {new Date(show.endAt) > new Date()
     ? `Closes ${new Date(show.endAt).toLocaleDateString("en-US", { month:"short", day:"numeric", hour:"numeric", minute:"2-digit" })}`
     :"Entries closed"}
    </span>
    )}
    <span>
    📅{" "}
    {new Date(show.createdAt).toLocaleDateString("en-US", {
    month:"short",
    day:"numeric",
    })}
    </span>
    </div>
   </Link>
   );
   })}
  </div>
  )}
 </ExplorerLayout>
 );
}
