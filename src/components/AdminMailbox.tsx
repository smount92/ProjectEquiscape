"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import AdminReplyForm from "@/components/AdminReplyForm";
import MarkReadButton from "@/components/MarkReadButton";
import { deleteContactMessage } from "@/app/actions/admin";
import { listMailbox, setMailboxStatus, type MailboxFilter, type MailboxMessage } from "@/app/actions/admin-mailbox";
import { contactCategoryOwnerLabel } from "@/lib/contact/categories";
import CopyAsTicketButton from "@/components/admin/CopyAsTicketButton";
import { labelForContactCategory, sourceDate } from "@/lib/admin/ticketDraft";

const FILTERS: { key: MailboxFilter; label: string }[] = [
    { key: "open", label: "Open" },
    { key: "resolved", label: "Resolved" },
    { key: "all", label: "All" },
];

const LOAD_FAILED = "The mailbox couldn't load just now. Please refresh to try again.";

function when(iso: string): string {
    return new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

/**
 * The owner's mailbox (MHH-027): open messages first, each with what it's
 * about, the sender's account when they were signed in, and the error
 * reference if they came from an error page. Resolve closes one; older
 * messages load on demand.
 *
 * Open/resolved is the state that matters: the tab badge and the pulse
 * count open messages (countOpenContactMessages). Read/unread stays as a
 * small side detail on each card.
 */
export default function AdminMailbox() {
    const [filter, setFilter] = useState<MailboxFilter>("open");
    const [messages, setMessages] = useState<MailboxMessage[] | null>(null);
    const [more, setMore] = useState(false);
    const [triage, setTriage] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [loadingOlder, setLoadingOlder] = useState(false);
    // A ref, not state: two clicks in the same frame both see `false` state.
    const olderInFlight = useRef(false);

    useEffect(() => {
        let live = true;
        listMailbox(filter)
            .then((r) => {
                if (!live) return;
                if (!r.success) return setError(r.error);
                setError(null);
                setTriage(r.triage);
                setMore(r.more);
                setMessages(r.messages);
            })
            .catch(() => {
                if (live) setError(LOAD_FAILED);
            });
        return () => {
            live = false;
        };
    }, [filter]);

    const loadOlder = async () => {
        if (olderInFlight.current || !messages?.length) return;
        olderInFlight.current = true;
        setLoadingOlder(true);
        try {
            const r = await listMailbox(filter, messages[messages.length - 1].createdAt);
            if (!r.success) {
                setError(r.error);
            } else {
                setError(null);
                setTriage(r.triage);
                setMore(r.more);
                setMessages((prev) => [...(prev ?? []), ...r.messages]);
            }
        } catch {
            setError("Older messages couldn't load just now. Please try again.");
        } finally {
            olderInFlight.current = false;
            setLoadingOlder(false);
        }
    };

    const resolve = async (m: MailboxMessage) => {
        setBusy(m.id);
        const next = m.status === "open" ? ("resolved" as const) : ("open" as const);
        try {
            const r = await setMailboxStatus(m.id, next);
            if (r.success) {
                setError(null);
                setMessages((prev) =>
                    (prev ?? [])
                        .map((x) => (x.id === m.id ? { ...x, status: next } : x))
                        .filter((x) => filter === "all" || x.status === filter),
                );
            } else {
                setError(r.error);
            }
        } catch {
            setError("That message couldn't be updated just now. Please try again.");
        } finally {
            setBusy(null);
        }
    };

    const remove = async (m: MailboxMessage) => {
        if (!window.confirm(`Delete the message from ${m.name}? This can't be undone.`)) return;
        setBusy(m.id);
        try {
            const r = await deleteContactMessage(m.id);
            if (r.success) {
                setError(null);
                setMessages((prev) => (prev ?? []).filter((x) => x.id !== m.id));
            } else {
                setError(`The message from ${m.name} couldn't be deleted. Please try again.`);
            }
        } catch {
            setError(`The message from ${m.name} couldn't be deleted. Please try again.`);
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="flex flex-col gap-3">
            <div role="group" aria-label="Which messages" className="flex gap-2">
                {FILTERS.map((f) => (
                    <button
                        key={f.key}
                        type="button"
                        aria-pressed={filter === f.key}
                        onClick={() => {
                            if (filter === f.key) return;
                            setError(null);
                            setMessages(null);
                            setFilter(f.key);
                        }}
                        className={`rounded-full border px-3 py-1 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
                            filter === f.key ? "border-forest bg-muted font-semibold" : "border-input hover:bg-muted"
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>
            {!triage && (
                <p className="text-xs text-muted-foreground">
                    Categories, open/resolved and account links appear once migration 236 is pasted.
                </p>
            )}
            {error && (
                <p role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}
            {messages === null && !error && (
                <p role="status" className="text-sm text-muted-foreground">
                    Loading…
                </p>
            )}
            {messages?.length === 0 && (
                <div className="rounded-lg border border-input bg-card px-8 py-12 text-center shadow-sm">
                    <div className="mb-4 text-5xl" aria-hidden="true">
                        📬
                    </div>
                    <p className="m-0">
                        {filter === "open" ? "Nothing waiting. Every message is handled." : "No messages here."}
                    </p>
                </div>
            )}
            {messages?.map((m) => (
                <article
                    key={m.id}
                    aria-label={`Message from ${m.name}${m.status === "resolved" ? ", resolved" : ""}`}
                    className={`rounded-lg border border-input bg-card p-4 [overflow-wrap:anywhere] ${m.status === "open" ? "shadow-md" : ""}`}
                >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">{m.name}</span>
                            <a href={`mailto:${m.email}`} className="text-xs text-forest no-underline hover:underline">
                                {m.email}
                            </a>
                            {m.sender && (
                                <Link
                                    href={`/profile/${encodeURIComponent(m.sender.alias)}`}
                                    className="text-xs text-forest underline hover:no-underline"
                                >
                                    @{m.sender.alias}
                                </Link>
                            )}
                            {triage && (
                                <span className="rounded-full border border-input bg-muted px-2 py-0.5 text-xs text-secondary-foreground">
                                    {contactCategoryOwnerLabel(m.category)}
                                </span>
                            )}
                            {triage && m.status === "resolved" && (
                                <span className="rounded-full border border-forest/40 px-2 py-0.5 text-xs font-semibold text-forest">
                                    ✓ Resolved
                                </span>
                            )}
                        </div>
                        <span className="text-xs text-muted-foreground">{when(m.createdAt)}</span>
                    </div>
                    {m.subject && <div className="mb-2 text-sm font-medium">{m.subject}</div>}
                    {m.errorRef && (
                        <p className="mb-2 text-xs text-secondary-foreground">
                            Error reference <span className="font-mono">{m.errorRef}</span> (find it in Ops › Errors /
                            Sentry)
                        </p>
                    )}
                    <div className="mb-3 text-sm leading-relaxed whitespace-pre-wrap text-secondary-foreground">
                        {m.message}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 border-t border-input pt-3">
                        <AdminReplyForm
                            messageId={m.id}
                            recipientEmail={m.email}
                            recipientName={m.name}
                            originalSubject={m.subject}
                            originalMessage={m.message}
                        />
                        <MarkReadButton messageId={m.id} isRead={m.isRead} />
                        {triage && (
                            <Button type="button" variant="outline" onClick={() => resolve(m)} disabled={busy === m.id}>
                                {m.status === "open" ? "Mark resolved" : "Reopen"}
                            </Button>
                        )}
                        <Button type="button" variant="outline" onClick={() => remove(m)} disabled={busy === m.id}>
                            Delete
                        </Button>
                        <CopyAsTicketButton
                            draft={{
                                title: m.subject || m.message.slice(0, 80),
                                type: m.category === "idea" ? "feature" : "bug",
                                labels: [labelForContactCategory(m.category), "member-reported"],
                                why: m.message,
                                source: `Admin › Mailbox, ${m.sender ? `@${m.sender.alias}` : "a visitor"}, ${sourceDate(m.createdAt)}${m.errorRef ? `, error ${m.errorRef}` : ""}`,
                            }}
                        />
                    </div>
                </article>
            ))}
            {more && messages && messages.length > 0 && (
                <Button
                    type="button"
                    variant="outline"
                    onClick={loadOlder}
                    disabled={loadingOlder}
                    aria-busy={loadingOlder}
                >
                    {loadingOlder ? "Loading older messages…" : "Load older messages"}
                </Button>
            )}
        </div>
    );
}
