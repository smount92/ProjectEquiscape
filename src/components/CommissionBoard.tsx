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
                                <span className="studio-tab-badge">{count}</span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Commission Cards */}
            {filteredCommissions.length === 0 ? (
                <div className="card" style={{ padding: "var(--space-2xl)", textAlign: "center" }}>
                    <p style={{ color: "var(--color-text-muted)", fontSize: "calc(0.9rem * var(--font-scale))" }}>
                        No commissions in this category.
                    </p>
                </div>
            ) : (
                <div className="studio-commission-grid">
                    {filteredCommissions.map(c => (
                        <div key={c.id} className="studio-commission-card">
                            <div className="studio-commission-header">
                                <span className="studio-commission-type">{c.commissionType}</span>
                                <span
                                    className="commission-status-badge"
                                    style={{ backgroundColor: `${STATUS_COLORS[c.status]}20`, color: STATUS_COLORS[c.status], border: `1px solid ${STATUS_COLORS[c.status]}40` }}
                                >
                                    {c.statusLabel}
                                </span>
                            </div>

                            <div className="studio-commission-meta">
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

                            <p className="studio-commission-desc">
                                {c.description.length > 120
                                    ? c.description.substring(0, 120) + "…"
                                    : c.description}
                            </p>

                            <div className="studio-commission-footer">
                                <span style={{ fontSize: "calc(0.7rem * var(--font-scale))", color: "var(--color-text-muted)" }}>
                                    {new Date(c.lastUpdateAt).toLocaleDateString("en-US", {
                                        month: "short", day: "numeric",
                                    })}
                                </span>

                                <div style={{ display: "flex", gap: "var(--space-xs)", flexWrap: "wrap" }}>
                                    <Link
                                        href={`/studio/commission/${c.id}`}
                                        className="btn btn-ghost"
                                        style={{ fontSize: "calc(0.7rem * var(--font-scale))", padding: "4px 8px" }}
                                    >
                                        View
                                    </Link>

                                    {/* Quick actions based on status */}
                                    {c.status === "requested" && (
                                        <>
                                            <button
                                                className="btn btn-primary"
                                                style={{ fontSize: "calc(0.7rem * var(--font-scale))", padding: "4px 8px" }}
                                                onClick={() => handleStatusChange(c.id, "accepted")}
                                                disabled={acting === c.id}
                                            >
                                                ✅ Accept
                                            </button>
                                            <button
                                                className="btn btn-ghost"
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
                                            className="btn btn-primary"
                                            style={{ fontSize: "calc(0.7rem * var(--font-scale))", padding: "4px 8px" }}
                                            onClick={() => handleStatusChange(c.id, "in_progress")}
                                            disabled={acting === c.id}
                                        >
                                            🎨 Start
                                        </button>
                                    )}
                                    {c.status === "in_progress" && (
                                        <button
                                            className="btn btn-primary"
                                            style={{ fontSize: "calc(0.7rem * var(--font-scale))", padding: "4px 8px" }}
                                            onClick={() => handleStatusChange(c.id, "review")}
                                            disabled={acting === c.id}
                                        >
                                            👁️ Submit for Review
                                        </button>
                                    )}
                                    {c.status === "review" && (
                                        <button
                                            className="btn btn-primary"
                                            style={{ fontSize: "calc(0.7rem * var(--font-scale))", padding: "4px 8px" }}
                                            onClick={() => handleStatusChange(c.id, "completed")}
                                            disabled={acting === c.id}
                                        >
                                            ✅ Complete
                                        </button>
                                    )}
                                    {c.status === "completed" && (
                                        <button
                                            className="btn btn-primary"
                                            style={{ fontSize: "calc(0.7rem * var(--font-scale))", padding: "4px 8px" }}
                                            onClick={() => handleStatusChange(c.id, "delivered")}
                                            disabled={acting === c.id}
                                        >
                                            📦 Mark Delivered
                                        </button>
                                    )}
                                    {c.status === "revision" && (
                                        <button
                                            className="btn btn-primary"
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
