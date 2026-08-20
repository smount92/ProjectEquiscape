"use client";

/**
 * Admin — announcement banner composer (phase 1: owner-authored).
 * Compose with optional link + end date; list + retire live ones.
 * Renders its errors inline; the card is admin-page-only (the
 * actions re-verify ADMIN_EMAIL server-side regardless).
 */

import { useEffect, useState, useTransition } from "react";

import {
    createAnnouncement,
    deleteAnnouncement,
    listAnnouncements,
    type AdminAnnouncement,
} from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminAnnouncementsCard() {
    const [rows, setRows] = useState<AdminAnnouncement[]>([]);
    const [message, setMessage] = useState("");
    const [linkUrl, setLinkUrl] = useState("");
    const [endsAt, setEndsAt] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    const refresh = async () => {
        const result = await listAnnouncements();
        if (result.success) setRows(result.announcements);
    };
    useEffect(() => {
        void refresh();
    }, []);

    const submit = () => {
        startTransition(async () => {
            setError(null);
            const result = await createAnnouncement({
                message,
                linkUrl: linkUrl || undefined,
                endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
            });
            if (!result.success) {
                setError(result.error ?? "Failed to post the announcement.");
                return;
            }
            setMessage("");
            setLinkUrl("");
            setEndsAt("");
            await refresh();
        });
    };

    return (
        <section className="rounded-lg border border-input bg-card p-5">
            <h2 className="mt-0 mb-1 text-base font-bold text-foreground">📣 Announcement banner</h2>
            <p className="mt-0 mb-4 text-xs text-muted-foreground">
                Shows site-wide under the header until its end date (or until retired).
                Members can dismiss each announcement once read.
            </p>

            <div className="flex flex-col gap-2">
                <Input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Announcement text (300 chars max)"
                    maxLength={300}
                    aria-label="Announcement text"
                />
                <div className="flex flex-wrap gap-2">
                    <Input
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        placeholder="Link (optional, e.g. /shows/…)"
                        className="min-w-[200px] flex-1"
                        aria-label="Announcement link"
                    />
                    <Input
                        type="datetime-local"
                        value={endsAt}
                        onChange={(e) => setEndsAt(e.target.value)}
                        className="w-auto"
                        aria-label="Ends at (optional)"
                    />
                    <Button onClick={submit} disabled={pending || !message.trim()}>
                        Post
                    </Button>
                </div>
                {error && (
                    <p role="alert" className="m-0 text-sm font-semibold text-destructive">
                        {error}
                    </p>
                )}
            </div>

            {rows.length > 0 && (
                <ul className="mt-4 flex list-none flex-col gap-2 p-0">
                    {rows.map((a) => (
                        <li
                            key={a.id}
                            className="flex items-center justify-between gap-3 rounded-md border border-input px-3 py-2 text-sm"
                        >
                            <span className="min-w-0 flex-1 truncate">
                                {a.message}
                                {a.endsAt && (
                                    <span className="ml-2 text-xs text-muted-foreground">
                                        until {new Date(a.endsAt).toLocaleString()}
                                    </span>
                                )}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    startTransition(async () => {
                                        await deleteAnnouncement(a.id);
                                        await refresh();
                                    })
                                }
                            >
                                Retire
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
