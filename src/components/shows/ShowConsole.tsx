"use client";

/**
 * /shows/host/[id] — the showholder console shell. Server page
 * fetches ShowConsoleData; this client shell renders the tab bar
 * (AdminTabs pattern: horizontal-scroll, forest underline) and the
 * four Phase C tabs. Mutations live in the tab components; each
 * router.refresh()es so the server data re-flows.
 */

import { useState } from "react";

import type { ShowConsoleData } from "@/lib/shows/console";
import ClasslistBuilder from "@/components/shows/ClasslistBuilder";
import ShowEntriesPanel from "@/components/shows/ShowEntriesPanel";
import ShowStaffPanel from "@/components/shows/ShowStaffPanel";
import ShowStatusCard from "@/components/shows/ShowStatusCard";

type TabKey = "overview" | "classlist" | "staff" | "entries";

const TABS: { key: TabKey; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "classlist", label: "Classlist" },
    { key: "staff", label: "Staff" },
    { key: "entries", label: "Entries" },
];

export default function ShowConsole({ data }: { data: ShowConsoleData }) {
    const [activeTab, setActiveTab] = useState<TabKey>("overview");
    const { show, viewerRole, divisions, staff, entries } = data;

    const canManage = viewerRole === "host" || viewerRole === "co_host";
    const classCount = divisions.reduce(
        (sum, d) => sum + d.sections.reduce((s, sec) => s + sec.classes.length, 0),
        0,
    );

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
            {/* Tab bar — scrolls horizontally on mobile */}
            <div
                role="tablist"
                aria-label="Show console sections"
                className="mb-6 flex gap-1 overflow-x-auto border-b border-border [-webkit-overflow-scrolling:touch] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
                {TABS.map((tab) => {
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
                            onClick={() => setActiveTab(tab.key)}
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
                    <ShowStatusCard show={show} entryCount={entries.length} canManage={canManage} />
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
                        divisions={divisions}
                        entries={entries}
                        showStatus={show.status}
                    />
                )}
            </div>
        </>
    );
}
