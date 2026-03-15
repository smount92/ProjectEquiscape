"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import RatingBadge from "@/components/RatingBadge";
import UserAvatar from "@/components/UserAvatar";
import styles from "../app/discover/discover.module.css";

interface DiscoverUser {
    id: string;
    alias_name: string;
    created_at: string;
    avatar_url: string | null;
    public_horse_count: number;
    avg_rating: number;
    rating_count: number;
}

interface DiscoverGridProps {
    users: DiscoverUser[];
    currentUserId: string;
}

const memberSince = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
    });

export default function DiscoverGrid({ users, currentUserId }: DiscoverGridProps) {
    const [searchQuery, setSearchQuery] = useState("");

    const filteredUsers = useMemo(() => {
        if (!searchQuery.trim()) return users;
        const q = searchQuery.toLowerCase();
        return users.filter(
            (u) => u.alias_name.toLowerCase().includes(q)
        );
    }, [users, searchQuery]);

    return (
        <>
            {/* Search Bar */}
            <div className="search-bar-container" style={{ marginBottom: "var(--space-lg)" }}>
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="🔍 Search for a collector by name…"
                    className="form-input"
                    id="discover-search-bar"
                    style={{ maxWidth: 500 }}
                />
            </div>

            {searchQuery.trim() && (
                <div className="search-results-count" style={{ marginBottom: "var(--space-md)" }}>
                    {filteredUsers.length === 0
                        ? `No collectors match "${searchQuery}"`
                        : `Showing ${filteredUsers.length} collector${filteredUsers.length !== 1 ? "s" : ""}`}
                </div>
            )}

            {/* Grid */}
            {filteredUsers.length === 0 && !searchQuery.trim() ? (
                <div className="card shelf-empty animate-fade-in-up">
                    <div className="shelf-empty-icon">👥</div>
                    <h2>No Active Collectors Yet</h2>
                    <p>Be the first to make your models public!</p>
                </div>
            ) : filteredUsers.length === 0 ? (
                <div className="card shelf-empty animate-fade-in-up">
                    <div className="shelf-empty-icon">🔍</div>
                    <h2>No Results</h2>
                    <p>No collectors match &quot;{searchQuery}&quot;. Try a different name.</p>
                </div>
            ) : (
                <div className={`${styles.grid} animate-fade-in-up`}>
                    {filteredUsers.map((u) => {
                        const publicCount = u.public_horse_count;
                        const isMe = u.id === currentUserId;

                        return (
                            <Link
                                key={u.id}
                                href={`/profile/${encodeURIComponent(u.alias_name)}`}
                                className={styles.card}
                                id={`discover-${u.id}`}
                            >
                                <div className={styles.avatar}>
                                    <UserAvatar avatarUrl={u.avatar_url} aliasName={u.alias_name} size={40} />
                                </div>
                                <div className={styles.info}>
                                    <div className={styles.alias}>
                                        @{u.alias_name}
                                        {isMe && (
                                            <span
                                                className="community-own-badge"
                                                style={{ marginLeft: "6px" }}
                                            >
                                                You
                                            </span>
                                        )}
                                    </div>
                                    <div className={styles.stats}>
                                        <span>
                                            🐴 {publicCount} model{publicCount !== 1 ? "s" : ""}
                                        </span>
                                        <span>📅 {memberSince(u.created_at)}</span>
                                    </div>
                                    {u.rating_count > 0 && (
                                        <div style={{ marginTop: "var(--space-xs)" }}>
                                            <RatingBadge
                                                average={Number(Number(u.avg_rating).toFixed(1))}
                                                count={u.rating_count}
                                            />
                                        </div>
                                    )}
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </>
    );
}
