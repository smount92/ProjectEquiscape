"use client";

import { useState } from "react";

import { writeEntryScore } from "@/app/actions/shows-v4";
import type { JudgeQueueEntry } from "@/lib/shows/gallery";
import {
    SCORE_ANCHORS,
    SCORE_MAX,
    SCORE_MIN,
    isComplete,
    weightedTotal,
    type Rubric,
} from "@/lib/shows/rubrics";

/**
 * The judge's score pad — five tap-scales and a running total, living
 * in the same expandable panel as the placing note and critique.
 * Every tap saves (optimistic, whisper on failure); a PARTIAL sheet
 * saves too, but only a complete one earns a total — partial sheets
 * never rank. The anchor bands keep a 7 meaning the same thing at
 * entry #2 and entry #38.
 */
export default function EntryScorePad({
    entry,
    rubric,
    onTotal,
}: {
    entry: JudgeQueueEntry;
    rubric: Rubric;
    /** Reports the fresh total upward so the tray suggestion stays live. */
    onTotal?: (entryId: string, total: number | null) => void;
}) {
    const [scores, setScores] = useState<Record<string, number>>(
        () => entry.scoreData ?? {},
    );
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const total = weightedTotal(rubric, scores);
    const complete = isComplete(rubric, scores);

    const tap = (key: string, value: number) => {
        const next = { ...scores, [key]: value };
        setScores(next);
        setError(null);
        setSaving(true);
        void writeEntryScore({ entryId: entry.id, scores: next }).then((res) => {
            setSaving(false);
            if (!res.success) {
                setError(res.error ?? "That score didn't save.");
                return;
            }
            onTotal?.(entry.id, res.total ?? null);
        });
    };

    return (
        <div className="border-input bg-card rounded-md border p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-bold">🎯 Score — {rubric.name}</span>
                <span className="text-muted-foreground text-xs tabular-nums">
                    {complete && total != null ? (
                        <>
                            weighted <b className="text-foreground">{total}</b>/100
                        </>
                    ) : (
                        "score every criterion to rank"
                    )}
                    {saving ? " · saving…" : ""}
                </span>
            </div>
            <p className="text-muted-foreground mt-1 mb-2 text-[0.72rem]">
                {SCORE_ANCHORS.map((a) => `${a.from}–${a.to} ${a.label.toLowerCase()}`).join(" · ")}
            </p>
            {rubric.criteria.map((c) => (
                <div key={c.key} className="border-border-tan/30 border-b border-dashed py-2 last:border-b-0">
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                        <span className="font-semibold">
                            {c.label}
                            <span className="text-muted-foreground ml-1 text-xs font-normal">{c.weight}%</span>
                        </span>
                        {c.help && <span className="text-muted-foreground truncate text-xs">{c.help}</span>}
                    </div>
                    <div
                        className="flex flex-wrap gap-1"
                        role="radiogroup"
                        aria-label={`${c.label} score, 1 to 10`}
                    >
                        {Array.from({ length: SCORE_MAX - SCORE_MIN + 1 }, (_, i) => i + SCORE_MIN).map(
                            (v) => (
                                <button
                                    key={v}
                                    type="button"
                                    role="radio"
                                    aria-checked={scores[c.key] === v}
                                    onClick={() => tap(c.key, v)}
                                    className={`min-h-8 min-w-8 rounded-md border text-xs font-bold tabular-nums transition-colors ${
                                        scores[c.key] === v
                                            ? "border-transparent text-white"
                                            : "border-input bg-background text-muted-foreground hover:border-forest"
                                    }`}
                                    style={
                                        scores[c.key] === v
                                            ? { background: "var(--chart-entry)" }
                                            : undefined
                                    }
                                >
                                    {v}
                                </button>
                            ),
                        )}
                    </div>
                </div>
            ))}
            {error && <p className="text-destructive mt-2 mb-0 text-xs">{error}</p>}
        </div>
    );
}
