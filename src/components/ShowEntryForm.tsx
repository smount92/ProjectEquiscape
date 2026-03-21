"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { enterShow } from "@/app/actions/shows";
import { createClient } from "@/lib/supabase/client";
import { getPublicImageUrl } from "@/lib/utils/storage";

interface ClassDetail {
    id: string;
    name: string;
    divisionName: string;
    allowedScales?: string[] | null;
    isNanQualifying?: boolean;
    maxEntries?: number | null;
    currentEntryCount?: number;
}

interface ShowEntryFormProps {
    showId: string;
    userHorses: { id: string; name: string }[];
    classes?: ClassDetail[];
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
    const [showPreview, setShowPreview] = useState(false);
    const [classSearch, setClassSearch] = useState("");
    const [horseScale, setHorseScale] = useState<string | null>(null);

    // Fetch horse photos + scale when a horse is selected
    useEffect(() => {
        if (!selectedHorse) {
            setHorsePhotos([]);
            setSelectedPhoto(null);
            setHorseScale(null);
            return;
        }

        setLoadingPhotos(true);
        const supabase = createClient();

        // Fetch photos
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
                    const primary = photos.find(p => p.angleProfile === "Primary_Thumbnail");
                    setSelectedPhoto(primary?.storagePath || photos[0].storagePath);
                } else {
                    setHorsePhotos([]);
                    setSelectedPhoto(null);
                }
                setLoadingPhotos(false);
            });

        // Fetch horse scale via catalog join
        supabase
            .from("user_horses")
            .select("catalog_items:catalog_id(scale)")
            .eq("id", selectedHorse)
            .single()
            .then(({ data }) => {
                const scale = (data as { catalog_items: { scale: string } | null } | null)?.catalog_items?.scale;
                setHorseScale(scale || null);
            });
    }, [selectedHorse]);

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!selectedHorse || status === "submitting") return;

        setStatus("submitting");
        setErrorMsg("");
        setShowPreview(false);

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
            setHorseScale(null);
            setTimeout(() => setStatus("idle"), 3000);
        } else {
            setErrorMsg(result.error || "Failed to enter show.");
            setStatus("error");
            setTimeout(() => setStatus("idle"), 3000);
        }
    };

    if (userHorses.length === 0) {
        return (
            <div className="flex flex-col gap-4-empty">
                <p className="text-muted" >
                    You need at least one public horse to enter shows.
                </p>
            </div>
        );
    }

    // Filter classes by search term
    const filteredClasses = classes?.filter(c =>
        c.name.toLowerCase().includes(classSearch.toLowerCase()) ||
        c.divisionName.toLowerCase().includes(classSearch.toLowerCase())
    ) ?? [];

    // Group filtered classes by division
    const divisionGroups: Map<string, ClassDetail[]> = new Map();
    for (const c of filteredClasses) {
        const group = divisionGroups.get(c.divisionName) || [];
        group.push(c);
        divisionGroups.set(c.divisionName, group);
    }

    const selectedPhotoObj = horsePhotos.find(p => p.storagePath === selectedPhoto);
    const selectedHorseName = userHorses.find(h => h.id === selectedHorse)?.name || "";
    const selectedClassName = classes?.find(c => c.id === selectedClassId)?.name || "";
    const canPreview = selectedHorse && selectedPhotoObj;

    // Preview modal rendered via portal
    const previewModal = showPreview && selectedPhotoObj && typeof document !== "undefined"
        ? createPortal(
            <div className="modal-overlay" onClick={() => setShowPreview(false)}>
                <div className="modal-content max-sm:max-w-full max-w-[480px] text-center" onClick={e => e.stopPropagation()}>
                    <div className="text-[calc(0.75rem*var(--font-scale))] text-muted text-center mb-4 uppercase tracking-[0.05em]">This is what judges & voters will see</div>
                    <div className="mb-2" style={{ textAlign: "center" }}>
                        <span className="font-bold text-[calc(1rem*var(--font-scale))]" >
                            🐴 {selectedHorseName}
                        </span>
                        {selectedClassName && (
                            <span className="text-forest ml-2 text-[calc(0.85rem*var(--font-scale))]" >
                                · {selectedClassName}
                            </span>
                        )}
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={selectedPhotoObj.publicUrl}
                        alt={selectedHorseName}
                        className="aspect-[4/3] object-cover rounded-md max-w-[400px] w-full mx-auto block shadow-lg"
                    />
                    {caption.trim() && (
                        <p className="italic text-ink-light mt-2 text-[calc(0.9rem*var(--font-scale))] leading-normal">
                            &ldquo;{caption.trim()}&rdquo;
                        </p>
                    )}
                    <div className="flex gap-2 justify-center mt-6 flex-wrap">
                        <button
                            className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm"
                            onClick={() => handleSubmit()}
                            disabled={status === "submitting"}
                        >
                            {status === "submitting" ? "Entering…" : "✅ Looks Good — Submit Entry"}
                        </button>
                        <button
                            className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge"
                            onClick={() => setShowPreview(false)}
                        >
                            ← Choose Different Photo
                        </button>
                    </div>
                </div>
            </div>,
            document.body
        )
        : null;

    return (
        <>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {/* Guidance tip */}
                <div className="py-4 px-6 rounded-lg bg-[rgba(44,85,69,0.08)] border border-[rgba(44,85,69,0.2)] text-sm leading-relaxed mt-4 text-[calc(0.8rem*var(--font-scale))] py-2 px-4">
                    💡 <strong>How it works:</strong> Select a horse, pick your best photo, add an optional caption, then submit.
                    For best results, upload clear, well-lit photos (at least 800×600) to your horse&apos;s passport first.
                </div>

                {/* Top row: Horse selector */}
                <div className="grid grid-cols-2 gap-4">
                    <select
                        className="form-select"
                        value={selectedHorse}
                        onChange={(e) => {
                            setSelectedHorse(e.target.value);
                            setSelectedClassId("");
                            setClassSearch("");
                        }}
                        required
                    >
                        <option value="">Select a horse to enter…</option>
                        {userHorses.map((h) => (
                            <option key={h.id} value={h.id}>{h.name}</option>
                        ))}
                    </select>
                </div>

                {/* Smart Class Browser */}
                {classes && classes.length > 0 && selectedHorse && (
                    <div className="mb-4">
                        <label className="block text-sm font-semibold text-ink mb-1">📋 Select Class</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Search classes…"
                            value={classSearch}
                            onChange={(e) => setClassSearch(e.target.value)}
                            style={{ marginBottom: "var(--space-xs)" }}
                        />
                        <div className="max-h-[240px] overflow-y-auto border border-edge rounded-md bg-elevated">
                            {/* No class option */}
                            <button
                                type="button"
                                className={`class-browser-item ${selectedClassId === "" ? "selected" : ""}`}
                                onClick={() => setSelectedClassId("")}
                            >
                                <span>General (no specific class)</span>
                            </button>
                            {Array.from(divisionGroups.entries()).map(([divName, items]) => (
                                <div key={divName}>
                                    <div className="max-h-[240px] overflow-y-auto border border-edge rounded-md bg-elevated-division">{divName}</div>
                                    {items.map((c) => {
                                        const scaleMatch = c.allowedScales && c.allowedScales.length > 0 && horseScale
                                            ? c.allowedScales.includes(horseScale)
                                            : null;
                                        return (
                                            <button
                                                key={c.id}
                                                type="button"
                                                className={`class-browser-item ${selectedClassId === c.id ? "selected" : ""}`}
                                                onClick={() => setSelectedClassId(c.id)}
                                            >
                                                <span className="max-h-[240px] overflow-y-auto border border-edge rounded-md bg-elevated-name">{c.name}</span>
                                                <span className="max-h-[240px] overflow-y-auto border border-edge rounded-md bg-elevated-meta">
                                                    {c.currentEntryCount !== undefined && (
                                                        <span className="text-[calc(0.7rem*var(--font-scale))] text-muted">
                                                            {c.currentEntryCount} {c.currentEntryCount === 1 ? "entry" : "entries"}
                                                        </span>
                                                    )}
                                                    {c.isNanQualifying && (
                                                        <span className="class-inline-flex items-center gap-[2px] py-[1px] px-[6px] rounded-full bg-[rgba(245, 158, 11, 0.15)] text-[#f59e0b] text-xs font-semibold whitespace-nowrap">NAN</span>
                                                    )}
                                                    {scaleMatch === true && <span className="text-[0.85em]" title="Scale matches!">✅</span>}
                                                    {scaleMatch === false && (
                                                        <span
                                                            className="class-scale-warn"
                                                            title={`Your horse is ${horseScale}, this class requires ${c.allowedScales!.join(", ")}`}
                                                        >⚠️</span>
                                                    )}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            ))}
                            {filteredClasses.length === 0 && classSearch && (
                                <div className="max-h-[240px] overflow-y-auto border border-edge rounded-md bg-elevated-empty">No classes match &ldquo;{classSearch}&rdquo;</div>
                            )}
                        </div>
                    </div>
                )}

                {/* Two-column layout: Photo picker left, Caption + Submit right */}
                {selectedHorse && (
                    <div className="show-entry-body max-sm:grid-cols-1">
                        {/* LEFT: Photo picker */}
                        <div className="flex flex-col gap-1">
                            <label className="block text-sm font-semibold text-ink mb-1">
                                📸 Choose Entry Photo
                            </label>
                            {loadingPhotos ? (
                                <p className="text-muted text-[calc(0.8rem*var(--font-scale))]" >
                                    Loading photos…
                                </p>
                            ) : horsePhotos.length === 0 ? (
                                <p className="text-muted text-[calc(0.8rem*var(--font-scale))]" >
                                    No photos found. Upload photos to your horse&apos;s passport first.
                                </p>
                            ) : (
                                <>
                                    <div className="grid grid-cols-[repeat(auto-fill, minmax(72px, 1fr))] gap-1">
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
                                                    <div className="absolute top-[2px] right-[2px] bg-[var(--color-accent-primary, #d4a574)] text-white rounded-full w-[18px] h-[18px] flex items-center justify-center text-[0.65rem] font-bold">✓</div>
                                                )}
                                                <div className="absolute bottom-0 left-0 right-0 bg-[rgba(0,0,0,0.55)] text-white text-[0.55rem] py-[1px] px-[4px] text-center whitespace-nowrap overflow-hidden text-ellipsis">
                                                    {ANGLE_LABELS[photo.angleProfile] || photo.angleProfile}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                    <p className="block mt-1 text-xs text-muted mt-1">
                                        Photos display at 4:3 in the show grid. 800×600 minimum recommended.
                                    </p>
                                </>
                            )}
                        </div>

                        {/* RIGHT: Preview + Caption + Submit */}
                        <div className="flex flex-col gap-4">
                            {/* Preview of selected photo */}
                            {selectedPhotoObj && (
                                <div className="w-full h-full object-cover">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={selectedPhotoObj.publicUrl}
                                        alt="Selected entry photo"
                                    />
                                </div>
                            )}

                            {/* Caption */}
                            <div>
                                <label className="block text-sm font-semibold text-ink mb-1" htmlFor="entry-caption">
                                    ✏️ Entry Caption <span className="text-muted font-normal" >(optional)</span>
                                </label>
                                <textarea
                                    id="entry-caption"
                                    className="block w-full min-h-[var(--inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none-min-h)] py-2 px-4 font-sans text-base text-ink bg-input border border-edge-input rounded-md outline-none transition-all duration-150"
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

                            {/* Submit + Preview buttons */}
                            <div className="gap-2 mt-2" style={{ display: "flex", flexWrap: "wrap" }}>
                                <button
                                    type="submit"
                                    className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm"
                                    disabled={!selectedHorse || status === "submitting"}
                                >
                                    {status === "submitting" ? "Entering…" : "🐴 Enter Show"}
                                </button>
                                {canPreview && (
                                    <button
                                        type="button"
                                        className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge"
                                        onClick={() => setShowPreview(true)}
                                    >
                                        👁 Preview
                                    </button>
                                )}
                            </div>
                            {status === "success" && (
                                <span className="bg-[rgba(34,197,94,0.1)] border border-[rgba(34,197,94,0.3)] text-[#22C55E] py-2 px-4 rounded-md text-[calc(0.85rem*var(--font-scale))]">✅ Entered!</span>
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
                        className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm"
                        disabled={true}
                    >
                        🐴 Enter Show
                    </button>
                )}
            </form>
            {previewModal}
        </>
    );
}
