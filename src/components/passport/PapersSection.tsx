"use client";

/**
 * Papers — the horse's certificates, framed on the passport.
 *
 * Breeding certificates are how the hobby's pretend pedigrees are
 * honoured: one program grants a breeding to another's model, and a
 * certificate comes with the foal. Older ones are paper; a scan is the
 * only copy that survives a move. This chapter shows each one as the
 * document it is — framed on cream, captioned with who issued it and
 * when — and opens full size in the passport's own lightbox. PDFs get a
 * plate and open in a new tab.
 *
 * Files live in a PRIVATE bucket; the URLs here are signed for an hour
 * by the server, which only signs what the viewer's own RLS returned.
 */

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { createPaper, deletePaper, updatePaper, type PaperView } from "@/app/actions/papers";
import LinkifiedText from "@/components/LinkifiedText";
import PhotoLightbox from "@/components/PhotoLightbox";
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
    MAX_PAPERS_PER_HORSE,
    MAX_PAPER_ISSUER,
    MAX_PAPER_NOTES,
    MAX_PAPER_TITLE,
    PAPER_KINDS,
    extensionFor,
    isPdf,
    issuedLine,
    validatePaperFile,
    type PaperKind,
} from "@/lib/papers/validate";
import { parseLooseDate } from "@/lib/studio/making";
import { createClient } from "@/lib/supabase/client";
import { PARCHMENT_INK } from "@/lib/theme/parchment";
import { compressImage } from "@/lib/utils/imageCompression";

interface PapersSectionProps {
    horseId: string;
    horseName: string;
    papers: PaperView[];
    isOwner?: boolean;
}

const KIND_GLYPH: Record<string, string> = Object.fromEntries(PAPER_KINDS.map((k) => [k.value, k.glyph]));
const KIND_LABEL: Record<string, string> = Object.fromEntries(PAPER_KINDS.map((k) => [k.value, k.label]));

function formatBytes(n: number): string {
    if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
    return `${Math.max(1, Math.round(n / 1024))} KB`;
}

export default function PapersSection({ horseId, horseName, papers, isOwner = false }: PapersSectionProps) {
    const router = useRouter();
    const [lightbox, setLightbox] = useState<number | null>(null);
    const [editing, setEditing] = useState<PaperView | "new" | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // The lightbox reel is the image papers only, in filing order.
    const imagePapers = useMemo(() => papers.filter((p) => !isPdf(p.mime)), [papers]);
    const reel = useMemo(() => imagePapers.map((p) => ({ url: p.url, label: p.title })), [imagePapers]);

    if (papers.length === 0 && !isOwner) return null;

    const togglePublic = async (p: PaperView) => {
        setBusyId(p.id);
        setError(null);
        const r = await updatePaper({ paperId: p.id, isPublic: !p.isPublic });
        setBusyId(null);
        if (!r.success) {
            setError(r.error ?? "That didn't save.");
            return;
        }
        router.refresh();
    };

    const remove = async (p: PaperView) => {
        if (!window.confirm(`Remove "${p.title}" from ${horseName}'s papers? The file is deleted too.`)) return;
        setBusyId(p.id);
        setError(null);
        const r = await deletePaper(p.id);
        setBusyId(null);
        if (!r.success) {
            setError(r.error ?? "That didn't work.");
            return;
        }
        router.refresh();
    };

    return (
        <section
            className="rounded-lg border border-input bg-card p-4 shadow-sm"
            id="passport-papers"
            aria-labelledby="passport-papers-heading"
        >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 id="passport-papers-heading" className="m-0 flex items-center gap-2 text-lg">
                    <span aria-hidden="true">📜</span> Papers
                    {papers.length > 0 && (
                        <span className="text-muted-foreground text-sm font-normal">
                            {papers.length} on file
                        </span>
                    )}
                </h3>
                {isOwner && papers.length < MAX_PAPERS_PER_HORSE && (
                    <Button variant="outline" size="sm" onClick={() => setEditing("new")}>
                        + File a paper
                    </Button>
                )}
            </div>
            <p className="text-muted-foreground m-0 mb-4 text-xs leading-relaxed">
                {isOwner
                    ? "Breeding certificates, registration papers, pedigree charts — filed by you, shown as they were issued. A scan of the old paper ones is the copy that survives a move."
                    : "Breeding certificates, registration papers and pedigree charts, filed by the owner and shown as they were issued."}
            </p>

            {papers.length === 0 ? (
                <div
                    // A ruled note, not a frame: the plate's 4:3 proportion is for
                    // documents, and an empty folder is two lines, not a poster.
                    className="paper-plate rounded-md px-6 py-5 text-center"
                    style={{ ...PARCHMENT_INK, aspectRatio: "auto" }}
                >
                    <p className="m-0 text-sm font-medium">No papers filed yet.</p>
                    <p className="text-muted-foreground m-0 mt-1 text-xs">
                        The breeding certificate that came with {horseName}, registry papers, the
                        pedigree chart — photograph or scan them, or drop in the PDF, and they
                        hang here framed.
                    </p>
                </div>
            ) : (
                <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2">
                    {papers.map((p) => {
                        const pdf = isPdf(p.mime);
                        const reelIndex = pdf ? -1 : imagePapers.findIndex((x) => x.id === p.id);
                        return (
                            <li key={p.id} className="flex flex-col gap-2">
                                {/* The FRAME is cream in both themes (a document is a
                                    document), so its ink is pinned; the caption below
                                    sits on the card and follows the theme. */}
                                {pdf ? (
                                    <a
                                        href={p.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="paper-frame block no-underline"
                                        style={PARCHMENT_INK}
                                        aria-label={`Open ${p.title} (PDF)`}
                                    >
                                        <div className="paper-plate">
                                            <div className="text-center">
                                                <div className="text-4xl" aria-hidden="true">📄</div>
                                                <div className="paper-kind text-xs font-semibold">PDF · {formatBytes(p.byteSize)}</div>
                                                <div className="text-forest mt-1 text-xs font-semibold">Open ↗</div>
                                            </div>
                                        </div>
                                    </a>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setLightbox(reelIndex)}
                                        className="paper-frame block w-full cursor-zoom-in text-left"
                                        style={PARCHMENT_INK}
                                        aria-label={`View ${p.title} full size`}
                                    >
                                        <div className="paper-frame-inner">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={p.url} alt={`${p.title} — ${KIND_LABEL[p.kind] ?? "papers"} for ${horseName}`} loading="lazy" decoding="async" />
                                        </div>
                                    </button>
                                )}

                                <div className="px-1">
                                    <div className="paper-kind text-muted-foreground text-[0.7rem] font-semibold">
                                        <span aria-hidden="true">{KIND_GLYPH[p.kind] ?? "🗂️"}</span> {KIND_LABEL[p.kind] ?? "Papers"}
                                        {isOwner && !p.isPublic && <span className="ml-2">· 🔒 only you</span>}
                                    </div>
                                    <div className="font-serif text-base font-bold leading-tight">{p.title}</div>
                                    {issuedLine(p.issuedBy, p.issuedOn) && (
                                        <div className="text-secondary-foreground text-xs">{issuedLine(p.issuedBy, p.issuedOn)}</div>
                                    )}
                                    {p.notes && (
                                        <p className="text-secondary-foreground m-0 mt-1 text-xs leading-relaxed whitespace-pre-wrap">
                                            <LinkifiedText text={p.notes} />
                                        </p>
                                    )}
                                    {isOwner && (
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            <Button variant="ghost" size="sm" disabled={busyId === p.id} onClick={() => setEditing(p)}>
                                                Edit
                                            </Button>
                                            <Button variant="ghost" size="sm" disabled={busyId === p.id} onClick={() => togglePublic(p)}>
                                                {p.isPublic ? "Hide from passport" : "Show on passport"}
                                            </Button>
                                            <Button variant="ghost" size="sm" disabled={busyId === p.id} onClick={() => remove(p)}>
                                                Remove
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            {error && (
                <p role="alert" className="text-destructive mt-3 text-sm font-semibold">
                    {error}
                </p>
            )}

            {lightbox !== null && reel.length > 0 && (
                <PhotoLightbox images={reel} initialIndex={Math.max(0, lightbox)} onClose={() => setLightbox(null)} />
            )}

            {editing !== null && (
                <PaperDialog
                    horseId={horseId}
                    horseName={horseName}
                    paper={editing === "new" ? null : editing}
                    onClose={() => setEditing(null)}
                    onSaved={() => {
                        setEditing(null);
                        router.refresh();
                    }}
                />
            )}
        </section>
    );
}

// ── The filing dialog ─────────────────────────────────────────────────

function PaperDialog({
    horseId,
    horseName,
    paper,
    onClose,
    onSaved,
}: {
    horseId: string;
    horseName: string;
    paper: PaperView | null;
    onClose: () => void;
    onSaved: () => void;
}) {
    const isNew = paper === null;
    const [kind, setKind] = useState<PaperKind>(paper?.kind ?? "breeding_certificate");
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
            // A sensible default title from the kind and the horse.
            setTitle(`${KIND_LABEL[kind]} — ${horseName}`);
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

    return (
        <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
            <DialogContent className="sm:max-w-[560px]">
                <DialogHeader>
                    <DialogTitle>{isNew ? "File a paper" : "Edit this paper"}</DialogTitle>
                    <DialogDescription>
                        {isNew
                            ? `It hangs on ${horseName}'s passport, framed, with who issued it and when.`
                            : "The file stays; change what it's called and how it's captioned."}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4">
                    <div>
                        <span className="text-foreground mb-1 block text-sm font-semibold">What is it?</span>
                        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Kind of paper">
                            {PAPER_KINDS.map((k) => (
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
                            placeholder={`e.g. Breeding certificate — ${horseName}`}
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
                                placeholder="The program or registry"
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
                            placeholder="Who granted the breeding, the sire's and dam's pages, anything a reader should know. Links become clickable."
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
                        {busy ?? (isNew ? "File it" : "Save")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
