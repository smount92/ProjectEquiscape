"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { addCommissionUpdate, type CommissionUpdate } from "@/app/actions/art-studio";
import { UserAvatar } from "@/components/social";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { STATUS_LABELS, normalizeStatus, type Party } from "@/lib/studio/pipeline";

const ICONS: Record<string, string> = {
    wip_photo: "📸",
    status_change: "🔄",
    message: "💬",
    revision_request: "✎",
    approval: "✅",
    milestone: "🏆",
};

/**
 * The work-in-progress thread.
 *
 * Every source agrees this is the trust engine: progress photos at agreed
 * checkpoints, early enough that changes are still cheap. It is the reason
 * a commissioner doesn't have to nag, and the reason an artist has a
 * record of what was shown and when.
 *
 * Backed by `commission_updates` (append-only, per-entry client
 * visibility) rather than `posts` — posts.studio_id exists but has never
 * had a writer or a reader.
 */
export default function WipThread({
    commissionId,
    updates,
    party,
    canPost,
}: {
    commissionId: string;
    updates: CommissionUpdate[];
    party: Party | null;
    canPost: boolean;
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);

    return (
        <div className="bg-card border-input rounded-lg border p-6 shadow-md">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="m-0 font-serif text-lg font-bold">📋 Progress</h2>
                {canPost && !open && (
                    <Button size="sm" onClick={() => setOpen(true)}>
                        + Post an update
                    </Button>
                )}
            </div>

            {open && party && (
                <PostForm
                    commissionId={commissionId}
                    party={party}
                    onClose={() => setOpen(false)}
                    onPosted={() => {
                        setOpen(false);
                        router.refresh();
                    }}
                />
            )}

            {updates.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                    Nothing posted yet. Work-in-progress photos land here — the artist posts them
                    as the piece comes together.
                </p>
            ) : (
                <ol className="m-0 grid list-none gap-0 p-0">
                    {updates.map((update, i) => (
                        <Entry
                            key={update.id}
                            update={update}
                            isArtist={party === "artist"}
                            last={i === updates.length - 1}
                        />
                    ))}
                </ol>
            )}
        </div>
    );
}

function Entry({
    update,
    isArtist,
    last,
}: {
    update: CommissionUpdate;
    isArtist: boolean;
    last: boolean;
}) {
    return (
        <li className="relative grid grid-cols-[2rem_1fr] gap-3 pb-5 last:pb-0">
            {/* The rail. v1 shipped class names from a botched codemod
                (`commission-relative`, `gap-4-dot`) that exist nowhere in
                globals.css, so this never rendered at all. */}
            <div className="relative flex justify-center">
                <span className="border-input bg-card relative z-[1] grid h-8 w-8 place-items-center rounded-full border text-sm">
                    {ICONS[update.updateType] ?? "📋"}
                </span>
                {!last && (
                    <span
                        aria-hidden="true"
                        className="bg-input absolute top-8 bottom-[-1.25rem] w-px"
                    />
                )}
            </div>

            <div className="min-w-0">
                <div className="flex flex-wrap items-start gap-2">
                    <UserAvatar
                        src={update.authorAvatarUrl}
                        alias={update.authorAlias}
                        size="sm"
                        href={`/profile/${encodeURIComponent(update.authorAlias)}`}
                    />
                    <div className="min-w-0 flex-1">
                        {update.title && (
                            <div className="text-foreground text-sm font-bold">
                                {update.title}
                            </div>
                        )}
                        <div className="text-muted-foreground text-xs">
                            @{update.authorAlias} ·{" "}
                            {new Date(update.createdAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                            })}
                            {!update.isVisibleToClient && isArtist && (
                                <span className="ml-2">🔒 private note</span>
                            )}
                        </div>
                    </div>
                </div>

                {update.body && (
                    <p className="text-secondary-foreground mt-1.5 text-sm leading-relaxed whitespace-pre-wrap">
                        {update.body}
                    </p>
                )}

                {update.imageUrls.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                        {update.imageUrls.map((url, idx) => (
                            <a
                                key={url}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="border-input block max-w-[280px] overflow-hidden rounded-md border"
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={url}
                                    alt={`Progress photo ${idx + 1}`}
                                    loading="lazy"
                                    className="block max-h-[220px] w-full object-cover"
                                />
                            </a>
                        ))}
                    </div>
                )}

                {update.oldStatus && update.newStatus && (
                    <div className="text-muted-foreground mt-1.5 text-xs">
                        {STATUS_LABELS[normalizeStatus(update.oldStatus)]} →{" "}
                        <strong>{STATUS_LABELS[normalizeStatus(update.newStatus)]}</strong>
                    </div>
                )}
            </div>
        </li>
    );
}

function PostForm({
    commissionId,
    party,
    onClose,
    onPosted,
}: {
    commissionId: string;
    party: Party;
    onClose: () => void;
    onPosted: () => void;
}) {
    const [type, setType] = useState<"wip_photo" | "message" | "milestone">(
        party === "artist" ? "wip_photo" : "message",
    );
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [visible, setVisible] = useState(true);
    const [file, setFile] = useState<File | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    }, []);

    const upload = async (image: File): Promise<string | null> => {
        if (!userId) return null;
        const supabase = createClient();
        const ext = image.name.split(".").pop()?.toLowerCase() || "webp";
        // Path must match the storage policy: {userId}/commissions/{name}
        const path = `${userId}/commissions/${commissionId}_${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
            .from("horse-images")
            .upload(path, image, { contentType: image.type });
        if (upErr) {
            setError(`That image didn't upload: ${upErr.message}`);
            return null;
        }
        return supabase.storage.from("horse-images").getPublicUrl(path).data.publicUrl;
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!body.trim() && !file) {
            setError("Add a note or a photo.");
            return;
        }

        setBusy(true);
        let imageUrls: string[] = [];
        if (file) {
            const url = await upload(file);
            if (!url) {
                setBusy(false);
                return;
            }
            imageUrls = [url];
        }

        const result = await addCommissionUpdate(commissionId, {
            updateType: type,
            title: title.trim() || undefined,
            body: body.trim() || undefined,
            imageUrls: imageUrls.length ? imageUrls : undefined,
            isVisibleToClient: visible,
        });
        setBusy(false);

        if (!result.success) {
            setError(result.error ?? "That didn't post.");
            return;
        }
        onPosted();
    };

    return (
        <form onSubmit={submit} className="border-input bg-muted/40 mb-6 rounded-lg border p-4">
            {party === "artist" && (
                <label className="mb-4 block">
                    <span className="mb-1 block text-sm font-semibold">Kind of update</span>
                    <select
                        className="border-input bg-card ring-offset-background focus:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none"
                        value={type}
                        onChange={(e) => setType(e.target.value as typeof type)}
                    >
                        <option value="wip_photo">📸 Work-in-progress photo</option>
                        <option value="message">💬 Message</option>
                        <option value="milestone">🏆 Milestone</option>
                    </select>
                </label>
            )}

            <label className="mb-4 block">
                <span className="mb-1 block text-sm font-semibold">
                    Title <span className="text-muted-foreground">(optional)</span>
                </span>
                <Input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Base coat down"
                />
            </label>

            <label className="mb-4 block">
                <span className="mb-1 block text-sm font-semibold">Details</span>
                <Textarea
                    rows={3}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder={
                        party === "artist"
                            ? "Where the piece is up to, and anything you want checked before you go further."
                            : "A question, or an answer to something the artist asked."
                    }
                />
            </label>

            <label className="mb-4 block">
                <span className="mb-1 block text-sm font-semibold">
                    Photo <span className="text-muted-foreground">(optional)</span>
                </span>
                <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                {file && (
                    <span className="text-muted-foreground mt-1 block text-xs">
                        📎 {file.name} ({(file.size / 1024).toFixed(0)} KB)
                    </span>
                )}
            </label>

            {party === "artist" && (
                <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={visible}
                        onChange={(e) => setVisible(e.target.checked)}
                        className="h-4 w-4"
                    />
                    Visible to the commissioner
                    <span className="text-muted-foreground text-xs">
                        (uncheck for a private note to yourself)
                    </span>
                </label>
            )}

            {error && (
                <p className="text-destructive border-destructive/30 bg-destructive/10 mb-4 rounded-md border px-4 py-2 text-sm">
                    {error}
                </p>
            )}

            <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={busy}>
                    {busy ? "Posting…" : "Post update"}
                </Button>
                <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
                    Cancel
                </Button>
            </div>
        </form>
    );
}
