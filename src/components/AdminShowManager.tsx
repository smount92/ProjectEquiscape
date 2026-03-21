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
        return <p className="text-muted" >No shows yet. Create one above.</p>;
    }

    return (
        <div className="gap-2" style={{ display: "flex", flexDirection: "column" }}>
            {shows.map((show) => (
                <div key={show.id} className="bg-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-12 shadow-md transition-all p-4 gap-4" style={{ display: "flex", alignItems: "center", flexWrap: "wrap" }}>
                    <div className="flex-1 min-w-[200px]" >
                        <div className="font-semibold" >{show.title}</div>
                        <div className="text-[calc(0.75rem*var(--font-scale))] text-muted" >
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
                        className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge"
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
