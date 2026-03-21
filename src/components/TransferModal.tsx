"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { generateTransferCode, cancelTransfer } from "@/app/actions/hoofprint";

interface TransferModalProps {
    horseId: string;
    horseName: string;
}

export default function TransferModal({ horseId, horseName }: TransferModalProps) {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [step, setStep] = useState<"form" | "code">("form");
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [generatedCode, setGeneratedCode] = useState<string | null>(null);
    const [transferId, setTransferId] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // Form state
    const [acquisitionType, setAcquisitionType] = useState<"purchase" | "trade" | "gift" | "transfer">("purchase");
    const [salePrice, setSalePrice] = useState("");
    const [isPricePublic, setIsPricePublic] = useState(false);
    const [notes, setNotes] = useState("");

    const handleGenerate = async () => {
        setGenerating(true);
        setError(null);
        const result = await generateTransferCode({
            horseId,
            acquisitionType,
            salePrice: salePrice ? parseFloat(salePrice) : undefined,
            isPricePublic,
            notes: notes.trim() || undefined,
        });
        if (result.success && result.code) {
            setGeneratedCode(result.code);
            setStep("code");
        } else {
            setError(result.error || "Failed to generate code.");
        }
        setGenerating(false);
    };

    const handleCopy = async () => {
        if (generatedCode) {
            await navigator.clipboard.writeText(generatedCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleCancel = async () => {
        if (transferId) {
            await cancelTransfer(transferId);
        }
        setIsOpen(false);
        setStep("form");
        setGeneratedCode(null);
        setTransferId(null);
        router.refresh();
    };

    const handleClose = () => {
        setIsOpen(false);
        setStep("form");
        setGeneratedCode(null);
        setError(null);
    };

    void transferId; // will be used when cancel is wired to the generated transfer

    return (
        <>
            <button
                className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge"
                onClick={() => setIsOpen(true)}
                style={{ fontSize: "calc(0.85rem * var(--font-scale))" }}
            >
                📦 Transfer Ownership
            </button>

            {isOpen && createPortal(
                <div className="modal-overlay" onClick={handleClose}>
                    <div className="modal-content max-sm:max-w-full max-w-[420px]" onClick={(e) => e.stopPropagation()}>
                        {step === "form" ? (
                            <>
                                <h3 className="mb-4" >
                                    📦 Transfer &ldquo;{horseName}&rdquo;
                                </h3>
                                <p className="text-[calc(0.8rem*var(--font-scale))] text-muted mb-4" >
                                    Generate a 6-character code to send to the new owner. They&apos;ll enter it on the Claim page to complete the transfer.
                                    <strong> The code expires in 48 hours.</strong>
                                </p>

                                <div className="mb-6">
                                    <label className="block text-sm font-semibold text-ink mb-1">Transfer Type</label>
                                    <select
                                        className="form-select"
                                        value={acquisitionType}
                                        onChange={(e) => setAcquisitionType(e.target.value as typeof acquisitionType)}
                                    >
                                        <option value="purchase">💲 Sale</option>
                                        <option value="trade">🔄 Trade</option>
                                        <option value="gift">🎁 Gift</option>
                                        <option value="transfer">📦 Transfer</option>
                                    </select>
                                </div>

                                {acquisitionType === "purchase" && (
                                    <div className="mb-6">
                                        <label className="block text-sm font-semibold text-ink mb-1">Sale Price</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={salePrice}
                                            onChange={(e) => setSalePrice(e.target.value)}
                                            placeholder="0.00"
                                            min="0"
                                            step="0.01"
                                        />
                                        <label className="gap-[6px] mt-[6px] text-[calc(0.8rem*var(--font-scale))]" style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                                            <input
                                                type="checkbox"
                                                checked={isPricePublic}
                                                onChange={(e) => setIsPricePublic(e.target.checked)}
                                            />
                                            Show price on public Hoofprint
                                        </label>
                                    </div>
                                )}

                                <div className="mb-6">
                                    <label className="block text-sm font-semibold text-ink mb-1">Notes (optional)</label>
                                    <textarea
                                        className="form-input"
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="e.g. Sold at BreyerFest 2026"
                                        rows={2}
                                    />
                                </div>

                                {error && (
                                    <p className="text-[#ef4444] text-[calc(0.8rem*var(--font-scale))] mb-2" >
                                        {error}
                                    </p>
                                )}

                                <div className="gap-2 justify-end mt-4" style={{ display: "flex" }}>
                                    <button className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge" onClick={handleClose}>Cancel</button>
                                    <button className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm" onClick={handleGenerate} disabled={generating}>
                                        {generating ? "Generating…" : "Generate Code"}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <h3 className="mb-4" style={{ textAlign: "center" }}>
                                    🐾 Transfer Code Ready!
                                </h3>
                                <div style={{
                                    textAlign: "center",
                                    padding: "var(--space-lg)",
                                    background: "rgba(245, 158, 11, 0.1)",
                                    borderRadius: "var(--radius-lg)",
                                    border: "2px dashed rgba(245, 158, 11, 0.3)",
                                    marginBottom: "var(--space-md)",
                                }}>
                                    <div style={{
                                        fontFamily: "monospace",
                                        fontSize: "2.5rem",
                                        fontWeight: 800,
                                        letterSpacing: "0.3em",
                                        color: "#f59e0b",
                                    }}>
                                        {generatedCode}
                                    </div>
                                    <button
                                        className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge"
                                        onClick={handleCopy}
                                        style={{ marginTop: "var(--space-sm)", fontSize: "calc(0.8rem * var(--font-scale))" }}
                                    >
                                        {copied ? "✅ Copied!" : "📋 Copy Code"}
                                    </button>
                                </div>
                                <p className="text-[calc(0.8rem*var(--font-scale))] text-muted" style={{ textAlign: "center" }}>
                                    Send this code to the buyer/receiver. They can enter it on
                                    <strong> /claim</strong> to complete the transfer.
                                    <br />
                                    <span className="text-[var(--color-accent, #f59e0b)]" >Expires in 48 hours.</span>
                                </p>
                                <div className="gap-2 mt-4" style={{ display: "flex", justifyContent: "center" }}>
                                    <button className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge text-[#ef4444]" onClick={handleCancel}>
                                        Cancel Transfer
                                    </button>
                                    <button className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm" onClick={handleClose}>
                                        Done
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>,
                document.body)}
        </>
    );
}
