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

    return (
        <form onSubmit={handleSubmit} className="show-entry-form" style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            {/* Guidance tip */}
            <div className="getting-started-tip" style={{ fontSize: "calc(0.8rem * var(--font-scale))", padding: "var(--space-sm) var(--space-md)" }}>
                💡 <strong>How it works:</strong> Select a horse, pick your best photo for the entry, add an optional caption, then submit.
                For best results, upload clear, well-lit photos (at least 800×600) to your horse&apos;s passport first.
            </div>

            {/* Horse selector */}
            <select
                className="form-input"
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

            {/* Class selection — only if structured classes exist */}
            {divisionGroups.size > 0 && (
                <select
                    className="form-input"
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

            {/* Photo Picker — shows after horse selected */}
            {selectedHorse && (
                <div>
                    <label className="form-label" style={{ marginBottom: "var(--space-xs)" }}>
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
                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
                                gap: "var(--space-xs)",
                            }}>
                                {horsePhotos.map((photo) => (
                                    <button
                                        key={photo.id}
                                        type="button"
                                        onClick={() => setSelectedPhoto(photo.storagePath)}
                                        style={{
                                            position: "relative",
                                            aspectRatio: "1",
                                            border: selectedPhoto === photo.storagePath
                                                ? "3px solid var(--color-accent-primary, #d4a574)"
                                                : "2px solid var(--color-border)",
                                            borderRadius: "var(--radius-md)",
                                            overflow: "hidden",
                                            cursor: "pointer",
                                            padding: 0,
                                            background: "var(--color-bg-secondary)",
                                            transition: "border-color 0.2s ease, transform 0.15s ease",
                                            transform: selectedPhoto === photo.storagePath ? "scale(1.05)" : "scale(1)",
                                        }}
                                        title={ANGLE_LABELS[photo.angleProfile] || photo.angleProfile}
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={photo.publicUrl}
                                            alt={ANGLE_LABELS[photo.angleProfile] || photo.angleProfile}
                                            style={{
                                                width: "100%",
                                                height: "100%",
                                                objectFit: "cover",
                                            }}
                                            loading="lazy"
                                        />
                                        {selectedPhoto === photo.storagePath && (
                                            <div style={{
                                                position: "absolute",
                                                top: 2,
                                                right: 2,
                                                background: "var(--color-accent-primary, #d4a574)",
                                                color: "white",
                                                borderRadius: "50%",
                                                width: 20,
                                                height: 20,
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontSize: "0.7rem",
                                                fontWeight: 700,
                                            }}>
                                                ✓
                                            </div>
                                        )}
                                        <div style={{
                                            position: "absolute",
                                            bottom: 0,
                                            left: 0,
                                            right: 0,
                                            background: "rgba(0,0,0,0.55)",
                                            color: "white",
                                            fontSize: "0.55rem",
                                            padding: "1px 4px",
                                            textAlign: "center",
                                            whiteSpace: "nowrap",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                        }}>
                                            {ANGLE_LABELS[photo.angleProfile] || photo.angleProfile}
                                        </div>
                                    </button>
                                ))}
                            </div>
                            <p style={{
                                fontSize: "calc(0.7rem * var(--font-scale))",
                                color: "var(--color-text-muted)",
                                marginTop: "var(--space-xs)",
                            }}>
                                Photos display at 4:3 in the show grid. Upload at least 800×600 for sharpness.
                            </p>
                        </>
                    )}
                </div>
            )}

            {/* Caption */}
            {selectedHorse && (
                <div>
                    <label className="form-label" htmlFor="entry-caption" style={{ marginBottom: "var(--space-xs)" }}>
                        ✏️ Entry Caption <span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}>(optional)</span>
                    </label>
                    <textarea
                        id="entry-caption"
                        className="form-textarea"
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        maxLength={280}
                        rows={2}
                        placeholder="Describe your entry, photography setup, or what makes this model special…"
                        style={{ fontSize: "calc(0.85rem * var(--font-scale))", resize: "vertical" }}
                    />
                    <span style={{
                        fontSize: "calc(0.7rem * var(--font-scale))",
                        color: caption.length > 250 ? "var(--color-error)" : "var(--color-text-muted)",
                        float: "right",
                    }}>
                        {caption.length}/280
                    </span>
                </div>
            )}

            <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={!selectedHorse || status === "submitting"}
            >
                {status === "submitting" ? "Entering…" : "🐴 Enter Show"}
            </button>
            {status === "success" && (
                <span className="comment-success">✅ Entered!</span>
            )}
            {status === "error" && errorMsg && (
                <span className="comment-error">{errorMsg}</span>
            )}
        </form>
    );
}
