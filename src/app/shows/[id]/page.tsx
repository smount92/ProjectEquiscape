import { createClient } from"@/lib/supabase/server";
import { redirect, notFound } from"next/navigation";
import { getShowEntries } from"@/app/actions/shows";
import { getEventJudges } from"@/app/actions/events";
import { getEventDivisions } from"@/app/actions/competition";
import { getPosts } from"@/app/actions/posts";
import Link from"next/link";
import ShowEntryForm from"@/components/ShowEntryForm";
import ShowResultsView from"@/components/ShowResultsView";
import UniversalFeed from"@/components/UniversalFeed";
import CloseShowButton from"@/components/CloseShowButton";
import ExpertJudgingPanel from"@/components/ExpertJudgingPanel";
import ExplorerLayout from"@/components/layouts/ExplorerLayout";
import { getUserTier } from"@/lib/auth";
import { getPublicImageUrl } from"@/lib/utils/storage";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
 const { id } = await params;
 return {
 title: `Photo Show — Model Horse Hub`,
 description: `Virtual photo show ${id}.`,
 };
}


export default async function ShowDetailPage({ params }: { params: Promise<{ id: string }> }) {
 const { id: showId } = await params;
 const supabase = await createClient();
 const {
 data: { user },
 } = await supabase.auth.getUser();
 if (!user) redirect("/login");

 const { show, entries } = await getShowEntries(showId);
 if (!show) notFound();

 const showComments = await getPosts({ eventId: showId }, { includeReplies: true });

 // Fetch user's public horses for entry form
 const { data: userHorses } = await supabase
 .from("user_horses")
 .select("id, custom_name")
 .eq("owner_id", user.id)
 .eq("is_public", true);

  const horseIds = (userHorses ?? []).map((h: { id: string }) => h.id);
  let thumbMap = new Map<string, string>();
  if (horseIds.length > 0) {
    const { data: horseThumbs } = await supabase
      .from("horse_images")
      .select("horse_id, image_url, angle_profile")
      .in("horse_id", horseIds);
    for (const hId of horseIds) {
      const imgs = (horseThumbs ?? []).filter((r: { horse_id: string }) => r.horse_id === hId);
      const primary = imgs.find((i: { angle_profile: string }) => i.angle_profile === "Primary_Thumbnail");
      const url = (primary ?? imgs[0])?.image_url;
      if (url) thumbMap.set(hId, getPublicImageUrl(url as string));
    }
  }

  const horseOptions = (userHorses ?? []).map((h: { id: string; custom_name: string }) => ({
    id: h.id,
    name: h.custom_name,
    thumbnailUrl: thumbMap.get(h.id) || null,
  }));

 const isOpen = show.status ==="open";
 const isCreator = show.createdBy === user.id;
 const isAdmin = user.email?.toLowerCase() === process.env.ADMIN_EMAIL?.toLowerCase();
 const isExpired = show.endAt ? new Date(show.endAt) < new Date() : false;
 const canClose = (isCreator || isAdmin) && show.status !=="closed" && (isExpired || show.status ==="judging");
 const hasUserEntries = entries.some((e) => e.ownerId === user.id);
 const userTier = await getUserTier();

 // Expert judge flags
 const isExpertJudged = show.judgingMethod ==="expert_judge";
 const isJudging = show.status ==="judging";

 // Check if user is assigned judge
 const eventJudges = isExpertJudged ? await getEventJudges(showId) : [];
 const isJudge = eventJudges.some((j) => j.userId === user.id);

 // Fetch divisions/classes for the entry form
 const divisions = await getEventDivisions(showId);
 const classOptions = divisions.flatMap((d) =>
 d.classes.map((c) => ({
 id: c.id,
 name: c.classNumber ? `${c.classNumber}: ${c.name}` : c.name,
 divisionName: d.name,
 allowedScales: c.allowedScales,
 isNanQualifying: c.isNanQualifying,
 maxEntries: c.maxEntries,
 currentEntryCount: c.entryCount || 0,
 })),
 );

 // Sort entries by division → class → entry order
 const sortedEntries = [...entries].sort((a, b) => {
 const divA = a.divisionName ||"zzz";
 const divB = b.divisionName ||"zzz";
 if (divA !== divB) return divA.localeCompare(divB);
 const clsA = a.className ||"zzz";
 const clsB = b.className ||"zzz";
 if (clsA !== clsB) return clsA.localeCompare(clsB);
 return 0;
 });

 return (
 <ExplorerLayout
  title={<>📸 <span className="text-forest">{show.title}</span></>}
  description={<>{show.theme && <span className="italic">Theme: {show.theme} · </span>}{show.description && <span>{show.description} · </span>}{show.creatorAlias && <span>Hosted by @{show.creatorAlias}</span>}</>}
 >
 {/* Hero */}
 <div className="animate-fade-in-up mb-6 text-center">
 <div className="mb-4">
 <h1 className="text-2xl font-bold tracking-tight">
 📸 <span className="text-forest">{show.title}</span>
 </h1>
 {show.theme && (
 <p className="mt-2 text-base italic text-ink-light">
 Theme: {show.theme}
 </p>
 )}
 {show.description && (
 <p className="mt-2 text-sm text-ink-light">
 {show.description}
 </p>
 )}
 {show.endAt && (
 <p
 className={`mt-2 text-sm font-medium ${
 new Date(show.endAt) > new Date()
 ? "text-amber-600"
 : "text-stone-500"
 }`}
 >
 ⏰{" "}
 {new Date(show.endAt) > new Date()
 ? `Entries close: ${new Date(show.endAt).toLocaleDateString("en-US", { month:"long", day:"numeric", year:"numeric", hour:"numeric", minute:"2-digit" })}`
 :"Entries are closed"}
 </p>
 )}
 {show.creatorAlias && (
 <p className="mt-1 text-sm text-ink-light">
 Hosted by @{show.creatorAlias}
 </p>
 )}
 </div>
 <div className="mt-6 flex justify-center gap-8">
 <div className="flex flex-col items-center">
 <span className="text-xl font-bold">{entries.length}</span>
 <span className="text-xs text-ink-light">Entries</span>
 </div>
 <div className="flex flex-col items-center">
 <span className="text-xl">
 {show.status ==="open" ?"🟢" : show.status ==="judging" ?"🟡" :"🔴"}
 </span>
 <span className="text-xs text-ink-light">
 {show.status.charAt(0).toUpperCase() + show.status.slice(1)}
 </span>
 </div>
 <div className="flex flex-col items-center">
 <span className="text-xl">{isExpertJudged ?"🏅" :"🗳️"}</span>
 <span className="text-xs text-ink-light">
 {isExpertJudged ?"Expert Judge" :"Community Vote"}
 </span>
 </div>
 </div>
 </div>


 {/* Creator Actions */}
 {(isCreator || isAdmin) && (
 <div className="animate-fade-in-up mb-4 flex justify-end gap-2">
 <Link
 href={`/community/events/${showId}/manage`}
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 >
 ⚙️ Manage Classes
 </Link>
 {userTier !== "free" ? (
 <a
  href={`/api/export/show-tags?showId=${showId}&all=true`}
  target="_blank"
  className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-6 py-2 text-sm font-semibold text-amber-700 no-underline transition-all hover:bg-amber-100"
 >
  🏷️ Print All Tags (PDF)
 </a>
 ) : (
 <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
  🏷️ Show Tags are a <Link href="/upgrade" className="font-semibold underline">Pro feature</Link>
 </div>
 )}
 </div>
 )}

 {/* Entrant Tags — any user with entries can print their own tags */}
 {hasUserEntries && !isCreator && (
 <div className="animate-fade-in-up mb-4 flex justify-end gap-2">
  {userTier !== "free" ? (
  <a
   href={`/api/export/show-tags?showId=${showId}`}
   target="_blank"
   className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-6 py-2 text-sm font-semibold text-amber-700 no-underline transition-all hover:bg-amber-100"
  >
   🏷️ Print My Show Tags (PDF)
  </a>
  ) : (
  <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
   🏷️ Show Tags are a <Link href="/upgrade" className="font-semibold underline">Pro feature</Link>
  </div>
  )}
 </div>
 )}

 {/* Judge Assignment Banner — always visible to assigned judges */}
 {isJudge && !isCreator && (
 <div
 className="animate-fade-in-up mb-6 rounded-xl border border-stone-200 bg-white p-6 text-center shadow-sm"
 >
 <div className="mb-2 text-[2rem]">🏅</div>
 <h3 className="mb-2">You Are an Assigned Judge</h3>
 {show.status ==="open" ? (
 <p className="text-stone-500 text-sm">
 This show is still accepting entries. Once the host transitions it to{""}
 <strong>&quot;Judging&quot;</strong> status, the judging panel will appear here for you to
 assign placings.
 </p>
 ) : show.status ==="judging" ? (
 <p className="text-stone-500 text-sm">
 The judging panel is available below. Scroll down to assign placings to each entry.
 </p>
 ) : (
 <p className="text-stone-500 text-sm">Judging is complete. Results are final.</p>
 )}
 </div>
 )}

 {/* Entry Form */}
 {isOpen && (
 <div className="animate-fade-in-up mb-8 rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
 <h2 className="mb-4 text-lg">Enter Your Horse</h2>
 <ShowEntryForm
 showId={showId}
 userHorses={horseOptions}
 classes={classOptions.length > 0 ? classOptions : undefined}
 />
 </div>
 )}

 {/* Breadcrumb */}
 <nav className="text-stone-500 animate-fade-in-up mb-6 flex flex-wrap items-center gap-2 text-sm">
 <Link href="/shows">← All Shows</Link>
 {show.status ==="closed" && (
  <>
  <span className="text-stone-300">·</span>
  <Link
   href={`/shows/${showId}/results`}
   className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 no-underline transition-colors hover:bg-amber-100"
  >
   📊 Share Public Results
  </Link>
  <a
   href={`/api/export/show-results/${showId}`}
   className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600 no-underline transition-colors hover:bg-stone-200"
  >
   📥 CSV
  </a>
  </>
 )}
 </nav>

 {/* Results + Entries — unified client component with class filter */}
 <ShowResultsView
  entries={sortedEntries.map(e => ({
  id: e.id,
  horseId: e.horseId,
  horseName: e.horseName,
  ownerAlias: e.ownerAlias,
  ownerId: e.ownerId,
  thumbnailUrl: e.thumbnailUrl,
  caption: e.caption,
  votes: e.votes,
  hasVoted: e.hasVoted,
  placing: e.placing,
  finishType: e.finishType,
  className: e.className,
  divisionName: e.divisionName,
  classId: e.classId,
  }))}
  classes={classOptions.map(c => ({ id: c.id, name: c.name, divisionName: c.divisionName }))}
  showStatus={show.status}
  isExpertJudged={isExpertJudged}
  isJudging={isJudging}
  currentUserId={user.id}
  />

 {/* Judging Banner */}
 {isJudging && (
 <div
 className="animate-fade-in-up mb-6 rounded-xl border border-stone-200 bg-white p-8 text-center shadow-sm"
 >
 <div className="text-[2rem]">🟡</div>
 <h3>Judging in Progress</h3>
 <p className="text-stone-500">
 {isExpertJudged
 ? isCreator || isJudge
 ?"Use the judging panel below to assign placings."
 :"The judges are reviewing entries. Results will be announced soon!"
 :"Voting is closed. Results will be announced soon!"}
 </p>
 </div>
 )}

 {/* Expert Judging Panel — host or assigned judge, during judging */}
 {isExpertJudged && isJudging && (isCreator || isJudge) && (
 <ExpertJudgingPanel
 showId={showId}
 classes={classOptions.map(c => ({ id: c.id, name: c.name, divisionName: c.divisionName }))}
 entries={entries.map((e) => ({
 id: e.id,
 horseName: e.horseName,
 ownerAlias: e.ownerAlias,
 thumbnailUrl: e.thumbnailUrl,
 placing: e.placing,
 classId: e.classId || null,
 }))}
 />
 )}

 {/* Close Show Button — creator/admin only, when expired */}
 {canClose && <CloseShowButton showId={showId} />}

 {/* Host Override Panel — collapsed by default, only shown to creator */}
 {isCreator && show.status ==="closed" && (
 <details className="mb-6">
 <summary className="cursor-pointer rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-500 shadow-sm transition-colors hover:bg-stone-50">
 🔧 Override Final Placings (Host Only)
 </summary>
 <div className="mt-2">
 <ExpertJudgingPanel
 showId={showId}
 overrideMode
 classes={classOptions.map(c => ({ id: c.id, name: c.name, divisionName: c.divisionName }))}
 entries={entries.map((e) => ({
 id: e.id,
 horseName: e.horseName,
 ownerAlias: e.ownerAlias,
 thumbnailUrl: e.thumbnailUrl,
 placing: e.placing,
 classId: e.classId || null,
 }))}
 />
 </div>
 </details>
 )}

 {/* Show Discussion */}
 <UniversalFeed
 initialPosts={showComments}
 context={{ eventId: showId }}
 currentUserId={user.id}
 showComposer={true}
 composerPlaceholder="Discuss this show…"
 label="Discussion"
 />
 </ExplorerLayout>
 );
}
