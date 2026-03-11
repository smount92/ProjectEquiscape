import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getEvent, getEventAttendees } from "@/app/actions/events";
import { getPosts, getEventMedia } from "@/app/actions/posts";
import EventRsvpButton from "@/components/EventRsvpButton";
import EventDeleteButton from "@/components/EventDeleteButton";
import EventPhotoGallery from "@/components/EventPhotoGallery";
import UniversalFeed from "@/components/UniversalFeed";

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

    // Parallel data fetches
    const [attendees, comments, photos] = await Promise.all([
        getEventAttendees(id),
        getPosts({ eventId: id }, { includeReplies: true }),
        getEventMedia(id),
    ]);

    const date = new Date(event.startsAt);
    const endDate = event.endsAt ? new Date(event.endsAt) : null;

    return (
        <div className="page-container">
            <div className="page-content" style={{ maxWidth: 720 }}>
                <Link href="/community/events" className="btn btn-ghost" style={{ marginBottom: "var(--space-md)" }}>← All Events</Link>

                <div className="event-detail-header">
                    <div className="event-detail-date-badge">
                        <span className="event-date-month">{date.toLocaleDateString("en-US", { month: "short" }).toUpperCase()}</span>
                        <span className="event-date-day">{date.getDate()}</span>
                    </div>
                    <div>
                        <h1>{event.name}</h1>
                        <div style={{ display: "flex", gap: "var(--space-md)", flexWrap: "wrap", marginTop: "var(--space-sm)", color: "var(--color-text-muted)" }}>
                            <span>{EVENT_TYPE_LABELS[event.eventType] || event.eventType}</span>
                            <span>👥 {event.rsvpCount} attending</span>
                            {event.isOfficial && <span style={{ color: "#f59e0b" }}>⭐ Official</span>}
                        </div>
                    </div>
                </div>

                {/* RSVP */}
                <div style={{ margin: "var(--space-lg) 0" }}>
                    <EventRsvpButton eventId={event.id} currentStatus={event.userRsvp} />
                </div>

                {/* Details */}
                <div className="studio-info-grid" style={{ marginBottom: "var(--space-lg)" }}>
                    <div className="studio-info-item">
                        <span className="studio-info-label">📅 Date</span>
                        <span className="studio-info-value">
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
                        <div className="studio-info-item">
                            <span className="studio-info-label">📍 Location</span>
                            <span className="studio-info-value">{event.locationName}{event.locationAddress && <><br />{event.locationAddress}</>}</span>
                        </div>
                    )}
                    {event.isVirtual && event.virtualUrl && (
                        <div className="studio-info-item">
                            <span className="studio-info-label">🌐 Virtual Link</span>
                            <a href={event.virtualUrl} target="_blank" rel="noopener noreferrer" className="studio-info-value" style={{ color: "var(--color-accent-primary)" }}>
                                Join Online →
                            </a>
                        </div>
                    )}
                    {event.region && (
                        <div className="studio-info-item">
                            <span className="studio-info-label">🗺️ Region</span>
                            <span className="studio-info-value">{event.region}</span>
                        </div>
                    )}
                    {event.groupName && (
                        <div className="studio-info-item">
                            <span className="studio-info-label">🏛️ Hosted by</span>
                            <span className="studio-info-value">{event.groupName}</span>
                        </div>
                    )}
                    <div className="studio-info-item">
                        <span className="studio-info-label">Created by</span>
                        <span className="studio-info-value">@{event.creatorAlias}</span>
                    </div>
                </div>

                {/* Description */}
                {event.description && (
                    <div className="glass-card" style={{ padding: "var(--space-lg)" }}>
                        <h3 style={{ marginBottom: "var(--space-sm)" }}>About</h3>
                        <p style={{ lineHeight: 1.7, whiteSpace: "pre-line" }}>{event.description}</p>
                    </div>
                )}

                {/* Creator Actions */}
                {user.id === event.createdBy && (
                    <div style={{ marginTop: "var(--space-lg)", textAlign: "right" }}>
                        <EventDeleteButton eventId={event.id} />
                    </div>
                )}

                {/* Attendees */}
                {attendees.length > 0 && (
                    <div className="glass-card" style={{ padding: "var(--space-lg)", marginTop: "var(--space-lg)" }}>
                        <h3 style={{ marginBottom: "var(--space-sm)" }}>👥 Who&apos;s Going ({attendees.filter(a => a.status === "going").length})</h3>
                        <div className="event-attendee-grid">
                            {attendees.filter(a => a.status === "going").map(a => (
                                <Link key={a.userId} href={`/profile/${encodeURIComponent(a.alias)}`} className="event-attendee-chip">
                                    @{a.alias}
                                </Link>
                            ))}
                        </div>
                        {attendees.filter(a => a.status === "interested").length > 0 && (
                            <>
                                <h4 style={{ marginTop: "var(--space-md)", color: "var(--color-text-muted)" }}>⭐ Interested ({attendees.filter(a => a.status === "interested").length})</h4>
                                <div className="event-attendee-grid">
                                    {attendees.filter(a => a.status === "interested").map(a => (
                                        <Link key={a.userId} href={`/profile/${encodeURIComponent(a.alias)}`} className="event-attendee-chip">
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
