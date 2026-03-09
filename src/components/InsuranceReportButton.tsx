"use client";

import { useState, useCallback } from "react";
import { pdf } from "@react-pdf/renderer";
import InsuranceReport from "@/components/pdf/InsuranceReport";
import { getInsuranceReportData } from "@/app/actions/insurance-report";
import type { InsuranceReportPayload } from "@/app/actions/insurance-report";

export default function InsuranceReportButton() {
    const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = useCallback(async () => {
        setStatus("loading");
        setError(null);

        try {
            // Fetch data from server action
            const result = await getInsuranceReportData();
            if (!result.success || !result.data) {
                throw new Error(result.error || "Failed to fetch report data");
            }

            const data: InsuranceReportPayload = result.data;

            // Generate PDF client-side
            const blob = await pdf(<InsuranceReport data={data} />).toBlob();

            // Trigger download
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `MHH_Insurance_Report_${new Date().toISOString().split("T")[0]}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            setStatus("idle");
        } catch (err) {
            setStatus("error");
            setError(err instanceof Error ? err.message : "Failed to generate report");
        }
    }, []);

    return (
        <div className="insurance-report-wrapper">
            <button
                className="btn btn-ghost"
                onClick={handleGenerate}
                disabled={status === "loading"}
                id="insurance-report-btn"
                title="Generate a PDF insurance report of your collection"
            >
                {status === "loading" ? (
                    <>
                        <span className="spinner-inline" /> Generating…
                    </>
                ) : (
                    "📄 Insurance Report"
                )}
            </button>
            {status === "error" && error && (
                <span style={{ color: "var(--color-accent-danger)", fontSize: "calc(var(--font-size-xs) * var(--font-scale))", marginLeft: "var(--space-sm)" }}>
                    {error}
                </span>
            )}
        </div>
    );
}
