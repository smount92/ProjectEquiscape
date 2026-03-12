"use client";

import { useState } from "react";
import UniversalFeed from "@/components/UniversalFeed";
import GroupRegistry from "@/components/GroupRegistry";
import GroupFiles from "@/components/GroupFiles";
import GroupAdminPanel from "@/components/GroupAdminPanel";
import type { Group, GroupChannel } from "@/app/actions/groups";
import styles from "./GroupDetailClient.module.css";

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
            <div className={styles.tabs}>
                <button
                    className={`${styles.tab} ${activeTab === "feed" ? styles.tabActive : ""}`}
                    onClick={() => setActiveTab("feed")}
                >
                    💬 Feed
                </button>
                <button
                    className={`${styles.tab} ${activeTab === "files" ? styles.tabActive : ""}`}
                    onClick={() => setActiveTab("files")}
                >
                    📁 Files
                </button>
                <button
                    className={`${styles.tab} ${activeTab === "registry" ? styles.tabActive : ""}`}
                    onClick={() => setActiveTab("registry")}
                >
                    📋 Registry
                </button>
            </div>

            {/* Channel Pills (only on Feed tab) */}
            {activeTab === "feed" && channels.length > 1 && (
                <div className={styles.channels}>
                    <button
                        className={`${styles.channelPill} ${activeChannel === null ? styles.channelPillActive : ""}`}
                        onClick={() => setActiveChannel(null)}
                    >
                        # all
                    </button>
                    {channels.map(ch => (
                        <button
                            key={ch.id}
                            className={`${styles.channelPill} ${activeChannel === ch.id ? styles.channelPillActive : ""}`}
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
