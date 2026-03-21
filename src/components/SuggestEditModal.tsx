"use client";

import { useState, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import { createSuggestion } from "@/app/actions/catalog-suggestions";
import { useToast } from "@/lib/context/ToastContext";

interface CatalogItem {
    id: string;
    item_type: string;
    title: string;
    maker: string;
    scale: string | null;
    attributes: Record<string, unknown>;
}

interface SuggestEditModalProps {
    catalogItem: CatalogItem;
    openOnMount?: boolean;
}

interface FieldEdit {
    key: string;
    label: string;
    original: string;
    current: string;
}

export default function SuggestEditModal({
    catalogItem,
    openOnMount = false,
}: SuggestEditModalProps) {
    const [isOpen, setIsOpen] = useState(openOnMount);
    const [isPending, startTransition] = useTransition();
    const [reason, setReason] = useState("");
    const [error, setError] = useState("");
    const { toast } = useToast();

    // Build editable fields
    const attrs = catalogItem.attributes ?? {};
    const initialFields: FieldEdit[] = [
        { key: "title", label: "Title", original: catalogItem.title, current: catalogItem.title },
        { key: "maker", label: "Maker", original: catalogItem.maker, current: catalogItem.maker },
        { key: "scale", label: "Scale", original: catalogItem.scale ?? "", current: catalogItem.scale ?? "" },
        ...Object.entries(attrs)
            .filter(([, v]) => v != null)
            .map(([k, v]) => ({
                key: k,
                label: k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
                original: String(v),
                current: String(v),
            })),
    ];

    const [fields, setFields] = useState<FieldEdit[]>(initialFields);

    // Reset on open
    useEffect(() => {
        if (isOpen) {
            setFields(initialFields);
            setReason("");
            setError("");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const handleFieldChange = (index: number, value: string) => {
        setFields((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], current: value };
            return next;
        });
    };

    const changedFields = fields.filter((f) => f.current !== f.original);
    const hasChanges = changedFields.length > 0;

    const handleSubmit = () => {
        if (!hasChanges) {
            setError("No changes detected. Edit at least one field.");
            return;
        }
        if (reason.trim().length < 10) {
            setError("Please provide a reason (at least 10 characters).");
            return;
        }

        const fieldChanges: Record<string, { from: string; to: string }> = {};
        for (const f of changedFields) {
            fieldChanges[f.key] = { from: f.original, to: f.current };
        }

        startTransition(async () => {
            const result = await createSuggestion({
                catalogItemId: catalogItem.id,
                suggestionType: "correction",
                fieldChanges,
                reason: reason.trim(),
            });

            if (result.success) {
                setIsOpen(false);
                toast(
                    result.autoApproved
                        ? "⚡ Auto-approved! Your correction has been applied."
                        : "✅ Thanks! Your suggestion will be reviewed.",
                    "success"
                );
            } else {
                setError(result.error ?? "Something went wrong.");
            }
        });
    };

    // Lock body scroll when modal open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    return (
        <>
            <button
                id="suggest-edit-btn"
                className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm"
                onClick={() => setIsOpen(true)}
            >
                ✏️ Suggest Edit
            </button>

            {isOpen && createPortal(
                <div
                    className="modal-overlay"
                    onClick={() => setIsOpen(false)}
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0, 0, 0, 0.7)",
                        backdropFilter: "blur(4px)",
                        WebkitBackdropFilter: "blur(4px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1000,
                        padding: "24px",
                    }}
                >
                    <div
                        className="flex items-center justify-between py-6 px-8 border-b border-edge bg-glass rounded-[var(--radius-xl) var(--radius-xl) 0 0]"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: "#faf6ef",
                            border: "1px solid #d4c9a8",
                            borderRadius: "16px",
                            width: "100%",
                            maxWidth: 580,
                            maxHeight: "85vh",
                            overflowY: "auto",
                            boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
                        }}
                    >
                        <div className="modal-sticky top-0 z-[100] h-[var(--header-height)] flex items-center justify-between py-[0] px-8 bg-parchment-dark border-b border-edge transition-all">
                            <h2>✏️ Suggest Edit</h2>
                            <button
                                className="bg-transparent border-0 text-muted text-[1.2rem] cursor-pointer p-1 rounded-md transition-all duration-150"
                                onClick={() => setIsOpen(false)}
                            >
                                ✕
                            </button>
                        </div>
                        <p className="text-[var(--color-text)]">
                            Editing: <strong>{catalogItem.title}</strong> by{" "}
                            {catalogItem.maker}
                        </p>

                        <div className="py-6 px-8">
                            {/* Editable Fields */}
                            <div className="flex flex-col gap-4 mb-6">
                                {fields.map((field, i) => (
                                    <div
                                        key={field.key}
                                        className={`ref-suggest-field ${field.current !== field.original ? "ref-suggest-field-changed" : ""}`}
                                    >
                                        <label className="p-2 rounded-md transition-colors border-l-[3px] border-[transparent]-label">
                                            {field.label}
                                            {field.current !== field.original && (
                                                <span className="bg-[#ffc107] text-[#1a1a1a] text-[0.62rem] py-[2px] px-[7px] rounded-[8px] font-extrabold uppercase tracking-[0.03em]">
                                                    Changed
                                                </span>
                                            )}
                                        </label>
                                        <input
                                            type="text"
                                            className="input"
                                            value={field.current}
                                            onChange={(e) =>
                                                handleFieldChange(i, e.target.value)
                                            }
                                        />
                                        {field.current !== field.original && (
                                            <span className="text-[calc(0.75rem*var(--font-scale))] text-muted mt-[4px] italic">
                                                Was: {field.original}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Reason */}
                            <div className="mb-6">
                                <label className="p-2 rounded-md transition-colors border-l-[3px] border-[transparent]-label">
                                    Reason for change *
                                </label>
                                <textarea
                                    className="input w-full resize-y text-[calc(0.9rem*var(--font-scale))] min-h-[72px]"
                                    placeholder="Explain why this change is needed (e.g., 'The 2019 Breyer catalog lists this as Dark Bay, not Bay')"
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    rows={3}
                                    maxLength={2000}
                                />
                                <span className="text-[calc(0.7rem*var(--font-scale))] text-muted text-right block mt-[4px]">
                                    {reason.length}/2000
                                </span>
                            </div>

                            {error && <p className="flex items-center gap-2 mt-2 py-2 px-4 bg-[rgba(240,108,126,0.1)] border border-[rgba(240,108,126,0.3)] rounded-md text-danger text-sm">{error}</p>}

                            {/* Summary */}
                            {hasChanges && (
                                <div className="list-none p-0 m-0">
                                    <strong>
                                        {changedFields.length} field
                                        {changedFields.length > 1 ? "s" : ""} changed:
                                    </strong>
                                    <ul>
                                        {changedFields.map((f) => (
                                            <li key={f.key}>
                                                <span className="font-bold text-[var(--color-text)]">
                                                    {f.label}:
                                                </span>{" "}
                                                <span className="ref-diff-from">
                                                    {f.original}
                                                </span>{" "}
                                                →{" "}
                                                <span className="text-[#66bb6a] font-bold">
                                                    {f.current}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        <div className="modal-footer">
                            <button
                                className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none btn-secondary"
                                onClick={() => setIsOpen(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm"
                                onClick={handleSubmit}
                                disabled={isPending || !hasChanges}
                            >
                                {isPending ? "Submitting…" : "Submit Suggestion"}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
