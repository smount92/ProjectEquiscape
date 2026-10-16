"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getGroupRegistry, type RegistryEntry } from "@/app/actions/groups";
import { Input } from "@/components/ui/input";

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
        // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag for a fetch started by the effect
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
        <div className="mt-6 rounded-lg border border-input bg-card p-6 shadow-md transition-all">
            <div className="flex cursor-pointer items-center justify-between" onClick={() => setExpanded(!expanded)}>
                <h3 className="m-0">📋 Group Registry</h3>
                <span className="text-sm text-muted-foreground">
                    {expanded ? "▲" : "▼"} {entries.length > 0 ? `${entries.length} models` : ""}
                </span>
            </div>

            {expanded && (
                <div className="mt-4">
                    <p className="mb-4 text-sm text-muted-foreground">
                        Public models from all group members — a shared catalog of the group&apos;s collection.
                    </p>

                    {loading ? (
                        <p className="text-muted-foreground">Loading registry…</p>
                    ) : entries.length === 0 ? (
                        <p className="text-muted-foreground">No public models from group members yet.</p>
                    ) : (
                        <>
                            <Input
                                className="mb-4 max-w-[300px]"
                                placeholder="Search by name or owner…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />

                            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
                                {Array.from(byOwner.entries()).map(([ownerAlias, horses]) => (
                                    <div
                                        key={ownerAlias}
                                        className="bg-surface-secondary rounded-lg border border-input p-6 transition-all hover:-translate-y-0.5 hover:border-emerald-700"
                                    >
                                        <div className="mb-2 flex items-center gap-2">
                                            <Link
                                                href={`/profile/${encodeURIComponent(ownerAlias)}`}
                                                className="font-semibold"
                                            >
                                                @{ownerAlias}
                                            </Link>
                                            <span className="text-xs text-secondary-foreground">
                                                {horses.length} model{horses.length !== 1 ? "s" : ""}
                                            </span>
                                        </div>
                                        <div>
                                            {horses.slice(0, 8).map((h) => (
                                                <Link
                                                    key={h.horseId}
                                                    href={`/community/${h.horseId}`}
                                                    className="flex items-center gap-2 border-b border-input py-1.5 text-sm text-foreground no-underline last:border-b-0 hover:text-forest"
                                                >
                                                    <span>🐴 {h.horseName}</span>
                                                    <span className="ml-auto text-xs text-secondary-foreground">
                                                        {h.finishType}
                                                    </span>
                                                </Link>
                                            ))}
                                            {horses.length > 8 && (
                                                <p className="mt-[4] text-xs text-secondary-foreground">
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
