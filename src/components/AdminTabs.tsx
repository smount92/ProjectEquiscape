"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { BRONZE_THRESHOLD, CONTRIBUTOR_THRESHOLD, GOLD_THRESHOLD, SILVER_THRESHOLD } from "@/lib/catalog/corrections";
import FeatureHorseForm from "@/components/FeatureHorseForm";
import AdminShowManager from "@/components/AdminShowManager";
import AdminSuggestionsPanel from "@/components/AdminSuggestionsPanel";
import ReportActions from "@/components/ReportActions";
import CopyAsTicketButton from "@/components/admin/CopyAsTicketButton";
import { sourceDate } from "@/lib/admin/ticketDraft";
import SuggestionAdminActions from "@/components/SuggestionAdminActions";
import ExternalShowAdminActions from "@/components/calendar/ExternalShowAdminActions";
import AdminAnnouncementsCard from "@/components/AdminAnnouncementsCard";
import AdminCatalogMergeCard, { type MergePrefill } from "@/components/AdminCatalogMergeCard";
import AdminCatalogDuplicatesCard from "@/components/AdminCatalogDuplicatesCard";
import AdminSanctioningCard from "@/components/AdminSanctioningCard";
import AdminMembersTab from "@/components/AdminMembersTab";
import AdminOpsTab from "@/components/AdminOpsTab";
import AdminEnvFlagsCard from "@/components/AdminEnvFlagsCard";
import AdminErrorsCard from "@/components/AdminErrorsCard";
import type { SentryStatus } from "@/lib/sentry/issues";
import AdminOverdueShowsCard from "@/components/AdminOverdueShowsCard";
import AdminInsightsTab from "@/components/AdminInsightsTab";
import AdminPulseStrip from "@/components/AdminPulseStrip";
import type { PendingExternalShow } from "@/app/actions/external-shows";
import type { AdminPulse, EnvFlagStatus, LegacySuggestionRow, MigrationStatusRow } from "@/app/actions/admin";
import AdminHiddenPricesCard from "@/components/AdminHiddenPricesCard";
import AdminCronCard from "@/components/AdminCronCard";
import AdminMailbox from "@/components/AdminMailbox";
import { REPORT_TARGET_LABEL, isReportTargetType, type ReportTargetView } from "@/lib/moderation/reports";

interface Show {
    id: string;
    title: string;
    status: string;
    endAt: string | null;
    entryCount: number;
}

interface Report {
    id: string;
    targetType: string;
    targetId: string;
    /** What was reported, where it lives, and what can be done (getOpenReports). */
    target?: ReportTargetView | null;
    reason: string;
    details: string | null;
    reporterAlias: string;
    createdAt: string;
}

interface CatalogSuggestionAdmin {
    id: string;
    user_id: string;
    catalog_item_id?: string | null;
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

/** Friendly labels — no status.replace(/_/g,"") "autoapproved" mush. */
const SUGGESTION_TYPE_LABELS: Record<string, string> = {
    correction: "Correction",
    addition: "New entry",
    photo: "Photo",
    removal: "Removal",
    duplicate: "Duplicate — approve to merge",
};

const SUGGESTION_STATUS_LABELS: Record<string, string> = {
    pending: "Pending",
    under_review: "Under review",
    approved: "Approved",
    auto_approved: "Auto-approved",
    rejected: "Rejected",
};

interface AdminTabsProps {
    /** Contact messages still open: what Mailbox › Open lists (countOpenContactMessages). */
    openMessages: number;
    shows: Show[];
    suggestions: LegacySuggestionRow[];
    reports: Report[];
    catalogSuggestions?: CatalogSuggestionAdmin[];
    externalShows?: PendingExternalShow[];
    /** Launch-week numbers for the strip above the tabs. Null = unreadable this load. */
    pulse?: AdminPulse | null;
    /** Ops corner: which hand-pasted migrations the database actually has. */
    migrations?: MigrationStatusRow[];
    /** Ops corner: what the server sees for the launch flags. Secrets are booleans only. */
    envFlags?: EnvFlagStatus | null;
    /** Ops corner: unresolved Sentry issues from the last day, or the setup guide. */
    sentry?: SentryStatus | null;
    /** Server-side count so the Sanctioning tab can badge before its card loads. */
    sanctioningCount?: number;
}

/**
 * Tab order is queue-first: the four things that arrive unbidden and
 * need a decision, then the things you go to on purpose, then the
 * read-only ops view. `content` sits late deliberately — its only live
 * job is Feature-a-Horse and announcements now that the legacy
 * suggestion queue retires itself.
 */
type TabKey =
    | "mailbox"
    | "reports"
    | "catalog"
    | "calendar"
    | "sanctioning"
    | "shows"
    | "members"
    | "content"
    | "insights"
    | "ops";

const TABS: { key: TabKey; emoji: string; label: string }[] = [
    { key: "mailbox", emoji: "📬", label: "Mailbox" },
    { key: "reports", emoji: "🚩", label: "Reports" },
    { key: "catalog", emoji: "📚", label: "Catalog" },
    { key: "calendar", emoji: "🗓️", label: "Calendar" },
    { key: "sanctioning", emoji: "🏅", label: "Sanctioning" },
    { key: "shows", emoji: "📸", label: "Shows" },
    { key: "members", emoji: "👤", label: "Members" },
    { key: "content", emoji: "💡", label: "Content" },
    { key: "insights", emoji: "📈", label: "Insights" },
    { key: "ops", emoji: "🛠️", label: "Ops" },
];

const isTabKey = (v: unknown): v is TabKey => typeof v === "string" && TABS.some((t) => t.key === v);

/**
 * The tab a URL asks for: `#members` / `#mailbox` / `#calendar` (notice
 * links) or `?tab=reports` (the report bell). A hash is the more recent
 * ask when both are there. Null when neither names a tab.
 */
export function askedAdminTab(tabParam: string | null, hash: string): TabKey | null {
    const fromHash = hash.replace(/^#/, "");
    if (isTabKey(fromHash)) return fromHash;
    return isTabKey(tabParam) ? tabParam : null;
}

/** localStorage can throw (private windows, blocked site data); the tab is a convenience. */
function safeStorage<T>(read: () => T): T | null {
    try {
        return read();
    } catch {
        return null;
    }
}

export default function AdminTabs({
    openMessages,
    shows,
    suggestions,
    reports,
    catalogSuggestions = [],
    externalShows = [],
    pulse = null,
    migrations = [],
    envFlags = null,
    sentry = null,
    sanctioningCount = 0,
}: AdminTabsProps) {
    const [activeTab, setActiveTab] = useState<TabKey>("mailbox");
    // A report card's "Suspend @alias" opens Members already searching for them.
    const [memberQuery, setMemberQuery] = useState("");
    const searchParams = useSearchParams();
    const restored = useRef(false);

    // Open the tab a link asked for (?tab=reports from the report bell,
    // #members / #mailbox / #calendar from the other notices), else, on
    // first load only, the one last used. This runs again whenever the
    // URL changes, so a notice clicked while the owner is already on
    // /admin still switches tabs: Next re-renders useSearchParams readers
    // on every navigation, a hash-only one included, and the history
    // entry is written before effects run.
    useEffect(() => {
        const asked = askedAdminTab(searchParams?.get("tab") ?? null, window.location.hash);
        if (asked) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- the URL lives outside React; this syncs to it
            setActiveTab(asked);
        } else if (!restored.current) {
            const saved = safeStorage(() => localStorage.getItem("admin-tab"));
            if (isTabKey(saved)) setActiveTab(saved);
        }
        restored.current = true;
    }, [searchParams]);

    // A plain #hash change (typed, or a raw <a href="#...">) that Next's
    // router never sees.
    useEffect(() => {
        const onHashChange = () => {
            const asked = askedAdminTab(new URLSearchParams(window.location.search).get("tab"), window.location.hash);
            if (asked) setActiveTab(asked);
        };
        window.addEventListener("hashchange", onHashChange);
        return () => window.removeEventListener("hashchange", onHashChange);
    }, []);

    const handleTabChange = (key: TabKey) => {
        setActiveTab(key);
        safeStorage(() => localStorage.setItem("admin-tab", key));
        // Keep the address in step with the tab, so the next notice link
        // (even one to the tab that was open before) is a real change and
        // a reload stays put. `null` state lets Next's router adopt the new
        // URL (it copies its own history state across).
        if (window.location.hash !== `#${key}` || window.location.search) {
            window.history.replaceState(null, "", `${window.location.pathname}#${key}`);
        }
    };

    // Every actionable queue carries its count on the tab. `ops` badges
    // the count of migrations the database is MISSING plus any required
    // key the server does not have — the one number in this console that
    // is a warning rather than a workload. An unset service-role key is
    // exactly as alarming as an unpasted migration, so it counts here too.
    const missingMigrations = migrations.filter((m) => m.applied === false).length;
    const missingKeys = (envFlags?.secrets ?? []).filter((s) => !s.present).length;
    const opsWarnings = missingMigrations + missingKeys;
    // Open Deal Room disputes are listed at the top of Members.
    const openDisputes = pulse?.pending.disputes ?? 0;

    const getBadge = (key: TabKey): number | null => {
        switch (key) {
            case "mailbox":
                return openMessages > 0 ? openMessages : null;
            case "members":
                return openDisputes > 0 ? openDisputes : null;
            case "shows":
                return shows.length > 0 ? shows.length : null;
            case "content":
                return suggestions.length > 0 ? suggestions.length : null;
            case "reports":
                return reports.length > 0 ? reports.length : null;
            case "catalog":
                return catalogSuggestions.length > 0 ? catalogSuggestions.length : null;
            case "calendar":
                return externalShows.length > 0 ? externalShows.length : null;
            case "sanctioning":
                return sanctioningCount > 0 ? sanctioningCount : null;
            case "ops":
                return opsWarnings > 0 ? opsWarnings : null;
            default:
                return null;
        }
    };

    const alarming = (key: TabKey) =>
        (key === "reports" && reports.length > 0) ||
        (key === "members" && openDisputes > 0) ||
        (key === "ops" && opsWarnings > 0);

    return (
        <>
            <AdminPulseStrip pulse={pulse} onJump={handleTabChange} />

            {/* Tab bar */}
            <div className="mb-6 flex gap-1 overflow-x-auto border-b border-border [-ms-overflow-style:none] [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {TABS.map((tab) => {
                    const badge = getBadge(tab.key);
                    return (
                        <button
                            key={tab.key}
                            className={`flex cursor-pointer items-center gap-1.5 border-0 border-b-[3px] bg-transparent px-4 py-2 text-sm font-semibold whitespace-nowrap transition-all ${
                                activeTab === tab.key
                                    ? "border-forest text-forest"
                                    : "border-transparent text-muted-foreground hover:text-foreground"
                            }`}
                            onClick={() => handleTabChange(tab.key)}
                        >
                            <span className="text-[1.1em]">{tab.emoji}</span>
                            <span>{tab.label}</span>
                            {badge !== null && (
                                <span
                                    className={`ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[0.65rem] font-bold text-white ${
                                        alarming(tab.key) ? "bg-destructive" : "bg-forest"
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
                {activeTab === "mailbox" && <AdminMailbox />}
                {activeTab === "shows" && <ShowsTab shows={shows} />}
                {activeTab === "content" && <ContentTab suggestions={suggestions} />}
                {activeTab === "reports" && (
                    <ReportsTab
                        reports={reports}
                        onOpenMember={(alias) => {
                            setMemberQuery(alias);
                            handleTabChange("members");
                        }}
                    />
                )}
                {activeTab === "catalog" && <CatalogTab suggestions={catalogSuggestions} />}
                {activeTab === "calendar" && <CalendarQueueTab shows={externalShows} />}
                {activeTab === "sanctioning" && <AdminSanctioningCard showEmptyState />}
                {activeTab === "members" && <AdminMembersTab key={memberQuery} initialQuery={memberQuery} />}
                {activeTab === "insights" && <AdminInsightsTab />}
                {activeTab === "ops" && (
                    <div className="flex flex-col gap-8">
                        <AdminOpsTab migrations={migrations} />
                        <AdminEnvFlagsCard status={envFlags} />
                        <AdminErrorsCard status={sentry} />
                        <AdminCronCard />
                    </div>
                )}
            </div>
        </>
    );
}

/* ═══════════════════════════════════════════
 Shows Tab — the overdue queue, then Manage

 The queue goes on top because it is the only part of this tab that
 is waiting on you. Everything below it you go to on purpose.
 ═══════════════════════════════════════════ */
function ShowsTab({ shows }: { shows: Show[] }) {
    return (
        <div className="flex flex-col gap-6">
            <div>
                <h3 className="mt-0 mb-3 flex items-center gap-2 text-base font-bold">⏰ Overdue &amp; stalled</h3>
                <AdminOverdueShowsCard />
            </div>
            <div>
                <div>
                    <h3 className="mb-4 flex items-center gap-2 text-base font-bold">
                        🎛️ Manage Shows <span className="mt-6-count">{shows.length}</span>
                    </h3>
                    <AdminShowManager shows={shows} />
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════
 Content Tab — what the house says about itself

 Feature-a-Horse and the announcement banner are the two levers that
 put the owner's own words on the site, so they live together. The
 legacy suggestion queue renders itself only while it still has rows
 (AdminSuggestionsPanel returns null when drained), so this tab gets
 quietly simpler over time instead of carrying a dead section.
 ═══════════════════════════════════════════ */
function ContentTab({ suggestions }: { suggestions: LegacySuggestionRow[] }) {
    return (
        <div className="flex flex-col gap-6">
            <div className="admin-content-grid">
                <div>
                    <h3 className="mt-0 mb-4 flex items-center gap-2 text-base font-bold">🌟 Feature a Horse</h3>
                    <FeatureHorseForm />
                </div>
                <div>
                    <h3 className="mt-0 mb-4 flex items-center gap-2 text-base font-bold">📣 Announcements</h3>
                    <AdminAnnouncementsCard />
                </div>
            </div>
            {/* Self-retiring — see AdminSuggestionsPanel. */}
            <AdminSuggestionsPanel suggestions={suggestions} />
        </div>
    );
}

/* ═══════════════════════════════════════════
 Reports Tab
 ═══════════════════════════════════════════ */
export function ReportsTab({ reports, onOpenMember }: { reports: Report[]; onOpenMember?: (alias: string) => void }) {
    if (reports.length === 0) {
        return (
            <div className="rounded-lg border border-input bg-card px-8 py-12 text-center shadow-md transition-all">
                <div className="mb-4 text-5xl">🎉</div>
                <h2>All Clear</h2>
                <p>No open reports to review.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            {reports.map((report) => {
                const target = report.target ?? null;
                const kind = isReportTargetType(report.targetType)
                    ? REPORT_TARGET_LABEL[report.targetType]
                    : report.targetType;
                return (
                    <article
                        key={report.id}
                        className="rounded-lg border border-input bg-card px-6 py-4 transition-all"
                        aria-label={`Report: ${kind}`}
                    >
                        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                            <span className="flex items-center gap-2">
                                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{kind}</span>
                                <strong>{report.reason}</strong>
                            </span>
                            <span className="text-xs text-muted-foreground">
                                {new Date(report.createdAt).toLocaleDateString()} · reported by @{report.reporterAlias}
                            </span>
                        </div>

                        {/* What was reported, in its own words, with the way to it. */}
                        <blockquote className="m-0 rounded-md border-l-4 border-input bg-muted/40 px-3 py-2 text-sm">
                            {target ? target.summary : "Couldn't load what was reported."}
                            {target?.state && (
                                <span className="ml-2 rounded-full border border-input px-2 py-0.5 text-xs text-muted-foreground">
                                    {target.state}
                                </span>
                            )}
                        </blockquote>
                        <p className="mt-1 mb-0 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                            {target?.ownerAlias && (
                                <span>
                                    {report.targetType === "user" ? "Member" : "By"} @{target.ownerAlias}
                                </span>
                            )}
                            {target?.href ? (
                                <a
                                    href={target.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-forest underline-offset-2 hover:underline"
                                >
                                    Open it <span aria-hidden="true">↗</span>
                                    <span className="sr-only"> (opens in a new tab)</span>
                                </a>
                            ) : (
                                target &&
                                report.targetType === "message" && (
                                    <span>Private message: the words above are all of it.</span>
                                )
                            )}
                        </p>

                        {report.details && (
                            <p className="mt-2 mb-0 text-sm text-secondary-foreground">
                                <span className="font-semibold">Reporter says:</span> {report.details}
                            </p>
                        )}
                        {/* A report that shows a site problem becomes a ticket. Never the
                            words of a private message, never who reported it. */}
                        <div className="mt-2">
                            <CopyAsTicketButton
                                draft={{
                                    title: `Look into a reported ${kind.toLowerCase()}: ${report.reason}`,
                                    type: "bug",
                                    labels: ["moderation", "member-reported"],
                                    why: [
                                        report.reason,
                                        report.details,
                                        target && report.targetType !== "message"
                                            ? `Reported: ${target.summary}`
                                            : null,
                                    ]
                                        .filter(Boolean)
                                        .join(". "),
                                    source: `Admin › Reports, report ${report.id.slice(0, 8)}, ${sourceDate(report.createdAt)}`,
                                    notes: target?.href ?? undefined,
                                }}
                            />
                        </div>
                        <ReportActions
                            reportId={report.id}
                            takeDownLabel={target?.takeDownLabel ?? null}
                            ownerAlias={target?.ownerAlias ?? null}
                            onOpenMember={onOpenMember}
                        />
                    </article>
                );
            })}
        </div>
    );
}

/* ═══════════════════════════════════════════
 Catalog Tab — curation queue + the merge tool

 The merge tool used to float above the tabs with no context. It is
 catalog surgery, so it belongs under the catalog queue: the duplicate
 you need to merge is usually the thing you just found while reviewing
 a suggestion.

 The sweeper sits between the two and hands pairs DOWN into the merge
 card — find, then confirm, then merge, in reading order. The handoff
 is only a pre-fill: the merge card's own confirm dialog still stands
 between a click here and a deleted catalog row.
 ═══════════════════════════════════════════ */
function CatalogTab({ suggestions }: { suggestions: CatalogSuggestionAdmin[] }) {
    // The counter is the merge card's remount `key`. Seeding it as INITIAL
    // state (rather than syncing through an effect) is what lets the same
    // pair be handed over twice after a merge cleared the boxes.
    const [handoffCount, setHandoffCount] = useState(0);
    const [mergePrefill, setMergePrefill] = useState<MergePrefill | null>(null);

    const handoff = (next: MergePrefill) => {
        setMergePrefill(next);
        setHandoffCount((n) => n + 1);
        // The merge card can be off-screen below a long queue; a pre-fill
        // you can't see reads as a button that did nothing.
        document.getElementById("admin-catalog-merge")?.scrollIntoView({ behavior: "smooth", block: "center" });
    };

    return (
        <div className="flex flex-col gap-6">
            <CatalogQueue suggestions={suggestions} />
            <div>
                <h3 className="mt-0 mb-3 text-base font-bold">🧹 Possible duplicates</h3>
                <AdminCatalogDuplicatesCard onHandoff={handoff} />
            </div>
            <div id="admin-catalog-merge">
                <h3 className="mt-0 mb-3 text-base font-bold">🔗 Merge duplicate entries</h3>
                <AdminCatalogMergeCard key={handoffCount} prefill={mergePrefill} />
            </div>
            <div>
                <h3 className="mt-0 mb-3 text-base font-bold">💲 Hidden eBay prices</h3>
                <AdminHiddenPricesCard />
            </div>
        </div>
    );
}

function CatalogQueue({ suggestions }: { suggestions: CatalogSuggestionAdmin[] }) {
    if (suggestions.length === 0) {
        return (
            <div className="rounded-lg border border-input bg-card px-8 py-12 text-center shadow-md transition-all">
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
                    s.author_approved_count >= GOLD_THRESHOLD
                        ? "🥇"
                        : s.author_approved_count >= SILVER_THRESHOLD
                          ? "🥈"
                          : s.author_approved_count >= BRONZE_THRESHOLD
                            ? "🥉"
                            : s.author_approved_count >= CONTRIBUTOR_THRESHOLD
                              ? "📘"
                              : "";

                const typeIcon =
                    s.suggestion_type === "correction"
                        ? "🔧"
                        : s.suggestion_type === "addition"
                          ? "📗"
                          : s.suggestion_type === "photo"
                            ? "📸"
                            : s.suggestion_type === "duplicate"
                              ? "🔁"
                              : "🗑";

                // Build changes summary
                let changeText = "";
                if (s.suggestion_type === "duplicate") {
                    const keep = (s.field_changes as { duplicate_of_title?: string } | null)?.duplicate_of_title;
                    changeText = `Remove this entry, keep: ${keep || "(entry)"}`;
                } else if (s.suggestion_type === "correction" && s.field_changes) {
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
                    <div key={s.id} className="rounded-lg border border-input bg-card px-6 py-4 transition-all">
                        <div className="mb-1 flex justify-between">
                            <strong>
                                {typeIcon}
                                {""}
                                {SUGGESTION_TYPE_LABELS[s.suggestion_type] ?? s.suggestion_type}
                            </strong>
                            <span className="text-xs text-muted-foreground">
                                {SUGGESTION_STATUS_LABELS[s.status] ?? s.status} · ▲{s.upvotes} ▼{s.downvotes} ·{" "}
                                {new Date(s.created_at).toLocaleDateString()}
                            </span>
                        </div>
                        <p className="mb-1 text-sm">
                            By: {curatorIcon} @{s.author_alias}
                        </p>
                        {changeText && <p className="mb-1 rounded-sm bg-card p-1 font-mono text-sm">{changeText}</p>}
                        <p className="mb-2 text-sm text-muted-foreground italic">
                            &ldquo;{s.reason.slice(0, 200)}
                            {s.reason.length > 200 ? "…" : ""}&rdquo;
                        </p>
                        {/* Context links — review without leaving the console blind */}
                        <p className="mb-2 flex flex-wrap gap-4 text-sm">
                            <a href={`/catalog/suggestions/${s.id}`} className="font-medium text-forest">
                                View suggestion &amp; discussion →
                            </a>
                            {s.catalog_item_id && (
                                <a href={`/catalog/${s.catalog_item_id}`} className="font-medium text-forest">
                                    View catalog item →
                                </a>
                            )}
                        </p>
                        <SuggestionAdminActions suggestionId={s.id} />
                        {/* A suggestion that shows a Registry problem (not just a fact
                            to fix) becomes a ticket. */}
                        <div className="mt-2">
                            <CopyAsTicketButton
                                draft={{
                                    title: changeText
                                        ? `Registry: ${changeText}`
                                        : `Registry: ${SUGGESTION_TYPE_LABELS[s.suggestion_type] ?? s.suggestion_type}`,
                                    type: "bug",
                                    labels: ["registry", "member-reported"],
                                    why: s.reason,
                                    source: `Registry suggestion /catalog/suggestions/${s.id}, @${s.author_alias}, ${sourceDate(s.created_at)}`,
                                    notes: s.catalog_item_id ? `/catalog/${s.catalog_item_id}` : undefined,
                                }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/* ═══════════════════════════════════════════
 Calendar Tab — External Show Listing Queue
 ═══════════════════════════════════════════ */
const EXTERNAL_VENUE_LABELS: Record<string, string> = {
    online_photo: "Online photo show",
    live: "Live show",
    mail_in: "Mail-in show",
};

function CalendarQueueTab({ shows }: { shows: PendingExternalShow[] }) {
    if (shows.length === 0) {
        return (
            <div className="rounded-lg border border-input bg-card px-8 py-12 text-center shadow-md transition-all">
                <div className="mb-4 text-5xl">🗓️</div>
                <h2>No Pending Listings</h2>
                <p>Community-submitted external shows will appear here for review before joining the calendar.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            {shows.map((s) => (
                <div key={s.id} className="rounded-lg border border-input bg-card px-6 py-4 transition-all">
                    <div className="mb-1 flex flex-wrap justify-between gap-2">
                        <strong>{s.title}</strong>
                        <span className="text-xs text-muted-foreground">
                            {EXTERNAL_VENUE_LABELS[s.venue_type] ?? s.venue_type} · {s.platform} ·{""}
                            {new Date(s.created_at).toLocaleDateString()}
                        </span>
                    </div>
                    <p className="mb-1 text-sm">
                        By: @{s.submitter_alias} · Host: {s.host_name} · Show date: {s.starts_on}
                        {s.entries_close_on ? ` · Entries close: ${s.entries_close_on}` : ""}
                        {s.location ? ` · ${s.location}` : ""}
                    </p>
                    <p className="mb-1 text-sm">
                        {/* The link is reviewed, not trusted: opens in a new tab,
  never passes referrer or opener. */}
                        <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="break-all text-forest underline"
                        >
                            {s.url}
                        </a>
                    </p>
                    {s.description && (
                        <p className="mb-2 text-sm text-muted-foreground italic">
                            &ldquo;{s.description.slice(0, 200)}
                            {s.description.length > 200 ? "…" : ""}&rdquo;
                        </p>
                    )}
                    <ExternalShowAdminActions showId={s.id} />
                </div>
            ))}
        </div>
    );
}
