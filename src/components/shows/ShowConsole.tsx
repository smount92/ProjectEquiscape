"use client";

/**
 * /shows/host/[id] — the showholder console shell. Server page
 * fetches ShowConsoleData; this client shell renders the tab bar
 * (AdminTabs pattern: horizontal-scroll, forest underline) and the
 * tabs: Overview / Classlist / Staff / Entries, plus Settings for
 * managers (Wave 2 — the host steering wheel). Mutations live in
 * the tab components; each router.refresh()es so the server data
 * re-flows.
 *
 * Wave 4a: the active tab lives in the URL (?tab=, updated shallowly
 * via history.replaceState so refresh/share/back keep your place), a
 * "← Show page" link heads the console, and arriving with ?created=1
 * (the create-show form's landing) greets the host with a toast.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import type { ShowConsoleData } from "@/lib/shows/console";
import ClasslistBuilder from "@/components/shows/ClasslistBuilder";
import JudgingProgressCard from "@/components/shows/JudgingProgressCard";
import ShowAnnounceDialog from "@/components/shows/ShowAnnounceDialog";
import ShowEntriesPanel from "@/components/shows/ShowEntriesPanel";
import ShowSettingsForm from "@/components/shows/ShowSettingsForm";
import ShowStaffPanel from "@/components/shows/ShowStaffPanel";
import ShowStatusCard from "@/components/shows/ShowStatusCard";
import { useShowToast } from "@/components/shows/useShowToast";

type TabKey = "overview" | "classlist" | "staff" | "entries" | "settings";

const TABS: { key: TabKey; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "classlist", label: "Classlist" },
    { key: "staff", label: "Staff" },
    { key: "entries", label: "Entries" },
    { key: "settings", label: "Settings" },
];

const TAB_KEYS = TABS.map((t) => t.key);

export default function ShowConsole({ data }: { data: ShowConsoleData }) {
    const { show, viewerId, viewerRole, divisions, staff, entries, feePaidUserIds } = data;
    const searchParams = useSearchParams();
    const { showToast, toastNode } = useShowToast();

    const canManage = viewerRole === "host" || viewerRole === "co_host";
    const visibleTabs = TABS.filter((tab) => tab.key !== "settings" || canManage);

    // ?tab= is the source of the INITIAL tab (deep links, refreshes);
    // clicks update state and mirror to the URL shallowly below.
    const [activeTab, setActiveTab] = useState<TabKey>(() => {
        const raw = searchParams.get("tab");
        const valid =
            raw !== null && (TAB_KEYS as string[]).includes(raw) ? (raw as TabKey) : "overview";
        return valid === "settings" && !canManage ? "overview" : valid;
    });

    const selectTab = (key: TabKey) => {
        setActiveTab(key);
        // Shallow URL update — no server round-trip, no scroll jump.
        const url = new URL(window.location.href);
        if (key === "overview") url.searchParams.delete("tab");
        else url.searchParams.set("tab", key);
        window.history.replaceState(null, "", url.toString());
    };

    // The create-show form lands here with ?created=1 — answer it
    // once, then strip the flag so a refresh stays quiet.
    const createdHandled = useRef(false);
    useEffect(() => {
        if (createdHandled.current) return;
        if (searchParams.get("created") !== "1") return;
        createdHandled.current = true;
        showToast("Show created — build the classlist, then publish when you're ready.");
        const url = new URL(window.location.href);
        url.searchParams.delete("created");
        window.history.replaceState(null, "", url.toString());
    }, [searchParams, showToast]);

    const classCount = divisions.reduce(
        (sum, d) => sum + d.sections.reduce((s, sec) => s + sec.classes.length, 0),
        0,
    );

    // The announce composer's reach preview: distinct owners of live
    // entries, minus the sender (announceToEntrants applies the same
    // rule server-side and returns the real count).
    const announceRecipientCount = new Set(
        entries
            .filter((e) => e.status !== "scratched" && e.ownerId !== viewerId)
            .map((e) => e.ownerId),
    ).size;

    const badgeFor = (key: TabKey): number | null => {
        switch (key) {
            case "classlist":
                return classCount > 0 ? classCount : null;
            case "staff":
                return staff.length > 0 ? staff.length : null;
            case "entries":
                return entries.length > 0 ? entries.length : null;
            default:
                return null;
        }
    };

    return (
        <>
            {/* Way back out — the console is a room, not a trap. */}
            <div className="mb-3">
                <Link
                    href={`/shows/${show.id}`}
                    className="text-sm font-semibold text-forest hover:underline"
                    data-testid="console-back-link"
                >
                    ← Show page
                </Link>
            </div>

            {/* Tab bar — scrolls horizontally on mobile */}
            <div
                role="tablist"
                aria-label="Show console sections"
                className="mb-6 flex gap-1 overflow-x-auto border-b border-border [-webkit-overflow-scrolling:touch] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
                {visibleTabs.map((tab) => {
                    const badge = badgeFor(tab.key);
                    const active = activeTab === tab.key;
                    return (
                        <button
                            key={tab.key}
                            role="tab"
                            aria-selected={active}
                            className={`flex min-h-11 cursor-pointer items-center gap-1.5 border-0 border-b-[3px] bg-transparent px-4 py-2 text-sm font-semibold whitespace-nowrap transition-all ${
                                active
                                    ? "border-forest text-forest"
                                    : "border-transparent text-muted-foreground hover:text-foreground"
                            }`}
                            onClick={() => selectTab(tab.key)}
                        >
                            <span>{tab.label}</span>
                            {badge !== null && (
                                <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-forest px-1.5 text-[0.65rem] font-bold text-primary-foreground">
                                    {badge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            <div className="min-h-[300px]">
                {activeTab === "overview" && (
                    <div className="flex flex-col gap-6">
                        {/* Renders only while judging / in results review. */}
                        <JudgingProgressCard
                            showId={show.id}
                            status={show.status}
                            judging={show.judging}
                            divisions={divisions}
                            canManage={canManage}
                        />
                        <ShowStatusCard
                            show={show}
                            entryCount={entries.length}
                            canManage={canManage}
                        />
                        {canManage && (
                            <ShowAnnounceDialog
                                showId={show.id}
                                recipientCount={announceRecipientCount}
                            />
                        )}
                    </div>
                )}
                {activeTab === "classlist" && (
                    <ClasslistBuilder
                        showId={show.id}
                        showStatus={show.status}
                        divisions={divisions}
                        canManage={canManage}
                        entriesExist={entries.length > 0}
                    />
                )}
                {activeTab === "staff" && (
                    <ShowStaffPanel showId={show.id} staff={staff} viewerRole={viewerRole} />
                )}
                {activeTab === "entries" && (
                    <ShowEntriesPanel
                        showId={show.id}
                        divisions={divisions}
                        entries={entries}
                        showStatus={show.status}
                        feePaidUserIds={feePaidUserIds}
                        feeInfo={show.feeInfo}
                        canManage={canManage}
                        viewerRole={viewerRole}
                        viewerId={viewerId}
                    />
                )}
                {activeTab === "settings" && canManage && <ShowSettingsForm show={show} />}
            </div>

            {toastNode}
        </>
    );
}
