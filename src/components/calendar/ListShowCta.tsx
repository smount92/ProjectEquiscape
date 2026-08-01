"use client";

/**
 * "List a show" — the calendar's submission affordance.
 * Signed-in members get the zod-validated submission dialog;
 * anonymous visitors get routed to login with a redirect back to
 * the calendar. Submissions always land as pending (curated queue);
 * the success state says exactly that.
 */

import { useState } from "react";
import Link from "next/link";

import { submitExternalShow } from "@/app/actions/external-shows";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

const VENUE_OPTIONS = [
    { value: "online_photo", label: "Online photo show" },
    { value: "live", label: "Live show" },
    { value: "mail_in", label: "Mail-in show" },
] as const;

const PLATFORM_OPTIONS = [
    { value: "facebook", label: "Facebook group" },
    { value: "omhps", label: "OMHPS" },
    { value: "mepsa", label: "MEPSA" },
    { value: "website", label: "Club / show website" },
    { value: "other", label: "Somewhere else" },
] as const;

export default function ListShowCta({ isAuthed }: { isAuthed: boolean }) {
    const [open, setOpen] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const [title, setTitle] = useState("");
    const [url, setUrl] = useState("");
    const [venueType, setVenueType] = useState<string>("online_photo");
    const [platform, setPlatform] = useState<string>("facebook");
    const [hostName, setHostName] = useState("");
    const [startsOn, setStartsOn] = useState("");
    const [entriesCloseOn, setEntriesCloseOn] = useState("");
    const [location, setLocation] = useState("");
    const [description, setDescription] = useState("");

    if (!isAuthed) {
        return (
            <Button asChild variant="outline">
                <Link href={`/login?redirectTo=${encodeURIComponent("/calendar")}`}>
                    List a show
                </Link>
            </Button>
        );
    }

    const todayIso = new Date().toISOString().slice(0, 10);

    const handleOpenChange = (next: boolean) => {
        setOpen(next);
        if (!next) {
            setError("");
            setSubmitted(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError("");
        const result = await submitExternalShow({
            title,
            url,
            venueType: venueType as "online_photo" | "live" | "mail_in",
            platform: platform as "facebook" | "omhps" | "mepsa" | "website" | "other",
            hostName,
            startsOn,
            entriesCloseOn: entriesCloseOn || undefined,
            location: location || undefined,
            description: description || undefined,
        });
        setSaving(false);
        if (result.success) {
            setSubmitted(true);
            setTitle("");
            setUrl("");
            setHostName("");
            setStartsOn("");
            setEntriesCloseOn("");
            setLocation("");
            setDescription("");
        } else {
            setError(result.error || "Something went wrong — please try again.");
        }
    };

    return (
        <>
            <Button onClick={() => setOpen(true)}>List a show</Button>
            <Dialog open={open} onOpenChange={handleOpenChange}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle>🗓️ List a show on the calendar</DialogTitle>
                        <DialogDescription>
                            Know an upcoming show — a Facebook photo show, an OMHPS or MEPSA
                            round, a live hall? Add it so the whole hobby can find it.
                        </DialogDescription>
                    </DialogHeader>

                    {submitted ? (
                        <div className="py-4 text-center">
                            <div className="mb-3 text-4xl" aria-hidden="true">
                                ✅
                            </div>
                            <p className="mb-1 font-semibold text-foreground">
                                Submitted for review
                            </p>
                            <p className="mb-4 text-sm text-secondary-foreground">
                                We curate every listing to keep the calendar trustworthy —
                                it will appear once a curator approves it.
                            </p>
                            <div className="flex justify-center gap-2">
                                <Button variant="outline" onClick={() => setSubmitted(false)}>
                                    List another
                                </Button>
                                <Button onClick={() => handleOpenChange(false)}>Done</Button>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            <div>
                                <label htmlFor="ext-title" className="mb-1 block text-sm font-semibold text-foreground">
                                    Show name
                                </label>
                                <Input
                                    id="ext-title"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Spring Fling Photo Show"
                                    minLength={3}
                                    maxLength={120}
                                    required
                                />
                            </div>

                            <div>
                                <label htmlFor="ext-url" className="mb-1 block text-sm font-semibold text-foreground">
                                    Link to the show
                                </label>
                                <Input
                                    id="ext-url"
                                    type="url"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    placeholder="https://…"
                                    maxLength={2000}
                                    required
                                />
                                <span className="mt-1 block text-xs text-muted-foreground">
                                    The event page, group post, or entry form. http(s) links only.
                                </span>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label htmlFor="ext-venue" className="mb-1 block text-sm font-semibold text-foreground">
                                        Show type
                                    </label>
                                    <Select value={venueType} onValueChange={setVenueType}>
                                        <SelectTrigger id="ext-venue">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {VENUE_OPTIONS.map((o) => (
                                                <SelectItem key={o.value} value={o.value}>
                                                    {o.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <label htmlFor="ext-platform" className="mb-1 block text-sm font-semibold text-foreground">
                                        Where it lives
                                    </label>
                                    <Select value={platform} onValueChange={setPlatform}>
                                        <SelectTrigger id="ext-platform">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {PLATFORM_OPTIONS.map((o) => (
                                                <SelectItem key={o.value} value={o.value}>
                                                    {o.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div>
                                <label htmlFor="ext-host" className="mb-1 block text-sm font-semibold text-foreground">
                                    Host / organiser
                                </label>
                                <Input
                                    id="ext-host"
                                    value={hostName}
                                    onChange={(e) => setHostName(e.target.value)}
                                    placeholder="Who runs it — a person, group, or club"
                                    minLength={2}
                                    maxLength={80}
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label htmlFor="ext-starts" className="mb-1 block text-sm font-semibold text-foreground">
                                        Show date
                                    </label>
                                    <Input
                                        id="ext-starts"
                                        type="date"
                                        value={startsOn}
                                        min={todayIso}
                                        onChange={(e) => setStartsOn(e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <label htmlFor="ext-closes" className="mb-1 block text-sm font-semibold text-foreground">
                                        Entries close{" "}
                                        <span className="font-normal text-muted-foreground">(optional)</span>
                                    </label>
                                    <Input
                                        id="ext-closes"
                                        type="date"
                                        value={entriesCloseOn}
                                        max={startsOn || undefined}
                                        onChange={(e) => setEntriesCloseOn(e.target.value)}
                                    />
                                </div>
                            </div>

                            {venueType === "live" && (
                                <div>
                                    <label htmlFor="ext-location" className="mb-1 block text-sm font-semibold text-foreground">
                                        Location
                                    </label>
                                    <Input
                                        id="ext-location"
                                        value={location}
                                        onChange={(e) => setLocation(e.target.value)}
                                        placeholder="City, state / country"
                                        maxLength={160}
                                    />
                                </div>
                            )}

                            <div>
                                <label htmlFor="ext-desc" className="mb-1 block text-sm font-semibold text-foreground">
                                    Details{" "}
                                    <span className="font-normal text-muted-foreground">(optional)</span>
                                </label>
                                <Textarea
                                    id="ext-desc"
                                    rows={3}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Divisions, fees, anything an entrant should know…"
                                    maxLength={500}
                                />
                                <span className="mt-1 block text-right text-xs text-muted-foreground">
                                    {description.length}/500
                                </span>
                            </div>

                            {error && (
                                <p className="m-0 text-sm font-medium text-destructive" role="alert">
                                    {error}
                                </p>
                            )}

                            <div className="flex justify-end gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => handleOpenChange(false)}
                                    disabled={saving}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={saving}>
                                    {saving ? "Submitting…" : "Submit for review"}
                                </Button>
                            </div>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
