"use client";

/**
 * Phase D — the entry dialog. Class-first: the classlist picks the
 * class, this dialog picks the rest.
 *
 *   1. Pick one of YOUR public horses. Small stables (≤12) keep the
 *      original card grid; bigger stables get a search-first compact
 *      list (rows scale to 50–500 horses where cards can't), with
 *      horses that look compatible with the class's scale/finish
 *      limits floated to the top (lib/shows/horsePicker — SOFT
 *      ordering: a mismatch is a hint, nothing is hidden/disabled).
 *   2. Online shows only: pick the entry photo from that horse's
 *      existing photos (117: photo_id → horse_images), or upload a
 *      new one right here (Batch 3 — the v1 "no upload at entry"
 *      scoping was reversed by the owner). Uploads reuse the stable
 *      photo pipeline (client compress → Storage → metadata action)
 *      and land in the horse's stable photos too — free for every
 *      tier, capped at 5 show photos per horse.
 *   3. Optional handler ("someone else will show this horse") —
 *      resolved by alias via findUserByAlias (proxy showing).
 *
 * All rule refusals from enterClass are surfaced VERBATIM as a
 * list — the server (entryRules.validateEntry + RLS) is the only
 * authority; this dialog never pre-judges eligibility.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { enterClass, findUserByAlias } from "@/app/actions/shows-v2";
import { addShowPhotoToHorse } from "@/app/actions/entry-photo";
import { getProfile } from "@/app/actions/settings";
import { filterAndRankHorses } from "@/lib/shows/horsePicker";
import type { EntrantHorse } from "@/lib/shows/public";
import type { ShowMode } from "@/lib/shows/types";
import { createClient } from "@/lib/supabase/client";
import { entitledTier } from "@/lib/entitlement/clock";
import { getPublicImageUrl } from "@/lib/utils/storage";
import {
    compressImage,
    compressImageWithWatermark,
    validateImageFile,
    type UserTier,
} from "@/lib/utils/imageCompression";
import { uploadImageWithRetry } from "@/lib/utils/uploadWithRetry";
import { track } from "@/lib/analytics";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface EntryPhoto {
    id: string;
    publicUrl: string;
    angleProfile: string;
}

export interface EnterableClass {
    id: string;
    name: string;
    classNumber: string | null;
    /**
     * Soft-ordering context — optional so lighter callers still
     * compile; ConsoleClass (what the show page passes) carries all
     * three. Used ONLY to order the picker and hint at mismatches;
     * the server's validateEntry stays the sole authority.
     */
    maxPerEntrant?: number | null;
    allowedScales?: string[] | null;
    allowedFinishes?: string[] | null;
}

/** Grid cards stay comfortable up to a dozen horses; past that the
 *  picker switches to the search-first compact list. */
const GRID_MAX_HORSES = 12;

/** Desktop-ish pointer → safe to auto-focus the search box without
 *  popping a mobile keyboard over the list. */
function hasFinePointer(): boolean {
    return (
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(pointer: fine)").matches
    );
}

interface EnterClassDialogProps {
    showId: string;
    cls: EnterableClass;
    mode: ShowMode;
    horses: EntrantHorse[];
    /** Refetch the enterable-horse list when it's empty/stale. */
    onRefreshHorses?: () => Promise<void> | void;
    onClose: () => void;
    /** Fires after a successful entry so the page can re-flow —
     *  carries the horse name so the parent can toast it. */
    onEntered: (entered: { horseName: string }) => void;
}

export default function EnterClassDialog({
    showId,
    cls,
    mode,
    horses,
    onRefreshHorses,
    onClose,
    onEntered,
}: EnterClassDialogProps) {
    const [horse, setHorse] = useState<EntrantHorse | null>(null);
    const [refreshingHorses, setRefreshingHorses] = useState(false);

    // Picker search — deliberately NOT reset when a horse is picked,
    // so "← Choose a different horse" returns to the same filtered
    // view the user left.
    const [horseQuery, setHorseQuery] = useState("");
    const searchInputRef = useRef<HTMLInputElement>(null);
    const compactPicker = horses.length > GRID_MAX_HORSES;
    /** Name-filtered, likely-fits-first (soft), server order within
     *  each group. Applied to BOTH layouts so small stables get the
     *  same smart ordering. */
    const rankedHorses = useMemo(
        () => filterAndRankHorses(horses, cls, horseQuery),
        [horses, cls, horseQuery],
    );
    const anyMismatchListed = rankedHorses.some((p) => !p.fitsClass);
    /** The class's limits, spelled out visibly (never a tooltip):
     *  "Class allows: Traditional (1:9) · OF". Empty = no limits. */
    const classAllowsText = [
        ...(cls.allowedScales ?? []),
        ...(cls.allowedFinishes ?? []),
    ].join(" · ");

    // Focus the search box whenever the picker (re)appears — desktop
    // only; on touch the keyboard would cover half the list.
    useEffect(() => {
        if (horse === null && compactPicker && hasFinePointer()) {
            searchInputRef.current?.focus();
        }
    }, [horse, compactPicker]);

    // Online shows: the judged object is a photo of the horse.
    const [photos, setPhotos] = useState<EntryPhoto[]>([]);
    const [loadingPhotos, setLoadingPhotos] = useState(false);
    const [photoId, setPhotoId] = useState<string | null>(null);

    // In-dialog upload (Batch 3) — never touches horse/class state,
    // so a failed or slow upload can't lose where the user was.
    const [uploading, setUploading] = useState(false);
    const [uploadNote, setUploadNote] = useState<string | null>(null);
    const uploadInputRef = useRef<HTMLInputElement>(null);
    /** Watermark pref, fetched once per dialog on first upload. */
    const profileRef = useRef<{
        watermarkPhotos: boolean;
        aliasName: string;
        watermarkText: string;
    } | null>(null);

    // Proxy handler (owner ≠ handler is first-class and legal).
    const [handlerQuery, setHandlerQuery] = useState("");
    const [handler, setHandler] = useState<{ id: string; alias: string } | null>(null);
    const [handlerNote, setHandlerNote] = useState<string | null>(null);
    const [lookingUp, setLookingUp] = useState(false);

    const [submitting, setSubmitting] = useState(false);
    const [violations, setViolations] = useState<string[]>([]);

    // Stale-response guard for the photo fetch (fast horse switching).
    const photoFetchSeq = useRef(0);

    /** Online shows only: (re)fetch a horse's existing photos (same
     *  client-side pattern as the legacy entry form / passport pages
     *  — entries point at stable photos, no upload). Shared by
     *  selectHorse and the "Refresh photos" retry button below. */
    const fetchPhotos = (h: EntrantHorse) => {
        if (mode !== "online") return;

        const seq = ++photoFetchSeq.current;
        setLoadingPhotos(true);
        const supabase = createClient();
        supabase
            .from("horse_images")
            .select("id, image_url, angle_profile")
            .eq("horse_id", h.id)
            .order("uploaded_at")
            .then(({ data }) => {
                if (seq !== photoFetchSeq.current) return;
                const rows = (data ?? []) as {
                    id: string;
                    image_url: string;
                    angle_profile: string;
                }[];
                const mapped = rows.map((r) => ({
                    id: r.id,
                    publicUrl: getPublicImageUrl(r.image_url),
                    angleProfile: r.angle_profile,
                }));
                setPhotos(mapped);
                const primary = mapped.find((p) => p.angleProfile === "Primary_Thumbnail");
                setPhotoId(primary?.id ?? mapped[0]?.id ?? null);
                setLoadingPhotos(false);
            });
    };

    /** Pick a horse; online shows then fetch its existing photos. */
    const selectHorse = (h: EntrantHorse) => {
        setHorse(h);
        setViolations([]);
        setPhotos([]);
        setPhotoId(null);
        setUploadNote(null);
        fetchPhotos(h);
    };

    /**
     * Upload a brand-new entry photo without leaving the dialog:
     * the exact stable pipeline (validate → tier-aware compress →
     * direct-to-Storage upload with retry → metadata action), then
     * the new photo joins the grid optimistically and is selected.
     * "Refresh photos" stays available as the fallback path.
     */
    const handleUploadFile = async (file: File) => {
        if (!horse || uploading) return;
        const invalid = validateImageFile(file);
        if (invalid) {
            setUploadNote(invalid);
            return;
        }
        setUploading(true);
        setUploadNote(null);
        try {
            const supabase = createClient();
            const {
                data: { user },
            } = await supabase.auth.getUser();
            // entitledTier applies the clock, so an expired term does
            // not buy the Pro watermark path.
            const tier = entitledTier(user?.app_metadata) as UserTier;

            // Honor the account watermark preference — entry photos are
            // public gallery photos too. Fetched once per dialog.
            if (profileRef.current === null) {
                const profile = await getProfile().catch(() => null);
                profileRef.current = profile
                    ? {
                          watermarkPhotos: profile.watermarkPhotos,
                          aliasName: profile.aliasName,
                          watermarkText: profile.watermarkText,
                      }
                    : { watermarkPhotos: false, aliasName: "", watermarkText: "" };
            }
            const prefs = profileRef.current;

            const compressed =
                prefs.watermarkPhotos && prefs.aliasName
                    ? await compressImageWithWatermark(
                          file,
                          prefs.aliasName,
                          tier,
                          prefs.watermarkText,
                      )
                    : await compressImage(file, tier);

            const path = `horses/${horse.id}/show_photo_${Date.now()}.webp`;
            const { error: uploadError } = await uploadImageWithRetry(
                supabase,
                "horse-images",
                path,
                compressed,
            );
            if (uploadError) {
                setUploadNote("The upload didn't go through — check your connection and try again.");
                setUploading(false);
                return;
            }

            const result = await addShowPhotoToHorse({ horseId: horse.id, path });
            if (!result.success) {
                setUploadNote(result.error);
                setUploading(false);
                return;
            }

            // Optimistic: straight into the grid, auto-selected.
            setPhotos((prev) => [
                ...prev,
                {
                    id: result.photo.id,
                    publicUrl: result.photo.publicUrl,
                    angleProfile: result.photo.angleProfile,
                },
            ]);
            setPhotoId(result.photo.id);
        } catch {
            setUploadNote("Something went wrong with that photo — try again.");
        }
        setUploading(false);
    };

    const lookupHandler = async () => {
        setLookingUp(true);
        setHandlerNote(null);
        const result = await findUserByAlias({ alias: handlerQuery });
        setLookingUp(false);
        if (!result.success) {
            setHandlerNote(result.error);
            return;
        }
        if (!result.user) {
            setHandlerNote("No user found with that alias.");
            return;
        }
        setHandler(result.user);
        setHandlerNote(null);
    };

    const handleSubmit = async () => {
        if (!horse || submitting) return;
        setSubmitting(true);
        setViolations([]);
        const result = await enterClass({
            classId: cls.id,
            horseId: horse.id,
            photoId: mode === "online" ? photoId : null,
            handlerId: handler?.id ?? null,
        });
        setSubmitting(false);
        if (result.success) {
            track("show_entry", { show_id: showId });
            onEntered({ horseName: horse.name });
            onClose();
        } else {
            setViolations(result.violations ?? [result.error]);
        }
    };

    const classLabel = cls.classNumber ? `${cls.classNumber} · ${cls.name}` : cls.name;
    const needsPhoto = mode === "online";
    const canSubmit = !!horse && (!needsPhoto || !!photoId) && !submitting;

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent
                // Big stables get the roomier box while picking; the
                // photo/handler step keeps its familiar width.
                className={
                    !horse && compactPicker ? "sm:max-w-2xl" : "sm:max-w-[560px]"
                }
                // Radix focuses the first tabbable on open — that's the
                // search box now, which is exactly right on desktop but
                // pops the keyboard over the list on touch. Let the
                // effect above decide instead.
                onOpenAutoFocus={(e) => {
                    if (!hasFinePointer()) e.preventDefault();
                }}
            >
                <DialogHeader>
                    <DialogTitle>Enter {classLabel}</DialogTitle>
                    <DialogDescription>
                        {horse
                            ? needsPhoto
                                ? `Pick the entry photo for ${horse.name}.`
                                : `Confirm the entry for ${horse.name}.`
                            : "Pick one of your horses for this class."}
                    </DialogDescription>
                </DialogHeader>

                {!horse ? (
                    horses.length === 0 ? (
                        <div className="flex flex-col items-start gap-2">
                            <p className="text-sm text-muted-foreground">
                                You need at least one public horse to enter — add horses to your
                                stable (and set them public) first.
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                                <Button variant="outline" size="sm" asChild>
                                    <Link
                                        href={`/add-horse?returnTo=${encodeURIComponent(`/shows/${showId}`)}`}
                                        target="_blank"
                                    >
                                        Add a horse →
                                    </Link>
                                </Button>
                                {onRefreshHorses && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={refreshingHorses}
                                        onClick={async () => {
                                            setRefreshingHorses(true);
                                            try {
                                                await onRefreshHorses();
                                            } finally {
                                                setRefreshingHorses(false);
                                            }
                                        }}
                                    >
                                        {refreshingHorses ? "Refreshing…" : "Refresh horses"}
                                    </Button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex min-w-0 flex-col gap-2" data-testid="horse-picker">
                            {compactPicker && (
                                <>
                                    <Input
                                        ref={searchInputRef}
                                        type="search"
                                        value={horseQuery}
                                        onChange={(e) => setHorseQuery(e.target.value)}
                                        onKeyDown={(e) => {
                                            // Exactly one match → Enter picks it.
                                            // Picking is never submitting: the
                                            // confirm step (and the server) still
                                            // stand between here and an entry.
                                            if (e.key === "Enter" && rankedHorses.length === 1) {
                                                e.preventDefault();
                                                selectHorse(rankedHorses[0].horse);
                                            }
                                        }}
                                        placeholder="Search your horses by name…"
                                        aria-label="Search your horses by name"
                                        className="h-9"
                                    />
                                    <p
                                        className="m-0 text-xs text-muted-foreground"
                                        aria-live="polite"
                                        data-testid="horse-picker-count"
                                    >
                                        {horseQuery.trim()
                                            ? `${rankedHorses.length} of ${horses.length} horses`
                                            : `All ${horses.length} horses`}
                                    </p>
                                </>
                            )}

                            {rankedHorses.length === 0 ? (
                                <div className="flex flex-col items-start gap-2 py-4">
                                    <p className="text-sm text-muted-foreground">
                                        No horses named &ldquo;{horseQuery.trim()}&rdquo; in your
                                        stable.
                                    </p>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setHorseQuery("")}
                                    >
                                        Clear search
                                    </Button>
                                </div>
                            ) : compactPicker ? (
                                <ul
                                    className="m-0 flex max-h-[min(60dvh,560px)] list-none flex-col divide-y divide-input overflow-y-auto rounded-lg border border-input p-0"
                                    data-testid="horse-picker-list"
                                >
                                    {rankedHorses.map(({ horse: h, fitsClass }) => (
                                        <li key={h.id}>
                                            <button
                                                type="button"
                                                className="flex min-h-11 w-full cursor-pointer items-center gap-3 bg-card px-3 py-2 text-left transition-colors hover:bg-muted focus-visible:bg-muted"
                                                onClick={() => selectHorse(h)}
                                            >
                                                {h.thumbnailUrl ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={h.thumbnailUrl}
                                                        alt=""
                                                        className="h-10 w-10 shrink-0 rounded-md object-cover"
                                                        loading="lazy"
                                                    />
                                                ) : (
                                                    <span
                                                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-lg"
                                                        aria-hidden="true"
                                                    >
                                                        🐴
                                                    </span>
                                                )}
                                                <span className="flex min-w-0 flex-1 flex-col">
                                                    <span className="truncate text-sm font-medium text-foreground">
                                                        {h.name}
                                                    </span>
                                                    {(h.scale || h.finish) && (
                                                        <span className="truncate text-xs text-muted-foreground">
                                                            {[h.scale, h.finish]
                                                                .filter(Boolean)
                                                                .join(" · ")}
                                                        </span>
                                                    )}
                                                </span>
                                                {!fitsClass && (
                                                    <span className="shrink-0 text-[0.65rem] whitespace-nowrap text-muted-foreground italic">
                                                        may not fit
                                                    </span>
                                                )}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="grid max-h-[400px] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
                                    {rankedHorses.map(({ horse: h, fitsClass }) => (
                                        <button
                                            key={h.id}
                                            type="button"
                                            className="flex min-h-11 cursor-pointer flex-col items-center gap-1 rounded-lg border border-input bg-card p-2 transition-all hover:ring-2 hover:ring-forest"
                                            onClick={() => selectHorse(h)}
                                        >
                                            {h.thumbnailUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={h.thumbnailUrl}
                                                    alt={h.name}
                                                    className="aspect-square w-full rounded-md object-cover"
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <div
                                                    className="flex aspect-square w-full items-center justify-center rounded-md bg-muted text-3xl"
                                                    aria-hidden="true"
                                                >
                                                    🐴
                                                </div>
                                            )}
                                            <span className="max-w-full truncate text-xs font-medium text-foreground">
                                                {h.name}
                                            </span>
                                            {(h.scale || h.finish) && (
                                                <span className="text-[0.65rem] text-muted-foreground">
                                                    {[h.scale, h.finish].filter(Boolean).join(" · ")}
                                                </span>
                                            )}
                                            {!fitsClass && (
                                                <span className="text-[0.65rem] text-muted-foreground italic">
                                                    may not fit
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {anyMismatchListed && (
                                <p className="m-0 text-[0.7rem] text-muted-foreground">
                                    {classAllowsText && (
                                        <span className="font-semibold">
                                            Class allows: {classAllowsText}.{" "}
                                        </span>
                                    )}
                                    Horses that may not fit those limits are listed last — you can
                                    still pick any horse; the host&rsquo;s rules decide at entry.
                                </p>
                            )}
                        </div>
                    )
                ) : (
                    <div className="flex flex-col gap-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="self-start"
                            onClick={() => {
                                setHorse(null);
                                setViolations([]);
                            }}
                        >
                            ← Choose a different horse
                        </Button>

                        {needsPhoto && (
                            <div>
                                <span className="mb-1 block text-sm font-semibold text-foreground">
                                    Entry photo
                                </span>
                                {/* Show-photo tips — the judge sees the photo at full size. */}
                                <ul className="mb-2 flex list-none flex-col gap-0.5 p-0 text-xs text-muted-foreground">
                                    <li>· Sharp side profile — judges see this photo at full size.</li>
                                    <li>· Plain, discipline-appropriate background.</li>
                                    <li>· Whole horse in frame, level with the camera.</li>
                                    <li>
                                        · A watermark shows your name — in a blind-judged show,
                                        the judge will see it too. Prefer an unwatermarked photo.
                                    </li>
                                </ul>
                                {loadingPhotos ? (
                                    <p className="text-sm text-muted-foreground">Loading photos…</p>
                                ) : photos.length === 0 ? (
                                    <div className="flex flex-col items-start gap-2">
                                        <p className="text-sm text-muted-foreground">
                                            This horse has no photos yet — upload one here, or add
                                            photos to its passport in your stable and come back.
                                        </p>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={uploading}
                                                onClick={() => uploadInputRef.current?.click()}
                                            >
                                                {uploading ? "Uploading…" : "Upload a new photo"}
                                            </Button>
                                            <Button variant="outline" size="sm" asChild>
                                                <Link href={`/stable/${horse.id}`} target="_blank">
                                                    Open this horse&rsquo;s stable page →
                                                </Link>
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => fetchPhotos(horse)}
                                            >
                                                Refresh photos
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div
                                            className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-1"
                                            data-testid="photo-picker"
                                        >
                                            {photos.map((photo) => (
                                                <button
                                                    key={photo.id}
                                                    type="button"
                                                    onClick={() => setPhotoId(photo.id)}
                                                    aria-pressed={photoId === photo.id}
                                                    className={`relative aspect-square cursor-pointer overflow-hidden rounded-md border-2 transition-all ${
                                                        photoId === photo.id
                                                            ? "border-forest ring-2 ring-forest"
                                                            : "border-input"
                                                    }`}
                                                >
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img
                                                        src={photo.publicUrl}
                                                        alt={photo.angleProfile.replace(/_/g, " ")}
                                                        className="h-full w-full object-cover"
                                                        loading="lazy"
                                                    />
                                                </button>
                                            ))}
                                        </div>
                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={uploading}
                                                onClick={() => uploadInputRef.current?.click()}
                                            >
                                                {uploading ? "Uploading…" : "Upload a new photo"}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => fetchPhotos(horse)}
                                            >
                                                Refresh photos
                                            </Button>
                                        </div>
                                    </>
                                )}
                                <input
                                    ref={uploadInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/gif"
                                    className="hidden"
                                    aria-label="Upload a new entry photo"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) void handleUploadFile(file);
                                        e.target.value = "";
                                    }}
                                />
                                {uploadNote && (
                                    <p
                                        role="alert"
                                        className="mt-1 text-sm font-semibold text-destructive"
                                    >
                                        {uploadNote}
                                    </p>
                                )}
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Uploads are free on every tier (up to 5 show photos per horse)
                                    and join this horse&rsquo;s stable photos.
                                </p>
                            </div>
                        )}

                        {/* Proxy handler — owner ≠ handler is first-class */}
                        <div>
                            <span className="mb-1 block text-sm font-semibold text-foreground">
                                Handler{" "}
                                <span className="font-normal text-muted-foreground">
                                    (optional — someone else will show this horse)
                                </span>
                            </span>
                            {handler ? (
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="secondary">@{handler.alias} will handle</Badge>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setHandler(null);
                                            setHandlerQuery("");
                                        }}
                                    >
                                        Remove
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex flex-wrap items-center gap-2">
                                    <Input
                                        value={handlerQuery}
                                        onChange={(e) => setHandlerQuery(e.target.value)}
                                        placeholder="Their alias, e.g. @quarterflash"
                                        className="h-9 w-56 max-w-full"
                                        maxLength={60}
                                        aria-label="Handler alias"
                                    />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={lookingUp || !handlerQuery.trim()}
                                        onClick={lookupHandler}
                                    >
                                        {lookingUp ? "Looking up…" : "Look up"}
                                    </Button>
                                </div>
                            )}
                            {handlerNote && (
                                <p className="mt-1 text-sm text-muted-foreground">{handlerNote}</p>
                            )}
                        </div>

                        {violations.length > 0 && (
                            <ul
                                role="alert"
                                className="flex list-disc flex-col gap-1 pl-5 text-sm font-semibold text-destructive"
                                data-testid="entry-violations"
                            >
                                {violations.map((violation) => (
                                    <li key={violation}>{violation}</li>
                                ))}
                            </ul>
                        )}

                        <DialogFooter>
                            <Button variant="outline" onClick={onClose} disabled={submitting}>
                                Cancel
                            </Button>
                            <Button onClick={handleSubmit} disabled={!canSubmit}>
                                {submitting ? "Entering…" : `Enter ${horse.name}`}
                            </Button>
                        </DialogFooter>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
