"use client";

import { useState } from "react";
import Link from "next/link";
import { useToast } from "@/lib/context/ToastContext";
import type { QueueData, QueueTab } from "@/app/actions/registry-desk";
import QueueItemCard from "@/components/desk/QueueItemCard";

const TABS: { key: QueueTab; label: string; help: string }[] = [
    {
        key: "corrections",
        label: "Corrections",
        help: "Members' fixes to entries already in the Registry.",
    },
    { key: "additions", label: "New entries", help: "Molds, releases and resins members want added." },
    {
        key: "duplicates",
        label: "Duplicates",
        help: "Two entries for the same thing. Approving asks for a merge; another moderator confirms it.",
    },
    {
        key: "auto_applied",
        label: "Applied by curators",
        help: "What Silver and Gold curators changed in the last 7 days, live already. Put back anything wrong.",
    },
    {
        key: "second_looks",
        label: "Second looks",
        help: "Merges waiting for a second moderator. Nobody confirms their own.",
    },
];

/**
 * The Queue: members' suggestions by kind, oldest first. Approve, fix and
 * approve, or say no with a reason; the member hears back either way.
 */
export default function QueueList({ queue, role }: { queue: QueueData; role: "owner" | "moderator" }) {
    const { toast } = useToast();
    const [done, setDone] = useState<Set<string>>(new Set());
    const items = queue.items.filter((i) => !done.has(i.id));
    const tab = TABS.find((t) => t.key === queue.tab) ?? TABS[0];

    return (
        <section aria-label="Queue" className="flex max-w-[980px] flex-col gap-3">
            <p className="m-0 text-sm text-secondary-foreground">
                Suggestions from members. Approve, fix and approve, or say no with a reason. The member hears back
                either way. You never decide your own.
            </p>
            <nav aria-label="Queue sections" className="flex flex-wrap gap-2">
                {TABS.map((t) => {
                    const on = t.key === queue.tab;
                    const n = queue.counts[t.key] - (on ? done.size : 0);
                    return (
                        <Link
                            key={t.key}
                            href={t.key === "corrections" ? "/catalog/desk" : `/catalog/desk?tab=${t.key}`}
                            aria-current={on ? "page" : undefined}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold no-underline max-md:min-h-11 ${
                                on
                                    ? "border-forest bg-forest text-primary-foreground"
                                    : "border-input bg-card text-foreground hover:border-forest"
                            }`}
                        >
                            {t.label}
                            <span className="tabular-nums">{Math.max(0, n)}</span>
                        </Link>
                    );
                })}
            </nav>
            <p className="m-0 text-xs text-muted-foreground">{tab.help}</p>
            {queue.notice && (
                <p className="m-0 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">{queue.notice}</p>
            )}
            {items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-input bg-card p-8 text-center text-muted-foreground">
                    {queue.tab === "auto_applied"
                        ? "Nothing applied by curators this week."
                        : "The queue is clear. Nice work."}
                </div>
            ) : (
                items.map((item) => (
                    <QueueItemCard
                        key={item.id}
                        item={item}
                        role={role}
                        onDone={(id, message) => {
                            setDone((d) => new Set(d).add(id));
                            toast(message, "success");
                        }}
                    />
                ))
            )}
        </section>
    );
}
