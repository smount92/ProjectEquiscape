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

interface AdminTabsProps {
    messages: ContactMessage[];
    unreadCount: number;
    shows: Show[];
    suggestions: Suggestion[];
    reports: Report[];
}

type TabKey = "mailbox" | "shows" | "content" | "reports";

const TABS: { key: TabKey; emoji: string; label: string }[] = [
    { key: "mailbox", emoji: "📬", label: "Mailbox" },
    { key: "shows", emoji: "📸", label: "Shows" },
    { key: "content", emoji: "💡", label: "Content" },
    { key: "reports", emoji: "🚩", label: "Reports" },
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
                    className="admin-mark-btn admin-mark-unread"
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

export default function AdminTabs({ messages, unreadCount, shows, suggestions, reports }: AdminTabsProps) {
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
            default: return null;
        }
    };

    return (
        <>
            {/* Tab bar */}
            <div className="admin-tab-bar">
                {TABS.map((tab) => {
                    const badge = getBadge(tab.key);
                    return (
                        <button
                            key={tab.key}
                            className={`admin-tab ${activeTab === tab.key ? "admin-tab-active" : ""}`}
                            onClick={() => handleTabChange(tab.key)}
                        >
                            <span className="admin-tab-emoji">{tab.emoji}</span>
                            <span className="admin-tab-label">{tab.label}</span>
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
            <div className="admin-tab-content">
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
        <div className="admin-mailbox">
            {messages.map((msg) => (
                <div
                    key={msg.id}
                    className={`admin-message ${msg.is_read ? "admin-message-read" : "admin-message-unread"}`}
                >
                    <div className="admin-message-header">
                        <div className="admin-message-sender">
                            <span className="admin-message-name">{msg.name}</span>
                            <a href={`mailto:${msg.email}`} className="admin-message-email">
                                {msg.email}
                            </a>
                        </div>
                        <div className="admin-message-actions">
                            <span className="admin-message-date">
                                {formatDate(msg.created_at)}
                            </span>
                        </div>
                    </div>
                    {msg.subject && (
                        <div className="admin-message-subject">
                            {!msg.is_read && <span className="admin-unread-dot" />}
                            {msg.subject}
                        </div>
                    )}
                    <div className="admin-message-body">{msg.message}</div>
                    <div className="admin-message-footer">
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
        <div className="admin-shows-grid">
            <div>
                <h3 className="admin-sub-title">📸 Create Photo Show</h3>
                <CreateShowForm />
            </div>
            <div>
                <h3 className="admin-sub-title">🎛️ Manage Shows <span className="admin-section-count">{shows.length}</span></h3>
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
                <h3 className="admin-sub-title">💡 Database Suggestions <span className="admin-section-count">{suggestions.length} pending</span></h3>
                <AdminSuggestionsPanel suggestions={suggestions} />
            </div>
            <div>
                <h3 className="admin-sub-title">🌟 Feature a Horse</h3>
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
        <div className="admin-mailbox">
            {reports.map(report => (
                <div key={report.id} className="admin-message">
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
