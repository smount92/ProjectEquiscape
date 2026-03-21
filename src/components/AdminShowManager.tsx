"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateShowStatus, deleteShow } from "@/app/actions/shows";

interface AdminShow {
    id: string;
    title: string;
    status: string;
    endAt: string | null;
    entryCount: number;
}

export default function AdminShowManager({ shows }: { shows: AdminShow[] }) {
    const router = useRouter();
    const [busy, setBusy] = useState<string | null>(null);

    const handleStatusChange = async (showId: string, newStatus: string) => {
        setBusy(showId);
        await updateShowStatus(showId, newStatus as "open" | "judging" | "closed");
        router.refresh();
        setBusy(null);
    };

    const handleDelete = async (showId: string, title: string) => {
        if (!confirm(`Delete "${title}" and all its entries? This cannot be undone.`)) return;
        setBusy(showId);
        await deleteShow(showId);
        router.refresh();
        setBusy(null);
    };

    if (shows.length === 0) {
        return <p className="text-muted">No shows yet. Create one above.</p>;
    }

    return (
        <div className="gap-2" style={{ display: "flex", flexDirection: "column" }}>
            {shows.map((show) => (
                <div
                    key={show.id}
                    className="bg-bg-card border-edge border-edge gap-4 rounded-lg border p-4 p-12 shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]"
                    style={{ display: "flex", alignItems: "center", flexWrap: "wrap" }}
                >
                    <div className="min-w-[200px] flex-1">
                        <div className="font-semibold">{show.title}</div>
                        <div className="text-muted text-[calc(0.75rem*var(--font-scale))]">
                            🐴 {show.entryCount} entries
                            {show.endAt && <> · ⏰ {new Date(show.endAt).toLocaleDateString()}</>}
                        </div>
                    </div>
                    <select
                        value={show.status}
                        onChange={(e) => handleStatusChange(show.id, e.target.value)}
                        className="form-input"
                        style={{ width: "auto", minWidth: "120px" }}
                        disabled={busy === show.id}
                    >
                        <option value="open">🟢 Open</option>
                        <option value="judging">🟡 Judging</option>
                        <option value="closed">🔴 Closed</option>
                    </select>
                    <button
                        className="hover:no-underline-min-h)] text-ink-light border-edge inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] bg-transparent px-8 py-2 font-sans text-base leading-none font-semibold no-underline transition-all duration-150"
                        onClick={() => handleDelete(show.id, show.title)}
                        disabled={busy === show.id}
                        style={{ color: "var(--color-error, #ef4444)", fontSize: "calc(0.8rem * var(--font-scale))" }}
                    >
                        🗑 Delete
                    </button>
                </div>
            ))}
        </div>
    );
}
