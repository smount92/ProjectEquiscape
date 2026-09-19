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
 * Since 214 a paper may belong to a show record or an accomplishment
 * (a NAN card, a race chart); it shows there too, and here with a tag.
 *
 * Files live in a PRIVATE bucket; the URLs here are signed for an hour
 * by the server, which only signs what the viewer's own RLS returned.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { deletePaper, updatePaper, type PaperView } from "@/app/actions/papers";
import LinkifiedText from "@/components/LinkifiedText";
import PaperDialog, { formatBytes } from "@/components/passport/PaperDialog";
import PhotoLightbox from "@/components/PhotoLightbox";
import { Button } from "@/components/ui/button";
import { MAX_PAPERS_PER_HORSE, PAPER_KINDS, isPdf, issuedLine } from "@/lib/papers/validate";
import { PARCHMENT_INK } from "@/lib/theme/parchment";

interface PapersSectionProps {
    horseId: string;
    horseName: string;
    papers: PaperView[];
    isOwner?: boolean;
    /** Names for the "attached to" tag: show record id → show name, accomplishment id → title. */
    attachedLabels?: Record<string, string>;
}

const KIND_GLYPH: Record<string, string> = Object.fromEntries(PAPER_KINDS.map((k) => [k.value, k.glyph]));
const KIND_LABEL: Record<string, string> = Object.fromEntries(PAPER_KINDS.map((k) => [k.value, k.label]));

export default function PapersSection({ horseId, horseName, papers, isOwner = false, attachedLabels = {} }: PapersSectionProps) {
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

    const attachedTo = (p: PaperView): string | null => {
        const key = p.showRecordId ?? p.accomplishmentId;
        if (!key) return null;
        return attachedLabels[key] ?? (p.showRecordId ? "a show record" : "an accomplishment");
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
                        <span className="text-secondary-foreground text-sm font-normal">
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
            <p className="text-secondary-foreground m-0 mb-4 text-xs leading-relaxed">
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
                    <p className="text-secondary-foreground m-0 mt-1 text-xs">
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
                        const tag = attachedTo(p);
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
                                    <div className="paper-kind text-secondary-foreground text-[0.7rem] font-semibold">
                                        <span aria-hidden="true">{KIND_GLYPH[p.kind] ?? "🗂️"}</span> {KIND_LABEL[p.kind] ?? "Papers"}
                                        {tag && <span className="ml-2">· 📎 {tag}</span>}
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
