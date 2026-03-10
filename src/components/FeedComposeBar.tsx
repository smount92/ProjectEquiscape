"use client";

import { useState, useRef } from "react";
import { createTextPost } from "@/app/actions/activity";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function FeedComposeBar() {
    const [text, setText] = useState("");
    const [isPosting, setIsPosting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []).slice(0, 4 - imageFiles.length);
        if (files.length === 0) return;

        const newFiles = [...imageFiles, ...files].slice(0, 4);
        setImageFiles(newFiles);

        // Generate previews
        newFiles.forEach((file) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setImagePreviews((prev) => {
                    const next = [...prev, ev.target?.result as string];
                    return next.slice(0, 4);
                });
            };
            reader.readAsDataURL(file);
        });

        // Clear input so same file can be re-selected
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const removeImage = (index: number) => {
        setImageFiles((prev) => prev.filter((_, i) => i !== index));
        setImagePreviews((prev) => prev.filter((_, i) => i !== index));
    };

    const handlePost = async () => {
        if (!text.trim() && imageFiles.length === 0) return;
        setIsPosting(true);
        setError(null);

        try {
            // Upload images if any
            let uploadedUrls: string[] = [];
            if (imageFiles.length > 0) {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    setError("Not authenticated.");
                    setIsPosting(false);
                    return;
                }

                for (const file of imageFiles) {
                    const ext = file.name.split(".").pop() || "webp";
                    const path = `social/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
                    const { error: uploadError } = await supabase.storage
                        .from("horse-images")
                        .upload(path, file, { contentType: file.type });
                    if (uploadError) {
                        setError(`Upload failed: ${uploadError.message}`);
                        setIsPosting(false);
                        return;
                    }
                    uploadedUrls.push(path);
                }
            }

            const result = await createTextPost(text, uploadedUrls.length > 0 ? uploadedUrls : undefined);
            if (result.success) {
                setText("");
                setImageFiles([]);
                setImagePreviews([]);
                router.refresh();
            } else {
                setError(result.error || "Failed to post.");
            }
        } catch {
            setError("Something went wrong.");
        }
        setIsPosting(false);
    };

    return (
        <div className="feed-compose-bar">
            <textarea
                className="form-textarea feed-compose-input"
                placeholder="Share an update with the community… (supports @mentions)"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={500}
                rows={2}
            />

            {/* Image previews */}
            {imagePreviews.length > 0 && (
                <div className="feed-image-collage" data-count={imagePreviews.length} style={{ marginTop: "var(--space-sm)", maxHeight: 150 }}>
                    {imagePreviews.map((preview, i) => (
                        <div key={i} style={{ position: "relative" }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={preview} alt={`Preview ${i + 1}`} style={{ maxHeight: 150 }} />
                            <button
                                onClick={() => removeImage(i)}
                                style={{
                                    position: "absolute", top: 4, right: 4,
                                    background: "rgba(0,0,0,0.6)", color: "white",
                                    border: "none", borderRadius: "50%", width: 20, height: 20,
                                    cursor: "pointer", fontSize: 12, lineHeight: "20px",
                                }}
                                aria-label="Remove image"
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="feed-compose-footer">
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                    {/* Image attach button */}
                    <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={imageFiles.length >= 4}
                        title="Attach images (up to 4)"
                        style={{ padding: "4px 8px" }}
                    >
                        📷 {imageFiles.length > 0 ? `(${imageFiles.length}/4)` : ""}
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageSelect}
                        style={{ display: "none" }}
                    />
                    <span className="feed-compose-count">
                        {text.length}/500
                    </span>
                </div>
                <button
                    className="btn btn-primary btn-sm"
                    onClick={handlePost}
                    disabled={isPosting || (!text.trim() && imageFiles.length === 0)}
                >
                    {isPosting ? "Posting…" : "📝 Post"}
                </button>
            </div>
            {error && <p className="form-error" style={{ marginTop: "var(--space-xs)" }}>{error}</p>}
        </div>
    );
}
