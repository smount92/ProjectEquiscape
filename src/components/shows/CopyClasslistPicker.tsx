"use client";
/**
 * "Copy the classlist from one of my shows" — the empty-classlist
 * option beside the built-in templates. Your past shows are your
 * templates: divisions, sections and classes come across with their
 * rules. The list of sources loads when the host opens the picker, so
 * the empty state itself costs nothing extra.
 */
import { useState } from "react";
import { copyClasslistFromShow, listClasslistSources } from "@/app/actions/shows-v2";
import { friendlyShowStatus } from "@/lib/shows/plainWords";
import type { ShowStatus } from "@/lib/shows/types";
import { Button } from "@/components/ui/button";

type Source = { id: string; title: string; status: ShowStatus };

export default function CopyClasslistPicker({
    showId,
    pending,
    run,
}: {
    showId: string;
    pending: boolean;
    run: (action: () => Promise<{ success: boolean; error?: string }>) => Promise<void>;
}) {
    const [sources, setSources] = useState<Source[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [picked, setPicked] = useState("");
    const [loadError, setLoadError] = useState<string | null>(null);

    const openPicker = async () => {
        setLoading(true);
        setLoadError(null);
        const result = await listClasslistSources(showId);
        if (result.success) setSources(result.shows);
        else setLoadError(result.error ?? "Could not list your shows.");
        setLoading(false);
    };

    return (
        <div className="mt-2 flex w-full max-w-2xl flex-col items-center gap-2 border-t border-dashed border-input pt-4">
            {sources === null ? (
                <Button type="button" variant="outline" size="sm" onClick={openPicker} disabled={loading || pending} id="copy-classlist-open">
                    {loading ? "Looking up your shows…" : "Copy the classlist from one of my shows"}
                </Button>
            ) : sources.length === 0 ? (
                <p className="m-0 text-xs text-muted-foreground">You have no other shows to copy from yet.</p>
            ) : (
                <div className="flex w-full flex-wrap items-center justify-center gap-2">
                    <select
                        value={picked}
                        onChange={(e) => setPicked(e.target.value)}
                        className="min-w-0 flex-1 rounded-md border border-input bg-card px-2 py-1.5 text-sm"
                        aria-label="Show to copy the classlist from"
                        id="copy-classlist-source"
                    >
                        <option value="">Choose a show…</option>
                        {sources.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.title} · {friendlyShowStatus(s.status)}
                            </option>
                        ))}
                    </select>
                    <Button
                        type="button"
                        size="sm"
                        disabled={!picked || pending}
                        onClick={() => void run(() => copyClasslistFromShow({ showId, sourceShowId: picked }))}
                        id="copy-classlist-go"
                    >
                        Copy classlist
                    </Button>
                </div>
            )}
            {loadError && <p className="m-0 text-xs text-destructive">{loadError}</p>}
        </div>
    );
}
