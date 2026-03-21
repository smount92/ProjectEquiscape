"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";

interface ImageCropModalProps {
    file: File;
    aspectRatio?: number | null; // e.g., 4/3 for passport hero. null = free crop
    onCrop: (croppedFile: File) => void;
    onCancel: () => void;
}

interface CropArea {
    x: number;
    y: number;
    width: number;
    height: number;
}

const ASPECT_PRESETS = [
    { label: "Free", value: null },
    { label: "4:3", value: 4 / 3 },
    { label: "1:1", value: 1 },
    { label: "3:4", value: 3 / 4 },
    { label: "16:9", value: 16 / 9 },
];

export default function ImageCropModal({
    file,
    aspectRatio: initialAspectRatio = null,
    onCrop,
    onCancel,
}: ImageCropModalProps) {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [aspectRatio, setAspectRatio] = useState<number | null>(initialAspectRatio);
    const [crop, setCrop] = useState<CropArea>({ x: 0, y: 0, width: 0, height: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragMode, setDragMode] = useState<"move" | "resize" | null>(null);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [resizeHandle, setResizeHandle] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);

    const imgRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Load image preview
    useEffect(() => {
        const url = URL.createObjectURL(file);
        setImageUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    // Initialize crop to center 80% of image when loaded
    const handleImageLoad = useCallback(() => {
        if (!imgRef.current || !containerRef.current) return;

        const containerRect = containerRef.current.getBoundingClientRect();

        // Image may be object-fit: contain, so compute actual displayed area
        const imgNatW = imgRef.current.naturalWidth;
        const imgNatH = imgRef.current.naturalHeight;
        const scale = Math.min(containerRect.width / imgNatW, containerRect.height / imgNatH);
        const displayW = imgNatW * scale;
        const displayH = imgNatH * scale;
        const offsetX = (containerRect.width - displayW) / 2;
        const offsetY = (containerRect.height - displayH) / 2;

        let cropW = displayW * 0.8;
        let cropH = displayH * 0.8;

        if (aspectRatio) {
            // Fit to aspect ratio within the 80% region
            if (cropW / cropH > aspectRatio) {
                cropW = cropH * aspectRatio;
            } else {
                cropH = cropW / aspectRatio;
            }
        }

        setCrop({
            x: offsetX + (displayW - cropW) / 2,
            y: offsetY + (displayH - cropH) / 2,
            width: cropW,
            height: cropH,
        });

        setImageLoaded(true);
    }, [aspectRatio]);

    // Get the actual image display bounds
    const getImageBounds = useCallback(() => {
        if (!imgRef.current || !containerRef.current) return null;
        const containerRect = containerRef.current.getBoundingClientRect();
        const imgNatW = imgRef.current.naturalWidth;
        const imgNatH = imgRef.current.naturalHeight;
        const scale = Math.min(containerRect.width / imgNatW, containerRect.height / imgNatH);
        const displayW = imgNatW * scale;
        const displayH = imgNatH * scale;
        return {
            x: (containerRect.width - displayW) / 2,
            y: (containerRect.height - displayH) / 2,
            width: displayW,
            height: displayH,
            scale,
        };
    }, []);

    // Clamp crop to stay within image bounds
    const clampCrop = useCallback((c: CropArea): CropArea => {
        const bounds = getImageBounds();
        if (!bounds) return c;

        const minSize = 30;
        let { x, y, width, height } = c;

        width = Math.max(minSize, Math.min(width, bounds.width));
        height = Math.max(minSize, Math.min(height, bounds.height));
        x = Math.max(bounds.x, Math.min(x, bounds.x + bounds.width - width));
        y = Math.max(bounds.y, Math.min(y, bounds.y + bounds.height - height));

        return { x, y, width, height };
    }, [getImageBounds]);

    // Mouse/touch handlers
    const handlePointerDown = useCallback((e: React.PointerEvent, mode: "move" | "resize", handle?: string) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
        setDragMode(mode);
        setDragStart({ x: e.clientX, y: e.clientY });
        if (handle) setResizeHandle(handle);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }, []);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!isDragging || !dragMode) return;

        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        setDragStart({ x: e.clientX, y: e.clientY });

        if (dragMode === "move") {
            setCrop(prev => clampCrop({
                ...prev,
                x: prev.x + dx,
                y: prev.y + dy,
            }));
        } else if (dragMode === "resize" && resizeHandle) {
            setCrop(prev => {
                let newCrop = { ...prev };

                // Handle each corner/edge
                if (resizeHandle.includes("e")) {
                    newCrop.width = prev.width + dx;
                }
                if (resizeHandle.includes("w")) {
                    newCrop.x = prev.x + dx;
                    newCrop.width = prev.width - dx;
                }
                if (resizeHandle.includes("s")) {
                    newCrop.height = prev.height + dy;
                }
                if (resizeHandle.includes("n")) {
                    newCrop.y = prev.y + dy;
                    newCrop.height = prev.height - dy;
                }

                // Enforce aspect ratio
                if (aspectRatio) {
                    if (resizeHandle.includes("e") || resizeHandle.includes("w")) {
                        newCrop.height = newCrop.width / aspectRatio;
                    } else {
                        newCrop.width = newCrop.height * aspectRatio;
                    }
                }

                return clampCrop(newCrop);
            });
        }
    }, [isDragging, dragMode, dragStart, resizeHandle, aspectRatio, clampCrop]);

    const handlePointerUp = useCallback(() => {
        setIsDragging(false);
        setDragMode(null);
        setResizeHandle(null);
    }, []);

    // Handle aspect ratio change — recenter crop
    useEffect(() => {
        if (!imageLoaded) return;
        handleImageLoad();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [aspectRatio]);

    // Crop and export
    const handleCropConfirm = useCallback(async () => {
        if (!imgRef.current) return;
        setProcessing(true);

        const bounds = getImageBounds();
        if (!bounds) return;

        // Convert crop coordinates from display space to natural image space
        const scaleX = imgRef.current.naturalWidth / bounds.width;
        const scaleY = imgRef.current.naturalHeight / bounds.height;

        const srcX = (crop.x - bounds.x) * scaleX;
        const srcY = (crop.y - bounds.y) * scaleY;
        const srcW = crop.width * scaleX;
        const srcH = crop.height * scaleY;

        // Draw cropped area to canvas
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(srcW);
        canvas.height = Math.round(srcH);
        const ctx = canvas.getContext("2d");
        if (!ctx) { setProcessing(false); return; }

        ctx.drawImage(
            imgRef.current,
            Math.round(srcX), Math.round(srcY),
            Math.round(srcW), Math.round(srcH),
            0, 0,
            canvas.width, canvas.height
        );

        canvas.toBlob(
            (blob) => {
                if (!blob) { setProcessing(false); return; }
                const croppedFile = new File(
                    [blob],
                    file.name.replace(/\.[^.]+$/, "_cropped.webp"),
                    { type: "image/webp", lastModified: Date.now() }
                );
                onCrop(croppedFile);
            },
            "image/webp",
            0.85
        );
    }, [crop, file, getImageBounds, onCrop]);

    // Handle "Skip Crop" — use original
    const handleSkip = useCallback(() => {
        onCrop(file);
    }, [file, onCrop]);

    if (!imageUrl) return null;

    const HANDLE_SIZE = 12;

    const handles = [
        { key: "nw", cursor: "nwse-resize", style: { top: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 } },
        { key: "ne", cursor: "nesw-resize", style: { top: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 } },
        { key: "sw", cursor: "nesw-resize", style: { bottom: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 } },
        { key: "se", cursor: "nwse-resize", style: { bottom: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 } },
        { key: "n", cursor: "ns-resize", style: { top: -HANDLE_SIZE / 2, left: "50%", transform: "translateX(-50%)" } },
        { key: "s", cursor: "ns-resize", style: { bottom: -HANDLE_SIZE / 2, left: "50%", transform: "translateX(-50%)" } },
        { key: "w", cursor: "ew-resize", style: { top: "50%", left: -HANDLE_SIZE / 2, transform: "translateY(-50%)" } },
        { key: "e", cursor: "ew-resize", style: { top: "50%", right: -HANDLE_SIZE / 2, transform: "translateY(-50%)" } },
    ];

    const overlay = (
        <div className="modal-overlay" onClick={onCancel}>
            <div
                className="modal-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: 700, width: "95vw", padding: 0, overflow: "hidden" }}
            >
                {/* Header */}
                <div style={{
                    padding: "var(--space-md) var(--space-lg)",
                    borderBottom: "1px solid var(--color-border)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}>
                    <h3 className="m-0 text-[calc(var(--font-size-md)*var(--font-scale))]" >
                        ✂️ Crop Photo
                    </h3>
                    <div className="gap-1" style={{ display: "flex", flexWrap: "wrap" }}>
                        {ASPECT_PRESETS.map((preset) => (
                            <button
                                key={preset.label}
                                className={`inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge`}
                                onClick={() => setAspectRatio(preset.value)}
                                style={{
                                    padding: "4px 10px",
                                    fontSize: "calc(var(--font-size-xs) * var(--font-scale))",
                                    fontWeight: aspectRatio === preset.value ? 700 : 400,
                                    background: aspectRatio === preset.value ? "var(--color-accent-primary)" : undefined,
                                    color: aspectRatio === preset.value ? "white" : undefined,
                                    borderRadius: "var(--radius-sm)",
                                }}
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Crop area */}
                <div
                    ref={containerRef}
                    style={{
                        position: "relative",
                        width: "100%",
                        height: "min(60vh, 500px)",
                        background: "#111",
                        overflow: "hidden",
                        userSelect: "none",
                        touchAction: "none",
                    }}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                >
                    {/* Source image */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        ref={imgRef}
                        src={imageUrl}
                        alt="Crop preview"
                        onLoad={handleImageLoad}
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                            pointerEvents: "none",
                        }}
                    />

                    {imageLoaded && (
                        <>
                            {/* Dark overlay outside crop */}
                            <div style={{
                                position: "absolute",
                                inset: 0,
                                background: "rgba(0, 0, 0, 0.55)",
                                pointerEvents: "none",
                                clipPath: `polygon(
                                    0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
                                    ${crop.x}px ${crop.y}px,
                                    ${crop.x}px ${crop.y + crop.height}px,
                                    ${crop.x + crop.width}px ${crop.y + crop.height}px,
                                    ${crop.x + crop.width}px ${crop.y}px,
                                    ${crop.x}px ${crop.y}px
                                )`,
                            }} />

                            {/* Crop selection box */}
                            <div
                                style={{
                                    position: "absolute",
                                    left: crop.x,
                                    top: crop.y,
                                    width: crop.width,
                                    height: crop.height,
                                    border: "2px solid rgba(255, 255, 255, 0.9)",
                                    boxShadow: "0 0 0 1px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(0,0,0,0.1)",
                                    cursor: "move",
                                }}
                                onPointerDown={(e) => handlePointerDown(e, "move")}
                            >
                                {/* Rule of thirds grid lines */}
                                <div style={{
                                    position: "absolute",
                                    inset: 0,
                                    pointerEvents: "none",
                                    backgroundImage: `
                                        linear-gradient(to right, rgba(255,255,255,0.2) 1px, transparent 1px),
                                        linear-gradient(to bottom, rgba(255,255,255,0.2) 1px, transparent 1px)
                                    `,
                                    backgroundSize: "33.33% 33.33%",
                                    backgroundPosition: "33.33% 33.33%",
                                }} />

                                {/* Resize handles */}
                                {handles.map((handle) => (
                                    <div
                                        key={handle.key}
                                        style={{
                                            position: "absolute",
                                            ...handle.style as React.CSSProperties,
                                            width: HANDLE_SIZE,
                                            height: HANDLE_SIZE,
                                            background: "white",
                                            border: "1px solid rgba(0,0,0,0.3)",
                                            borderRadius: 2,
                                            cursor: handle.cursor,
                                            zIndex: 2,
                                        }}
                                        onPointerDown={(e) => handlePointerDown(e, "resize", handle.key)}
                                    />
                                ))}
                            </div>

                            {/* Size indicator */}
                            <div style={{
                                position: "absolute",
                                bottom: 8,
                                right: 8,
                                padding: "4px 8px",
                                background: "rgba(0, 0, 0, 0.7)",
                                color: "rgba(255, 255, 255, 0.8)",
                                fontSize: "11px",
                                borderRadius: "var(--radius-sm)",
                                fontFamily: "monospace",
                                pointerEvents: "none",
                            }}>
                                {Math.round(crop.width)} × {Math.round(crop.height)}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer actions */}
                <div style={{
                    padding: "var(--space-md) var(--space-lg)",
                    borderTop: "1px solid var(--color-border)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "var(--space-sm)",
                }}>
                    <button className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge" onClick={onCancel} disabled={processing}>
                        Cancel
                    </button>
                    <div className="gap-2" style={{ display: "flex" }}>
                        <button className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge" onClick={handleSkip} disabled={processing}>
                            Skip Crop
                        </button>
                        <button className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm" onClick={handleCropConfirm} disabled={processing || !imageLoaded}>
                            {processing ? "Processing…" : "✂️ Apply Crop"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(overlay, document.body);
}
