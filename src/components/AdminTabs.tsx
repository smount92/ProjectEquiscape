"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { deleteContactMessage } from "@/app/actions/admin";
import MarkReadButton from "@/components/MarkReadButton";
import AdminReplyForm from "@/components/AdminReplyForm";
import FeatureHorseForm from "@/components/FeatureHorseForm";
import CreateShowForm from "@/components/CreateShowForm";
import AdminShowManager from "@/components/AdminShowManager";
import AdminSuggestionsPanel from "@/components/AdminSuggestionsPanel";
import ReportActions from "@/components/ReportActions";
import SuggestionAdminActions from "@/components/SuggestionAdminActions";

interface ContactMessage {
    id: string;
    name: string;
    email: string;
    subject: string | null;
    message: string;
    is_read: boolean;
    created_at: string;
}

interface Show {
    id: string;
    title: string;
    status: string;
    endAt: string | null;
    entryCount: number;
}

interface Suggestion {
    id: string;
    suggestion_type: "mold" | "release" | "resin";
    name: string;
    details: string | null;
    status: string;
    created_at: string;
    submitted_by: string;
    admin_notes: string | null;
}

interface Report {
    id: string;
    targetType: string;
    targetId: string;
    reason: string;
    details: string | null;
    reporterAlias: string;
    createdAt: string;
}

interface CatalogSuggestionAdmin {
    id: string;
    user_id: string;
    suggestion_type: string;
    field_changes: Record<string, unknown>;
    reason: string;
    status: string;
    upvotes: number;
    downvotes: number;
    created_at: string;
    author_alias: string;
    author_approved_count: number;
}

interface AdminTabsProps {
    messages: ContactMessage[];
    unreadCount: number;
    shows: Show[];
    suggestions: Suggestion[];
    reports: Report[];
    catalogSuggestions?: CatalogSuggestionAdmin[];
}

type TabKey = "mailbox" | "shows" | "content" | "reports" | "catalog";

const TABS: { key: TabKey; emoji: string; label: string }[] = [
    { key: "mailbox", emoji: "📬", label: "Mailbox" },
    { key: "shows", emoji: "📸", label: "Shows" },
    { key: "content", emoji: "💡", label: "Content" },
    { key: "reports", emoji: "🚩", label: "Reports" },
    { key: "catalog", emoji: "📚", label: "Catalog" },
];

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });
}

function DeleteMessageButton({ messageId }: { messageId: string }) {
    const [confirming, setConfirming] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const router = useRouter();

    const handleDelete = async () => {
        setDeleting(true);
        const result = await deleteContactMessage(messageId);
        if (result.success) {
            router.refresh();
        }
        setDeleting(false);
        setConfirming(false);
    };

    if (confirming) {
        return (
            <span style={{ display: "inline-flex", gap: "var(--space-xs)", alignItems: "center" }}>
                <button
                    className="admin-mark-btn"
                    style={{ background: "rgba(239, 68, 68, 0.15)", borderColor: "rgba(239, 68, 68, 0.4)", color: "#ef4444" }}
                    onClick={handleDelete}
                    disabled={deleting}
                >
                    {deleting ? "…" : "Confirm"}
                </button>
                <button
                    className="admin-mark-btn bg-[rgba(0, 0, 0, 0.05)] border-edge text-muted"
                    onClick={() => setConfirming(false)}
                    disabled={deleting}
                >
                    Cancel
                </button>
            </span>
        );
    }

    return (
        <button
            className="admin-mark-btn"
            style={{ background: "rgba(239, 68, 68, 0.08)", borderColor: "rgba(239, 68, 68, 0.2)", color: "#ef4444" }}
            onClick={() => setConfirming(true)}
            title="Delete this message"
        >
            🗑️ Delete
        </button>
    );
}

export default function AdminTabs({ messages, unreadCount, shows, suggestions, reports, catalogSuggestions = [] }: AdminTabsProps) {
    const [activeTab, setActiveTab] = useState<TabKey>("mailbox");

    // Restore from localStorage
    useEffect(() => {
        const saved = localStorage.getItem("admin-tab");
        if (saved && TABS.some(t => t.key === saved)) {
            setActiveTab(saved as TabKey);
        }
    }, []);

    const handleTabChange = (key: TabKey) => {
        setActiveTab(key);
        localStorage.setItem("admin-tab", key);
    };

    const getBadge = (key: TabKey): number | null => {
        switch (key) {
            case "mailbox": return unreadCount > 0 ? unreadCount : null;
            case "shows": return shows.length > 0 ? shows.length : null;
            case "content": return suggestions.length > 0 ? suggestions.length : null;
            case "reports": return reports.length > 0 ? reports.length : null;
            case "catalog": return catalogSuggestions.length > 0 ? catalogSuggestions.length : null;
            default: return null;
        }
    };

    return (
        <>
            {/* Tab bar */}
            <div className="admin-tab hover:text-ink-bar">
                {TABS.map((tab) => {
                    const badge = getBadge(tab.key);
                    return (
                        <button
                            key={tab.key}
                            className={`admin-tab ${activeTab === tab.key ? "admin-tab-active" : ""}`}
                            onClick={() => handleTabChange(tab.key)}
                        >
                            <span className="text-[1.1em]">{tab.emoji}</span>
                            <span className="inline">{tab.label}</span>
                            {badge !== null && (
                                <span className={`admin-tab-badge ${tab.key === "reports" && reports.length > 0 ? "admin-tab-badge-alert" : ""}`}>
                                    {badge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Tab content */}
            <div className="min-h-[300px]">
                {activeTab === "mailbox" && (
                    <MailboxTab messages={messages} />
                )}
                {activeTab === "shows" && (
                    <ShowsTab shows={shows} />
                )}
                {activeTab === "content" && (
                    <ContentTab suggestions={suggestions} />
                )}
                {activeTab === "reports" && (
                    <ReportsTab reports={reports} />
                )}
                {activeTab === "catalog" && (
                    <CatalogTab suggestions={catalogSuggestions} />
                )}
            </div>
        </>
    );
}

/* ═══════════════════════════════════════════
   Mailbox Tab
   ═══════════════════════════════════════════ */
function MailboxTab({ messages }: { messages: ContactMessage[] }) {
    if (messages.length === 0) {
        return (
            <div className="card shelf-empty">
                <div className="shelf-empty-icon">📬</div>
                <h2>No Messages Yet</h2>
                <p>Contact form submissions will appear here.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            {messages.map((msg) => (
                <div
                    key={msg.id}
                    className={`admin-message ${msg.is_read ? "admin-message-read" : "admin-message-unread"}`}
                >
                    <div className="py-4 px-6 bg-glass border border-edge rounded-lg transition-all-header">
                        <div className="py-4 px-6 bg-glass border border-edge rounded-lg transition-all-sender">
                            <span className="py-4 px-6 bg-glass border border-edge rounded-lg transition-all-name">{msg.name}</span>
                            <a href={`mailto:${msg.email}`} className="py-4 px-6 bg-glass border border-edge rounded-lg transition-all-email">
                                {msg.email}
                            </a>
                        </div>
                        <div className="py-4 px-6 bg-glass border border-edge rounded-lg transition-all-actions">
                            <span className="py-4 px-6 bg-glass border border-edge rounded-lg transition-all-date">
                                {formatDate(msg.created_at)}
                            </span>
                        </div>
                    </div>
                    {msg.subject && (
                        <div className="py-4 px-6 bg-glass border border-edge rounded-lg transition-all-subject">
                            {!msg.is_read && <span className="w-[8px] h-[8px] rounded-full bg-forest shrink-0" />}
                            {msg.subject}
                        </div>
                    )}
                    <div className="py-4 px-6 bg-glass border border-edge rounded-lg transition-all-body">{msg.message}</div>
                    <div className="py-4 px-6 bg-glass border border-edge rounded-lg transition-all-footer">
                        <AdminReplyForm
                            messageId={msg.id}
                            recipientEmail={msg.email}
                            recipientName={msg.name}
                            originalSubject={msg.subject}
                            originalMessage={msg.message}
                        />
                        <MarkReadButton messageId={msg.id} isRead={msg.is_read} />
                        <DeleteMessageButton messageId={msg.id} />
                    </div>
                </div>
            ))}
        </div>
    );
}

/* ═══════════════════════════════════════════
   Shows Tab — Create + Manage side-by-side
   ═══════════════════════════════════════════ */
function ShowsTab({ shows }: { shows: Show[] }) {
    return (
        <div className="admin-grid grid-cols-[repeat(auto-fill, minmax(300px, 1fr))] gap-6">
            <div>
                <h3 className="flex items-center gap-2 text-base font-bold mb-4">📸 Create Photo Show</h3>
                <CreateShowForm />
            </div>
            <div>
                <h3 className="flex items-center gap-2 text-base font-bold mb-4">🎛️ Manage Shows <span className="mt-6-count">{shows.length}</span></h3>
                <AdminShowManager shows={shows} />
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════
   Content Tab — Suggestions + Feature Horse
   ═══════════════════════════════════════════ */
function ContentTab({ suggestions }: { suggestions: Suggestion[] }) {
    return (
        <div className="admin-content-grid">
            <div>
                <h3 className="flex items-center gap-2 text-base font-bold mb-4">💡 Database Suggestions <span className="mt-6-count">{suggestions.length} pending</span></h3>
                <AdminSuggestionsPanel suggestions={suggestions} />
            </div>
            <div>
                <h3 className="flex items-center gap-2 text-base font-bold mb-4">🌟 Feature a Horse</h3>
                <FeatureHorseForm />
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════
   Reports Tab
   ═══════════════════════════════════════════ */
function ReportsTab({ reports }: { reports: Report[] }) {
    if (reports.length === 0) {
        return (
            <div className="card shelf-empty">
                <div className="shelf-empty-icon">🎉</div>
                <h2>All Clear</h2>
                <p>No open reports to review.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            {reports.map(report => (
                <div key={report.id} className="py-4 px-6 bg-glass border border-edge rounded-lg transition-all">
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-xs)" }}>
                        <strong>{report.reason}</strong>
                        <span style={{ fontSize: "calc(var(--font-size-xs) * var(--font-scale))", color: "var(--color-text-muted)" }}>
                            {report.targetType} · {new Date(report.createdAt).toLocaleDateString()}
                        </span>
                    </div>
                    <p style={{ fontSize: "calc(var(--font-size-sm) * var(--font-scale))", marginBottom: "var(--space-xs)" }}>
                        Reported by: {report.reporterAlias} · Target: {report.targetId.slice(0, 8)}…
                    </p>
                    {report.details && (
                        <p style={{ fontSize: "calc(var(--font-size-sm) * var(--font-scale))", color: "var(--color-text-muted)" }}>
                            {report.details}
                        </p>
                    )}
                    <ReportActions reportId={report.id} />
                </div>
            ))}
        </div>
    );
}

/* ═══════════════════════════════════════════
   Catalog Tab — Catalog Curation Suggestions
   ═══════════════════════════════════════════ */
function CatalogTab({ suggestions }: { suggestions: CatalogSuggestionAdmin[] }) {
    if (suggestions.length === 0) {
        return (
            <div className="card shelf-empty">
                <div className="shelf-empty-icon">📚</div>
                <h2>No Pending Catalog Suggestions</h2>
                <p>Community suggestions will appear here for review.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            {suggestions.map((s) => {
                const curatorIcon =
                    s.author_approved_count >= 200 ? "🥇" :
                    s.author_approved_count >= 50 ? "🥈" :
                    s.author_approved_count >= 10 ? "🥉" :
                    s.author_approved_count >= 1 ? "📘" : "";

                const typeIcon =
                    s.suggestion_type === "correction" ? "🔧" :
                    s.suggestion_type === "addition" ? "📗" :
                    s.suggestion_type === "photo" ? "📸" : "🗑";

                // Build changes summary
                let changeText = "";
                if (s.suggestion_type === "correction" && s.field_changes) {
                    changeText = Object.entries(s.field_changes)
                        .map(([k, v]) => {
                            const val = v as { from: string; to: string };
                            return `${k}: ${val.from} → ${val.to}`;
                        })
                        .join(", ");
                } else if (s.suggestion_type === "addition") {
                    changeText = `New: ${(s.field_changes as { title?: string })?.title ?? "Untitled"}`;
                }

                return (
                    <div key={s.id} className="py-4 px-6 bg-glass border border-edge rounded-lg transition-all">
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-xs)" }}>
                            <strong>{typeIcon} {s.suggestion_type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</strong>
                            <span style={{ fontSize: "calc(var(--font-size-xs) * var(--font-scale))", color: "var(--color-text-muted)" }}>
                                ▲{s.upvotes} ▼{s.downvotes} · {new Date(s.created_at).toLocaleDateString()}
                            </span>
                        </div>
                        <p style={{ fontSize: "calc(var(--font-size-sm) * var(--font-scale))", marginBottom: "var(--space-xs)" }}>
                            By: {curatorIcon} @{s.author_alias}
                        </p>
                        {changeText && (
                            <p style={{ fontSize: "calc(var(--font-size-sm) * var(--font-scale))", fontFamily: "monospace", background: "var(--color-surface-glass)", padding: "var(--space-xs)", borderRadius: "var(--radius-sm)", marginBottom: "var(--space-xs)" }}>
                                {changeText}
                            </p>
                        )}
                        <p style={{ fontSize: "calc(var(--font-size-sm) * var(--font-scale))", color: "var(--color-text-muted)", fontStyle: "italic", marginBottom: "var(--space-sm)" }}>
                            &ldquo;{s.reason.slice(0, 200)}{s.reason.length > 200 ? "…" : ""}&rdquo;
                        </p>
                        <SuggestionAdminActions suggestionId={s.id} />
                    </div>
                );
            })}
        </div>
    );
}
