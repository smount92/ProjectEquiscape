import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import { getPhotoShows } from"@/app/actions/shows";
import Link from"next/link";

export const metadata = {
 title:"Photo Shows — Model Horse Hub",
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


export default async function ShowsPage() {
 const supabase = await createClient();
 const {
 data: { user },
 } = await supabase.auth.getUser();
 if (!user) redirect("/login");

 const shows = await getPhotoShows();

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
 <div className="mx-auto max-w-[var(--max-width)] px-6 py-8">
 <div className="animate-fade-in-up mb-8">
 <h1 className="text-2xl font-bold tracking-tight">
 📸 <span className="text-forest">Virtual Photo Shows</span>
 </h1>
 <p className="mt-2 max-w-xl text-base text-ink-light">
 Enter your models, vote for your favorites, and compete for community glory!
 </p>
 <div className="mt-6 flex items-baseline gap-2">
 <span className="text-2xl font-bold text-forest">
 {shows.filter((s) => s.status ==="open").length}
 </span>
 <span className="text-sm font-medium text-ink-light">Open Shows</span>
 </div>
 </div>

 {shows.length === 0 ? (
 <div className="bg-card border-edge animate-fade-in-up rounded-lg border px-8 py-12 text-center shadow-md transition-all">
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
 className="rounded-lg border border-edge bg-card p-4 shadow-md transition-all"
 id={`show-${show.id}`}
 >
 <div className="rounded-lg border border-edge bg-card p-4 shadow-md transition-all">
 <h3 className="rounded-lg border border-edge bg-card p-4 shadow-md transition-all">
 {show.title}
 </h3>
 <div className="flex items-center gap-1">
 {isUserJudge && (
 <span className="whitespace-nowrap rounded-sm border border-[rgba(139,92,246,0.3)] bg-[rgba(139,92,246,0.2)] px-2 py-0.5 text-[0.7rem] font-semibold text-[#a78bfa]">
 🏅 Judge
 </span>
 )}
 <span className={`show-status-badge ${badge.className}`}>{badge.label}</span>
 </div>
 </div>
 {show.theme && (
 <div className="rounded-lg border border-edge bg-card p-4 shadow-md transition-all">
 Theme: {show.theme}
 </div>
 )}
 {show.description && (
 <p className="rounded-lg border border-edge bg-card p-4 shadow-md transition-all">
 {show.description}
 </p>
 )}
 {show.creatorAlias && (
 <div className="text-muted mt-1 text-xs">Hosted by @{show.creatorAlias}</div>
 )}
 <div className="flex flex-wrap items-center gap-3 rounded-lg border border-edge bg-card p-4 text-sm text-muted">
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
 </div>
 );
}
