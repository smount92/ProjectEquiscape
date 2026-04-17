"use client";

import { useState, useEffect } from"react";
import { useRouter } from"next/navigation";
import { deleteContactMessage } from"@/app/actions/admin";
import MarkReadButton from"@/components/MarkReadButton";
import AdminReplyForm from"@/components/AdminReplyForm";
import FeatureHorseForm from"@/components/FeatureHorseForm";
import CreateShowForm from"@/components/CreateShowForm";
import AdminShowManager from"@/components/AdminShowManager";
import AdminSuggestionsPanel from"@/components/AdminSuggestionsPanel";
import ReportActions from"@/components/ReportActions";
import SuggestionAdminActions from"@/components/SuggestionAdminActions";

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
 suggestion_type: string;
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

type TabKey ="mailbox" |"shows" |"content" |"reports" |"catalog";

const TABS: { key: TabKey; emoji: string; label: string }[] = [
 { key:"mailbox", emoji:"📬", label:"Mailbox" },
 { key:"shows", emoji:"📸", label:"Shows" },
 { key:"content", emoji:"💡", label:"Content" },
 { key:"reports", emoji:"🚩", label:"Reports" },
 { key:"catalog", emoji:"📚", label:"Catalog" },
];

function formatDate(dateStr: string): string {
 return new Date(dateStr).toLocaleDateString("en-US", {
 month:"short",
 day:"numeric",
 hour:"numeric",
 minute:"2-digit",
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
 <span className="inline-flex items-center gap-1">
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-red-300 bg-red-50 px-6 py-2 text-sm font-semibold text-[#ef4444] no-underline transition-all"
 onClick={handleDelete}
 disabled={deleting}
 >
 {deleting ?"…" :"Confirm"}
 </button>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-transparent px-6 py-2 text-sm font-semibold no-underline transition-all"
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
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50/80 px-6 py-2 text-sm font-semibold text-[#ef4444] no-underline transition-all"
 onClick={() => setConfirming(true)}
 title="Delete this message"
 >
 🗑️ Delete
 </button>
 );
}

export default function AdminTabs({
 messages,
 unreadCount,
 shows,
 suggestions,
 reports,
 catalogSuggestions = [],
}: AdminTabsProps) {
 const [activeTab, setActiveTab] = useState<TabKey>("mailbox");

 // Restore from localStorage
 useEffect(() => {
 const saved = localStorage.getItem("admin-tab");
 if (saved && TABS.some((t) => t.key === saved)) {
 setActiveTab(saved as TabKey);
 }
 }, []);

 const handleTabChange = (key: TabKey) => {
 setActiveTab(key);
 localStorage.setItem("admin-tab", key);
 };

 const getBadge = (key: TabKey): number | null => {
 switch (key) {
 case"mailbox":
 return unreadCount > 0 ? unreadCount : null;
 case"shows":
 return shows.length > 0 ? shows.length : null;
 case"content":
 return suggestions.length > 0 ? suggestions.length : null;
 case"reports":
 return reports.length > 0 ? reports.length : null;
 case"catalog":
 return catalogSuggestions.length > 0 ? catalogSuggestions.length : null;
 default:
 return null;
 }
 };

 return (
 <>
 {/* Tab bar */}
 <div className="mb-6 flex gap-1 overflow-x-auto border-b border-[#E0D5C1] [-webkit-overflow-scrolling:touch] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
 {TABS.map((tab) => {
 const badge = getBadge(tab.key);
 return (
 <button
 key={tab.key}
 className={`flex cursor-pointer items-center gap-1.5 border-0 border-b-[3px] bg-transparent px-4 py-2 text-sm font-semibold whitespace-nowrap transition-all ${
 activeTab === tab.key
 ? "border-forest text-forest"
 : "border-transparent text-stone-500 hover:text-stone-900"
 }`}
 onClick={() => handleTabChange(tab.key)}
 >
 <span className="text-[1.1em]">{tab.emoji}</span>
 <span>{tab.label}</span>
 {badge !== null && (
 <span
 className={`ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[0.65rem] font-bold text-white ${
 tab.key === "reports" && reports.length > 0
 ? "bg-[#ef4444]"
 : "bg-forest"
 }`}
 >
 {badge}
 </span>
 )}
 </button>
 );
 })}
 </div>

 {/* Tab content */}
 <div className="min-h-[300px]">
 {activeTab ==="mailbox" && <MailboxTab messages={messages} />}
 {activeTab ==="shows" && <ShowsTab shows={shows} />}
 {activeTab ==="content" && <ContentTab suggestions={suggestions} />}
 {activeTab ==="reports" && <ReportsTab reports={reports} />}
 {activeTab ==="catalog" && <CatalogTab suggestions={catalogSuggestions} />}
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
 <div className="bg-white border-stone-200 rounded-lg border px-8 py-12 text-center shadow-md transition-all">
 <div className="mb-4 text-5xl">📬</div>
 <h2>No Messages Yet</h2>
 <p>Contact form submissions will appear here.</p>
 </div>
 );
 }

 return (
 <div className="flex flex-col gap-3">
 {messages.map((msg) => (
 <div
 key={msg.id}
 className={`rounded-lg border border-stone-200 p-4 transition-all ${msg.is_read ? "bg-white opacity-75" : "bg-white shadow-md"}`}
 >
 <div className="mb-2 flex items-center justify-between">
 <div className="flex items-center gap-2">
 <span className="text-sm font-semibold text-stone-900">
 {msg.name}
 </span>
 <a
 href={`mailto:${msg.email}`}
 className="text-xs text-forest no-underline hover:underline"
 >
 {msg.email}
 </a>
 </div>
 <span className="text-xs text-stone-500">
 {formatDate(msg.created_at)}
 </span>
 </div>
 {msg.subject && (
 <div className="mb-2 flex items-center gap-2 text-sm font-medium">
 {!msg.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-forest" />}
 {msg.subject}
 </div>
 )}
 <div className="mb-3 text-sm leading-relaxed text-stone-600 whitespace-pre-wrap">
 {msg.message}
 </div>
 <div className="flex flex-wrap items-center gap-2 border-t border-stone-200 pt-3">
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
 <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-6">
 <div>
 <h3 className="mb-4 flex items-center gap-2 text-base font-bold">📸 Create Photo Show</h3>
 <CreateShowForm />
 </div>
 <div>
 <h3 className="mb-4 flex items-center gap-2 text-base font-bold">
 🎛️ Manage Shows <span className="mt-6-count">{shows.length}</span>
 </h3>
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
 <h3 className="mb-4 flex items-center gap-2 text-base font-bold">
 💡 Database Suggestions <span className="mt-6-count">{suggestions.length} pending</span>
 </h3>
 <AdminSuggestionsPanel suggestions={suggestions} />
 </div>
 <div>
 <h3 className="mb-4 flex items-center gap-2 text-base font-bold">🌟 Feature a Horse</h3>
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
 <div className="bg-white border-stone-200 rounded-lg border px-8 py-12 text-center shadow-md transition-all">
 <div className="mb-4 text-5xl">🎉</div>
 <h2>All Clear</h2>
 <p>No open reports to review.</p>
 </div>
 );
 }

 return (
 <div className="flex flex-col gap-2">
 {reports.map((report) => (
 <div key={report.id} className="bg-white border-stone-200 rounded-lg border px-6 py-4 transition-all">
 <div className="mb-1 flex justify-between">
 <strong>{report.reason}</strong>
 <span className="text-stone-500 text-xs">
 {report.targetType} · {new Date(report.createdAt).toLocaleDateString()}
 </span>
 </div>
 <p className="mb-1 text-sm">
 Reported by: {report.reporterAlias} · Target: {report.targetId.slice(0, 8)}…
 </p>
 {report.details && <p className="text-stone-500 text-sm">{report.details}</p>}
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
 <div className="bg-white border-stone-200 rounded-lg border px-8 py-12 text-center shadow-md transition-all">
 <div className="mb-4 text-5xl">📚</div>
 <h2>No Pending Catalog Suggestions</h2>
 <p>Community suggestions will appear here for review.</p>
 </div>
 );
 }

 return (
 <div className="flex flex-col gap-2">
 {suggestions.map((s) => {
 const curatorIcon =
 s.author_approved_count >= 200
 ?"🥇"
 : s.author_approved_count >= 50
 ?"🥈"
 : s.author_approved_count >= 10
 ?"🥉"
 : s.author_approved_count >= 1
 ?"📘"
 :"";

 const typeIcon =
 s.suggestion_type ==="correction"
 ?"🔧"
 : s.suggestion_type ==="addition"
 ?"📗"
 : s.suggestion_type ==="photo"
 ?"📸"
 :"🗑";

 // Build changes summary
 let changeText ="";
 if (s.suggestion_type ==="correction" && s.field_changes) {
 changeText = Object.entries(s.field_changes)
 .map(([k, v]) => {
 const val = v as { from: string; to: string };
 return `${k}: ${val.from} → ${val.to}`;
 })
 .join(",");
 } else if (s.suggestion_type ==="addition") {
 changeText = `New: ${(s.field_changes as { title?: string })?.title ??"Untitled"}`;
 }

 return (
 <div key={s.id} className="bg-white border-stone-200 rounded-lg border px-6 py-4 transition-all">
 <div className="mb-1 flex justify-between">
 <strong>
 {typeIcon}{""}
 {s.suggestion_type.replace(/_/g,"").replace(/\b\w/g, (c) => c.toUpperCase())}
 </strong>
 <span className="text-stone-500 text-xs">
 ▲{s.upvotes} ▼{s.downvotes} · {new Date(s.created_at).toLocaleDateString()}
 </span>
 </div>
 <p className="mb-1 text-sm">
 By: {curatorIcon} @{s.author_alias}
 </p>
 {changeText && (
 <p className="bg-white mb-1 rounded-sm p-1 font-mono text-sm">
 {changeText}
 </p>
 )}
 <p className="text-stone-500 mb-2 text-sm italic">
 &ldquo;{s.reason.slice(0, 200)}
 {s.reason.length > 200 ?"…" :""}&rdquo;
 </p>
 <SuggestionAdminActions suggestionId={s.id} />
 </div>
 );
 })}
 </div>
 );
}
