"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { addEventMedia, deleteEventMedia } from "@/app/actions/posts";
import { createClient } from "@/lib/supabase/client";
import { safeUUID } from "@/lib/utils/uuid";

interface EventPhoto {
    id: string;
    imageUrl: string;
    caption: string | null;
    createdAt: string;
    userId: string;
    userAlias: string;
}

interface Props {
    eventId: string;
    currentUserId: string;
    initialPhotos: EventPhoto[];
}

export default function EventPhotoGallery({ eventId, currentUserId, initialPhotos }: Props) {
    const router = useRouter();
    const [photos, setPhotos] = useState(initialPhotos);
    const [isPending, startTransition] = useTransition();
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file
        if (!file.type.startsWith("image/")) {
            setError("Only image files are allowed.");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setError("Image must be under 5MB.");
            return;
        }

        setUploading(true);
        setError(null);

        try {
            const supabase = createClient();
            const ts = Date.now();
            const ext = file.name.split(".").pop() || "webp";
            const storagePath = `events/${eventId}/${currentUserId}_${ts}.${ext}`;

            const { error: uploadErr } = await supabase.storage
                .from("horse-images")
                .upload(storagePath, file, { upsert: false });

            if (uploadErr) {
                setError(uploadErr.message);
                setUploading(false);
                return;
            }

            // Create DB record via server action
            startTransition(async () => {
                const result = await addEventMedia(eventId, storagePath);
                if (result.success) {
                    // Optimistic — add with object URL for immediate preview
                    const previewUrl = URL.createObjectURL(file);
                    setPhotos(prev => [{
                        id: safeUUID(),
                        imageUrl: previewUrl,
                        caption: null,
                        createdAt: new Date().toISOString(),
                        userId: currentUserId,
                        userAlias: "You",
                    }, ...prev]);
                    router.refresh();
                } else {
                    setError(result.error || "Failed to save photo.");
                }
            });
        } catch {
            setError("Upload failed.");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    }

    async function handleDelete(photoId: string) {
        if (!confirm("Delete this photo?")) return;
        startTransition(async () => {
            const result = await deleteEventMedia(photoId);
            if (result.success) {
                setPhotos(prev => prev.filter(p => p.id !== photoId));
                router.refresh();
            }
        });
    }

    return (
        <div className="glass-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all p-6 mt-6">
            <div className="justify-between mb-4" style={{ display: "flex", alignItems: "center" }}>
                <h3>📸 Event Photos ({photos.length})</h3>
                <label className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm min-h-[36px] py-1 px-6 text-sm" style={{ cursor: "pointer" }}>
                    {uploading ? "Uploading…" : "+ Add Photo"}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleUpload}
                        disabled={uploading || isPending}
                        style={{ display: "none" }}
                        id="event-photo-upload"
                    />
                </label>
            </div>

            {error && <p className="text-[var(--color-error)] text-[0.85rem] mb-2" >{error}</p>}

            {photos.length === 0 ? (
                <p className="text-muted" >No photos yet — share yours!</p>
            ) : (
                <div className="grid grid-cols-[repeat(auto-fill, minmax(140px, 1fr))] gap-2 mt-2">
                    {photos.map(p => (
                        <div key={p.id} style={{ position: "relative" }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.imageUrl} alt={p.caption || "Event photo"} loading="lazy" />
                            {p.userId === currentUserId && (
                                <button
                                    onClick={() => handleDelete(p.id)}
                                    disabled={isPending}
                                    className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge min-h-[36px] py-1 px-6 text-sm"
                                    style={{
                                        position: "absolute", top: 4, right: 4,
                                        background: "rgba(0,0,0,0.6)", color: "white",
                                        borderRadius: "var(--radius-pill)", padding: "2px 6px",
                                        fontSize: "0.7rem",
                                    }}
                                >
                                    ✕
                                </button>
                            )}
                            {p.caption && (
                                <div style={{
                                    position: "absolute", bottom: 0, left: 0, right: 0,
                                    background: "rgba(0,0,0,0.5)", color: "white",
                                    fontSize: "0.7rem", padding: "2px 6px",
                                    borderRadius: "0 0 var(--radius-md) var(--radius-md)",
                                }}>
                                    {p.caption}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
