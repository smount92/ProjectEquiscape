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
        getGroupRegistry(groupId).then((data) => {
            setEntries(data);
            setLoading(false);
        });
    }, [expanded, groupId, isMember]);

    if (!isMember) return null;

    const filtered = search
        ? entries.filter(
              (e) =>
                  e.horseName.toLowerCase().includes(search.toLowerCase()) ||
                  e.ownerAlias.toLowerCase().includes(search.toLowerCase()),
          )
        : entries;

    // Group by owner
    const byOwner = new Map<string, RegistryEntry[]>();
    filtered.forEach((e) => {
        if (!byOwner.has(e.ownerAlias)) byOwner.set(e.ownerAlias, []);
        byOwner.get(e.ownerAlias)!.push(e);
    });

    return (
        <div className="glass-bg-card border-edge mt-6 rounded-lg border p-6 p-12 shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]">
            <div
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                onClick={() => setExpanded(!expanded)}
            >
                <h3 className="m-0">📋 Group Registry</h3>
                <span className="text-muted text-[calc(0.85rem*var(--font-scale))]">
                    {expanded ? "▲" : "▼"} {entries.length > 0 ? `${entries.length} models` : ""}
                </span>
            </div>

            {expanded && (
                <div className="mt-4">
                    <p className="text-muted mb-4 text-[calc(0.8rem*var(--font-scale))]">
                        Public models from all group members — a shared catalog of the group&apos;s collection.
                    </p>

                    {loading ? (
                        <p className="text-muted">Loading registry…</p>
                    ) : entries.length === 0 ? (
                        <p className="text-muted">No public models from group members yet.</p>
                    ) : (
                        <>
                            <input
                                className="form-input"
                                placeholder="Search by name or owner…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                style={{ marginBottom: "var(--space-md)", maxWidth: 300 }}
                            />

                            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
                                {Array.from(byOwner.entries()).map(([ownerAlias, horses]) => (
                                    <div
                                        key={ownerAlias}
                                        className="bg-surface-secondary border-edge hover:border-forest rounded-lg border p-6 transition-all hover:-translate-y-0.5"
                                    >
                                        <div className="mb-2 flex items-center gap-2">
                                            <Link
                                                href={`/profile/${encodeURIComponent(ownerAlias)}`}
                                                style={{ fontWeight: 600 }}
                                            >
                                                @{ownerAlias}
                                            </Link>
                                            <span className="text-muted text-xs">
                                                {horses.length} model{horses.length !== 1 ? "s" : ""}
                                            </span>
                                        </div>
                                        <div>
                                            {horses.slice(0, 8).map((h) => (
                                                <Link
                                                    key={h.horseId}
                                                    href={`/community/${h.horseId}`}
                                                    className="border-edge text-ink hover:text-forest flex items-center gap-2 border-b py-1.5 text-sm no-underline last:border-b-0"
                                                >
                                                    <span>🐴 {h.horseName}</span>
                                                    <span className="text-muted text-xs" style={{ marginLeft: "auto" }}>
                                                        {h.finishType}
                                                    </span>
                                                </Link>
                                            ))}
                                            {horses.length > 8 && (
                                                <p className="text-muted mt-[4] text-xs">+{horses.length - 8} more</p>
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
