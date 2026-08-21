"use client";

import { useRef, useState } from "react";
import { createPost, type PostVisibility } from "@/app/actions/posts";
import { createClient } from "@/lib/supabase/client";
import MentionTextarea from "@/components/feed/MentionTextarea";

interface FeedComposerProps {
    /** Show the Public/Followers picker (migration 166 applied). */
    visibilityEnabled: boolean;
    /** Called with the new post's id once the write succeeds. */
    onPosted: (draft: {
        postId: string;
        content: string;
        imagePreviews: string[];
        visibility: PostVisibility;
    }) => void;
    placeholder?: string;
}

const MAX_IMAGES = 4;

const VISIBILITY_CHOICES: { value: PostVisibility; label: string }[] = [
    { value: "public", label: "🌍 Public" },
    { value: "followers", label: "👥 Followers" },
];

/**
 * The feed's write path.
 *
 * This is now the ONLY composer that writes global feed text, and it
 * writes to `posts` — the same table horse passports, groups and
 * shows use — so a post made here has replies, likes, a permalink and
 * media attachments like any other post on the site. Its predecessor
 * wrote to `activity_events`, which had none of that.
 */
export default function FeedComposer({
    visibilityEnabled,
    onPosted,
    placeholder = "Share an update with the community… (@ to mention someone)",
}: FeedComposerProps) {
    const [text, setText] = useState("");
    const [visibility, setVisibility] = useState<PostVisibility>("public");
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [isPosting, setIsPosting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const picked = Array.from(e.target.files || []).slice(0, MAX_IMAGES - imageFiles.length);
        if (picked.length === 0) return;
        const nextFiles = [...imageFiles, ...picked].slice(0, MAX_IMAGES);
        setImageFiles(nextFiles);

        const previews: string[] = [];
        nextFiles.forEach((file) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                previews.push(ev.target?.result as string);
                if (previews.length === nextFiles.length) setImagePreviews(previews);
            };
            reader.readAsDataURL(file);
        });
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
            const uploadedPaths: string[] = [];
            if (imageFiles.length > 0) {
                const supabase = createClient();
                const {
                    data: { user },
                } = await supabase.auth.getUser();
                if (!user) {
                    setError("Not authenticated.");
                    setIsPosting(false);
                    return;
                }
                for (const file of imageFiles) {
                    const ext = file.name.split(".").pop() || "webp";
                    const path = `social/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
                    const { error: uploadErr } = await supabase.storage
                        .from("horse-images")
                        .upload(path, file, { contentType: file.type });
                    if (uploadErr) {
                        setError(`Upload failed: ${uploadErr.message}`);
                        setIsPosting(false);
                        return;
                    }
                    uploadedPaths.push(path);
                }
            }

            const result = await createPost({
                content: text.trim(),
                imagePaths: uploadedPaths.length > 0 ? uploadedPaths : undefined,
                visibility: visibilityEnabled ? visibility : undefined,
            });

            if (!result.success) {
                setError(result.error || "Failed to post.");
                setIsPosting(false);
                return;
            }

            onPosted({
                postId: result.postId || "",
                content: text.trim(),
                imagePreviews,
                visibility: visibilityEnabled ? visibility : "public",
            });
            setText("");
            setImageFiles([]);
            setImagePreviews([]);
        } catch {
            setError("Something went wrong.");
        }
        setIsPosting(false);
    };

    return (
        <div className="ledger-card">
            <span className="ledger-tab">Say something</span>
            <MentionTextarea
                id="feed-compose-input"
                value={text}
                onChange={setText}
                placeholder={placeholder}
                maxLength={2000}
                rows={2}
                /* A lit-paper slip laid on the ledger, not a hole in it. */
                className="border-input bg-(--paper-lit) text-(--paper-lit-ink) placeholder:text-(--paper-lit-ink-soft)/60 focus:border-forest min-h-[76px] w-full resize-y rounded-md border px-4 py-3 text-sm no-underline transition-all focus:outline-none"
                aria-label="Write a post"
            />

            {imagePreviews.length > 0 && (
                <div
                    className={`mt-3 grid gap-1.5 ${
                        imagePreviews.length === 1 ? "grid-cols-1" : "grid-cols-2"
                    }`}
                >
                    {imagePreviews.map((preview, i) => (
                        <div key={i} className="relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={preview}
                                alt={`Preview ${i + 1}`}
                                className="border-input bg-muted h-[150px] w-full rounded-lg border object-cover"
                            />
                            <button
                                onClick={() => removeImage(i)}
                                className="absolute top-1 right-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border-0 bg-black/60 text-xs leading-5 text-white"
                                aria-label={`Remove image ${i + 1}`}
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="border-forest/15 mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        className="studio-chip disabled:opacity-50"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={imageFiles.length >= MAX_IMAGES}
                        title={`Attach images (up to ${MAX_IMAGES})`}
                    >
                        📷 Photo
                        {imageFiles.length > 0 ? ` (${imageFiles.length}/${MAX_IMAGES})` : ""}
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageSelect}
                        className="hidden"
                        aria-label="Upload images"
                    />

                    {/* Audience: two stamps, not a dropdown. There are
                        exactly two answers and the current one should be
                        readable without opening anything. */}
                    {visibilityEnabled && (
                        <div
                            role="group"
                            aria-label="Who can see this post"
                            className="flex items-center gap-1"
                        >
                            {VISIBILITY_CHOICES.map((choice) => (
                                <button
                                    key={choice.value}
                                    type="button"
                                    aria-pressed={visibility === choice.value}
                                    className={`studio-chip ${
                                        visibility === choice.value ? "active" : ""
                                    }`}
                                    onClick={() => setVisibility(choice.value)}
                                >
                                    {choice.label}
                                </button>
                            ))}
                        </div>
                    )}

                    <span className="text-muted-foreground text-xs font-medium tabular-nums">
                        {text.length}/2000
                    </span>
                </div>

                <button
                    type="button"
                    className="btn-brass disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={handlePost}
                    disabled={isPosting || (!text.trim() && imageFiles.length === 0)}
                >
                    {isPosting ? "Posting…" : "Post"}
                </button>
            </div>

            {error && (
                <p className="text-destructive mt-2 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm">
                    {error}
                </p>
            )}
        </div>
    );
}
