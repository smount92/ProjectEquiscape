"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { evidencePackToText, type EvidencePack } from "@/lib/deals/evidence";

/**
 * Getting the record OUT.
 *
 * Three ways, because a dispute form is whatever the processor decided
 * it is: a PDF you attach, a printed page you post, or a wall of plain
 * text pasted into a textarea that accepts nothing else. The last one
 * is not a fallback — for several processors' web forms it is the only
 * thing that works, and a beautiful PDF you cannot upload is worth
 * nothing.
 *
 * The PDF renderer is ~1.5 MB, so it is lazy-loaded on click, exactly
 * as InsuranceReportButton does.
 */
export default function EvidencePackActions({
    pack,
    filenameHint,
}: {
    pack: EvidencePack;
    filenameHint: string;
}) {
    const [status, setStatus] = useState<"idle" | "building" | "copied" | "error">("idle");
    const [error, setError] = useState("");

    const download = async () => {
        setStatus("building");
        setError("");
        try {
            const [{ pdf }, { default: DealRecord }] = await Promise.all([
                import("@react-pdf/renderer"),
                import("@/components/pdf/DealRecord"),
            ]);
            const blob = await pdf(<DealRecord pack={pack} />).toBlob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `MHH_Deal_Record_${filenameHint}_${new Date()
                .toISOString()
                .slice(0, 10)}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            setStatus("idle");
        } catch (err) {
            setStatus("error");
            setError(err instanceof Error ? err.message : "The PDF could not be built.");
        }
    };

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(evidencePackToText(pack));
            setStatus("copied");
            setTimeout(() => setStatus("idle"), 2500);
        } catch {
            setStatus("error");
            setError("Your browser blocked the clipboard. Use Print or the PDF instead.");
        }
    };

    return (
        <div className="print:hidden">
            <div className="flex flex-wrap items-center gap-2">
                <Button onClick={download} disabled={status === "building"}>
                    {status === "building" ? "Building the PDF…" : "⬇️ Download as PDF"}
                </Button>
                <Button variant="outline" size="wide" onClick={() => window.print()}>
                    🖨️ Print
                </Button>
                <Button variant="outline" size="wide" onClick={copy}>
                    {status === "copied" ? "✅ Copied" : "📋 Copy as plain text"}
                </Button>
            </div>
            {status === "error" && (
                <p className="text-destructive border-destructive/30 bg-destructive/10 mt-3 mb-0 rounded-md border px-4 py-2 text-sm">
                    {error}
                </p>
            )}
        </div>
    );
}
