"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * BannerCropModal — frame a banner before it uploads.
 *
 * The banner renders at a fixed 4:1 aspect everywhere (directory card
 * and barn page), so the crop frame here IS the final crop: drag to
 * position, slide to zoom, and the exported image is exactly what every
 * surface shows. Exports 1600×400 JPEG off a canvas — the upload is the
 * crop, no focal-point bookkeeping anywhere else.
 *
 * Zoom is a multiplier on cover-fit, so 1× always fills the frame and
 * panning can never expose an empty edge (offsets are clamped).
 */
const OUT_W = 1600;
const OUT_H = 400;
const ASPECT = OUT_W / OUT_H;

export default function BannerCropModal({
    file,
    onCancel,
    onCropped,
}: {
    file: File;
    onCancel: () => void;
    onCropped: (cropped: File) => void;
}) {
    const frameRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement | null>(null);
    const [url] = useState(() => URL.createObjectURL(file));
    const [ready, setReady] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [off, setOff] = useState({ x: 0, y: 0 });
    const drag = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => () => URL.revokeObjectURL(url), [url]);

    // Cover-fit base scale for the current frame width.
    const geometry = useCallback(() => {
        const frame = frameRef.current;
        const img = imgRef.current;
        if (!frame || !img || !img.naturalWidth) return null;
        const W = frame.clientWidth;
        const H = W / ASPECT;
        const base = Math.max(W / img.naturalWidth, H / img.naturalHeight);
        const s = base * zoom;
        return { W, H, s, iw: img.naturalWidth, ih: img.naturalHeight };
    }, [zoom]);

    const clamp = useCallback(
        (x: number, y: number) => {
            const g = geometry();
            if (!g) return { x, y };
            return {
                x: Math.min(0, Math.max(g.W - g.iw * g.s, x)),
                y: Math.min(0, Math.max(g.H - g.ih * g.s, y)),
            };
        },
        [geometry],
    );

    // Re-clamp when zoom changes so zooming out never strands the image.
    useEffect(() => {
        setOff((o) => clamp(o.x, o.y));
    }, [zoom, clamp]);

    const onPointerDown = (e: React.PointerEvent) => {
        (e.target as Element).setPointerCapture(e.pointerId);
        drag.current = { startX: e.clientX, startY: e.clientY, baseX: off.x, baseY: off.y };
    };
    const onPointerMove = (e: React.PointerEvent) => {
        if (!drag.current) return;
        setOff(
            clamp(
                drag.current.baseX + (e.clientX - drag.current.startX),
                drag.current.baseY + (e.clientY - drag.current.startY),
            ),
        );
    };
    const onPointerUp = () => {
        drag.current = null;
    };

    const exportCrop = async () => {
        const g = geometry();
        const img = imgRef.current;
        if (!g || !img) return;
        setBusy(true);
        try {
            const canvas = document.createElement("canvas");
            canvas.width = OUT_W;
            canvas.height = OUT_H;
            const ctx = canvas.getContext("2d");
            if (!ctx) throw new Error("no canvas context");
            ctx.drawImage(img, -off.x / g.s, -off.y / g.s, g.W / g.s, g.H / g.s, 0, 0, OUT_W, OUT_H);
            const blob = await new Promise<Blob | null>((resolve) =>
                canvas.toBlob(resolve, "image/jpeg", 0.85),
            );
            if (!blob) throw new Error("crop failed");
            onCropped(new File([blob], "banner.jpg", { type: "image/jpeg" }));
        } catch {
            setBusy(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Crop banner image"
        >
            <div className="bg-card w-full max-w-2xl rounded-xl p-4 shadow-xl">
                <h2 className="text-foreground mb-1 font-serif text-lg font-semibold">Frame your banner</h2>
                <p className="text-muted-foreground mb-3 text-xs">
                    Drag to position, slide to zoom. This exact framing shows on the barn page and the
                    directory card.
                </p>
                <div
                    ref={frameRef}
                    className="border-input relative w-full cursor-move touch-none overflow-hidden rounded-lg border select-none"
                    style={{ aspectRatio: "4 / 1" }}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        ref={imgRef}
                        src={url}
                        alt="Banner being framed"
                        draggable={false}
                        onLoad={() => {
                            setReady(true);
                            setOff((o) => clamp(o.x, o.y));
                        }}
                        className="pointer-events-none absolute top-0 left-0 max-w-none origin-top-left"
                        style={
                            ready && geometry()
                                ? {
                                      width: `${geometry()!.iw * geometry()!.s}px`,
                                      height: `${geometry()!.ih * geometry()!.s}px`,
                                      transform: `translate(${off.x}px, ${off.y}px)`,
                                  }
                                : { opacity: 0 }
                        }
                    />
                </div>
                <div className="mt-3 flex items-center gap-3">
                    <span aria-hidden="true" className="text-xs">
                        🔍
                    </span>
                    <input
                        type="range"
                        min={1}
                        max={3}
                        step={0.01}
                        value={zoom}
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className="flex-1"
                        aria-label="Zoom"
                    />
                </div>
                <div className="mt-4 flex justify-end gap-3 text-sm">
                    <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground underline"
                        disabled={busy}
                        onClick={onCancel}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="bg-forest rounded-md px-4 py-1.5 font-semibold text-white disabled:opacity-50"
                        disabled={busy || !ready}
                        onClick={() => void exportCrop()}
                    >
                        {busy ? "Cropping…" : "Use this framing"}
                    </button>
                </div>
            </div>
        </div>
    );
}
