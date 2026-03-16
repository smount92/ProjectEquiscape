"use client";

import { useState, useEffect } from "react";
import { enterShow } from "@/app/actions/shows";
import { createClient } from "@/lib/supabase/client";
import { getPublicImageUrl } from "@/lib/utils/storage";

interface ShowEntryFormProps {
    showId: string;
    userHorses: { id: string; name: string }[];
    classes?: { id: string; name: string; divisionName: string }[];
}

interface HorsePhoto {
    id: string;
    imageUrl: string;
    publicUrl: string;
    angleProfile: string;
    storagePath: string;
}

const ANGLE_LABELS: Record<string, string> = {
    Primary_Thumbnail: "Primary",
    Left_Side: "Left Side",
    Right_Side: "Off-Side",
    Front_Chest: "Front",
    Back_Hind: "Hind",
    Belly_Makers_Mark: "Belly/Mark",
    Detail_Face_Eyes: "Face",
    Detail_Ears: "Ears",
    Detail_Hooves: "Hooves",
    Flaw_Rub_Damage: "Flaws",
    extra_detail: "Detail",
    Other: "Other",
};

export default function ShowEntryForm({ showId, userHorses, classes }: ShowEntryFormProps) {
    const [selectedHorse, setSelectedHorse] = useState("");
    const [selectedClassId, setSelectedClassId] = useState("");
    const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null); // storage path
    const [caption, setCaption] = useState("");
    const [horsePhotos, setHorsePhotos] = useState<HorsePhoto[]>([]);
    const [loadingPhotos, setLoadingPhotos] = useState(false);
    const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");

    // Fetch horse photos when a horse is selected
    useEffect(() => {
        if (!selectedHorse) {
            setHorsePhotos([]);
            setSelectedPhoto(null);
            return;
        }

        setLoadingPhotos(true);
        const supabase = createClient();
        supabase
            .from("horse_images")
            .select("id, image_url, angle_profile")
            .eq("horse_id", selectedHorse)
            .order("uploaded_at")
            .then(({ data }) => {
                if (data && data.length > 0) {
                    const photos: HorsePhoto[] = (data as { id: string; image_url: string; angle_profile: string }[]).map(img => {
                        const urlParts = img.image_url.split("/horse-images/");
                        const storagePath = urlParts.length > 1 ? urlParts[1] : img.image_url;
                        return {
                            id: img.id,
                            imageUrl: img.image_url,
                            publicUrl: getPublicImageUrl(img.image_url),
                            angleProfile: img.angle_profile,
                            storagePath,
                        };
                    });
                    setHorsePhotos(photos);
                    // Auto-select the primary thumbnail
                    const primary = photos.find(p => p.angleProfile === "Primary_Thumbnail");
                    setSelectedPhoto(primary?.storagePath || photos[0].storagePath);
                } else {
                    setHorsePhotos([]);
                    setSelectedPhoto(null);
                }
                setLoadingPhotos(false);
            });
    }, [selectedHorse]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedHorse || status === "submitting") return;

        setStatus("submitting");
        setErrorMsg("");

        const result = await enterShow(
            showId,
            selectedHorse,
            selectedClassId || undefined,
            selectedPhoto || undefined,
            caption.trim() || undefined
        );
        if (result.success) {
            setStatus("success");
            setSelectedHorse("");
            setSelectedClassId("");
            setSelectedPhoto(null);
            setCaption("");
            setHorsePhotos([]);
            setTimeout(() => setStatus("idle"), 3000);
        } else {
            setErrorMsg(result.error || "Failed to enter show.");
            setStatus("error");
            setTimeout(() => setStatus("idle"), 3000);
        }
    };

    if (userHorses.length === 0) {
        return (
            <div className="show-entry-form-empty">
                <p style={{ color: "var(--color-text-muted)" }}>
                    You need at least one public horse to enter shows.
                </p>
            </div>
        );
    }

    // Group classes by division for optgroup rendering
    const divisionGroups: Map<string, { id: string; name: string }[]> = new Map();
    if (classes && classes.length > 0) {
        for (const c of classes) {
            const group = divisionGroups.get(c.divisionName) || [];
            group.push({ id: c.id, name: c.name });
            divisionGroups.set(c.divisionName, group);
        }
    }

    const selectedPhotoObj = horsePhotos.find(p => p.storagePath === selectedPhoto);

    return (
        <form onSubmit={handleSubmit} className="show-entry-form">
            {/* Guidance tip */}
            <div className="getting-started-tip show-entry-tip">
                💡 <strong>How it works:</strong> Select a horse, pick your best photo, add an optional caption, then submit.
                For best results, upload clear, well-lit photos (at least 800×600) to your horse&apos;s passport first.
            </div>

            {/* Top row: Horse + Class selectors side by side */}
            <div className="show-entry-selectors">
                <select
                    className="form-select"
                    value={selectedHorse}
                    onChange={(e) => {
                        setSelectedHorse(e.target.value);
                        setSelectedClassId("");
                    }}
                    required
                >
                    <option value="">Select a horse to enter…</option>
                    {userHorses.map((h) => (
                        <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                </select>

                {divisionGroups.size > 0 && (
                    <select
                        className="form-select"
                        value={selectedClassId}
                        onChange={(e) => setSelectedClassId(e.target.value)}
                    >
                        <option value="">Select a class (optional)…</option>
                        {Array.from(divisionGroups.entries()).map(([divName, items]) => (
                            <optgroup key={divName} label={divName}>
                                {items.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </optgroup>
                        ))}
                    </select>
                )}
            </div>

            {/* Two-column layout: Photo picker left, Caption + Submit right */}
            {selectedHorse && (
                <div className="show-entry-body">
                    {/* LEFT: Photo picker */}
                    <div className="show-entry-photos">
                        <label className="form-label">
                            📸 Choose Entry Photo
                        </label>
                        {loadingPhotos ? (
                            <p style={{ color: "var(--color-text-muted)", fontSize: "calc(0.8rem * var(--font-scale))" }}>
                                Loading photos…
                            </p>
                        ) : horsePhotos.length === 0 ? (
                            <p style={{ color: "var(--color-text-muted)", fontSize: "calc(0.8rem * var(--font-scale))" }}>
                                No photos found. Upload photos to your horse&apos;s passport first.
                            </p>
                        ) : (
                            <>
                                <div className="show-entry-photo-grid">
                                    {horsePhotos.map((photo) => (
                                        <button
                                            key={photo.id}
                                            type="button"
                                            onClick={() => setSelectedPhoto(photo.storagePath)}
                                            className={`show-entry-photo-btn ${selectedPhoto === photo.storagePath ? "selected" : ""}`}
                                            title={ANGLE_LABELS[photo.angleProfile] || photo.angleProfile}
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={photo.publicUrl}
                                                alt={ANGLE_LABELS[photo.angleProfile] || photo.angleProfile}
                                                loading="lazy"
                                            />
                                            {selectedPhoto === photo.storagePath && (
                                                <div className="show-entry-photo-check">✓</div>
                                            )}
                                            <div className="show-entry-photo-label">
                                                {ANGLE_LABELS[photo.angleProfile] || photo.angleProfile}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                                <p className="form-hint" style={{ marginTop: "var(--space-xs)" }}>
                                    Photos display at 4:3 in the show grid. 800×600 minimum recommended.
                                </p>
                            </>
                        )}
                    </div>

                    {/* RIGHT: Preview + Caption + Submit */}
                    <div className="show-entry-details">
                        {/* Preview of selected photo */}
                        {selectedPhotoObj && (
                            <div className="show-entry-preview">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={selectedPhotoObj.publicUrl}
                                    alt="Selected entry photo"
                                />
                            </div>
                        )}

                        {/* Caption */}
                        <div>
                            <label className="form-label" htmlFor="entry-caption">
                                ✏️ Entry Caption <span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}>(optional)</span>
                            </label>
                            <textarea
                                id="entry-caption"
                                className="form-textarea"
                                value={caption}
                                onChange={(e) => setCaption(e.target.value)}
                                maxLength={280}
                                rows={3}
                                placeholder="Describe your entry, photography setup, or what makes this model special…"
                            />
                            <span style={{
                                fontSize: "calc(0.7rem * var(--font-scale))",
                                color: caption.length > 250 ? "var(--color-error)" : "var(--color-text-muted)",
                                float: "right",
                            }}>
                                {caption.length}/280
                            </span>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={!selectedHorse || status === "submitting"}
                            style={{ marginTop: "var(--space-sm)" }}
                        >
                            {status === "submitting" ? "Entering…" : "🐴 Enter Show"}
                        </button>
                        {status === "success" && (
                            <span className="comment-success">✅ Entered!</span>
                        )}
                        {status === "error" && errorMsg && (
                            <span className="comment-error">{errorMsg}</span>
                        )}
                    </div>
                </div>
            )}

            {/* Show submit button when no horse selected yet */}
            {!selectedHorse && (
                <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={true}
                >
                    🐴 Enter Show
                </button>
            )}
        </form>
    );
}
