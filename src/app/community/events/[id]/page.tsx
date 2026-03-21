import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getEvent, getEventAttendees } from "@/app/actions/events";
import { getEventDivisions } from "@/app/actions/competition";
import { getPosts, getEventMedia } from "@/app/actions/posts";
import { getShowEntries } from "@/app/actions/shows";
import EventRsvpButton from "@/components/EventRsvpButton";
import EventDeleteButton from "@/components/EventDeleteButton";
import EventPhotoGallery from "@/components/EventPhotoGallery";
import UniversalFeed from "@/components/UniversalFeed";
import AssignPlacings from "@/components/AssignPlacings";
import ShowEntryForm from "@/components/ShowEntryForm";
import VoteButton from "@/components/VoteButton";
import WithdrawButton from "@/components/WithdrawButton";

import { EVENT_TYPE_LABELS } from "@/lib/constants/events";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const event = await getEvent(id);
    return {
        title: event ? `${event.name} — Model Horse Hub` : "Event Not Found",
        description: event?.description || "Model Horse Hub event",
    };
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const event = await getEvent(id);
    if (!event) notFound();

    // Is this a show-type event? (live_show or photo_show)
    const isShowEvent = event.eventType === "live_show" || event.eventType === "photo_show";
    const isExpertJudged = event.judgingMethod === "expert_judge";
    const isHost = user.id === event.createdBy;

    // Parallel data fetches
    const [attendees, comments, photos, divisions, showData] = await Promise.all([
        getEventAttendees(id),
        getPosts({ eventId: id }, { includeReplies: true }),
        getEventMedia(id),
        getEventDivisions(id),
        isShowEvent ? getShowEntries(id) : Promise.resolve({ show: null, entries: [] }),
    ]);

    const showEntries = [...showData.entries].sort((a, b) => {
        const divA = a.divisionName || "zzz";
        const divB = b.divisionName || "zzz";
        if (divA !== divB) return divA.localeCompare(divB);
        const clsA = a.className || "zzz";
        const clsB = b.className || "zzz";
        if (clsA !== clsB) return clsA.localeCompare(clsB);
        return 0;
    });
    const showStatus = showData.show?.status || "open";
    const isShowOpen = showStatus === "open";

    // Fetch user's public horses for show entry form
    let horseOptions: { id: string; name: string }[] = [];
    if (isShowEvent && isShowOpen) {
        const { data: userHorses } = await supabase
            .from("user_horses")
            .select("id, custom_name")
            .eq("owner_id", user.id)
            .eq("is_public", true);
        horseOptions = (userHorses ?? []).map((h: { id: string; custom_name: string }) => ({
            id: h.id, name: h.custom_name,
        }));
    }

    // Build class options for the entry form (from divisions)
    const classOptions = divisions.flatMap(d =>
        d.classes.map(c => ({ id: c.id, name: c.name, divisionName: d.name }))
    );

    // Expert entries for assign placings panel
    const expertEntries = (isExpertJudged && isHost)
        ? showEntries.map(e => ({ id: e.id, horseName: e.horseName, ownerAlias: e.ownerAlias }))
        : [];

    const date = new Date(event.startsAt);
    const endDate = event.endsAt ? new Date(event.endsAt) : null;

    return (
        <div className="max-w-[var(--max-width)] mx-auto py-[0] px-6">
            <div className="page-content max-w-[720]">
                <Link href="/community/events" className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge mb-4">← All Events</Link>

                <div className="flex gap-6 items-start mb-6">
                    <div className="flex flex-col items-center justify-center min-w-[56px] h-[56px] rounded-md bg-[linear-gradient(135deg,rgba(44,85,69,0.15),rgba(139,92,246,0.1))] border border-[rgba(44,85,69,0.3)] shrink-0">
                        <span className="text-[calc(0.6rem*var(--font-scale))] font-bold text-[#2C5545] uppercase tracking-wider">{date.toLocaleDateString("en-US", { month: "short" }).toUpperCase()}</span>
                        <span className="text-[calc(1.2rem*var(--font-scale))] font-extrabold text-ink leading-none">{date.getDate()}</span>
                    </div>
                    <div>
                        <h1>{event.name}</h1>
                        <div className="gap-4 mt-2 text-muted" style={{ display: "flex", flexWrap: "wrap" }}>
                            <span>{EVENT_TYPE_LABELS[event.eventType] || event.eventType}</span>
                            <span>👥 {event.rsvpCount} attending</span>
                            {event.isOfficial && <span className="text-[#f59e0b]" >⭐ Official</span>}
                            {event.judgingMethod === "expert_judge" && <span className="text-[#8b5cf6]" >🏅 Expert Judged</span>}
                        </div>
                    </div>
                </div>

                {/* RSVP */}
                <div className="m-[var(--space-lg) 0]" >
                    <EventRsvpButton eventId={event.id} currentStatus={event.userRsvp} />
                </div>

                {/* Details */}
                <div className="grid gap-2 mb-6">
                    <div className="flex justify-between items-center py-1">
                        <span className="text-[calc(0.8rem*var(--font-scale))] text-muted">📅 Date</span>
                        <span className="font-bold text-[calc(0.9rem*var(--font-scale))]">
                            {event.isAllDay ? "All Day" : date.toLocaleString("en-US", {
                                weekday: "short", month: "short", day: "numeric",
                                hour: "numeric", minute: "2-digit",
                            })}
                            {endDate && (
                                <> — {endDate.toLocaleString("en-US", {
                                    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                                })}</>
                            )}
                        </span>
                    </div>
                    {!event.isVirtual && event.locationName && (
                        <div className="flex justify-between items-center py-1">
                            <span className="text-[calc(0.8rem*var(--font-scale))] text-muted">📍 Location</span>
                            <span className="font-bold text-[calc(0.9rem*var(--font-scale))]">{event.locationName}{event.locationAddress && <><br />{event.locationAddress}</>}</span>
                        </div>
                    )}
                    {event.isVirtual && event.virtualUrl && (
                        <div className="flex justify-between items-center py-1">
                            <span className="text-[calc(0.8rem*var(--font-scale))] text-muted">🌐 Virtual Link</span>
                            <a href={event.virtualUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-[calc(0.9rem*var(--font-scale))] text-forest">
                                Join Online →
                            </a>
                        </div>
                    )}
                    {event.region && (
                        <div className="flex justify-between items-center py-1">
                            <span className="text-[calc(0.8rem*var(--font-scale))] text-muted">🗺️ Region</span>
                            <span className="font-bold text-[calc(0.9rem*var(--font-scale))]">{event.region}</span>
                        </div>
                    )}
                    {event.groupName && (
                        <div className="flex justify-between items-center py-1">
                            <span className="text-[calc(0.8rem*var(--font-scale))] text-muted">🏛️ Hosted by</span>
                            <span className="font-bold text-[calc(0.9rem*var(--font-scale))]">{event.groupName}</span>
                        </div>
                    )}
                    <div className="flex justify-between items-center py-1">
                        <span className="text-[calc(0.8rem*var(--font-scale))] text-muted">Created by</span>
                        <span className="font-bold text-[calc(0.9rem*var(--font-scale))]">@{event.creatorAlias}</span>
                    </div>
                </div>

                {/* Description */}
                {event.description && (
                    <div className="glass-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all p-6">
                        <h3 className="mb-2" >About</h3>
                        <p className="leading-[1.7]" style={{ whiteSpace: "pre-line" }}>{event.description}</p>
                    </div>
                )}

                {/* Creator Actions */}
                {user.id === event.createdBy && (
                    <div className="mt-6 gap-2 justify-end" style={{ display: "flex", flexWrap: "wrap" }}>
                        <Link href={`/community/events/${event.id}/manage`} className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge">
                            ⚙️ Manage Classes
                        </Link>
                        <EventDeleteButton eventId={event.id} />
                    </div>
                )}

                {/* Division / Class Tree */}
                {divisions.length > 0 && (
                    <div className="glass-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all p-6 mt-6">
                        <h3 className="mb-4" >📋 Class List ({divisions.reduce((s, d) => s + d.classes.length, 0)} classes)</h3>
                        {divisions.map((div) => (
                            <div key={div.id} className="mb-4" >
                                <div className="font-bold mb-1 text-ink" >
                                    {div.name}
                                </div>
                                <div className="pl-6" >
                                    {div.classes.map((cls) => (
                                        <div key={cls.id} className="gap-2 p-[var(--space-xs) 0] text-sm text-ink-light" style={{ display: "flex", alignItems: "center" }}>
                                            <span className="text-muted min-w-[40px]" >{cls.classNumber || "—"}</span>
                                            <span>{cls.name}</span>
                                            {cls.isNanQualifying && <span title="NAN Qualifying" className="text-[#f59e0b]" >⭐</span>}
                                            {(cls.entryCount || 0) > 0 && (
                                                <span className="text-xs text-muted" >({cls.entryCount})</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ══════════════════════════════════════ */}
                {/* Show Entry Section (live_show / photo_show) */}
                {/* ══════════════════════════════════════ */}
                {isShowEvent && isShowOpen && (
                    <div className="glass-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all p-6 mt-6">
                        <h3 className="mb-2" >🐴 Enter Your Horse</h3>
                        <p className="text-muted text-sm mb-4" >
                            Select a public horse to enter. Your horse&apos;s passport photo will be used as the entry thumbnail.
                            {classOptions.length > 0 && " Choose which class to enter."}
                        </p>
                        <ShowEntryForm showId={event.id} userHorses={horseOptions} classes={classOptions.length > 0 ? classOptions : undefined} />
                    </div>
                )}

                {/* Show Entries Grid */}
                {isShowEvent && showEntries.length > 0 && (
                    <div className="glass-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all p-6 mt-6">
                        <h3 className="mb-4" >📸 Entries ({showEntries.length})</h3>
                        <div className="flex flex-col gap-[0] border border-[var(--color-border, rgba(0, 0, 0, 0.06))] rounded-lg overflow-hidden">
                            {showEntries.map((entry, index) => (
                                <div key={entry.id} className="flex items-center gap-4 py-4 px-6 border-b border-[var(--color-border, rgba(0, 0, 0, 0.06))] transition-colors">
                                    <div className="text-[calc(1.1rem*var(--font-scale))] font-bold text-muted min-w-[32px] text-center">
                                        {isExpertJudged && showStatus === "closed" && entry.placing
                                            ? entry.placing
                                            : `#${index + 1}`
                                        }
                                    </div>
                                    {entry.thumbnailUrl && (
                                        <div className="w-[64px] h-[64px] rounded-md overflow-hidden shrink-0">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={entry.thumbnailUrl} alt={entry.horseName} loading="lazy" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0 flex flex-col gap-[2px]">
                                        <Link href={`/community/${entry.horseId}`} className="font-semibold text-[calc(0.95rem*var(--font-scale))] no-underline text-inherit hover:text-forest">
                                            🐴 {entry.horseName}
                                        </Link>
                                        <span className="text-forest no-underline">
                                            by{" "}
                                            <Link href={`/profile/${encodeURIComponent(entry.ownerAlias)}`}>
                                                @{entry.ownerAlias}
                                            </Link>
                                            {" · "}{entry.finishType}
                                            {entry.className && (
                                                <span className="ml-1 text-forest" >
                                                    · {entry.divisionName && `${entry.divisionName} / `}{entry.className}
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                    <div className="gap-1" style={{ display: "flex", alignItems: "center" }}>
                                        {isExpertJudged ? (
                                            entry.placing && showStatus === "closed" ? (
                                                <span style={{
                                                    fontSize: "calc(var(--font-size-sm) * var(--font-scale))",
                                                    padding: "var(--space-xs) var(--space-sm)",
                                                    borderRadius: "var(--radius-sm)",
                                                    background: "rgba(245, 158, 11, 0.15)",
                                                    color: "var(--color-accent, #f59e0b)",
                                                    fontWeight: 600,
                                                }}>
                                                    {entry.placing}
                                                </span>
                                            ) : null
                                        ) : (
                                            <VoteButton
                                                entryId={entry.id}
                                                initialVotes={entry.votes}
                                                initialHasVoted={entry.hasVoted}
                                                disabled={showStatus !== "open"}
                                            />
                                        )}
                                        {entry.ownerId === user.id && showStatus === "open" && (
                                            <WithdrawButton entryId={entry.id} />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {isShowEvent && showEntries.length === 0 && !isShowOpen && (
                    <div className="glass-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all p-6 mt-6" style={{ textAlign: "center" }}>
                        <p className="text-muted" >No entries were submitted for this show.</p>
                    </div>
                )}

                {/* Expert Judge — Assign Placings */}
                {isExpertJudged && isHost && expertEntries.length > 0 && (
                    <AssignPlacings eventId={event.id} entries={expertEntries} />
                )}

                {/* Attendees */}
                {attendees.length > 0 && (
                    <div className="glass-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all p-6 mt-6">
                        <h3 className="mb-2" >👥 Who&apos;s Going ({attendees.filter(a => a.status === "going").length})</h3>
                        <div className="flex flex-wrap gap-1">
                            {attendees.filter(a => a.status === "going").map(a => (
                                <Link key={a.userId} href={`/profile/${encodeURIComponent(a.alias)}`} className="py-1 px-2.5 rounded-full bg-[var(--color-surface-hover)] text-ink text-[calc(0.8rem*var(--font-scale))] no-underline transition-colors hover:bg-[var(--color-accent)] hover:text-white">
                                    @{a.alias}
                                </Link>
                            ))}
                        </div>
                        {attendees.filter(a => a.status === "interested").length > 0 && (
                            <>
                                <h4 className="mt-4 text-muted" >⭐ Interested ({attendees.filter(a => a.status === "interested").length})</h4>
                                <div className="flex flex-wrap gap-1">
                                    {attendees.filter(a => a.status === "interested").map(a => (
                                        <Link key={a.userId} href={`/profile/${encodeURIComponent(a.alias)}`} className="py-1 px-2.5 rounded-full bg-[var(--color-surface-hover)] text-ink text-[calc(0.8rem*var(--font-scale))] no-underline transition-colors hover:bg-[var(--color-accent)] hover:text-white">
                                            @{a.alias}
                                        </Link>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Photo Gallery */}
                <EventPhotoGallery eventId={event.id} currentUserId={user.id} initialPhotos={photos} />

                {/* Comments — now via UniversalFeed */}
                <UniversalFeed
                    initialPosts={comments}
                    context={{ eventId: event.id }}
                    currentUserId={user.id}
                    showComposer={true}
                    composerPlaceholder="Add a comment on this event…"
                    label="Comments"
                />
            </div>
        </div>
    );
}
