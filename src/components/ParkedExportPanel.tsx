"use client";

import { useState, useCallback, useRef } from "react";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import { parkHorse, unparkHorse, getCoaData } from "@/app/actions/parked-export";

interface ParkedExportPanelProps {
    horseId: string;
    horseName: string;
    isParked: boolean;
    existingPin?: string | null;
}

export default function ParkedExportPanel({
    horseId,
    horseName,
    isParked: initialIsParked,
    existingPin,
}: ParkedExportPanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isParked, setIsParked] = useState(initialIsParked);
    const [pin, setPin] = useState<string | null>(existingPin || null);
    const [status, setStatus] = useState<"idle" | "parking" | "unparking" | "downloading">("idle");
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // Ref to the hidden QRCodeCanvas for PNG export
    const qrCanvasRef = useRef<HTMLDivElement>(null);

    const handlePark = useCallback(async () => {
        setStatus("parking");
        setError(null);
        const result = await parkHorse(horseId);
        if (result.success && result.pin) {
            setPin(result.pin);
            setIsParked(true);
        } else {
            setError(result.error || "Failed to park horse");
        }
        setStatus("idle");
    }, [horseId]);

    const handleUnpark = useCallback(async () => {
        setStatus("unparking");
        setError(null);
        const result = await unparkHorse(horseId);
        if (result.success) {
            setPin(null);
            setIsParked(false);
            setIsOpen(false);
        } else {
            setError(result.error || "Failed to unpark horse");
        }
        setStatus("idle");
    }, [horseId]);

    const handleCopyPin = useCallback(async () => {
        if (pin) {
            await navigator.clipboard.writeText(pin);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }, [pin]);

    const handleDownloadCoA = useCallback(async () => {
        setStatus("downloading");
        setError(null);
        try {
            const result = await getCoaData(horseId);
            if (!result.success || !result.data) throw new Error(result.error);

            // Grab the QR canvas from the hidden element and convert to PNG data URI
            const canvasEl = qrCanvasRef.current?.querySelector("canvas");
            const qrDataUri = canvasEl ? canvasEl.toDataURL("image/png") : ""; // fallback: empty (QR will be blank in PDF, but won't crash)

            // Lazy-load react-pdf (1.5MB) only when generating
            const [{ pdf }, { default: CertificateOfAuthenticity }] = await Promise.all([
                import("@react-pdf/renderer"),
                import("@/components/pdf/CertificateOfAuthenticity"),
            ]);

            // Generate PDF
            const blob = await pdf(<CertificateOfAuthenticity data={{ ...result.data, qrDataUri }} />).toBlob();

            // Download
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `CoA_${horseName.replace(/\s+/g, "_")}_${result.data.pin}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to generate CoA");
        }
        setStatus("idle");
    }, [horseId, horseName]);

    const claimUrl = pin ? `https://modelhorsehub.com/claim?pin=${pin}` : "";

    if (!isOpen) {
        return (
            <button
                className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
                onClick={() => setIsOpen(true)}
                id="park-export-btn"
                title="Sell off-platform with a Certificate of Authenticity"
            >
                {isParked ? "🔒 Parked — View CoA" : "📤 Sell Off-Platform"}
            </button>
        );
    }

    return (
        <div className="bg-card border-edge animate-fade-in-up mt-6 rounded-lg border p-12 shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]">
            <div className="mb-6 justify-between" style={{ display: "flex", alignItems: "center" }}>
                <h3>{isParked ? "🔒 Horse is Parked" : "📤 Sell Off-Platform"}</h3>
                <button
                    className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
                    onClick={() => setIsOpen(false)}
                >
                    ✕
                </button>
            </div>

            {!isParked ? (
                /* ── Not Parked: Explain + Park button ── */
                <div>
                    <p className="text-ink-light mb-6 leading-[1.6]">
                        Selling <strong>{horseName}</strong> at a live show, via Facebook, or another platform? Park it
                        here and get a <strong>Certificate of Authenticity</strong> with a QR code the buyer can scan to
                        claim the horse — and inherit its full Hoofprint™ history.
                    </p>
                    <ul className="m-[0 0 var(--space-md)] list-none p-0">
                        <li>1. Click &quot;Park This Horse&quot; — a unique claim PIN is generated</li>
                        <li>2. Download or print the Certificate of Authenticity</li>
                        <li>3. Give it to the buyer with the model</li>
                        <li>4. They scan the QR or enter the PIN to claim the horse on MHH</li>
                    </ul>
                    <button
                        className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
                        onClick={handlePark}
                        disabled={status === "parking"}
                        id="park-horse-btn"
                        style={{ marginTop: "var(--space-lg)" }}
                    >
                        {status === "parking" ? (
                            <>
                                <span className="spinner-inline" /> Parking…
                            </>
                        ) : (
                            "🔒 Park This Horse"
                        )}
                    </button>
                </div>
            ) : (
                /* ── Parked: Show PIN, QR, download CoA ── */
                <div>
                    <div className="parked-export-status">
                        <p className="text-ink-light mb-4">
                            <strong>{horseName}</strong> is parked. Its Hoofprint™ history is frozen until claimed by a
                            new owner.
                        </p>
                    </div>

                    {/* PIN Display */}
                    <div className="bg-elevated border-forest mb-6 flex items-center gap-4 rounded-lg border-[2px] p-6">
                        <span className="text-muted text-sm font-semibold">Claim PIN</span>
                        <span className="parked-export-pin">{pin}</span>
                        <button
                            className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
                            onClick={handleCopyPin}
                            style={{ fontSize: "calc(var(--font-size-sm) * var(--font-scale))" }}
                        >
                            {copied ? "✅ Copied!" : "📋 Copy"}
                        </button>
                    </div>

                    {/* QR Code (visible) */}
                    {pin && (
                        <div className="bg-elevated border-edge mb-6 flex flex-col items-center rounded-lg border p-6">
                            <QRCodeSVG value={claimUrl} size={180} level="M" bgColor="transparent" fgColor="#e0e0e0" />
                            <p className="text-muted mt-2 text-xs">Scan to claim at modelhorsehub.com</p>
                        </div>
                    )}

                    {/* Hidden QR canvas for PDF export (white bg, dark QR) */}
                    {pin && (
                        <div
                            ref={qrCanvasRef}
                            aria-hidden="true"
                            style={{ position: "absolute", left: "-9999px", top: 0 }}
                        >
                            <QRCodeCanvas value={claimUrl} size={400} level="M" bgColor="#ffffff" fgColor="#1a1a2e" />
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                        <button
                            className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
                            onClick={handleDownloadCoA}
                            disabled={status === "downloading"}
                            id="download-coa-btn"
                        >
                            {status === "downloading" ? (
                                <>
                                    <span className="spinner-inline" /> Generating…
                                </>
                            ) : (
                                "📄 Download Certificate of Authenticity"
                            )}
                        </button>
                        <button
                            className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
                            onClick={handleUnpark}
                            disabled={status === "unparking"}
                            id="unpark-btn"
                            style={{ color: "var(--color-accent-danger)" }}
                        >
                            {status === "unparking" ? "Unparking…" : "Cancel & Unpark"}
                        </button>
                    </div>
                </div>
            )}

            {error && (
                <div className="text-danger mt-4 rounded-md border border-[rgba(240,108,126,0.3)] bg-[rgba(240,108,126,0.1)] px-6 py-4 text-sm">
                    {error}
                </div>
            )}
        </div>
    );
}
