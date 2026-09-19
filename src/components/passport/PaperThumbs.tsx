"use client";

/**
 * A row of small framed papers — the NAN card on a show record, the
 * chart on a race — opening the same lightbox as the Papers folder.
 * PDFs open in a new tab. Nothing renders when there are none.
 */

import { useMemo, useState } from "react";

import type { PaperView } from "@/app/actions/papers";
import PhotoLightbox from "@/components/PhotoLightbox";
import { PAPER_KIND_LABELS, isPdf } from "@/lib/papers/validate";
import { PARCHMENT_INK } from "@/lib/theme/parchment";

export default function PaperThumbs({ papers, horseName }: { papers: PaperView[]; horseName: string }) {
    const [open, setOpen] = useState<number | null>(null);
    const images = useMemo(() => papers.filter((p) => !isPdf(p.mime)), [papers]);
    const reel = useMemo(() => images.map((p) => ({ url: p.url, label: p.title })), [images]);
    if (papers.length === 0) return null;

    return (
        <div className="mt-2 flex flex-wrap gap-2" data-testid="paper-thumbs">
            {papers.map((p) => {
                const label = `${p.title} — ${PAPER_KIND_LABELS[p.kind] ?? "papers"} for ${horseName}`;
                if (isPdf(p.mime)) {
                    return (
                        <a
                            key={p.id}
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="paper-frame block h-20 w-20 no-underline"
                            style={{ ...PARCHMENT_INK, padding: 6 }}
                            title={`${p.title} (PDF)`}
                            aria-label={`Open ${p.title} (PDF)`}
                        >
                            <div className="paper-plate h-full w-full text-center text-[0.6rem] font-semibold" style={{ aspectRatio: "auto" }}>
                                <span>
                                    <span className="block text-xl" aria-hidden="true">📄</span>
                                    PDF
                                </span>
                            </div>
                        </a>
                    );
                }
                const idx = images.findIndex((x) => x.id === p.id);
                return (
                    <button
                        key={p.id}
                        type="button"
                        onClick={() => setOpen(idx)}
                        className="paper-frame block h-20 w-20 cursor-zoom-in"
                        style={{ ...PARCHMENT_INK, padding: 6 }}
                        title={p.title}
                        aria-label={`View ${p.title} full size`}
                    >
                        <div className="paper-frame-inner h-full w-full" style={{ aspectRatio: "auto" }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.url} alt={label} loading="lazy" decoding="async" />
                        </div>
                    </button>
                );
            })}
            {open !== null && reel.length > 0 && (
                <PhotoLightbox images={reel} initialIndex={Math.max(0, open)} onClose={() => setOpen(null)} />
            )}
        </div>
    );
}
