"use client";

import { useState, useEffect, useCallback } from "react";
import { getInsuranceReportData } from "@/app/actions/insurance-report";
import type { InsuranceReportPayload } from "@/app/actions/insurance-report";

interface Collection {
    id: string;
    name: string;
    emoji: string;
}

export default function InsuranceReportButton() {
    const [status, setStatus] = useState<"idle" | "loading" | "error" | "picking">("idle");
    const [error, setError] = useState<string | null>(null);
    const [collections, setCollections] = useState<Collection[]>([]);
    const [selectedCollection, setSelectedCollection] = useState<string>("");
    const [horseCount, setHorseCount] = useState<number | null>(null);

    // Fetch collections on mount
    useEffect(() => {
        import("@/app/actions/collections").then(({ getCollectionsAction }) => {
            getCollectionsAction().then((cols: { id: string; name: string; description: string | null }[]) => {
                setCollections(cols.map(c => ({ id: c.id, name: c.name, emoji: "📁" })));
            });
        });
    }, []);

    // Fetch rough horse count for OOM warning
    useEffect(() => {
        import("@/lib/supabase/client").then(({ createClient }) => {
            const supabase = createClient();
            supabase.auth.getUser().then(({ data: { user } }) => {
                if (user) {
                    supabase
                        .from("user_horses")
                        .select("id", { count: "exact", head: true })
                        .eq("owner_id", user.id)
                        .then(({ count }) => setHorseCount(count ?? 0));
                }
            });
        });
    }, []);

    const handleGenerate = useCallback(async (collectionId?: string) => {
        setStatus("loading");
        setError(null);

        try {
            const result = await getInsuranceReportData(collectionId || undefined);
            if (!result.success || !result.data) {
                throw new Error(result.error || "Failed to fetch report data");
            }

            const data: InsuranceReportPayload = result.data;

            // Lazy-load react-pdf (1.5MB) only when generating
            const [{ pdf }, { default: InsuranceReport }] = await Promise.all([
                import("@react-pdf/renderer"),
                import("@/components/pdf/InsuranceReport"),
            ]);

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

    const handleClick = () => {
        if (collections.length > 0) {
            setStatus("picking");
            setSelectedCollection("");
        } else {
            handleGenerate();
        }
    };

    const handleConfirm = () => {
        setStatus("idle");
        handleGenerate(selectedCollection || undefined);
    };

    const handleCancel = () => {
        setStatus("idle");
        setSelectedCollection("");
    };

    return (
        <div className="insurance-report-wrapper">
            <button
                className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge"
                onClick={handleClick}
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
                <span className="text-danger text-xs ml-2" >
                    {error}
                </span>
            )}

            {/* Collection Picker Modal */}
            {status === "picking" && (
                <div className="modal-backdrop" onClick={handleCancel}>
                    <div className="modal-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all max-w-[400]" onClick={(e) => e.stopPropagation()}>
                        <h3 className="mb-4" >📄 Insurance Report Scope</h3>
                        <p className="text-ink-light text-sm mb-6" >
                            Choose which horses to include in your insurance report.
                        </p>

                        <select
                            className="form-select"
                            value={selectedCollection}
                            onChange={(e) => setSelectedCollection(e.target.value)}
                            style={{ width: "100%", marginBottom: "var(--space-md)" }}
                            id="insurance-collection-select"
                        >
                            <option value="">🐎 Entire Stable</option>
                            {collections.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.emoji} {c.name}
                                </option>
                            ))}
                        </select>

                        {!selectedCollection && horseCount !== null && horseCount > 200 && (
                            <div className="py-4 px-6 rounded-lg bg-[rgba(44,85,69,0.08)] border border-[rgba(44,85,69,0.2)] text-sm leading-relaxed mt-4 mb-4 text-[var(--color-accent-warning, #f59e0b)]">
                                ⚠️ Your stable has {horseCount} models. Generating a full report may be slow. Consider selecting a collection for faster results.
                            </div>
                        )}

                        <div className="gap-2 justify-end" style={{ display: "flex" }}>
                            <button className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge min-h-[36px] py-1 px-6 text-sm" onClick={handleCancel}>
                                Cancel
                            </button>
                            <button className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm min-h-[36px] py-1 px-6 text-sm" onClick={handleConfirm}>
                                Generate Report
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
