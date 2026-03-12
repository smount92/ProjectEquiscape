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
            <div className="group-tabs">
                <button
                    className={`group-tab ${activeTab === "feed" ? "active" : ""}`}
                    onClick={() => setActiveTab("feed")}
                >
                    💬 Feed
                </button>
                <button
                    className={`group-tab ${activeTab === "files" ? "active" : ""}`}
                    onClick={() => setActiveTab("files")}
                >
                    📁 Files
                </button>
                <button
                    className={`group-tab ${activeTab === "registry" ? "active" : ""}`}
                    onClick={() => setActiveTab("registry")}
                >
                    📋 Registry
                </button>
            </div>

            {/* Channel Pills (only on Feed tab) */}
            {activeTab === "feed" && channels.length > 1 && (
                <div className="group-channels">
                    <button
                        className={`group-channel-pill ${activeChannel === null ? "active" : ""}`}
                        onClick={() => setActiveChannel(null)}
                    >
                        # all
                    </button>
                    {channels.map(ch => (
                        <button
                            key={ch.id}
                            className={`group-channel-pill ${activeChannel === ch.id ? "active" : ""}`}
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
