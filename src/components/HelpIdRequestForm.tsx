"use client";

import { useState, useRef } from "react";
import { createIdRequest } from "@/app/actions/help-id";
import { compressImage } from "@/lib/utils/imageCompression";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

/**
 * Submit-a-mystery-model form for the Help ID desk.
 *
 * Restyle only — the compression, validation and createIdRequest call
 * are untouched. The old markup carried two classes that don't exist in
 * the stylesheet (`help-id-form-bg-card`, a bare `card`), which left the
 * open form with no padding and no surface at all, and it nested a
 * second dashed drop-zone INSIDE the drop-zone. Both are gone: the form
 * is a ledger leaf with a kraft tab, one drop-zone, and a brass submit.
 */

export default function HelpIdRequestForm() {
    const [isOpen, setIsOpen] = useState(false);
    const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
    const [error, setError] = useState<string | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => setPreview(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setStatus("submitting");
        setError(null);

        const form = e.currentTarget;
        const formData = new FormData(form);

        // Manual validation for photo (hidden input can't show native validation tooltip)
        const imageFile = formData.get("image") as File;
        if (!imageFile || imageFile.size === 0) {
            setStatus("error");
            setError("Please upload a photo of the model.");
            return;
        }

        // Compress image before upload
        if (imageFile.size > 0) {
            try {
                const compressed = await compressImage(imageFile);
                formData.set("image", compressed);
            } catch {
                // Use original if compression fails
            }
        }

        const result = await createIdRequest(formData);

        if (result.success) {
            setStatus("success");
            setPreview(null);
            form.reset();
            // Auto-close after success
            setTimeout(() => {
                setIsOpen(false);
                setStatus("idle");
            }, 2000);
        } else {
            setStatus("error");
            setError(result.error || "Failed to submit request");
        }
    };

    if (!isOpen) {
        return (
            <button
                type="button"
                className="btn-brass mt-8"
                onClick={() => setIsOpen(true)}
                id="new-id-request-btn"
            >
                🔍 Submit a Mystery Model
            </button>
        );
    }

    return (
        <div className="ledger-card animate-fade-in-up mt-6">
            <span className="ledger-tab">Submit a Mystery Model</span>

            {status === "success" ? (
                <div className="p-8 text-center">
                    <p className="mb-3 text-[2rem]" aria-hidden="true">
                        ✅
                    </p>
                    <span className="stamp">Submitted</span>
                    <p className="text-secondary-foreground mt-3 text-sm">
                        The community will help identify your model.
                    </p>
                </div>
            ) : (
                <form onSubmit={handleSubmit}>
                    {/* Photo Upload */}
                    <div className="mb-6">
                        <label className="text-foreground mb-1 block text-sm font-semibold">
                            Photo of the model *
                        </label>
                        <div
                            className="border-forest/35 flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed bg-[rgba(255,252,245,0.6)] px-8 py-10 text-center transition-all"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {preview ? (
                                <img
                                    src={preview}
                                    alt="Preview"
                                    className="max-h-[200px] rounded-md object-contain"
                                />
                            ) : (
                                <>
                                    <div className="mb-3 text-[2.5rem] opacity-70" aria-hidden="true">
                                        📷
                                    </div>
                                    <span className="text-foreground text-sm font-semibold">
                                        Click to upload a photo
                                    </span>
                                    <span className="text-muted-foreground mt-1 text-xs">
                                        Clear, well-lit photos get the best results
                                    </span>
                                </>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                name="image"
                                accept="image/*"
                                onChange={handleFileChange}
                                className="hidden"
                                required={false}
                                title="Upload model photo"
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div className="mb-6">
                        <label
                            className="text-foreground mb-1 block text-sm font-semibold"
                            htmlFor="help-id-description"
                        >
                            Description
                        </label>
                        <Textarea
                            id="help-id-description"
                            name="description"
                            className="resize-y"
                            rows={3}
                            placeholder="What do you know about this model? Size, material, markings, where you got it..."
                        />
                    </div>

                    {/* Identifying Marks */}
                    <div className="mb-6">
                        <label
                            className="text-foreground mb-1 block text-sm font-semibold"
                            htmlFor="help-id-marks"
                        >
                            Any identifying marks?
                        </label>
                        <Input
                            id="help-id-marks"
                            type="text"
                            name="identifyingMarks"
                            placeholder="Mold marks, stamps, stickers, model numbers..."
                        />
                    </div>

                    {error && (
                        <div className="border-l-[3px] border-[#9B3028] bg-[rgba(155,48,40,0.06)] px-4 py-3 text-sm text-[#9B3028]">
                            {error}
                        </div>
                    )}

                    <div className="mt-6 flex flex-wrap items-center gap-4">
                        <Button
                            type="button"
                            variant="outline"
                            size="wide"
                            onClick={() => {
                                setIsOpen(false);
                                setPreview(null);
                                setError(null);
                            }}
                        >
                            Cancel
                        </Button>
                        <button
                            type="submit"
                            className="btn-brass disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={status === "submitting"}
                            id="submit-id-request-btn"
                        >
                            {status === "submitting" ? (
                                <>
                                    <span className="spinner-inline" /> Submitting…
                                </>
                            ) : (
                                "Submit Request"
                            )}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}
