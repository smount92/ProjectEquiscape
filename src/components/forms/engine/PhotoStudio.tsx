"use client";

/**
 * The photo pipeline — once.
 *
 * This was the largest single duplication in the add-horse stack: slots,
 * flaws, extras, the crop queue, compression, upload-with-retry. The two
 * copies had already drifted, and the drift was a real bug — the edit form
 * accepted `image/*` with NO size check while the add form validated
 * properly and accepted HEIC. The add form's stricter behaviour is the one
 * that survives here, so the edit page gains a size cap as a side effect.
 *
 * Visually: each angle is a paper MOUNT with photo-corner tabs, and a
 * chosen shot seats into it like a print. The primary slot wears a brass
 * fore-edge, because it is the one the Digital Shelf will show.
 */

import { useRef, useState } from "react";
import ImageCropModal from "@/components/ImageCropModal";
import { Button } from "@/components/ui/button";
import { validateImageFile, createImagePreviewUrl, revokeImagePreviewUrl } from "@/lib/utils/imageCompression";
import type { GallerySlot } from "@/lib/config/assetFields";
import type { AngleProfile } from "@/lib/types/database";

export interface StudioImage {
    file: File;
    previewUrl: string;
}

export interface PhotoStudioValue {
    slots: Partial<Record<AngleProfile, StudioImage>>;
    extras: StudioImage[];
    flaws: StudioImage[];
}

export const EMPTY_STUDIO: PhotoStudioValue = { slots: {}, extras: [], flaws: [] };

/** Free for every tier, capped at 5 server-side. */
const FLAW_CAP = 5;
const EXTRA_CAP = 10;

/** The file types the ADD form accepted — HEIC included. */
const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif";

export default function PhotoStudio({
    gallerySlots,
    value,
    onChange,
    /** Extras are a Pro perk; the dropzone says so honestly rather than 404ing. */
    canAddExtras,
}: {
    gallerySlots: readonly GallerySlot[];
    value: PhotoStudioValue;
    onChange: (next: PhotoStudioValue) => void;
    canAddExtras: boolean;
}) {
    const [notice, setNotice] = useState<string | null>(null);

    // Crop queue — one modal, three sources.
    const [cropFile, setCropFile] = useState<File | null>(null);
    const [cropTarget, setCropTarget] = useState<
        | { kind: "slot"; angle: AngleProfile }
        | { kind: "extra"; replaceIndex: number | null }
        | { kind: "flaw"; replaceIndex: number | null }
        | null
    >(null);
    const [queue, setQueue] = useState<File[]>([]);

    const extraInput = useRef<HTMLInputElement>(null);
    const flawInput = useRef<HTMLInputElement>(null);

    // ── Helpers ───────────────────────────────────────────────────

    const accept = (files: File[]): File[] => {
        const good: File[] = [];
        for (const f of files) {
            const problem = validateImageFile(f);
            if (problem) {
                setNotice(problem);
                continue;
            }
            good.push(f);
        }
        if (good.length > 0) setNotice(null);
        return good;
    };

    const startQueue = (
        files: File[],
        target: { kind: "extra" | "flaw"; replaceIndex: number | null },
    ) => {
        const good = accept(files);
        if (good.length === 0) return;
        setCropTarget(target);
        setQueue(good.slice(1));
        setCropFile(good[0]);
    };

    /**
     * Advance the queue, or close the modal when it's drained.
     *
     * Reads `queue` from render rather than firing side effects inside a
     * state updater — the legacy version drove `setCropFile` from inside
     * `setExtraCropQueue`, which React is free to invoke twice.
     */
    const advance = () => {
        if (queue.length === 0) {
            setCropFile(null);
            setCropTarget(null);
            return;
        }
        const [next, ...rest] = queue;
        setQueue(rest);
        // A beat so the modal fully unmounts between crops.
        setTimeout(() => setCropFile(next), 30);
    };

    const handleCrop = (cropped: File) => {
        if (!cropTarget) return;
        const previewUrl = createImagePreviewUrl(cropped);

        if (cropTarget.kind === "slot") {
            const existing = value.slots[cropTarget.angle];
            if (existing) revokeImagePreviewUrl(existing.previewUrl);
            onChange({
                ...value,
                slots: { ...value.slots, [cropTarget.angle]: { file: cropped, previewUrl } },
            });
            setCropFile(null);
            setCropTarget(null);
            return;
        }

        const listKey = cropTarget.kind === "extra" ? "extras" : "flaws";
        const list = value[listKey];
        const idx = cropTarget.replaceIndex;

        if (idx !== null) {
            revokeImagePreviewUrl(list[idx]?.previewUrl);
            onChange({
                ...value,
                [listKey]: list.map((item, i) =>
                    i === idx ? { file: cropped, previewUrl } : item,
                ),
            });
            setCropFile(null);
            setCropTarget(null);
            return;
        }

        onChange({ ...value, [listKey]: [...list, { file: cropped, previewUrl }] });
        setCropFile(null);
        advance();
    };

    const removeSlot = (angle: AngleProfile) => {
        const existing = value.slots[angle];
        if (existing) revokeImagePreviewUrl(existing.previewUrl);
        const slots = { ...value.slots };
        delete slots[angle];
        onChange({ ...value, slots });
    };

    const removeFrom = (listKey: "extras" | "flaws", index: number) => {
        const list = value[listKey];
        revokeImagePreviewUrl(list[index]?.previewUrl);
        onChange({ ...value, [listKey]: list.filter((_, i) => i !== index) });
    };

    // ── Render ────────────────────────────────────────────────────

    return (
        <>
            <p className="mb-5 text-sm text-secondary-foreground">
                Click a mount to seat a photo in it. Everything is cropped and compressed
                here in your browser before it is saved. The{" "}
                <strong>primary shot</strong> is the one your Digital Shelf will show.
            </p>

            {notice && (
                <p
                    className="mb-4 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning"
                    role="alert"
                >
                    {notice}
                </p>
            )}

            {/* ── Angle mounts ── */}
            <div className="mb-8 grid grid-cols-2 gap-5 max-sm:grid-cols-1">
                {gallerySlots.map((slot) => {
                    const angle = slot.angle as AngleProfile;
                    const seated = value.slots[angle];
                    return (
                        <div key={slot.angle}>
                            <label
                                className="fe-mount block cursor-pointer"
                                data-filled={seated ? "true" : "false"}
                                data-primary={slot.primary ? "true" : "false"}
                            >
                                <span className="fe-mount-corners" aria-hidden="true" />
                                <input
                                    type="file"
                                    accept={ACCEPT}
                                    className="sr-only"
                                    aria-label={`Upload ${slot.label}`}
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        e.target.value = "";
                                        if (!file) return;
                                        const [good] = accept([file]);
                                        if (!good) return;
                                        setCropTarget({ kind: "slot", angle });
                                        setCropFile(good);
                                    }}
                                />
                                {seated ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={seated.previewUrl} alt={slot.label} />
                                ) : (
                                    <span className="absolute inset-0 grid place-items-center px-4 text-center">
                                        <span className="font-serif text-3xl opacity-45" aria-hidden="true">
                                            ⌗
                                        </span>
                                    </span>
                                )}
                            </label>

                            <div className="mt-2 flex items-baseline justify-between gap-2">
                                <span className="fe-mount-label">
                                    {slot.primary && (
                                        <span className="text-[var(--brass-dark)]" aria-hidden="true">
                                            ★{" "}
                                        </span>
                                    )}
                                    {slot.label}
                                </span>
                                {seated && (
                                    <button
                                        type="button"
                                        onClick={() => removeSlot(angle)}
                                        className="cursor-pointer text-xs text-muted-foreground underline hover:text-destructive"
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── Condition photos — free for every tier ── */}
            <ThumbStrip
                title="Condition photos"
                blurb="Rubs, chips, repairs. Showing them is what makes a listing trustworthy — this is never a paid feature."
                items={value.flaws}
                cap={FLAW_CAP}
                inputRef={flawInput}
                onPick={(files) => startQueue(files, { kind: "flaw", replaceIndex: null })}
                onRemove={(i) => removeFrom("flaws", i)}
                inputId="flaw-photos-input"
            />

            {/* ── Extra detail shots ── */}
            {canAddExtras ? (
                <ThumbStrip
                    title="Extra detail shots"
                    blurb="Anything else worth recording — the box, the certificate, a favourite angle."
                    items={value.extras}
                    cap={EXTRA_CAP}
                    inputRef={extraInput}
                    onPick={(files) => startQueue(files, { kind: "extra", replaceIndex: null })}
                    onRemove={(i) => removeFrom("extras", i)}
                    inputId="extra-photos-input"
                />
            ) : (
                <div className="rounded-lg border border-input bg-muted px-4 py-3 text-sm text-muted-foreground">
                    Extra detail shots are a Pro feature. Condition photos above are free
                    for everyone, always.
                </div>
            )}

            {cropFile && (
                <ImageCropModal
                    file={cropFile}
                    onCrop={handleCrop}
                    onCancel={() => {
                        setCropFile(null);
                        if (cropTarget?.kind === "slot") {
                            setCropTarget(null);
                            return;
                        }
                        advance();
                    }}
                />
            )}
        </>
    );
}

/** A row of seated thumbnails plus its dropzone. */
function ThumbStrip({
    title,
    blurb,
    items,
    cap,
    inputRef,
    inputId,
    onPick,
    onRemove,
}: {
    title: string;
    blurb: string;
    items: StudioImage[];
    cap: number;
    inputRef: React.RefObject<HTMLInputElement | null>;
    inputId: string;
    onPick: (files: File[]) => void;
    onRemove: (index: number) => void;
}) {
    const full = items.length >= cap;
    return (
        <div className="mb-6">
            <div className="fe-leaf-heading">
                <h3>{title}</h3>
            </div>
            <p className="-mt-3 mb-3 text-sm text-secondary-foreground">{blurb}</p>

            {items.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-3">
                    {items.map((item, i) => (
                        <div
                            key={item.previewUrl}
                            className="fe-mount relative h-[86px] w-[86px]"
                            data-filled="true"
                            style={{ aspectRatio: "auto" }}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={item.previewUrl} alt={`${title} ${i + 1}`} />
                            <button
                                type="button"
                                onClick={() => onRemove(i)}
                                aria-label={`Remove ${title} ${i + 1}`}
                                className="absolute top-1 right-1 z-[3] grid h-6 w-6 cursor-pointer place-items-center rounded-full border-0 bg-black/70 text-xs text-white"
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <input
                ref={inputRef}
                id={inputId}
                type="file"
                multiple
                accept={ACCEPT}
                className="sr-only"
                aria-label={`Upload ${title}`}
                onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    e.target.value = "";
                    if (files.length > 0) onPick(files.slice(0, cap - items.length));
                }}
            />
            <Button
                type="button"
                variant="outline"
                disabled={full}
                onClick={() => inputRef.current?.click()}
            >
                {full ? `${cap} is the limit` : `+ Add ${title.toLowerCase()}`}
            </Button>
            <span className="ml-3 text-xs text-muted-foreground">
                {items.length} of {cap}
            </span>
        </div>
    );
}
