import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getEvent, getEventAttendees } from "@/app/actions/events";
import { getPosts, getEventMedia } from "@/app/actions/posts";
import { createClient } from "@/lib/supabase/server";
import EventAttendeeStrip from "@/components/events/EventAttendeeStrip";
import EventLinkOut, { safeExternalUrl } from "@/components/events/EventLinkOut";
import EventRsvpBar from "@/components/events/EventRsvpBar";
import { eventTypeIcon, eventTypeLabel, isLegacyShowEvent } from "@/components/events/eventTypes";
import EventDeleteButton from "@/components/EventDeleteButton";
import EventPhotoGallery from "@/components/EventPhotoGallery";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import PageMasthead from "@/components/layouts/PageMasthead";
import UniversalFeed from "@/components/UniversalFeed";
import { Button } from "@/components/ui/button";

/**
 * /community/events/[id] — the event page.
 *
 * A Facebook-shaped page for an outside-MHH happening: masthead, when
 * and where, the big link out to wherever it actually lives, RSVP, a
 * face strip of who's coming, photos, and a discussion thread.
 *
 * No show machinery lives here any more. Legacy `live_show` /
 * `photo_show` rows still render — they just get a banner pointing at
 * /shows/[id], which is where the legacy entries, classlist, voting
 * and placings have always been served from (LegacyShowPage).
 */

function formatWhen(event: {
    startsAt: string;
    endsAt: string | null;
    isAllDay: boolean;
}): string {
    const start = new Date(event.startsAt);
    if (Number.isNaN(start.getTime())) return "Date TBD";

    const day = start.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
    });
    if (event.isAllDay) return `${day} · All day`;

    const time = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const end = event.endsAt ? new Date(event.endsAt) : null;
    if (!end || Number.isNaN(end.getTime())) return `${day} · ${time}`;

    const sameDay = start.toDateString() === end.toDateString();
    const endText = sameDay
        ? end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
        : end.toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
          });
    return `${day} · ${time} – ${endText}`;
}

/**
 * Has it already happened? An event with no end is over once its start
 * has passed. Server-rendered, so "now" is request time.
 */
function hasFinished(startsAt: string, endsAt: string | null): boolean {
    const end = new Date(endsAt ?? startsAt);
    if (Number.isNaN(end.getTime())) return false;
    return end.getTime() < Date.now();
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const event = await getEvent(id);
    return {
        title: event ? event.name : "Event Not Found",
        description: event?.description || "A model horse happening, listed on Model Horse Hub",
    };
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const event = await getEvent(id);
    if (!event) notFound();

    const [attendees, posts, photos] = await Promise.all([
        getEventAttendees(id),
        getPosts({ eventId: id }, { includeReplies: true }),
        getEventMedia(id),
    ]);

    const isHost = user.id === event.createdBy;
    const legacyShow = isLegacyShowEvent(event.eventType);
    const linkUrl = safeExternalUrl(event.virtualUrl);
    const start = new Date(event.startsAt);
    const isPast = hasFinished(event.startsAt, event.endsAt);

    const goingCount = attendees.filter((a) => a.status === "going").length;
    const interestedCount = attendees.filter((a) => a.status === "interested").length;

    const monthLabel = Number.isNaN(start.getTime())
        ? "—"
        : start.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
    const dayLabel = Number.isNaN(start.getTime()) ? "?" : String(start.getDate());

    const where = event.isVirtual
        ? "Online"
        : event.locationName || event.region || "Location to be announced";

    return (
        // frameless: every section below is its own ledger card, so the
        // archetype's ledger sheet underneath was framing a frame.
        <ExplorerLayout noHeader frameless>
            <div className="animate-fade-in-up mx-auto max-w-[860px]">
                <PageMasthead
                    icon={eventTypeIcon(event.eventType)}
                    title={event.name}
                    subtitle={
                        <>
                            {eventTypeLabel(event.eventType)}
                            {isPast ? " · Already happened" : ""}
                        </>
                    }
                    backHref="/community/events"
                    backLabel="Events"
                />

                {/* ── The masthead card: when, where, who, and the way out ── */}
                <section className="ledger-card mb-6">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="ledger-tab">When &amp; where</span>
                        <span className="stamp mb-3">
                            {eventTypeIcon(event.eventType)} {eventTypeLabel(event.eventType)}
                        </span>
                    </div>
                    <div className="flex flex-wrap items-start gap-5">
                        <div
                            className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-md border-2 border-forest/40 bg-forest/5"
                            aria-hidden="true"
                        >
                            <span className="font-serif text-[0.7rem] font-bold tracking-[0.14em] text-forest uppercase">
                                {monthLabel}
                            </span>
                            <span className="font-serif text-2xl leading-none font-bold tabular-nums text-foreground">
                                {dayLabel}
                            </span>
                        </div>

                        <div className="min-w-0 flex-1">
                            <p className="m-0 font-serif text-[1.05rem] font-bold">
                                {formatWhen(event)}
                            </p>
                            <p className="text-secondary-foreground m-0 mt-1 text-sm">
                                {where}
                                {event.locationAddress && !event.isVirtual && (
                                    <span className="text-muted-foreground">
                                        {" "}
                                        — {event.locationAddress}
                                    </span>
                                )}
                            </p>
                            <p className="m-0 mt-1 text-xs text-muted-foreground">
                                Listed by{" "}
                                <Link
                                    href={`/profile/${encodeURIComponent(event.creatorAlias)}`}
                                    className="font-semibold text-forest"
                                >
                                    @{event.creatorAlias}
                                </Link>
                                {event.groupName && <> · {event.groupName}</>}
                                {event.region && !event.isVirtual && <> · {event.region}</>}
                            </p>
                        </div>
                    </div>

                    {linkUrl && (
                        <div className="mt-5">
                            <EventLinkOut
                                url={linkUrl}
                                label={event.isVirtual ? "Join online" : "Event page"}
                            />
                            <p className="m-0 mt-2 text-xs text-muted-foreground">
                                This event happens off Model Horse Hub — entering, paying and
                                results all live at that link.
                            </p>
                        </div>
                    )}

                    <div className="mt-5 border-t border-forest/15 pt-4">
                        <EventRsvpBar
                            eventId={event.id}
                            currentStatus={event.userRsvp}
                            goingCount={goingCount}
                            interestedCount={interestedCount}
                            closed={isPast}
                        />
                    </div>
                </section>

                {/* ── Legacy show rows: send people where the show lives ── */}
                {legacyShow && (
                    <aside className="ledger-card mb-6">
                        <span className="ledger-tab">Legacy show</span>
                        <p className="m-0 text-sm leading-relaxed">
                            This listing was created back when events doubled as shows. Its
                            entries, classlist and results still live on the show page.
                            New shows are opened in the Show Office.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <Button asChild variant="outline">
                                <Link href={`/shows/${event.id}`}>View the show →</Link>
                            </Button>
                            <Button asChild variant="ghost">
                                <Link href="/shows/host">Show Office</Link>
                            </Button>
                        </div>
                    </aside>
                )}

                {/* ── About ── */}
                {event.description && (
                    <section className="ledger-card mb-6">
                        <span className="ledger-tab">About</span>
                        <p className="m-0 leading-[1.7] whitespace-pre-line">
                            {event.description}
                        </p>
                    </section>
                )}

                {/* ── Who's coming ── */}
                <section className="ledger-card mb-6">
                    <span className="ledger-tab">Who&rsquo;s coming</span>
                    <EventAttendeeStrip attendees={attendees} />
                </section>

                {/* ── Host controls ── */}
                {isHost && (
                    <div className="mb-6 flex flex-wrap justify-end gap-2">
                        <Button asChild variant="outline" size="wide">
                            <Link href={`/community/events/${event.id}/manage`}>
                                ⚙️ Edit event
                            </Link>
                        </Button>
                        <EventDeleteButton eventId={event.id} />
                    </div>
                )}

                {/* ── Photos ── */}
                <EventPhotoGallery
                    eventId={event.id}
                    currentUserId={user.id}
                    initialPhotos={photos}
                />

                {/* ── Discussion ── */}
                <UniversalFeed
                    initialPosts={posts}
                    context={{ eventId: event.id }}
                    currentUserId={user.id}
                    showComposer={true}
                    composerPlaceholder={
                        isPast ? "How was it?" : "Ask a question, or say you're bringing someone…"
                    }
                    label="Discussion"
                />
            </div>
        </ExplorerLayout>
    );
}
