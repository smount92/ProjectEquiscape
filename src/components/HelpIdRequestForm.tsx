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

        // Compress image before upload
        const imageFile = formData.get("image") as File;
        if (imageFile && imageFile.size > 0) {
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
                className="btn btn-primary"
                onClick={() => setIsOpen(true)}
                id="new-id-request-btn"
                style={{ marginTop: "var(--space-lg)" }}
            >
                🔍 Submit a Mystery Model
            </button>
        );
    }

    return (
        <div className="help-id-form-card card animate-fade-in-up" style={{ marginTop: "var(--space-lg)" }}>
            <h3 style={{ marginBottom: "var(--space-md)" }}>📸 Submit a Mystery Model</h3>

            {status === "success" ? (
                <div style={{ textAlign: "center", padding: "var(--space-xl)" }}>
                    <p style={{ fontSize: "2rem", marginBottom: "var(--space-sm)" }}>✅</p>
                    <p style={{ color: "var(--color-accent-success)" }}>Request submitted! The community will help identify your model.</p>
                </div>
            ) : (
                <form onSubmit={handleSubmit}>
                    {/* Photo Upload */}
                    <div className="form-group">
                        <label className="form-label">Photo of the model *</label>
                        <div
                            className="csv-dropzone"
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
                                    <div className="csv-dropzone-icon">📷</div>
                                    <p className="csv-dropzone-text">
                                        Click to upload a photo
                                        <br />
                                        <span className="csv-dropzone-hint">Clear, well-lit photos get the best results</span>
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
                                required
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div className="form-group">
                        <label className="form-label" htmlFor="help-id-description">
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
                    <div className="form-group">
                        <label className="form-label" htmlFor="help-id-marks">
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

                    {error && <div className="csv-error">{error}</div>}

                    <div style={{ display: "flex", gap: "var(--space-md)", marginTop: "var(--space-lg)" }}>
                        <button
                            type="button"
                            className="btn btn-ghost"
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
                            className="btn btn-primary"
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
