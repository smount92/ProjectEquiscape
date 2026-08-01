"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Identify-a-mold-from-a-photo dialog — the first (and only) caller of
 * POST /api/identify-mold (auth-gated, 5/day, catalog-constrained).
 *
 * Upload/take a photo → the AI names the closest catalog mold → picking it
 * hands the mold name to the caller, which runs the normal search/preselect
 * path (same as the AI-detect externalSearchQuery flow).
 *
 * Anon: renders a "Sign in to identify" link (login + redirectTo) instead
 * of the trigger — the API would 401 anyway; better to say so up front.
 */

interface IdentifyResult {
    manufacturer: string;
    mold_name: string;
    scale: string;
    confidence_score: number;
    on_answer_key: boolean;
}

interface IdentifyMoldDialogProps {
    /** Called with the identified mold name — feed it to the search path. */
    onIdentified: (moldName: string) => void;
    /** Trigger label override (default "📷 Identify from a photo"). */
    triggerLabel?: string;
    /** Extra classes for the trigger button. */
    triggerClassName?: string;
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB — the API buffers the upload

export default function IdentifyMoldDialog({
    onIdentified,
    triggerLabel = "📷 Identify from a photo",
    triggerClassName = "",
}: IdentifyMoldDialogProps) {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    // null = unknown (checking); false = anon; true = signed in
    const [signedIn, setSignedIn] = useState<boolean | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isIdentifying, setIsIdentifying] = useState(false);
    const [result, setResult] = useState<IdentifyResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const supabase = createClient();
        supabase.auth
            .getUser()
            .then(({ data: { user } }) => setSignedIn(!!user))
            .catch(() => setSignedIn(false));
    }, []);

    // Revoke the preview object URL when it changes/unmounts
    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    const reset = () => {
        setFile(null);
        setPreviewUrl(null);
        setResult(null);
        setError(null);
        setIsIdentifying(false);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setError(null);
        setResult(null);
        if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
            setError("Please choose a JPEG, PNG, or WebP photo.");
            return;
        }
        if (f.size > MAX_IMAGE_BYTES) {
            setError("That photo is over 10MB — please use a smaller one.");
            return;
        }
        setFile(f);
        setPreviewUrl(URL.createObjectURL(f));
    };

    const handleIdentify = async () => {
        if (!file || isIdentifying) return;
        setIsIdentifying(true);
        setError(null);
        setResult(null);
        try {
            const formData = new FormData();
            formData.append("image", file);
            const res = await fetch("/api/identify-mold", {
                method: "POST",
                body: formData,
            });
            const data = (await res.json().catch(() => null)) as
                | (Partial<IdentifyResult> & { error?: string; not_equine?: boolean })
                | null;

            if (!res.ok || !data || data.error) {
                // Show the API's message verbatim — including the daily-limit
                // error ("Daily identification limit reached (5/day). …").
                setError(data?.error ?? "Something went wrong. Please try again.");
                return;
            }

            setResult({
                manufacturer: data.manufacturer ?? "Unknown",
                mold_name: data.mold_name ?? "Unknown",
                scale: data.scale ?? "Unknown",
                confidence_score:
                    typeof data.confidence_score === "number" ? data.confidence_score : 0,
                on_answer_key: !!data.on_answer_key,
            });
        } catch {
            setError("Network error — please check your connection and try again.");
        } finally {
            setIsIdentifying(false);
        }
    };

    const handlePick = () => {
        if (!result) return;
        setIsOpen(false);
        reset();
        onIdentified(result.mold_name);
    };

    // ── Anon: sign-in link instead of the trigger ──
    if (signedIn === false) {
        return (
            <a
                href={`/login?redirectTo=${encodeURIComponent(pathname || "/add-horse")}`}
                className={`inline-flex min-h-[36px] items-center justify-center gap-2 rounded-md border border-input bg-transparent px-4 py-1 text-sm font-medium text-secondary-foreground no-underline transition-all hover:border-forest hover:text-forest ${triggerClassName}`}
            >
                📷 Sign in to identify
            </a>
        );
    }

    const confidencePct = result ? Math.round(result.confidence_score * 100) : 0;

    return (
        <>
            <button
                type="button"
                className={`inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-4 py-1 text-sm font-medium text-secondary-foreground transition-all hover:border-forest hover:text-forest ${triggerClassName}`}
                onClick={() => {
                    reset();
                    setIsOpen(true);
                }}
            >
                {triggerLabel}
            </button>

            <Dialog
                open={isOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        setIsOpen(false);
                        reset();
                    }
                }}
            >
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle>📷 Identify from a Photo</DialogTitle>
                        <DialogDescription>
                            Snap or upload a photo and the AI matches it against the mold catalog.
                            Limited to 5 identifications per day.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col gap-4">
                        {/* Photo picker */}
                        <div
                            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input bg-card px-6 py-6 text-center transition-all hover:border-forest"
                            onClick={() => fileInputRef.current?.click()}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
                            }}
                        >
                            {previewUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={previewUrl}
                                    alt="Photo to identify"
                                    className="max-h-[220px] w-auto rounded-md object-contain"
                                />
                            ) : (
                                <>
                                    <span className="text-[2.5rem] opacity-70">🐴</span>
                                    <span className="text-sm text-muted-foreground">
                                        Tap to upload or take a photo
                                    </span>
                                    <span className="text-xs text-muted-foreground">JPEG, PNG, or WebP · up to 10MB</span>
                                </>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="hidden"
                                onChange={handleFileChange}
                                aria-label="Photo to identify"
                            />
                        </div>

                        {file && !result && (
                            <Button onClick={handleIdentify} disabled={isIdentifying}>
                                {isIdentifying ? (
                                    <>
                                        <span className="spinner-inline" /> Identifying…
                                    </>
                                ) : (
                                    "🔍 Identify this mold"
                                )}
                            </Button>
                        )}

                        {/* Error — shown verbatim (incl. the daily limit) */}
                        {error && (
                            <p className="text-destructive rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm">
                                {error}
                            </p>
                        )}

                        {/* Candidate */}
                        {result && (
                            <div className="flex flex-col gap-3">
                                <button
                                    type="button"
                                    className="group flex w-full cursor-pointer items-center gap-3 rounded-lg border border-input bg-card px-4 py-3 text-left transition-all hover:border-forest hover:bg-success/10"
                                    onClick={handlePick}
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-semibold text-foreground">{result.mold_name}</div>
                                        <div className="mt-0.5 text-xs text-muted-foreground">
                                            {result.manufacturer}
                                            {result.scale && result.scale !== "Unknown" ? ` · ${result.scale}` : ""}
                                        </div>
                                    </div>
                                    <span
                                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                            confidencePct >= 70
                                                ? "bg-success/10 text-success"
                                                : "bg-warning/10 text-warning"
                                        }`}
                                    >
                                        {confidencePct}% match
                                    </span>
                                </button>
                                {!result.on_answer_key && (
                                    <p className="text-xs text-muted-foreground">
                                        ⚠️ Closest guess — this name isn&apos;t an exact catalog match, so
                                        double-check the search results.
                                    </p>
                                )}
                                <div className="flex flex-wrap justify-end gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setResult(null);
                                            setFile(null);
                                            setPreviewUrl(null);
                                        }}
                                    >
                                        Try another photo
                                    </Button>
                                    <Button onClick={handlePick}>Search for this mold →</Button>
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
