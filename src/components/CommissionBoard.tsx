"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateCommissionStatus } from "@/app/actions/art-studio";
import type { Commission } from "@/app/actions/art-studio";

const TABS = [
    { key: "requested", label: "📥 Requests", statuses: ["requested"] },
    { key: "active", label: "🎨 Active", statuses: ["accepted", "in_progress", "revision"] },
    { key: "review", label: "👁️ Review", statuses: ["review"] },
    { key: "done", label: "✅ Done", statuses: ["completed", "delivered"] },
    { key: "closed", label: "🚫 Closed", statuses: ["declined", "cancelled"] },
];

const STATUS_COLORS: Record<string, string> = {
    requested: "#6b7280",
    accepted: "#3b82f6",
    in_progress: "#f59e0b",
    review: "#8b5cf6",
    revision: "#f97316",
    completed: "#22c55e",
    delivered: "#14b8a6",
    declined: "#ef4444",
    cancelled: "#ef4444",
};

export default function CommissionBoard({ commissions }: { commissions: Commission[] }) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState("requested");
    const [acting, setActing] = useState<string | null>(null);

    const currentTab = TABS.find(t => t.key === activeTab) || TABS[0];
    const filteredCommissions = commissions.filter(c => currentTab.statuses.includes(c.status));

    const handleStatusChange = async (commissionId: string, newStatus: string) => {
        setActing(commissionId);
        await updateCommissionStatus(commissionId, newStatus);
        router.refresh();
        setActing(null);
    };

    return (
        <div className="animate-fade-in-up">
            {/* Tabs */}
            <div className="studio-tabs">
                {TABS.map(tab => {
                    const count = commissions.filter(c => tab.statuses.includes(c.status)).length;
                    return (
                        <button
                            key={tab.key}
                            className={`studio-tab ${activeTab === tab.key ? "active" : ""}`}
                            onClick={() => setActiveTab(tab.key)}
                        >
                            {tab.label}
                            {count > 0 && (
                                <span className="flex items-center gap-1 py-2 px-4 rounded-md border border-[transparent] bg-card max-[480px]:rounded-[var(--radius-md)] text-muted text-[calc(0.85rem*var(--font-scale))] cursor-pointer whitespace-nowrap transition-all-badge">{count}</span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Commission Cards */}
            {filteredCommissions.length === 0 ? (
                <div className="bg-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-12 shadow-md transition-all p-12" style={{ textAlign: "center" }}>
                    <p className="text-muted text-[calc(0.9rem*var(--font-scale))]" >
                        No commissions in this category.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] max-md:grid-cols-1 gap-4">
                    {filteredCommissions.map(c => (
                        <div key={c.id} className="flex flex-col p-6 rounded-lg bg-[var(--color-bg-elevated)] border border-edge transition-all hover:border-[rgba(139,92,246,0.3)] hover:-translate-y-[1px]">
                            <div className="flex justify-between items-center mb-2 gap-2">
                                <span className="font-bold text-[calc(0.95rem*var(--font-scale))]">{c.commissionType}</span>
                                <span
                                    className="inline-flex items-center py-[3px] px-[10px] rounded-full text-[calc(0.7rem*var(--font-scale))] font-semibold whitespace-nowrap"
                                    style={{ backgroundColor: `${STATUS_COLORS[c.status]}20`, color: STATUS_COLORS[c.status], border: `1px solid ${STATUS_COLORS[c.status]}40` }}
                                >
                                    {c.statusLabel}
                                </span>
                            </div>

                            <div className="flex gap-4 text-[calc(0.8rem*var(--font-scale))] text-muted mb-2">
                                {c.clientAlias && (
                                    <span>👤 @{c.clientAlias}</span>
                                )}
                                {c.slotNumber && (
                                    <span>📌 Slot {c.slotNumber}</span>
                                )}
                                {c.priceQuoted && (
                                    <span>💰 ${c.priceQuoted}</span>
                                )}
                            </div>

                            <p className="text-[calc(0.85rem*var(--font-scale))] text-ink-light leading-normal mb-2">
                                {c.description.length > 120
                                    ? c.description.substring(0, 120) + "…"
                                    : c.description}
                            </p>

                            <div className="flex justify-between items-center mt-auto pt-2 border-t border-edge">
                                <span className="text-[calc(0.7rem*var(--font-scale))] text-muted" >
                                    {new Date(c.lastUpdateAt).toLocaleDateString("en-US", {
                                        month: "short", day: "numeric",
                                    })}
                                </span>

                                <div className="gap-1" style={{ display: "flex", flexWrap: "wrap" }}>
                                    <Link
                                        href={`/studio/commission/${c.id}`}
                                        className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge"
                                        style={{ fontSize: "calc(0.7rem * var(--font-scale))", padding: "4px 8px" }}
                                    >
                                        View
                                    </Link>

                                    {/* Quick actions based on status */}
                                    {c.status === "requested" && (
                                        <>
                                            <button
                                                className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm"
                                                style={{ fontSize: "calc(0.7rem * var(--font-scale))", padding: "4px 8px" }}
                                                onClick={() => handleStatusChange(c.id, "accepted")}
                                                disabled={acting === c.id}
                                            >
                                                ✅ Accept
                                            </button>
                                            <button
                                                className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge"
                                                style={{ fontSize: "calc(0.7rem * var(--font-scale))", padding: "4px 8px", color: "#ef4444" }}
                                                onClick={() => handleStatusChange(c.id, "declined")}
                                                disabled={acting === c.id}
                                            >
                                                ✕ Decline
                                            </button>
                                        </>
                                    )}
                                    {c.status === "accepted" && (
                                        <button
                                            className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm"
                                            style={{ fontSize: "calc(0.7rem * var(--font-scale))", padding: "4px 8px" }}
                                            onClick={() => handleStatusChange(c.id, "in_progress")}
                                            disabled={acting === c.id}
                                        >
                                            🎨 Start
                                        </button>
                                    )}
                                    {c.status === "in_progress" && (
                                        <button
                                            className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm"
                                            style={{ fontSize: "calc(0.7rem * var(--font-scale))", padding: "4px 8px" }}
                                            onClick={() => handleStatusChange(c.id, "review")}
                                            disabled={acting === c.id}
                                        >
                                            👁️ Submit for Review
                                        </button>
                                    )}
                                    {c.status === "review" && (
                                        <button
                                            className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm"
                                            style={{ fontSize: "calc(0.7rem * var(--font-scale))", padding: "4px 8px" }}
                                            onClick={() => handleStatusChange(c.id, "completed")}
                                            disabled={acting === c.id}
                                        >
                                            ✅ Complete
                                        </button>
                                    )}
                                    {c.status === "completed" && (
                                        <button
                                            className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm"
                                            style={{ fontSize: "calc(0.7rem * var(--font-scale))", padding: "4px 8px" }}
                                            onClick={() => handleStatusChange(c.id, "delivered")}
                                            disabled={acting === c.id}
                                        >
                                            📦 Mark Delivered
                                        </button>
                                    )}
                                    {c.status === "revision" && (
                                        <button
                                            className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm"
                                            style={{ fontSize: "calc(0.7rem * var(--font-scale))", padding: "4px 8px" }}
                                            onClick={() => handleStatusChange(c.id, "in_progress")}
                                            disabled={acting === c.id}
                                        >
                                            🎨 Resume Work
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
