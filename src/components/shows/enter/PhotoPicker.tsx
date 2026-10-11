"use client";

/**
 * The inline "Change photo" picker for one horse (online shows): its
 * stable photos as a grid, plus "Upload new" — the exact stable
 * pipeline the old entry dialog used (validate → tier-aware compress,
 * watermark pref honoured → Storage upload with retry →
 * addShowPhotoToHorse). An upload joins the grid and is picked.
 */

import { useRef, useState } from "react";
import Link from "next/link";

import { addShowPhotoToHorse } from "@/app/actions/entry-photo";
import { getProfile } from "@/app/actions/settings";
import { entitledTier } from "@/lib/entitlement/clock";
import { createClient } from "@/lib/supabase/client";
import {
    compressImage,
    compressImageWithWatermark,
    validateImageFile,
    type UserTier,
} from "@/lib/utils/imageCompression";
import { uploadImageWithRetry } from "@/lib/utils/uploadWithRetry";
import { Button } from "@/components/ui/button";
import type { EntryPhoto } from "./shared";

interface PhotoPickerProps {
    horseId: string;
    horseName: string;
    photos: EntryPhoto[] | undefined;
    loading: boolean;
    selectedPhotoId: string | null;
    onPick: (photoId: string) => void;
    onUploaded: (photo: EntryPhoto) => void;
    onRefresh: () => void;
    onClose: () => void;
}

export default function PhotoPicker({
    horseId,
    horseName,
    photos,
    loading,
    selectedPhotoId,
    onPick,
    onUploaded,
    onRefresh,
    onClose,
}: PhotoPickerProps) {
    const [uploading, setUploading] = useState(false);
    const [note, setNote] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    /** Watermark pref, fetched once per picker on first upload. */
    const profileRef = useRef<{ watermarkPhotos: boolean; aliasName: string; watermarkText: string } | null>(
        null,
    );

    const upload = async (file: File) => {
        if (uploading) return;
        const invalid = validateImageFile(file);
        if (invalid) {
            setNote(invalid);
            return;
        }
        setUploading(true);
        setNote(null);
        try {
            const supabase = createClient();
            const {
                data: { user },
            } = await supabase.auth.getUser();
            // entitledTier applies the clock: an expired term does not
            // buy the Pro compression path.
            const tier = entitledTier(user?.app_metadata) as UserTier;
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
                    ? await compressImageWithWatermark(file, prefs.aliasName, tier, prefs.watermarkText)
                    : await compressImage(file, tier);

            const path = `horses/${horseId}/show_photo_${Date.now()}.webp`;
            const { error: uploadError } = await uploadImageWithRetry(supabase, "horse-images", path, compressed);
            if (uploadError) {
                setNote("The upload didn't go through — check your connection and try again.");
                setUploading(false);
                return;
            }
            const result = await addShowPhotoToHorse({ horseId, path });
            if (!result.success) {
                setNote(result.error);
                setUploading(false);
                return;
            }
            onUploaded({
                id: result.photo.id,
                publicUrl: result.photo.publicUrl,
                angleProfile: result.photo.angleProfile,
            });
        } catch {
            setNote("Something went wrong with that photo — try again.");
        }
        setUploading(false);
    };

    return (
        <div
            className="flex flex-col gap-2 rounded-lg border border-input bg-muted/40 p-3"
            data-testid={`photo-picker-${horseId}`}
        >
            <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">Judged photo for {horseName}</span>
                <Button variant="ghost" size="sm" onClick={onClose}>
                    Done
                </Button>
            </div>
            <p className="m-0 text-xs text-muted-foreground">
                Sharp side profile, plain background, whole horse in frame. A watermark shows your name —
                in a blind-judged show the judge sees it too.
            </p>
            {loading && !photos ? (
                <p className="m-0 text-sm text-muted-foreground">Loading photos…</p>
            ) : !photos || photos.length === 0 ? (
                <p className="m-0 text-sm text-muted-foreground">
                    No photos yet — upload one here, or add photos on{" "}
                    <Link href={`/stable/${horseId}`} target="_blank" className="underline">
                        its stable page
                    </Link>{" "}
                    and refresh.
                </p>
            ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-1">
                    {photos.map((photo) => (
                        <button
                            key={photo.id}
                            type="button"
                            onClick={() => onPick(photo.id)}
                            aria-pressed={selectedPhotoId === photo.id}
                            aria-label={`Use ${photo.angleProfile.replace(/_/g, " ")} photo`}
                            className={`relative aspect-square cursor-pointer overflow-hidden rounded-md border-2 ${
                                selectedPhotoId === photo.id ? "border-forest ring-2 ring-forest" : "border-input"
                            }`}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={photo.publicUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                        </button>
                    ))}
                </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
                    {uploading ? "Uploading…" : "Upload new"}
                </Button>
                <Button variant="ghost" size="sm" onClick={onRefresh}>
                    Refresh photos
                </Button>
            </div>
            <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                aria-label={`Upload a new entry photo for ${horseName}`}
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void upload(file);
                    e.target.value = "";
                }}
            />
            {note && (
                <p role="alert" className="m-0 text-sm font-semibold text-destructive">
                    {note}
                </p>
            )}
            <p className="m-0 text-xs text-muted-foreground">
                Uploads are free on every tier (up to 5 show photos per horse) and join this horse&rsquo;s
                stable photos.
            </p>
        </div>
    );
}
