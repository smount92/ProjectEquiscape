import { createClient } from"@/lib/supabase/server";
import { redirect, notFound } from"next/navigation";
import { getShowEntries } from"@/app/actions/shows";
import { getEventJudges } from"@/app/actions/events";
import { getEventDivisions } from"@/app/actions/competition";
import { getPosts } from"@/app/actions/posts";
import Link from"next/link";
import VoteButton from"@/components/VoteButton";
import ShowEntryForm from"@/components/ShowEntryForm";
import WithdrawButton from"@/components/WithdrawButton";
import UniversalFeed from"@/components/UniversalFeed";
import CloseShowButton from"@/components/CloseShowButton";
import ExpertJudgingPanel from"@/components/ExpertJudgingPanel";
import ExplorerLayout from"@/components/layouts/ExplorerLayout";

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

 const horseOptions = (userHorses ?? []).map((h: { id: string; custom_name: string }) => ({
 id: h.id,
 name: h.custom_name,
 }));

 const isOpen = show.status ==="open";
 const isCreator = show.createdBy === user.id;
 const isAdmin = user.email?.toLowerCase() === process.env.ADMIN_EMAIL?.toLowerCase();
 const isExpired = show.endAt ? new Date(show.endAt) < new Date() : false;
 const canClose = (isCreator || isAdmin) && show.status !=="closed" && (isExpired || show.status ==="judging");

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
 : "text-muted"
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
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 >
 ⚙️ Manage Classes
 </Link>
 </div>
 )}

 {/* Judge Assignment Banner — always visible to assigned judges */}
 {isJudge && !isCreator && (
 <div
 className="animate-fade-in-up mb-6 rounded-lg border border-[rgba(139,92,246,0.3)] bg-gradient-to-br from-[rgba(139,92,246,0.15)] to-[rgba(245,158,11,0.1)] p-6 text-center shadow-md transition-all"
 >
 <div className="mb-2 text-[2rem]">🏅</div>
 <h3 className="mb-2">You Are an Assigned Judge</h3>
 {show.status ==="open" ? (
 <p className="text-muted text-sm">
 This show is still accepting entries. Once the host transitions it to{""}
 <strong>&quot;Judging&quot;</strong> status, the judging panel will appear here for you to
 assign placings.
 </p>
 ) : show.status ==="judging" ? (
 <p className="text-muted text-sm">
 The judging panel is available below. Scroll down to assign placings to each entry.
 </p>
 ) : (
 <p className="text-muted text-sm">Judging is complete. Results are final.</p>
 )}
 </div>
 )}

 {/* Entry Form */}
 {isOpen && (
 <div className="bg-[rgba(129,140,248,0.04)] border-[rgba(129,140,248,0.15)] animate-fade-in-up mb-8 rounded-lg border p-6">
 <h2 className="mb-4 text-lg">Enter Your Horse</h2>
 <ShowEntryForm
 showId={showId}
 userHorses={horseOptions}
 classes={classOptions.length > 0 ? classOptions : undefined}
 />
 </div>
 )}

 {/* Breadcrumb */}
 <nav className="text-muted animate-fade-in-up mb-6 flex items-center gap-2 text-sm">
 <Link href="/shows">← All Shows</Link>
 </nav>

 {/* Winner Podium for closed shows */}
 {show.status ==="closed" &&
 entries.length > 0 &&
 (() => {
 const RIBBON_MAP: Record<string, string> = {
"1st":"blue",
"2nd":"red",
"3rd":"yellow",
"4th":"white",
"5th":"pink",
"6th":"green",
 HM:"green",
 Champion:"blue",
"Reserve Champion":"red",
"Grand Champion":"blue",
"Reserve Grand Champion":"red",
 };
 const MEDAL_MAP: Record<string, string> = {
"1st":"🥇",
"2nd":"🥈",
"3rd":"🥉",
 HM:"🎗️",
 Champion:"🏆",
"Reserve Champion":"🥈",
"Grand Champion":"🏆",
"Reserve Grand Champion":"🥈",
 };
 const PLACE_ORDER: Record<string, number> = {
"Grand Champion": 0,
"Reserve Grand Champion": 1,
 Champion: 2,
"Reserve Champion": 3,
"1st": 4,
"2nd": 5,
"3rd": 6,
"4th": 7,
"5th": 8,
"6th": 9,
 HM: 10,
 };

 // Champions first
 const champions = sortedEntries.filter(
 (e) =>
 e.placing &&
 ["Champion","Reserve Champion","Grand Champion","Reserve Grand Champion"].includes(
 e.placing,
 ),
 );
 // Top placed
 const topPlaced = isExpertJudged
 ? sortedEntries
 .filter(
 (e) =>
 e.placing &&
 ![
"Champion",
"Reserve Champion",
"Grand Champion",
"Reserve Grand Champion",
 ].includes(e.placing),
 )
 .sort((a, b) => (PLACE_ORDER[a.placing!] ?? 99) - (PLACE_ORDER[b.placing!] ?? 99))
 .slice(0, 6)
 : sortedEntries.slice(0, 3);
 const podiumEntries = topPlaced.slice(0, 3);

 return (
 <div
 className="bg-card border-edge animate-fade-in-up rounded-lg border p-8 mb-6 shadow-md transition-all"
 >
 <h2 className="mb-2 text-xl text-center">
 🏆 <span className="text-forest">Results</span>
 </h2>

 {/* Champion Banners */}
 {champions.map((entry) => (
 <div key={entry.id} className="animate-fade-in-up mb-4 rounded-lg border border-amber-200/30 bg-amber-50/30 p-4 text-center">
 <div className="mb-2 text-xl font-extrabold">
 {MEDAL_MAP[entry.placing!] ||"🏆"} {entry.placing}
 </div>
 <div className="flex items-center justify-center gap-4">
 {entry.thumbnailUrl && (
 <div className="h-[60px] w-[60px] shrink-0 overflow-hidden rounded-md">
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img
 src={entry.thumbnailUrl}
 alt={entry.horseName}
 className="h-full w-full object-cover"
 />
 </div>
 )}
 <div>
 <Link
 href={`/community/${entry.horseId}`}
 className="text-base font-bold"
 >
 🐴 {entry.horseName}
 </Link>
 <div className="text-muted text-sm">
 by{""}
 <Link href={`/profile/${encodeURIComponent(entry.ownerAlias)}`}>
 @{entry.ownerAlias}
 </Link>
 </div>
 </div>
 </div>
 </div>
 ))}

 {/* Podium */}
 <div className="flex flex-wrap items-end justify-center gap-8 px-0 py-8">
 {podiumEntries.map((entry, i) => {
 const placing = isExpertJudged ? entry.placing! : ["1st","2nd","3rd"][i];
 const ribbon = RIBBON_MAP[placing] ||"blue";
 const medal = MEDAL_MAP[placing] ||"🏅";
 return (
 <div
 key={entry.id}
 className={`max-w-[220px] min-w-[160px] overflow-hidden rounded-lg text-center shadow-lg transition-transform ${i === 0 ? "scale-105" : ""}`}
 >
 <div className="h-1 w-full bg-amber-400" />
 {entry.thumbnailUrl && (
 // eslint-disable-next-line @next/next/no-img-element
 <img
 src={entry.thumbnailUrl}
 alt={entry.horseName}
 className="aspect-[4/3] w-full object-cover"
 />
 )}
 <div className="bg-elevated max-w-[220px] min-w-[160px] overflow-hidden rounded-lg p-4 text-center shadow-lg">
 <div className="mb-1 text-[2rem]">{medal}</div>
 <Link
 href={`/community/${entry.horseId}`}
 className="text-ink block text-sm font-bold no-underline hover:underline"
 >
 {entry.horseName}
 </Link>
 <div className="text-muted mt-[2px] text-xs">
 by{""}
 <Link href={`/profile/${encodeURIComponent(entry.ownerAlias)}`}>
 @{entry.ownerAlias}
 </Link>
 {!isExpertJudged &&
 ` · ${entry.votes} vote${entry.votes !== 1 ?"s" :""}`}
 </div>
 <div className="text-[var(--color-accent, #f59e0b)] mt-1 text-sm font-extrabold">
 {placing}
 </div>
 {entry.caption && (
 <div className="text-ink-light mt-1 text-xs leading-snug italic">
 &ldquo;{entry.caption}&rdquo;
 </div>
 )}
 </div>
 </div>
 );
 })}
 </div>

 {/* Remaining placed entries below podium */}
 {topPlaced.length > 3 && (
 <div className="mt-4">
 <h3 className="text-ink-light mb-2 text-sm">
 Also Placed
 </h3>
 {topPlaced.slice(3).map((entry) => {
 const placing = entry.placing!;
 const ribbon = RIBBON_MAP[placing] ||"green";
 return (
 <div
 key={entry.id}
 className="mb-1 flex items-center gap-4 px-4 py-2"
 style={{
 borderLeft: `3px solid var(--podium-${ribbon}, #22c55e)`,
 }}
 >
 {entry.thumbnailUrl && (
 <div
 className="h-[36] w-[36] shrink-0 overflow-hidden rounded-sm"
 >
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img
 src={entry.thumbnailUrl}
 alt={entry.horseName}
 className="h-full w-full object-cover"
 />
 </div>
 )}
 <div className="flex-1">
 <Link
 href={`/community/${entry.horseId}`}
 className="font-semibold"
 >
 {entry.horseName}
 </Link>
 <span className="text-muted ml-1 text-xs">
 by @{entry.ownerAlias}
 </span>
 </div>
 <span className="text-[var(--color-accent, #f59e0b)] text-sm font-bold">
 {MEDAL_MAP[placing] ||"🏅"} {placing}
 </span>
 </div>
 );
 })}
 </div>
 )}
 </div>
 );
 })()}

 {/* Judging Banner */}
 {isJudging && (
 <div
 className="bg-card border-edge animate-fade-in-up rounded-lg border shadow-md transition-all"
 style={{
 textAlign:"center",
 padding:"var(--space-lg)",
 marginBottom:"var(--space-lg)",
 background:"rgba(245, 158, 11, 0.1)",
 border:"1px solid rgba(245, 158, 11, 0.3)",
 }}
 >
 <div className="text-[2rem]">🟡</div>
 <h3>Judging in Progress</h3>
 <p className="text-muted">
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
 entries={entries.map((e) => ({
 id: e.id,
 horseName: e.horseName,
 ownerAlias: e.ownerAlias,
 thumbnailUrl: e.thumbnailUrl,
 placing: e.placing,
 classId: null,
 }))}
 />
 )}

 {/* Close Show Button — creator/admin only, when expired */}
 {canClose && <CloseShowButton showId={showId} />}

 {/* Host Override Panel — creator can adjust placings on closed shows */}
 {isCreator && show.status ==="closed" && (
 <ExpertJudgingPanel
 showId={showId}
 overrideMode
 entries={entries.map((e) => ({
 id: e.id,
 horseName: e.horseName,
 ownerAlias: e.ownerAlias,
 thumbnailUrl: e.thumbnailUrl,
 placing: e.placing,
 classId: null,
 }))}
 />
 )}

 {/* Entries Grid */}
 {entries.length === 0 ? (
 <div className="bg-card border-edge animate-fade-in-up rounded-lg border px-8 py-12 text-center shadow-md transition-all">
 <div className="mb-4 text-5xl">📸</div>
 <h2>No Entries Yet</h2>
 <p>Be the first to enter this show!</p>
 </div>
 ) : (
 <div className="border-[var(--color-border, rgba(0, 0, 0, 0.06))] animate-fade-in-up flex flex-col gap-0 overflow-hidden rounded-lg border">
 {sortedEntries.map((entry, index) => (
 <div
 key={entry.id}
 className="border-[var(--color-border, rgba(0, 0, 0, 0.06))] flex items-center gap-4 border-b px-6 py-4 transition-colors"
 >
 <div className="text-muted min-w-[32px] text-center text-lg font-bold">
 {isExpertJudged && show.status ==="closed" && entry.placing
 ? entry.placing
 : `#${index + 1}`}
 </div>
 {entry.thumbnailUrl && (
 <div className="h-[64px] w-[64px] shrink-0 overflow-hidden rounded-md">
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img src={entry.thumbnailUrl} alt={entry.horseName} loading="lazy" />
 </div>
 )}
 <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
 <Link
 href={`/community/${entry.horseId}`}
 className="hover:text-forest text-base font-semibold text-inherit no-underline"
 >
 🐴 {entry.horseName}
 </Link>
 <span className="text-forest no-underline">
 by{""}
 <Link href={`/profile/${encodeURIComponent(entry.ownerAlias)}`}>
 @{entry.ownerAlias}
 </Link>
 {" ·"}
 {entry.finishType}
 {entry.className && (
 <span className="text-forest ml-1">
 · {entry.divisionName && `${entry.divisionName} / `}
 {entry.className}
 </span>
 )}
 </span>
 {entry.caption && (
 <p
 style={{
 fontSize:"0.75rem",
 color:"var(--color-text-secondary)",
 margin:"var(--space-xs) 0 0",
 fontStyle:"italic",
 lineHeight: 1.4,
 }}
 >
 &ldquo;{entry.caption}&rdquo;
 </p>
 )}
 </div>
 <div className="gap-1" style={{ display:"flex", alignItems:"center" }}>
 {isExpertJudged ? (
 entry.placing && show.status ==="closed" ? (
 <span
 style={{
 fontSize:"0.875rem",
 padding:"var(--space-xs) var(--space-sm)",
 borderRadius:"var(--radius-sm)",
 background:"rgba(245, 158, 11, 0.15)",
 color:"var(--color-accent, #f59e0b)",
 fontWeight: 600,
 }}
 >
 {entry.placing}
 </span>
 ) : isJudging ? (
 <span className="text-muted text-xs">
 🏅 Expert judging
 </span>
 ) : null
 ) : (
 <VoteButton
 entryId={entry.id}
 initialVotes={entry.votes}
 initialHasVoted={entry.hasVoted}
 disabled={show.status !=="open"}
 />
 )}
 {entry.ownerId === user.id && show.status ==="open" && (
 <WithdrawButton entryId={entry.id} />
 )}
 </div>
 </div>
 ))}
 </div>
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
