"use client";

import { useState } from "react";
import UniversalFeed from "@/components/UniversalFeed";
import GroupRegistry from "@/components/GroupRegistry";
import GroupFiles from "@/components/GroupFiles";
import GroupAdminPanel from "@/components/GroupAdminPanel";
import type { Group, GroupChannel } from "@/app/actions/groups";


interface Props {
    group: Group;
    initialPosts: Parameters<typeof UniversalFeed>[0]["initialPosts"];
    channels: GroupChannel[];
    currentUserId: string;
}

export default function GroupDetailClient({ group, initialPosts, channels, currentUserId }: Props) {
    const [activeTab, setActiveTab] = useState<"feed" | "files" | "registry">("feed");
    const [activeChannel, setActiveChannel] = useState<string | null>(null);

    const isAdmin = group.memberRole === "owner" || group.memberRole === "admin";
    const isMod = isAdmin || group.memberRole === "moderator";

    return (
        <>
            {/* Tab Bar */}
            <div className="flex gap-[2px] my-lg bg-black/[0.03] rounded-lg p-1 border border-border">
                <button
                    className={`flex-1 py-sm px-md bg-transparent border-none rounded-md text-text-muted text-sm font-semibold cursor-pointer transition-all hover:text-text-primary hover:bg-black/[0.05] ${activeTab === "feed" ? "text-text-primary bg-[rgba(44,85,69,0.12)] border border-[rgba(44,85,69,0.3)]" : ""}`}
                    onClick={() => setActiveTab("feed")}
                >
                    💬 Feed
                </button>
                <button
                    className={`flex-1 py-sm px-md bg-transparent border-none rounded-md text-text-muted text-sm font-semibold cursor-pointer transition-all hover:text-text-primary hover:bg-black/[0.05] ${activeTab === "files" ? "text-text-primary bg-[rgba(44,85,69,0.12)] border border-[rgba(44,85,69,0.3)]" : ""}`}
                    onClick={() => setActiveTab("files")}
                >
                    📁 Files
                </button>
                <button
                    className={`flex-1 py-sm px-md bg-transparent border-none rounded-md text-text-muted text-sm font-semibold cursor-pointer transition-all hover:text-text-primary hover:bg-black/[0.05] ${activeTab === "registry" ? "text-text-primary bg-[rgba(44,85,69,0.12)] border border-[rgba(44,85,69,0.3)]" : ""}`}
                    onClick={() => setActiveTab("registry")}
                >
                    📋 Registry
                </button>
            </div>

            {/* Channel Pills (only on Feed tab) */}
            {activeTab === "feed" && channels.length > 1 && (
                <div className="flex gap-xs mb-lg overflow-x-auto pb-xs scrollbar-none">
                    <button
                        className={`py-1.5 px-3.5 bg-black/[0.04] border border-border rounded-full text-text-muted text-xs font-semibold cursor-pointer whitespace-nowrap transition-all hover:bg-black/[0.06] hover:text-text-primary ${activeChannel === null ? "bg-[rgba(44,85,69,0.15)] border-[rgba(44,85,69,0.4)] text-accent-primary" : ""}`}
                        onClick={() => setActiveChannel(null)}
                    >
                        # all
                    </button>
                    {channels.map(ch => (
                        <button
                            key={ch.id}
                            className={`py-1.5 px-3.5 bg-black/[0.04] border border-border rounded-full text-text-muted text-xs font-semibold cursor-pointer whitespace-nowrap transition-all hover:bg-black/[0.06] hover:text-text-primary ${activeChannel === ch.id ? "bg-[rgba(44,85,69,0.15)] border-[rgba(44,85,69,0.4)] text-accent-primary" : ""}`}
                            onClick={() => setActiveChannel(ch.id)}
                        >
                            # {ch.name.toLowerCase()}
                        </button>
                    ))}
                </div>
            )}

            {/* Tab Content */}
            {activeTab === "feed" && (
                <UniversalFeed
                    initialPosts={initialPosts}
                    context={{ groupId: group.id }}
                    currentUserId={currentUserId}
                    showComposer={true}
                    composerPlaceholder={activeChannel ? `Post to #${channels.find(c => c.id === activeChannel)?.name || "channel"}…` : "Share with the group…"}
                    label="Group Posts"
                />
            )}

            {activeTab === "files" && (
                <GroupFiles
                    groupId={group.id}
                    canUpload={isMod}
                    canDelete={isAdmin}
                />
            )}

            {activeTab === "registry" && (
                <GroupRegistry groupId={group.id} isMember={group.isMember} />
            )}

            {/* Admin Panel (always visible for admins below content) */}
            {isAdmin && (
                <GroupAdminPanel
                    groupId={group.id}
                    currentUserId={currentUserId}
                    memberRole={group.memberRole || "member"}
                />
            )}
        </>
    );
}
