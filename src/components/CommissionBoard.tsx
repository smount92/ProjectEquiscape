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

    const currentTab = TABS.find((t) => t.key === activeTab) || TABS[0];
    const filteredCommissions = commissions.filter((c) => currentTab.statuses.includes(c.status));

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
                {TABS.map((tab) => {
                    const count = commissions.filter((c) => tab.statuses.includes(c.status)).length;
                    return (
                        <button
                            key={tab.key}
                            className={`studio-tab ${activeTab === tab.key ? "active" : ""}`}
                            onClick={() => setActiveTab(tab.key)}
                        >
                            {tab.label}
                            {count > 0 && (
                                <span className="bg-card text-muted transition-all-badge flex cursor-pointer items-center gap-1 rounded-md border border-[transparent] px-4 py-2 text-[calc(0.85rem*var(--font-scale))] whitespace-nowrap max-[480px]:rounded-[var(--radius-md)]">
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Commission Cards */}
            {filteredCommissions.length === 0 ? (
                <div
                    className="bg-bg-card border-edge border-edge rounded-lg border p-12 shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]"
                    style={{ textAlign: "center" }}
                >
                    <p className="text-muted text-[calc(0.9rem*var(--font-scale))]">No commissions in this category.</p>
                </div>
            ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4 max-md:grid-cols-1">
                    {filteredCommissions.map((c) => (
                        <div
                            key={c.id}
                            className="border-edge flex flex-col rounded-lg border bg-[var(--color-bg-elevated)] p-6 transition-all hover:-translate-y-[1px] hover:border-[rgba(139,92,246,0.3)]"
                        >
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <span className="text-[calc(0.95rem*var(--font-scale))] font-bold">
                                    {c.commissionType}
                                </span>
                                <span
                                    className="inline-flex items-center rounded-full px-[10px] py-[3px] text-[calc(0.7rem*var(--font-scale))] font-semibold whitespace-nowrap"
                                    style={{
                                        backgroundColor: `${STATUS_COLORS[c.status]}20`,
                                        color: STATUS_COLORS[c.status],
                                        border: `1px solid ${STATUS_COLORS[c.status]}40`,
                                    }}
                                >
                                    {c.statusLabel}
                                </span>
                            </div>

                            <div className="text-muted mb-2 flex gap-4 text-[calc(0.8rem*var(--font-scale))]">
                                {c.clientAlias && <span>👤 @{c.clientAlias}</span>}
                                {c.slotNumber && <span>📌 Slot {c.slotNumber}</span>}
                                {c.priceQuoted && <span>💰 ${c.priceQuoted}</span>}
                            </div>

                            <p className="text-ink-light mb-2 text-[calc(0.85rem*var(--font-scale))] leading-normal">
                                {c.description.length > 120 ? c.description.substring(0, 120) + "…" : c.description}
                            </p>

                            <div className="border-edge mt-auto flex items-center justify-between border-t pt-2">
                                <span className="text-muted text-[calc(0.7rem*var(--font-scale))]">
                                    {new Date(c.lastUpdateAt).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                    })}
                                </span>

                                <div className="gap-1" style={{ display: "flex", flexWrap: "wrap" }}>
                                    <Link
                                        href={`/studio/commission/${c.id}`}
                                        className="hover:no-underline-min-h)] text-ink-light border-edge inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] bg-transparent px-8 py-2 font-sans text-base leading-none font-semibold no-underline transition-all duration-150"
                                        style={{ fontSize: "calc(0.7rem * var(--font-scale))", padding: "4px 8px" }}
                                    >
                                        View
                                    </Link>

                                    {/* Quick actions based on status */}
                                    {c.status === "requested" && (
                                        <>
                                            <button
                                                className="hover:no-underline-min-h)] bg-forest text-inverse inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-0 border-[transparent] px-8 py-2 font-sans text-base leading-none font-semibold no-underline shadow-sm transition-all duration-150"
                                                style={{
                                                    fontSize: "calc(0.7rem * var(--font-scale))",
                                                    padding: "4px 8px",
                                                }}
                                                onClick={() => handleStatusChange(c.id, "accepted")}
                                                disabled={acting === c.id}
                                            >
                                                ✅ Accept
                                            </button>
                                            <button
                                                className="hover:no-underline-min-h)] text-ink-light border-edge inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] bg-transparent px-8 py-2 font-sans text-base leading-none font-semibold no-underline transition-all duration-150"
                                                style={{
                                                    fontSize: "calc(0.7rem * var(--font-scale))",
                                                    padding: "4px 8px",
                                                    color: "#ef4444",
                                                }}
                                                onClick={() => handleStatusChange(c.id, "declined")}
                                                disabled={acting === c.id}
                                            >
                                                ✕ Decline
                                            </button>
                                        </>
                                    )}
                                    {c.status === "accepted" && (
                                        <button
                                            className="hover:no-underline-min-h)] bg-forest text-inverse inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-0 border-[transparent] px-8 py-2 font-sans text-base leading-none font-semibold no-underline shadow-sm transition-all duration-150"
                                            style={{ fontSize: "calc(0.7rem * var(--font-scale))", padding: "4px 8px" }}
                                            onClick={() => handleStatusChange(c.id, "in_progress")}
                                            disabled={acting === c.id}
                                        >
                                            🎨 Start
                                        </button>
                                    )}
                                    {c.status === "in_progress" && (
                                        <button
                                            className="hover:no-underline-min-h)] bg-forest text-inverse inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-0 border-[transparent] px-8 py-2 font-sans text-base leading-none font-semibold no-underline shadow-sm transition-all duration-150"
                                            style={{ fontSize: "calc(0.7rem * var(--font-scale))", padding: "4px 8px" }}
                                            onClick={() => handleStatusChange(c.id, "review")}
                                            disabled={acting === c.id}
                                        >
                                            👁️ Submit for Review
                                        </button>
                                    )}
                                    {c.status === "review" && (
                                        <button
                                            className="hover:no-underline-min-h)] bg-forest text-inverse inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-0 border-[transparent] px-8 py-2 font-sans text-base leading-none font-semibold no-underline shadow-sm transition-all duration-150"
                                            style={{ fontSize: "calc(0.7rem * var(--font-scale))", padding: "4px 8px" }}
                                            onClick={() => handleStatusChange(c.id, "completed")}
                                            disabled={acting === c.id}
                                        >
                                            ✅ Complete
                                        </button>
                                    )}
                                    {c.status === "completed" && (
                                        <button
                                            className="hover:no-underline-min-h)] bg-forest text-inverse inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-0 border-[transparent] px-8 py-2 font-sans text-base leading-none font-semibold no-underline shadow-sm transition-all duration-150"
                                            style={{ fontSize: "calc(0.7rem * var(--font-scale))", padding: "4px 8px" }}
                                            onClick={() => handleStatusChange(c.id, "delivered")}
                                            disabled={acting === c.id}
                                        >
                                            📦 Mark Delivered
                                        </button>
                                    )}
                                    {c.status === "revision" && (
                                        <button
                                            className="hover:no-underline-min-h)] bg-forest text-inverse inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-0 border-[transparent] px-8 py-2 font-sans text-base leading-none font-semibold no-underline shadow-sm transition-all duration-150"
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
