"use client";

import { useState, useRef } from "react";
import { createIdRequest } from "@/app/actions/help-id";
import { compressImage } from "@/lib/utils/imageCompression";

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
                className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm"
                onClick={() => setIsOpen(true)}
                id="new-id-request-btn"
                style={{ marginTop: "var(--space-lg)" }}
            >
                🔍 Submit a Mystery Model
            </button>
        );
    }

    return (
        <div className="help-id-form-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all card animate-fade-in-up mt-6">
            <h3 className="mb-4" >📸 Submit a Mystery Model</h3>

            {status === "success" ? (
                <div className="p-8" style={{ textAlign: "center" }}>
                    <p className="text-[2rem] mb-2" >✅</p>
                    <p className="text-success" >Request submitted! The community will help identify your model.</p>
                </div>
            ) : (
                <form onSubmit={handleSubmit}>
                    {/* Photo Upload */}
                    <div className="mb-6">
                        <label className="block text-sm font-semibold text-ink mb-1">Photo of the model *</label>
                        <div
                            className="flex flex-col items-center justify-center py-[var(--space-3xl)] px-8 border-[2px] border-dashed border-edge rounded-lg bg-card max-[480px]:rounded-[var(--radius-md)] cursor-pointer text-center transition-all"
                            style={{ padding: "var(--space-xl)", cursor: "pointer" }}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {preview ? (
                                <img
                                    src={preview}
                                    alt="Preview"
                                    style={{ maxHeight: 200, borderRadius: "var(--radius-md)", objectFit: "contain" }}
                                />
                            ) : (
                                <>
                                    <div className="text-[3rem] mb-4 opacity-[0.7]">📷</div>
                                    <p className="flex flex-col items-center justify-center py-[var(--space-3xl)] px-8 border-[2px] border-dashed border-edge rounded-lg bg-card max-[480px]:rounded-[var(--radius-md)] cursor-pointer text-center transition-all-text">
                                        Click to upload a photo
                                        <br />
                                        <span className="text-sm text-forest underline">Clear, well-lit photos get the best results</span>
                                    </p>
                                </>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                name="image"
                                accept="image/*"
                                onChange={handleFileChange}
                                style={{ display: "none" }}
                                required={false}
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div className="mb-6">
                        <label className="block text-sm font-semibold text-ink mb-1" htmlFor="help-id-description">
                            Description
                        </label>
                        <textarea
                            id="help-id-description"
                            name="description"
                            className="form-input"
                            rows={3}
                            placeholder="What do you know about this model? Size, material, markings, where you got it..."
                            style={{ resize: "vertical" }}
                        />
                    </div>

                    {/* Identifying Marks */}
                    <div className="mb-6">
                        <label className="block text-sm font-semibold text-ink mb-1" htmlFor="help-id-marks">
                            Any identifying marks?
                        </label>
                        <input
                            id="help-id-marks"
                            type="text"
                            name="identifyingMarks"
                            className="form-input"
                            placeholder="Mold marks, stamps, stickers, model numbers..."
                        />
                    </div>

                    {error && <div className="mt-4 py-4 px-6 bg-[rgba(240,108,126,0.1)] border border-[rgba(240,108,126,0.3)] rounded-md text-danger text-sm">{error}</div>}

                    <div className="gap-4 mt-6" style={{ display: "flex" }}>
                        <button
                            type="button"
                            className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge"
                            onClick={() => {
                                setIsOpen(false);
                                setPreview(null);
                                setError(null);
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm"
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
