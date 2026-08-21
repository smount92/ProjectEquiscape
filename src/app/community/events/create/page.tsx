"use client";

/**
 * /community/events/create — post something happening OUTSIDE MHH.
 *
 * The old form let anyone spin up a `live_show` / `photo_show` event
 * that could never award a point, card, or title. Those two options
 * are gone: MHH-hosted shows are created in the Show Office
 * (/shows/host), and this form says so up top rather than letting
 * people find out after the fact.
 *
 * What's left is honest: a name, when, where, and a link to wherever
 * the thing actually lives.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { createEvent } from "@/app/actions/events";
import { CREATABLE_EVENT_TYPES, EVENT_TYPE_META } from "@/components/events/eventTypes";
import FocusLayout from "@/components/layouts/FocusLayout";
import PageMasthead from "@/components/layouts/PageMasthead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function CreateEventPage() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [eventType, setEventType] = useState("external_show");
    const [startsAt, setStartsAt] = useState("");
    const [endsAt, setEndsAt] = useState("");
    const [isAllDay, setIsAllDay] = useState(false);
    const [isVirtual, setIsVirtual] = useState(false);
    const [locationName, setLocationName] = useState("");
    const [locationAddress, setLocationAddress] = useState("");
    const [region, setRegion] = useState("");
    const [linkUrl, setLinkUrl] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const selected = EVENT_TYPE_META[eventType];

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!startsAt) {
            setError("Start date/time is required.");
            return;
        }
        setSaving(true);
        setError("");

        const result = await createEvent({
            name: name.trim(),
            description: description.trim() || undefined,
            eventType,
            startsAt: new Date(startsAt).toISOString(),
            endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
            isAllDay,
            isVirtual,
            locationName: locationName.trim() || undefined,
            locationAddress: locationAddress.trim() || undefined,
            region: region.trim() || undefined,
            virtualUrl: linkUrl.trim() || undefined,
        });

        if (result.success && result.eventId) {
            router.push(`/community/events/${result.eventId}`);
        } else {
            setError(result.error || "Failed to create event");
            setSaving(false);
        }
    }

    return (
        <FocusLayout noHeader>
            <PageMasthead
                compact
                icon="📅"
                title="Post an Event"
                subtitle="Something happening out in the hobby"
                backHref="/community/events"
                backLabel="Events"
            />

            {/* The one thing this form is NOT for. */}
            <aside className="ledger-card mb-6">
                <span className="ledger-tab">Hosting a show on MHH?</span>
                <p className="m-0 text-sm leading-relaxed">
                    Shows you run <em>here</em> — with entries, judging, results, points,
                    cards and titles — are created in the Show Office, not on this form.
                    Events are listings for things happening somewhere else, and they award
                    nothing.
                </p>
                <Button asChild variant="outline" className="mt-3">
                    <Link href="/shows/host">Go to the Show Office →</Link>
                </Button>
            </aside>

            <form onSubmit={handleSubmit} className="ledger-card">
                <div className="mb-6">
                    <label
                        htmlFor="event-name"
                        className="text-foreground mb-1 block text-sm font-semibold"
                    >
                        Event Name *
                    </label>
                    <Input
                        id="event-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="MEPSA Autumn Championship"
                        required
                    />
                </div>

                <div className="mb-6">
                    <label
                        htmlFor="event-type"
                        className="text-foreground mb-1 block text-sm font-semibold"
                    >
                        Event Type *
                    </label>
                    <select
                        id="event-type"
                        className="border-input bg-card ring-offset-background focus:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none"
                        value={eventType}
                        onChange={(e) => setEventType(e.target.value)}
                    >
                        {CREATABLE_EVENT_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                                {t.icon} {t.label}
                            </option>
                        ))}
                    </select>
                    {selected && (
                        <p className="text-muted-foreground mt-1 text-xs">{selected.blurb}</p>
                    )}
                </div>

                <div className="mb-6">
                    <label
                        htmlFor="event-link"
                        className="text-foreground mb-1 block text-sm font-semibold"
                    >
                        Link
                    </label>
                    <Input
                        id="event-link"
                        type="url"
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        placeholder="https://facebook.com/events/…"
                    />
                    <p className="text-muted-foreground mt-1 text-xs">
                        Where the event actually lives — the Facebook event, the show
                        packet, the club page, the sign-up form. This becomes the big button
                        on the listing.
                    </p>
                </div>

                <div className="mb-6">
                    <label
                        htmlFor="event-description"
                        className="text-foreground mb-1 block text-sm font-semibold"
                    >
                        Description
                    </label>
                    <Textarea
                        id="event-description"
                        className="w-full resize-y"
                        rows={4}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="What's happening, who's running it, what people need to know (entry fees, deadlines, what to bring)…"
                    />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="mb-6">
                        <label
                            htmlFor="event-start"
                            className="text-foreground mb-1 block text-sm font-semibold"
                        >
                            Start *
                        </label>
                        <Input
                            id="event-start"
                            type="datetime-local"
                            value={startsAt}
                            onChange={(e) => setStartsAt(e.target.value)}
                            required
                        />
                    </div>
                    <div className="mb-6">
                        <label
                            htmlFor="event-end"
                            className="text-foreground mb-1 block text-sm font-semibold"
                        >
                            End
                        </label>
                        <Input
                            id="event-end"
                            type="datetime-local"
                            value={endsAt}
                            onChange={(e) => setEndsAt(e.target.value)}
                        />
                    </div>
                </div>

                <div className="my-3 flex flex-wrap gap-6">
                    <label className="flex cursor-pointer items-center gap-2">
                        <input
                            type="checkbox"
                            checked={isAllDay}
                            onChange={(e) => setIsAllDay(e.target.checked)}
                        />
                        All day
                    </label>
                    <label className="flex cursor-pointer items-center gap-2">
                        <input
                            type="checkbox"
                            checked={isVirtual}
                            onChange={(e) => setIsVirtual(e.target.checked)}
                        />
                        Online only (no physical venue)
                    </label>
                </div>

                {!isVirtual && (
                    <>
                        <div className="mb-6">
                            <label
                                htmlFor="event-venue"
                                className="text-foreground mb-1 block text-sm font-semibold"
                            >
                                Venue
                            </label>
                            <Input
                                id="event-venue"
                                value={locationName}
                                onChange={(e) => setLocationName(e.target.value)}
                                placeholder="Kentucky Horse Park"
                            />
                        </div>
                        <div className="mb-6">
                            <label
                                htmlFor="event-address"
                                className="text-foreground mb-1 block text-sm font-semibold"
                            >
                                Address
                            </label>
                            <Input
                                id="event-address"
                                value={locationAddress}
                                onChange={(e) => setLocationAddress(e.target.value)}
                                placeholder="123 Main St, City, State"
                            />
                        </div>
                    </>
                )}

                <div className="mb-6">
                    <label
                        htmlFor="event-region"
                        className="text-foreground mb-1 block text-sm font-semibold"
                    >
                        Region
                    </label>
                    <Input
                        id="event-region"
                        value={region}
                        onChange={(e) => setRegion(e.target.value)}
                        placeholder="e.g. Pacific Northwest, Northeast, UK"
                    />
                    <p className="text-muted-foreground mt-1 text-xs">
                        Helps people find things near them — useful even for online events.
                    </p>
                </div>

                {error && (
                    <p
                        role="alert"
                        className="text-destructive border-destructive/30 bg-destructive/10 mt-2 flex items-center gap-2 rounded-md border px-4 py-2 text-sm"
                    >
                        {error}
                    </p>
                )}

                <div className="mt-6 flex gap-2">
                    <Button type="submit" disabled={saving || !name.trim()}>
                        {saving ? "Posting…" : "Post Event"}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="wide"
                        onClick={() => router.push("/community/events")}
                    >
                        Cancel
                    </Button>
                </div>
            </form>
        </FocusLayout>
    );
}
