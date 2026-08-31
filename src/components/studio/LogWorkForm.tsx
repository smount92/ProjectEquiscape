"use client";

/**
 * The three-minute back-fill — the make-or-break flow of the studio
 * rebuild (owner decision 2026-09-01: if logging a past work takes
 * twenty minutes, the works walls stay empty).
 *
 * One page, three moves: pick the horse, say what the work was, drop
 * photos into stage buckets. Each non-empty bucket becomes ONE moment
 * (its photos + one caption + one date). Photos ride the SAME
 * compression pipeline as gallery photos — tier-quality WebP, never
 * raw bytes (the WIP thread's raw-upload mistake ends here).
 */

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { compressImage, type UserTier } from "@/lib/utils/imageCompression";
import { uploadImageWithRetry } from "@/lib/utils/uploadWithRetry";
import { createWorkRecord, addWorkMoments } from "@/app/actions/work-records";
import { SERVICE_TYPES } from "@/lib/studio/services";
import {
    MAX_IMAGES_PER_MOMENT,
    STAGE_LABELS,
    WORK_STAGES,
    makingImagePrefix,
    type WorkStage,
} from "@/lib/studio/making";
import { Button } from "@/components/ui/button";

export interface LogWorkHorse {
    id: string;
    name: string;
    thumbUrl: string | null;
    ownedByMe: boolean;
}

interface Bucket {
    files: File[];
    caption: string;
    date: string;
}

const BACKFILL_STAGES: WorkStage[] = ["blank", "prep", "base", "detail", "finished"];

export default function LogWorkForm({
    horses,
    tier,
    studioName,
}: {
    horses: LogWorkHorse[];
    tier: UserTier;
    studioName: string;
}) {
    const [horseId, setHorseId] = useState<string | null>(null);
    const [filter, setFilter] = useState("");
    const [workType, setWorkType] = useState<string>(SERVICE_TYPES[1]);
    const [summary, setSummary] = useState("");
    const [claimedStart, setClaimedStart] = useState("");
    const [dateCompleted, setDateCompleted] = useState("");
    const [buckets, setBuckets] = useState<Record<WorkStage, Bucket>>(() => {
        const init = {} as Record<WorkStage, Bucket>;
        for (const s of WORK_STAGES) init[s] = { files: [], caption: "", date: "" };
        return init;
    });
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [doneHorse, setDoneHorse] = useState<{ id: string; name: string } | null>(null);
    const previewUrls = useRef(new Map<File, string>());

    const shown = useMemo(() => {
        const q = filter.trim().toLowerCase();
        const list = q ? horses.filter((h) => h.name.toLowerCase().includes(q)) : horses;
        return list.slice(0, 60);
    }, [horses, filter]);

    const chosen = horses.find((h) => h.id === horseId) ?? null;
    const totalPhotos = WORK_STAGES.reduce((n, s) => n + buckets[s].files.length, 0);

    const preview = (f: File) => {
        let u = previewUrls.current.get(f);
        if (!u) {
            u = URL.createObjectURL(f);
            previewUrls.current.set(f, u);
        }
        return u;
    };

    const addFiles = (stage: WorkStage, list: FileList | null) => {
        if (!list) return;
        setBuckets((b) => ({
            ...b,
            [stage]: {
                ...b[stage],
                files: [...b[stage].files, ...Array.from(list)].slice(0, MAX_IMAGES_PER_MOMENT),
            },
        }));
    };

    const removeFile = (stage: WorkStage, idx: number) => {
        setBuckets((b) => ({
            ...b,
            [stage]: { ...b[stage], files: b[stage].files.filter((_, i) => i !== idx) },
        }));
    };

    const submit = async () => {
        if (!horseId || !chosen) return setError("Pick the horse first.");
        if (totalPhotos === 0 && !summary.trim()) {
            return setError("Add at least a photo or a summary — an empty record helps no one.");
        }
        setError(null);
        setBusy(true);
        try {
            setProgress("Filing the work record…");
            const rec = await createWorkRecord({
                horseId,
                workType,
                summary: summary.trim() || undefined,
                claimedStart: claimedStart || null,
                dateCompleted: dateCompleted || null,
            });
            if (!rec.success || !rec.logId) throw new Error(rec.error ?? "Could not create the record.");

            const supabase = createClient();
            const moments: { images: { path: string; stage: WorkStage; caption?: string; claimedDate?: string | null }[] }[] = [];
            let uploadedCount = 0;
            const failed: string[] = [];
            for (const stage of WORK_STAGES) {
                const bucket = buckets[stage];
                if (bucket.files.length === 0) continue;
                const images: { path: string; stage: WorkStage; caption?: string; claimedDate?: string | null }[] = [];
                for (let i = 0; i < bucket.files.length; i++) {
                    setProgress(`Uploading ${STAGE_LABELS[stage].toLowerCase()} photo ${i + 1} of ${bucket.files.length}…`);
                    const path = `${makingImagePrefix(horseId)}${Date.now()}_${stage}_${i}.webp`;
                    const blob = await compressImage(bucket.files[i], tier);
                    const { error: upErr } = await uploadImageWithRetry(supabase, "horse-images", path, blob);
                    if (upErr) {
                        failed.push(`${STAGE_LABELS[stage]} photo ${i + 1}`);
                        continue;
                    }
                    uploadedCount++;
                    images.push({
                        path,
                        stage,
                        caption: bucket.caption.trim() || undefined,
                        claimedDate: bucket.date || null,
                    });
                }
                if (images.length > 0) moments.push({ images });
            }

            if (moments.length > 0) {
                setProgress("Building the reel…");
                const res = await addWorkMoments(rec.logId, moments);
                if (!res.success) throw new Error(res.error ?? "Photos uploaded but the reel failed to save.");
            }
            if (failed.length > 0) {
                setError(`Saved, but ${failed.length} photo${failed.length === 1 ? "" : "s"} failed to upload: ${failed.join(", ")}.`);
            }
            setDoneHorse({ id: horseId, name: chosen.name });
            setProgress(null);
        } catch (e) {
            setProgress(null);
            setError(e instanceof Error ? e.message : "Something went wrong.");
        } finally {
            setBusy(false);
        }
    };

    if (doneHorse) {
        return (
            <div className="border-input bg-card rounded-2xl border p-6 text-center">
                <p className="text-foreground m-0 font-serif text-xl font-bold">
                    ✓ {doneHorse.name}&rsquo;s work record is on your wall.
                </p>
                <p className="text-secondary-foreground mt-2 text-sm">
                    {studioName} is credited
                    {chosen?.ownedByMe
                        ? " — when this horse is parked and claimed, the new owner's claim confirms it."
                        : " — the owner has been asked to confirm it."}
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-3">
                    <Link href={`/community/${doneHorse.id}/making`} className="text-forest font-semibold hover:underline">
                        See The Making →
                    </Link>
                    <button
                        type="button"
                        className="text-secondary-foreground underline"
                        onClick={() => {
                            setDoneHorse(null);
                            setHorseId(null);
                            setSummary("");
                            setClaimedStart("");
                            setDateCompleted("");
                            setBuckets(() => {
                                const init = {} as Record<WorkStage, Bucket>;
                                for (const s of WORK_STAGES) init[s] = { files: [], caption: "", date: "" };
                                return init;
                            });
                        }}
                    >
                        Log another work
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            {/* ── 1. The horse ── */}
            <section className="border-input bg-card rounded-2xl border p-5">
                <h2 className="text-foreground mt-0 mb-1 font-serif text-lg font-bold">1 · Which horse?</h2>
                <p className="text-muted-foreground mt-0 mb-3 text-sm">
                    Yours or a client&rsquo;s — a work on someone else&rsquo;s horse asks their owner to
                    confirm the credit. Not in a stable yet?{" "}
                    <Link href="/add-horse" className="text-forest hover:underline">Add the horse first</Link>,
                    then park it for its owner.
                </p>
                <input
                    type="text"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Search by name…"
                    className="border-input bg-background mb-3 w-full rounded-md border px-3 py-2 text-sm"
                />
                <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 md:grid-cols-4">
                    {shown.map((h) => (
                        <button
                            key={h.id}
                            type="button"
                            onClick={() => setHorseId(h.id)}
                            className={`flex items-center gap-2 rounded-lg border p-2 text-left text-sm ${
                                horseId === h.id
                                    ? "border-forest bg-forest/10 font-semibold"
                                    : "border-input bg-background"
                            }`}
                        >
                            {h.thumbUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={h.thumbUrl} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" />
                            ) : (
                                <span className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-md">🐴</span>
                            )}
                            <span className="min-w-0 truncate">{h.name}</span>
                        </button>
                    ))}
                    {shown.length === 0 && (
                        <p className="text-muted-foreground col-span-full m-0 text-sm">No horses match.</p>
                    )}
                </div>
            </section>

            {/* ── 2. The work ── */}
            <section className="border-input bg-card rounded-2xl border p-5">
                <h2 className="text-foreground mt-0 mb-3 font-serif text-lg font-bold">2 · What was the work?</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm font-medium">
                        Work type
                        <select
                            value={workType}
                            onChange={(e) => setWorkType(e.target.value)}
                            className="border-input bg-background mt-1 block w-full rounded-md border px-3 py-2 text-sm"
                        >
                            {SERVICE_TYPES.map((t) => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <label className="text-sm font-medium">
                            Started
                            <input
                                type="date"
                                value={claimedStart}
                                onChange={(e) => setClaimedStart(e.target.value)}
                                className="border-input bg-background mt-1 block w-full rounded-md border px-3 py-2 text-sm"
                            />
                        </label>
                        <label className="text-sm font-medium">
                            Finished
                            <input
                                type="date"
                                value={dateCompleted}
                                onChange={(e) => setDateCompleted(e.target.value)}
                                className="border-input bg-background mt-1 block w-full rounded-md border px-3 py-2 text-sm"
                            />
                        </label>
                    </div>
                </div>
                <label className="mt-3 block text-sm font-medium">
                    The story (optional)
                    <textarea
                        rows={3}
                        maxLength={2000}
                        value={summary}
                        onChange={(e) => setSummary(e.target.value)}
                        placeholder="What she started as, what she became…"
                        className="border-input bg-background mt-1 block w-full rounded-md border px-3 py-2 text-sm"
                    />
                </label>
                <p className="text-muted-foreground mt-2 mb-0 text-xs">
                    Dates are your record of when the work happened — they display as your claim, with
                    today as the honest logging date underneath.
                </p>
            </section>

            {/* ── 3. The reel ── */}
            <section className="border-input bg-card rounded-2xl border p-5">
                <h2 className="text-foreground mt-0 mb-1 font-serif text-lg font-bold">3 · The making-of reel</h2>
                <p className="text-muted-foreground mt-0 mb-3 text-sm">
                    Drop photos into the stages you have. Each stage takes up to {MAX_IMAGES_PER_MOMENT} photos,
                    one caption, one date. Skip what you don&rsquo;t have — even two photos tell a story.
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                    {BACKFILL_STAGES.map((stage) => {
                        const b = buckets[stage];
                        return (
                            <div key={stage} className="border-input bg-background rounded-xl border p-3">
                                <div className="flex items-baseline justify-between">
                                    <h3 className="text-foreground m-0 font-serif text-sm font-bold">{STAGE_LABELS[stage]}</h3>
                                    <label className="text-forest cursor-pointer text-sm font-semibold hover:underline">
                                        + photos
                                        <input
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            className="hidden"
                                            onChange={(e) => {
                                                addFiles(stage, e.target.files);
                                                e.target.value = "";
                                            }}
                                        />
                                    </label>
                                </div>
                                {b.files.length > 0 && (
                                    <>
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                            {b.files.map((f, i) => (
                                                <span key={i} className="relative">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={preview(f)} alt="" className="h-14 w-14 rounded-md object-cover" />
                                                    <button
                                                        type="button"
                                                        onClick={() => removeFile(stage, i)}
                                                        aria-label="Remove photo"
                                                        className="bg-card border-input absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border text-xs leading-none"
                                                    >
                                                        ×
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                        <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                                            <input
                                                type="text"
                                                maxLength={280}
                                                value={b.caption}
                                                onChange={(e) =>
                                                    setBuckets((prev) => ({ ...prev, [stage]: { ...prev[stage], caption: e.target.value } }))
                                                }
                                                placeholder="Caption…"
                                                className="border-input bg-card rounded-md border px-2 py-1.5 text-sm"
                                            />
                                            <input
                                                type="date"
                                                value={b.date}
                                                onChange={(e) =>
                                                    setBuckets((prev) => ({ ...prev, [stage]: { ...prev[stage], date: e.target.value } }))
                                                }
                                                className="border-input bg-card rounded-md border px-2 py-1.5 text-sm"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            </section>

            {error && <p className="text-destructive m-0 text-sm font-medium">{error}</p>}
            <div className="flex items-center gap-4">
                <Button onClick={submit} disabled={busy || !horseId}>
                    {busy ? (progress ?? "Saving…") : `File the work record${totalPhotos ? ` + ${totalPhotos} photo${totalPhotos === 1 ? "" : "s"}` : ""}`}
                </Button>
                {chosen && (
                    <span className="text-muted-foreground text-sm">
                        for <b>{chosen.name}</b>{chosen.ownedByMe ? "" : " (owner will be asked to confirm)"}
                    </span>
                )}
            </div>
        </div>
    );
}
