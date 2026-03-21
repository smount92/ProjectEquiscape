"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { submitSuggestion } from "@/app/actions/suggestions";

interface SuggestReferenceModalProps {
    isOpen: boolean;
    searchTerm: string;
    onClose: () => void;
    onSubmitted: (searchTerm: string) => void;
}

const SUGGESTION_TYPES = [
    { value: "mold", label: "🐴 Mold / Sculpt", description: "A specific sculpt (e.g., Breyer Alborozo, Stone Ideal Stock Horse)" },
    { value: "release", label: "🎨 Specific Release / Color", description: "A specific release or color run of an existing mold" },
    { value: "resin", label: "✨ Artist Resin", description: "An artist resin sculpt not in our database" },
] as const;

export default function SuggestReferenceModal({
    isOpen,
    searchTerm,
    onClose,
    onSubmitted,
}: SuggestReferenceModalProps) {
    const [name, setName] = useState(searchTerm);
    const [suggestionType, setSuggestionType] = useState<"mold" | "release" | "resin">("mold");
    const [details, setDetails] = useState("");
    const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || status === "submitting") return;

        setStatus("submitting");
        setErrorMsg("");

        const result = await submitSuggestion({
            suggestionType,
            name: name.trim(),
            details: details.trim() || undefined,
        });

        if (result.success) {
            setStatus("success");
            setTimeout(() => {
                onSubmitted(name.trim());
            }, 1500);
        } else {
            setErrorMsg(result.error || "Failed to submit suggestion.");
            setStatus("error");
        }
    };

    const handleClose = () => {
        if (status === "submitting") return;
        onClose();
    };

    const overlay = (
        <div className="modal-overlay" onClick={handleClose}>
            <div
                className="modal-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: 520 }}
            >
                {status === "success" ? (
                    <div style={{ textAlign: "center", padding: "var(--space-xl) var(--space-lg)" }}>
                        <div style={{ fontSize: "3rem", marginBottom: "var(--space-md)" }}>✅</div>
                        <h3 style={{ marginBottom: "var(--space-sm)" }}>Suggestion Submitted!</h3>
                        <p style={{ color: "var(--color-text-muted)", fontSize: "calc(var(--font-size-sm) * var(--font-scale))" }}>
                            Our team will review your suggestion. If approved, it will appear in the reference database.
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <h3 style={{ marginBottom: "var(--space-xs)" }}>
                            📝 Suggest a Reference
                        </h3>
                        <p style={{
                            color: "var(--color-text-muted)",
                            fontSize: "calc(var(--font-size-sm) * var(--font-scale))",
                            marginBottom: "var(--space-lg)",
                        }}>
                            Help us grow the database! Tell us about the model you couldn&apos;t find.
                        </p>

                        {/* Suggestion Type */}
                        <div className="mb-6" style={{ marginBottom: "var(--space-md)" }}>
                            <label className="block text-sm font-semibold text-ink mb-1">What are you suggesting?</label>
                            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                                {SUGGESTION_TYPES.map((type) => (
                                    <label
                                        key={type.value}
                                        style={{
                                            display: "flex",
                                            alignItems: "flex-start",
                                            gap: "var(--space-sm)",
                                            padding: "var(--space-sm) var(--space-md)",
                                            borderRadius: "var(--radius-sm)",
                                            border: `1px solid ${suggestionType === type.value ? "var(--color-accent-primary)" : "var(--color-border)"}`,
                                            background: suggestionType === type.value ? "rgba(61, 90, 62, 0.08)" : "transparent",
                                            cursor: "pointer",
                                            transition: "all 0.2s ease",
                                        }}
                                    >
                                        <input
                                            type="radio"
                                            name="suggestion-type"
                                            value={type.value}
                                            checked={suggestionType === type.value}
                                            onChange={() => setSuggestionType(type.value)}
                                            style={{ marginTop: 3, accentColor: "var(--color-accent-primary)" }}
                                        />
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: "calc(var(--font-size-sm) * var(--font-scale))" }}>
                                                {type.label}
                                            </div>
                                            <div style={{
                                                color: "var(--color-text-muted)",
                                                fontSize: "calc(var(--font-size-xs) * var(--font-scale))",
                                            }}>
                                                {type.description}
                                            </div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Name */}
                        <div className="mb-6" style={{ marginBottom: "var(--space-md)" }}>
                            <label className="block text-sm font-semibold text-ink mb-1">
                                Name <span style={{ color: "#e74c6f" }}>*</span>
                            </label>
                            <input
                                className="form-input"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Breyer Alborozo, Stone Ideal Stock Horse"
                                maxLength={200}
                                required
                                autoFocus
                                id="suggest-name"
                            />
                        </div>

                        {/* Details */}
                        <div className="mb-6" style={{ marginBottom: "var(--space-md)" }}>
                            <label className="block text-sm font-semibold text-ink mb-1">Additional Details</label>
                            <textarea
                                className="form-input"
                                value={details}
                                onChange={(e) => setDetails(e.target.value)}
                                placeholder={
                                    suggestionType === "mold"
                                        ? "Manufacturer, scale, year introduced, model number…"
                                        : suggestionType === "release"
                                            ? "Color name, mold it belongs to, year released, regular/special run…"
                                            : "Sculptor, scale, approximate edition size…"
                                }
                                maxLength={1000}
                                rows={3}
                                id="suggest-details"
                            />
                            <small style={{
                                color: "var(--color-text-muted)",
                                fontSize: "calc(var(--font-size-xs) * var(--font-scale))",
                            }}>
                                The more detail you provide, the faster we can add it.
                            </small>
                        </div>

                        {status === "error" && errorMsg && (
                            <div className="comment-error" style={{ marginBottom: "var(--space-md)" }}>
                                {errorMsg}
                            </div>
                        )}

                        <div style={{ display: "flex", gap: "var(--space-sm)", justifyContent: "flex-end" }}>
                            <button
                                type="button"
                                className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge"
                                onClick={handleClose}
                                disabled={status === "submitting"}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm"
                                disabled={!name.trim() || status === "submitting"}
                            >
                                {status === "submitting" ? "Submitting…" : "📤 Submit Suggestion"}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );

    return createPortal(overlay, document.body);
}
