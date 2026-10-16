"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { messageShowHost } from "@/app/actions/show-host-message";
import { HOST_MESSAGE_MAX, hostMessageHeading } from "@/lib/shows/hostMessage";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export interface HostMessageEntryOption {
    id: string;
    entryNumber: number | null;
    horseName: string;
    className: string | null;
    scratched: boolean;
}

const optionLabel = (e: HostMessageEntryOption) =>
    [
        e.entryNumber !== null ? `#${e.entryNumber}` : null,
        e.horseName,
        e.className ? `in ${e.className}` : null,
        e.scratched ? "(scratched)" : null,
    ]
        .filter(Boolean)
        .join(" ");

/** The message box on /shows/[id]/message-host (MHH-026). */
export default function MessageHostForm({
    showId,
    showTitle,
    hostAlias,
    entries,
    initialEntryId = "",
}: {
    showId: string;
    showTitle: string;
    hostAlias: string | null;
    entries: HostMessageEntryOption[];
    /** Preselected entry (Ask the host on a My Entries row). */
    initialEntryId?: string;
}) {
    const router = useRouter();
    const [entryId, setEntryId] = useState(initialEntryId);
    const [message, setMessage] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    const picked = entries.find((e) => e.id === entryId) ?? null;
    const heading = hostMessageHeading(showTitle, picked);

    const send = (event: React.FormEvent) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
            const result = await messageShowHost({ showId, entryId: entryId || null, message });
            if (!result.success) return setError(result.error);
            router.push(`/inbox/${result.conversationId}`);
        });
    };

    return (
        <form onSubmit={send} className="mx-auto flex max-w-[560px] flex-col gap-5" aria-describedby="host-note">
            <p id="host-note" className="m-0 text-sm text-secondary-foreground">
                Your message goes to {hostAlias ? `@${hostAlias}` : "the host"}&apos;s inbox, in your conversation with
                them. Their reply comes back to yours.
            </p>

            {entries.length > 0 && (
                <div>
                    <label htmlFor="host-entry" className="mb-1 block text-sm font-semibold text-foreground">
                        Which entry is this about?
                    </label>
                    <select
                        id="host-entry"
                        value={entryId}
                        onChange={(e) => setEntryId(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none"
                    >
                        <option value="">The show in general</option>
                        {entries.map((e) => (
                            <option key={e.id} value={e.id}>
                                {optionLabel(e)}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            <div>
                <label htmlFor="host-message" className="mb-1 block text-sm font-semibold text-foreground">
                    Message
                </label>
                <p className="mt-0 mb-2 text-xs text-muted-foreground">
                    It starts with <span className="font-medium text-secondary-foreground">{heading}</span>
                </p>
                <Textarea
                    id="host-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="min-h-[140px] resize-y"
                    rows={6}
                    maxLength={HOST_MESSAGE_MAX}
                    required
                    autoFocus
                />
                <p className="mt-1 mb-0 text-right text-xs text-muted-foreground tabular-nums">
                    {message.length}/{HOST_MESSAGE_MAX}
                </p>
            </div>

            {error && (
                <p
                    role="alert"
                    className="m-0 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive"
                >
                    {error}
                </p>
            )}

            <div>
                <Button type="submit" disabled={pending || !message.trim()}>
                    {pending ? "Sending…" : "Send to the host"}
                </Button>
            </div>
        </form>
    );
}
