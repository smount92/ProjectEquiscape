"use client";

/**
 * The filing dialog for Papers (213/214). Used from the Papers folder,
 * from a show record ("attach the NAN card, the show photo") and from an
 * accomplishment ("attach the race chart") — the attach point is a
 * preset, the rest is the same form.
 *
 * The file goes straight from the browser into the PRIVATE horse-papers
 * bucket under the owner's own folder; the row is written after.
 */

import { useRef, useState } from "react";

import { createPaper, updatePaper, type PaperView } from "@/app/actions/papers";
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
import { Textarea } from "@/components/ui/textarea";
import {
    MAX_PAPER_ISSUER,
    MAX_PAPER_NOTES,
    MAX_PAPER_TITLE,
    PAPER_KINDS,
    PAPER_KIND_LABELS,
    extensionFor,
    isPdf,
    validatePaperFile,
    type PaperKind,
} from "@/lib/papers/validate";
import { parseLooseDate } from "@/lib/studio/making";
import { createClient } from "@/lib/supabase/client";
import { PARCHMENT_INK } from "@/lib/theme/parchment";
import { compressImage } from "@/lib/utils/imageCompression";

export function formatBytes(n: number): string {
    if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
    return `${Math.max(1, Math.round(n / 1024))} KB`;
}

export interface PaperDialogProps {
    horseId: string;
    horseName: string;
    /** null = filing a new paper. */
    paper: PaperView | null;
    /** Where the new paper is attached (214). */
    attachTo?: { showRecordId?: string; accomplishmentId?: string; label?: string };
    /** The kind to start on when attaching (a card, a show photo). */
    presetKind?: PaperKind;
    /** Kinds to offer; defaults to all. */
    kinds?: PaperKind[];
    onClose: () => void;
    onSaved: () => void;
}

export default function PaperDialog({
    horseId,
    horseName,
    paper,
    attachTo,
    presetKind,
    kinds,
    onClose,
    onSaved,
}: PaperDialogProps) {
    const isNew = paper === null;
    const offered = kinds ? PAPER_KINDS.filter((k) => kinds.includes(k.value)) : PAPER_KINDS;
    const [kind, setKind] = useState<PaperKind>(paper?.kind ?? presetKind ?? offered[0]?.value ?? "other");
    const [title, setTitle] = useState(paper?.title ?? "");
    const [issuedBy, setIssuedBy] = useState(paper?.issuedBy ?? "");
    const [issuedOn, setIssuedOn] = useState(paper?.issuedOn ? paper.issuedOn.slice(0, 7) : "");
    const [notes, setNotes] = useState(paper?.notes ?? "");
    const [isPublic, setIsPublic] = useState(paper?.isPublic ?? true);
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInput = useRef<HTMLInputElement>(null);

    const pickFile = (f: File | null) => {
        setError(null);
        if (preview) URL.revokeObjectURL(preview);
        setPreview(null);
        if (!f) {
            setFile(null);
            return;
        }
        const problem = validatePaperFile(f);
        if (problem) {
            setError(problem);
            setFile(null);
            return;
        }
        setFile(f);
        if (!isPdf(f.type)) setPreview(URL.createObjectURL(f));
        if (!title.trim()) {
            // A sensible default title from the kind and the horse (or the record).
            setTitle(attachTo?.label ? `${PAPER_KIND_LABELS[kind]} — ${attachTo.label}` : `${PAPER_KIND_LABELS[kind]} — ${horseName}`);
        }
    };

    const save = async () => {
        setError(null);
        const t = title.trim();
        if (!t) return setError("Give the paper a title — what a visitor should call it.");
        const when = parseLooseDate(issuedOn);
        if (when.error) return setError(`Issued on: ${when.error}`);

        if (isNew) {
            if (!file) return setError("Choose the scan, photo or PDF first.");
            setBusy("Preparing…");
            try {
                const supabase = createClient();
                const {
                    data: { user },
                } = await supabase.auth.getUser();
                if (!user) throw new Error("Please sign in again.");

                let body: Blob = file;
                let mime = file.type;
                if (!isPdf(file.type)) {
                    // Legibility over bytes: a certificate is read, not glanced at.
                    body = await compressImage(file, "studio");
                    mime = "image/webp";
                }
                const path = `${user.id}/${horseId}/${crypto.randomUUID()}.${extensionFor(mime)}`;
                setBusy("Uploading…");
                const { error: upErr } = await supabase.storage
                    .from("horse-papers")
                    .upload(path, body, { contentType: mime, upsert: false });
                if (upErr) throw new Error("The upload didn't go through — check your connection and try again.");

                setBusy("Filing…");
                const r = await createPaper({
                    horseId,
                    path,
                    mime,
                    byteSize: body.size,
                    kind,
                    title: t,
                    issuedBy: issuedBy.trim() || null,
                    issuedOn: when.iso,
                    notes: notes.trim() || null,
                    isPublic,
                    showRecordId: attachTo?.showRecordId ?? null,
                    accomplishmentId: attachTo?.accomplishmentId ?? null,
                });
                if (!r.success) throw new Error(r.error);
                onSaved();
            } catch (e) {
                setError(e instanceof Error ? e.message : "Something went wrong.");
            } finally {
                setBusy(null);
            }
            return;
        }

        setBusy("Saving…");
        const r = await updatePaper({
            paperId: paper.id,
            kind,
            title: t,
            issuedBy: issuedBy.trim() || null,
            issuedOn: when.iso,
            notes: notes.trim() || null,
            isPublic,
        });
        setBusy(null);
        if (!r.success) return setError(r.error ?? "That didn't save.");
        onSaved();
    };

    const heading = isNew ? (attachTo ? "Attach a paper" : "File a paper") : "Edit this paper";
    const blurb = isNew
        ? attachTo?.label
            ? `It hangs on ${horseName}'s passport with ${attachTo.label}, framed, and in the horse's Papers.`
            : `It hangs on ${horseName}'s passport, framed, with who issued it and when.`
        : "The file stays; change what it's called and how it's captioned.";

    return (
        <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
            <DialogContent className="sm:max-w-[560px]">
                <DialogHeader>
                    <DialogTitle>{heading}</DialogTitle>
                    <DialogDescription>{blurb}</DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4">
                    <div>
                        <span className="text-foreground mb-1 block text-sm font-semibold">What is it?</span>
                        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Kind of paper">
                            {offered.map((k) => (
                                <button
                                    key={k.value}
                                    type="button"
                                    role="radio"
                                    aria-checked={kind === k.value}
                                    onClick={() => setKind(k.value)}
                                    title={k.hint}
                                    className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs ${
                                        kind === k.value
                                            ? "border-forest bg-forest/10 text-forest font-semibold"
                                            : "border-input text-muted-foreground"
                                    }`}
                                >
                                    {k.glyph} {k.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {isNew && (
                        <div>
                            <span className="text-foreground mb-1 block text-sm font-semibold">The scan, photo or PDF</span>
                            <div className="flex flex-wrap items-center gap-3">
                                <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()} disabled={!!busy}>
                                    {file ? "Choose a different file" : "Choose a file"}
                                </Button>
                                {file && (
                                    <span className="text-muted-foreground text-xs">
                                        {file.name} · {formatBytes(file.size)}
                                    </span>
                                )}
                            </div>
                            <input
                                ref={fileInput}
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                                className="hidden"
                                aria-label="Choose the paper's file"
                                onChange={(e) => {
                                    pickFile(e.target.files?.[0] ?? null);
                                    e.target.value = "";
                                }}
                            />
                            {preview && (
                                <div className="paper-frame mt-3 max-w-[240px]" style={PARCHMENT_INK}>
                                    <div className="paper-frame-inner">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={preview} alt="Preview of the paper you chose" />
                                    </div>
                                </div>
                            )}
                            <span className="text-muted-foreground mt-1 block text-xs">
                                Up to 10 MB. Photos and scans are stored at reading size; PDFs as they are.
                            </span>
                        </div>
                    )}

                    <label className="block">
                        <span className="text-foreground mb-1 block text-sm font-semibold">Title</span>
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            maxLength={MAX_PAPER_TITLE}
                            placeholder={`e.g. ${PAPER_KIND_LABELS[kind]} — ${attachTo?.label ?? horseName}`}
                        />
                    </label>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block">
                            <span className="text-foreground mb-1 block text-sm font-semibold">
                                Issued by <span className="text-muted-foreground font-normal">(optional)</span>
                            </span>
                            <Input
                                value={issuedBy}
                                onChange={(e) => setIssuedBy(e.target.value)}
                                maxLength={MAX_PAPER_ISSUER}
                                placeholder="The program, registry or show"
                            />
                        </label>
                        <label className="block">
                            <span className="text-foreground mb-1 block text-sm font-semibold">
                                Issued on <span className="text-muted-foreground font-normal">(optional)</span>
                            </span>
                            <Input
                                value={issuedOn}
                                onChange={(e) => setIssuedOn(e.target.value)}
                                inputMode="numeric"
                                placeholder="2014 or 2014-03"
                            />
                        </label>
                    </div>

                    <label className="block">
                        <span className="text-foreground mb-1 block text-sm font-semibold">
                            Notes <span className="text-muted-foreground font-normal">(optional)</span>
                        </span>
                        <Textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value.slice(0, MAX_PAPER_NOTES))}
                            rows={3}
                            maxLength={MAX_PAPER_NOTES}
                            placeholder="Anything a reader should know. Links become clickable."
                        />
                    </label>

                    <label className="flex cursor-pointer items-start gap-2 text-sm">
                        <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="mt-0.5 h-4 w-4" />
                        <span>
                            Show on the public passport
                            <span className="text-muted-foreground block text-xs">
                                Off keeps it for your eyes only. Papers on a private horse are never public either way.
                            </span>
                        </span>
                    </label>

                    {error && (
                        <p role="alert" className="text-destructive m-0 text-sm font-semibold">
                            {error}
                        </p>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={!!busy}>
                        Cancel
                    </Button>
                    <Button onClick={save} disabled={!!busy}>
                        {busy ?? (isNew ? (attachTo ? "Attach it" : "File it") : "Save")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
