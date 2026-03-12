"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getGroupRegistry, type RegistryEntry } from "@/app/actions/groups";

interface Props {
    groupId: string;
    isMember: boolean;
}

export default function GroupRegistry({ groupId, isMember }: Props) {
    const [entries, setEntries] = useState<RegistryEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [search, setSearch] = useState("");

    useEffect(() => {
        if (!expanded || !isMember) return;
        setLoading(true);
        getGroupRegistry(groupId).then(data => {
            setEntries(data);
            setLoading(false);
        });
    }, [expanded, groupId, isMember]);

    if (!isMember) return null;

    const filtered = search
        ? entries.filter(e =>
            e.horseName.toLowerCase().includes(search.toLowerCase()) ||
            e.ownerAlias.toLowerCase().includes(search.toLowerCase())
        )
        : entries;

    // Group by owner
    const byOwner = new Map<string, RegistryEntry[]>();
    filtered.forEach(e => {
        if (!byOwner.has(e.ownerAlias)) byOwner.set(e.ownerAlias, []);
        byOwner.get(e.ownerAlias)!.push(e);
    });

    return (
        <div className="glass-card" style={{ padding: "var(--space-lg)", marginTop: "var(--space-lg)" }}>
            <div
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                onClick={() => setExpanded(!expanded)}
            >
                <h3 style={{ margin: 0 }}>📋 Group Registry</h3>
                <span style={{ color: "var(--color-text-muted)", fontSize: "calc(0.85rem * var(--font-scale))" }}>
                    {expanded ? "▲" : "▼"} {entries.length > 0 ? `${entries.length} models` : ""}
                </span>
            </div>

            {expanded && (
                <div style={{ marginTop: "var(--space-md)" }}>
                    <p style={{ color: "var(--color-text-muted)", fontSize: "calc(0.8rem * var(--font-scale))", marginBottom: "var(--space-md)" }}>
                        Public models from all group members — a shared catalog of the group&apos;s collection.
                    </p>

                    {loading ? (
                        <p style={{ color: "var(--color-text-muted)" }}>Loading registry…</p>
                    ) : entries.length === 0 ? (
                        <p style={{ color: "var(--color-text-muted)" }}>
                            No public models from group members yet.
                        </p>
                    ) : (
                        <>
                            <input
                                className="form-input"
                                placeholder="Search by name or owner…"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                style={{ marginBottom: "var(--space-md)", maxWidth: 300 }}
                            />

                            <div className="registry-grid">
                                {Array.from(byOwner.entries()).map(([ownerAlias, horses]) => (
                                    <div key={ownerAlias} className="registry-card">
                                        <div className="registry-card-header">
                                            <Link
                                                href={`/profile/${encodeURIComponent(ownerAlias)}`}
                                                style={{ fontWeight: 600 }}
                                            >
                                                @{ownerAlias}
                                            </Link>
                                            <span className="registry-card-meta">
                                                {horses.length} model{horses.length !== 1 ? "s" : ""}
                                            </span>
                                        </div>
                                        <div>
                                            {horses.slice(0, 8).map(h => (
                                                <Link
                                                    key={h.horseId}
                                                    href={`/community/${h.horseId}`}
                                                    className="registry-item"
                                                >
                                                    <span>🐴 {h.horseName}</span>
                                                    <span style={{ marginLeft: "auto", fontSize: "calc(var(--font-size-xs) * var(--font-scale))", color: "var(--color-text-muted)" }}>
                                                        {h.finishType}
                                                    </span>
                                                </Link>
                                            ))}
                                            {horses.length > 8 && (
                                                <p style={{ color: "var(--color-text-muted)", fontSize: "calc(var(--font-size-xs) * var(--font-scale))", marginTop: 4 }}>
                                                    +{horses.length - 8} more
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
