import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import { getPhotoShows } from"@/app/actions/shows";
import { getPublicShows } from"@/app/actions/shows-v2";
import Link from"next/link";
import ExplorerLayout from"@/components/layouts/ExplorerLayout";
import PageMasthead from"@/components/layouts/PageMasthead";
import { showsV2Enabled } from"@/lib/shows/flags";
import type { PublicShowSummary } from"@/lib/shows/public";
import { formatStatus } from"@/lib/shows/stateMachine";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata = {
 title:"Photo Shows",
 description:"Browse and enter virtual photo shows. Show off your models and vote for favorites!",
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

/** Phase D — v2 shows as ledger cards, ABOVE the legacy photo-show
 *  list. Links go to the canonical /shows/[id] route (the Phase E2
 *  resolver renders the v2 page for v2 ids). */
function V2ShowsSection({ shows }: { shows: PublicShowSummary[] }) {
 if (shows.length === 0) return null;
 return (
  <section aria-labelledby="v2-shows-heading" className="mb-10">
   <span className="ledger-tab" id="v2-shows-heading">
    Shows — Live &amp; Online
   </span>
   <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
    {shows.map((show) => (
     <Link
      key={show.id}
      href={`/shows/${show.id}`}
      className="ledger-card block no-underline transition-all hover:shadow-lg"
     >
      <div className="flex flex-wrap items-center gap-2">
       <h3 className="m-0 text-base font-bold text-foreground">{show.title}</h3>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
       <span className="stamp">{formatStatus(show.status)}</span>
       <Badge variant="secondary">{show.mode ==="live" ?"Live" :"Online"}</Badge>
       {show.isMhhQualifying && <Badge>MHH Qualifying</Badge>}
      </div>
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
 if (!user) redirect("/login");

 const shows = await getPhotoShows();

 // v2 shows (flag-gated) render ABOVE the legacy photo-show list.
 let v2Shows: PublicShowSummary[] = [];
 if (showsV2Enabled()) {
  const v2Result = await getPublicShows();
  if (v2Result.success) v2Shows = v2Result.shows;
 }

 // Batch-check which shows this user is a judge for
 const showIds = shows.map((s) => s.id);
 let judgeShowIds = new Set<string>();
 if (showIds.length > 0) {
 const { data: judgeRows } = await supabase
 .from("event_judges")
 .select("event_id")
 .eq("user_id", user.id)
 .in("event_id", showIds);
 judgeShowIds = new Set((judgeRows ?? []).map((r: { event_id: string }) => r.event_id));
 }

 return (
 <ExplorerLayout noHeader>
  <PageMasthead
   icon="🏆"
   title="Shows"
   subtitle="Enter your models, vote for your favorites, and compete for community glory!"
   actions={
    showsV2Enabled() ? (
     <Button asChild variant="outline">
      <Link href="/shows/host">Host a show</Link>
     </Button>
    ) : undefined
   }
  />
  <V2ShowsSection shows={v2Shows} />

  <div className="mb-6 flex items-baseline gap-2">
  <span className="text-2xl font-bold text-forest">
   {shows.filter((s) => s.status ==="open").length}
  </span>
  <span className="text-sm font-medium text-secondary-foreground">Open Shows</span>
  </div>

  {shows.length === 0 ? (
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
    <div className="rounded-lg border border-input bg-card p-4 shadow-md transition-all">
    <h3 className="rounded-lg border border-input bg-card p-4 shadow-md transition-all">
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
    <div className="rounded-lg border border-input bg-card p-4 shadow-md transition-all">
    Theme: {show.theme}
    </div>
    )}
    {show.description && (
    <p className="rounded-lg border border-input bg-card p-4 shadow-md transition-all">
    {show.description}
    </p>
    )}
    {show.creatorAlias && (
    <div className="text-muted-foreground mt-1 text-xs">Hosted by @{show.creatorAlias}</div>
    )}
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-input bg-card p-4 text-sm text-muted-foreground">
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
