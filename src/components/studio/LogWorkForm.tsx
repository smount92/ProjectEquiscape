"use client";

/**
 * The three-minute back-fill — the make-or-break flow of the studio
 * rebuild (owner decision 2026-09-01: if logging a past work takes
 * twenty minutes, the works walls stay empty).
 *
 * One page, three moves: pick the horse, say what the work was, drop
 * photos into stage buckets. Each non-empty bucket becomes ONE moment
 * (its photos + one caption + one date).
 *
 * STAGES BELONG TO THE ARTIST (204): pick a discipline and its
 * suggested ladder prefills the buckets — then rename any of them,
 * add your own ("Base coat 3 — dappling"), or delete what you don't
 * need. A sculptor, a china painter and a tack maker all get a ladder
 * in their own words.
 *
 * Photos ride the SAME compression pipeline as gallery photos —
 * tier-quality WebP, never raw bytes.
 */

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { compressImage, type UserTier } from "@/lib/utils/imageCompression";
import { uploadImageWithRetry } from "@/lib/utils/uploadWithRetry";
import { createWorkRecord, addWorkMoments, searchWorkTargets } from "@/app/actions/work-records";
import { SERVICE_TYPES } from "@/lib/studio/services";
import {
    DISCIPLINE_PRESETS,
    MAX_IMAGES_PER_MOMENT,
    MAX_MOMENT_NOTES,
    MAX_STAGE_LABEL,
    makingImagePrefix,
} from "@/lib/studio/making";
import { Button } from "@/components/ui/button";

export interface LogWorkHorse {
    id: string;
    name: string;
    thumbUrl: string | null;
    ownedByMe: boolean;
}

interface Bucket {
    id: number;
    label: string;
    files: File[];
    caption: string;
    date: string;
}

let nextBucketId = 1;
function bucketsFromPreset(stages: readonly string[]): Bucket[] {
    return stages.map((label) => ({ id: nextBucketId++, label, files: [], caption: "", date: "" }));
}

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
    const [discipline, setDiscipline] = useState(DISCIPLINE_PRESETS[0].key);
    const [workType, setWorkType] = useState<string>(SERVICE_TYPES[1]);
    const [summary, setSummary] = useState("");
    const [claimedStart, setClaimedStart] = useState("");
    const [dateCompleted, setDateCompleted] = useState("");
    const [buckets, setBuckets] = useState<Bucket[]>(() =>
        bucketsFromPreset(DISCIPLINE_PRESETS[0].stages),
    );
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [doneHorse, setDoneHorse] = useState<{ id: string; name: string } | null>(null);
    const previewUrls = useRef(new Map<File, string>());

    // The other half of "yours or a client's": search every stable the
    // artist can see (Amanda's model lived in another account and the
    // own-stable picker simply couldn't show it).
    const [external, setExternal] = useState<
        { id: string; name: string; ownerAlias: string | null; thumbUrl: string | null }[] | null
    >(null);
    const [searchingAll, setSearchingAll] = useState(false);
    const [chosenExternal, setChosenExternal] = useState<LogWorkHorse | null>(null);

    const shown = useMemo(() => {
        const q = filter.trim().toLowerCase();
        const list = q ? horses.filter((h) => h.name.toLowerCase().includes(q)) : horses;
        return list.slice(0, 60);
    }, [horses, filter]);

    const searchEverywhere = async () => {
        setSearchingAll(true);
        setExternal(null);
        const results = await searchWorkTargets(filter);
        setSearchingAll(false);
        setExternal(results.filter((r) => !horses.some((h) => h.id === r.id)));
    };

    const chosen =
        horses.find((h) => h.id === horseId) ??
        (chosenExternal?.id === horseId ? chosenExternal : null);
    const totalPhotos = buckets.reduce((n, b) => n + b.files.length, 0);

    const preview = (f: File) => {
        let u = previewUrls.current.get(f);
        if (!u) {
            u = URL.createObjectURL(f);
            previewUrls.current.set(f, u);
        }
        return u;
    };

    const switchDiscipline = (key: string) => {
        const preset = DISCIPLINE_PRESETS.find((d) => d.key === key);
        if (!preset) return;
        if (totalPhotos > 0 && !window.confirm("Switch the ladder? Photos already placed stay in their buckets; empty buckets are replaced.")) {
            return;
        }
        setDiscipline(key);
        setBuckets((prev) => [
            ...prev.filter((b) => b.files.length > 0),
            ...bucketsFromPreset(preset.stages),
        ]);
    };

    const patchBucket = (id: number, patch: Partial<Bucket>) =>
        setBuckets((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));

    const addFiles = (id: number, list: FileList | null) => {
        if (!list) return;
        setBuckets((prev) =>
            prev.map((b) =>
                b.id === id
                    ? { ...b, files: [...b.files, ...Array.from(list)].slice(0, MAX_IMAGES_PER_MOMENT) }
                    : b,
            ),
        );
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
            const moments: { images: { path: string; stage: string; caption?: string; claimedDate?: string | null }[] }[] = [];
            let uploadedCount = 0;
            const failed: string[] = [];
            for (const bucket of buckets) {
                if (bucket.files.length === 0) continue;
                const stage = bucket.label.trim().slice(0, MAX_STAGE_LABEL) || "In progress";
                const images: { path: string; stage: string; caption?: string; claimedDate?: string | null }[] = [];
                for (let i = 0; i < bucket.files.length; i++) {
                    setProgress(`Uploading “${stage}” photo ${i + 1} of ${bucket.files.length}…`);
                    const path = `${makingImagePrefix(horseId)}${Date.now()}_${bucket.id}_${i}.webp`;
                    // One unreadable file (a HEIC this browser can't
                    // decode, a stray PDF) skips THAT photo — it must
                    // never sink the whole record.
                    let blob: Blob;
                    try {
                        blob = await compressImage(bucket.files[i], tier);
                    } catch {
                        failed.push(`“${stage}” photo ${i + 1} (couldn't be read as an image — try JPG/PNG)`);
                        continue;
                    }
                    const { error: upErr } = await uploadImageWithRetry(supabase, "horse-images", path, blob);
                    if (upErr) {
                        failed.push(`“${stage}” photo ${i + 1}`);
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
                            const preset = DISCIPLINE_PRESETS.find((d) => d.key === discipline) ?? DISCIPLINE_PRESETS[0];
                            setBuckets(bucketsFromPreset(preset.stages));
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

                {filter.trim().length >= 2 && (
                    <div className="border-border-tan/30 mt-3 border-t border-dashed pt-3">
                        <button
                            type="button"
                            onClick={() => void searchEverywhere()}
                            disabled={searchingAll}
                            className="text-forest text-sm font-semibold hover:underline disabled:opacity-50"
                        >
                            {searchingAll ? "Searching…" : `🔎 Search all of MHH for “${filter.trim()}”`}
                        </button>
                        {external !== null && (
                            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                                {external.map((h) => (
                                    <button
                                        key={h.id}
                                        type="button"
                                        onClick={() => {
                                            setHorseId(h.id);
                                            setChosenExternal({
                                                id: h.id,
                                                name: h.name,
                                                thumbUrl: h.thumbUrl,
                                                ownedByMe: false,
                                            });
                                        }}
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
                                        <span className="min-w-0">
                                            <span className="block truncate">{h.name}</span>
                                            {h.ownerAlias && (
                                                <span className="text-muted-foreground block truncate text-xs">@{h.ownerAlias}</span>
                                            )}
                                        </span>
                                    </button>
                                ))}
                                {external.length === 0 && (
                                    <p className="text-muted-foreground col-span-full m-0 text-sm">
                                        Nothing visible by that name anywhere on MHH.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )}
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
                <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-foreground m-0 font-serif text-lg font-bold">3 · The making-of reel</h2>
                    <label className="text-sm font-medium">
                        <span className="text-muted-foreground mr-2 text-xs font-semibold tracking-wide uppercase">Ladder</span>
                        <select
                            value={discipline}
                            onChange={(e) => switchDiscipline(e.target.value)}
                            className="border-input bg-background rounded-md border px-2 py-1.5 text-sm"
                        >
                            {DISCIPLINE_PRESETS.map((d) => (
                                <option key={d.key} value={d.key}>{d.label}</option>
                            ))}
                        </select>
                    </label>
                </div>
                <p className="text-muted-foreground mt-0 mb-3 text-sm">
                    The ladder is a suggestion — rename any stage in your own words, add stages,
                    delete what you don&rsquo;t need. Each stage takes up to {MAX_IMAGES_PER_MOMENT} photos,
                    one caption, one date. Even two photos tell a story.
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                    {buckets.map((b) => (
                        <div key={b.id} className="border-input bg-background rounded-xl border p-3">
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={b.label}
                                    maxLength={MAX_STAGE_LABEL}
                                    onChange={(e) => patchBucket(b.id, { label: e.target.value })}
                                    className="text-foreground min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 py-0.5 font-serif text-sm font-bold hover:border-input focus:border-input focus:outline-none"
                                    aria-label="Stage name"
                                />
                                <label className="text-forest shrink-0 cursor-pointer text-sm font-semibold hover:underline">
                                    + photos
                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        className="hidden"
                                        onChange={(e) => {
                                            addFiles(b.id, e.target.files);
                                            e.target.value = "";
                                        }}
                                    />
                                </label>
                                <button
                                    type="button"
                                    aria-label={`Remove stage ${b.label}`}
                                    onClick={() => setBuckets((prev) => prev.filter((x) => x.id !== b.id))}
                                    className="text-muted-foreground hover:text-destructive shrink-0 px-1 text-sm"
                                >
                                    ×
                                </button>
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
                                                    onClick={() =>
                                                        patchBucket(b.id, { files: b.files.filter((_, k) => k !== i) })
                                                    }
                                                    aria-label="Remove photo"
                                                    className="bg-card border-input absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border text-xs leading-none"
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                    <div className="mt-2 flex flex-col gap-2">
                                        <textarea
                                            rows={2}
                                            maxLength={MAX_MOMENT_NOTES}
                                            value={b.caption}
                                            onChange={(e) => patchBucket(b.id, { caption: e.target.value })}
                                            placeholder="Notes for this stage — what happened, what you'd want the owner to know…"
                                            className="border-input bg-card rounded-md border px-2 py-1.5 text-sm"
                                            aria-label={`Notes for ${b.label || "this stage"}`}
                                        />
                                        <input
                                            type="date"
                                            value={b.date}
                                            onChange={(e) => patchBucket(b.id, { date: e.target.value })}
                                            className="border-input bg-card self-start rounded-md border px-2 py-1.5 text-sm"
                                            aria-label={`When ${b.label || "this stage"} happened`}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
                <button
                    type="button"
                    onClick={() =>
                        setBuckets((prev) => [
                            ...prev,
                            { id: nextBucketId++, label: "", files: [], caption: "", date: "" },
                        ])
                    }
                    className="text-forest mt-3 text-sm font-semibold hover:underline"
                >
                    + Add a stage of your own
                </button>
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
