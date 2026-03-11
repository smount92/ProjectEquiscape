"use client";

import { useState, useEffect, useCallback } from "react";
import StableGrid from "@/components/StableGrid";
import StableLedger from "@/components/StableLedger";

interface HorseCardData {
    id: string;
    customName: string;
    finishType: string;
    conditionGrade: string;
    createdAt: string;
    refName: string;
    releaseLine: string | null;
    thumbnailUrl: string | null;
    collectionName: string | null;
    sculptor: string | null;
    tradeStatus: string;
    moldName: string | null;
    releaseName: string | null;
    assetCategory?: string;
    vaultValue?: number | null;
}

export default function DashboardShell({
    horseCards,
}: {
    horseCards: HorseCardData[];
}) {
    const [view, setView] = useState<"grid" | "ledger">("grid");

    // Persist view preference in localStorage
    useEffect(() => {
        const saved = localStorage.getItem("mhh-dashboard-view");
        if (saved === "grid" || saved === "ledger") setView(saved);
    }, []);

    const handleViewChange = useCallback((v: "grid" | "ledger") => {
        setView(v);
        localStorage.setItem("mhh-dashboard-view", v);
    }, []);

    return (
        <>
            {/* View Toggle */}
            {horseCards.length > 0 && (
                <div className="view-toggle-row">
                    <div className="view-toggle" id="dashboard-view-toggle">
                        <button
                            className={`view-toggle-btn ${view === "grid" ? "active" : ""}`}
                            onClick={() => handleViewChange("grid")}
                            aria-label="Gallery view"
                        >
                            🖼️ Gallery
                        </button>
                        <button
                            className={`view-toggle-btn ${view === "ledger" ? "active" : ""}`}
                            onClick={() => handleViewChange("ledger")}
                            aria-label="Ledger view"
                        >
                            📋 Ledger
                        </button>
                    </div>
                </div>
            )}

            {/* Content */}
            {view === "grid" ? (
                <StableGrid horseCards={horseCards} />
            ) : (
                <StableLedger horseCards={horseCards} />
            )}
        </>
    );
}
