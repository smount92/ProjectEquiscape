"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import SearchBar from "@/components/SearchBar";

interface HorseCardData {
    id: string;
    customName: string;
    finishType: string;
    conditionGrade: string;
    createdAt: string;
    refName: string;
    releaseLine: string | null;
    thumbnailUrl: string | null;
    collectionName: string | null;
    sculptor: string | null;
    tradeStatus: string;
    moldName: string | null;
    releaseName: string | null;
    assetCategory?: string;
    vaultValue?: number | null;
}

type SortKey = "name" | "ref" | "finish" | "condition" | "collection" | "trade" | "value" | "added";
type SortDir = "asc" | "desc";

function getFinishBadgeClass(finishType: string): string {
    const base = "inline-block py-[2px] px-2 rounded-full text-xs font-semibold";
    switch (finishType) {
        case "OF": return `${base} bg-[rgba(59,130,246,0.15)] text-[rgb(59,130,246)]`;
        case "Custom": return `${base} bg-[rgba(168,85,247,0.15)] text-[rgb(168,85,247)]`;
        case "Artist Resin": return `${base} bg-[rgba(236,72,153,0.15)] text-[rgb(236,72,153)]`;
        default: return `${base} bg-surface-secondary text-ink-light`;
    }
}

const CONDITION_ORDER = ["Mint", "Near Mint", "Excellent", "Very Good", "Good", "Fair", "Poor", "Play Grade", "Not Graded"];

function formatRelDate(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const days = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 30) return `${days}d ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export default function StableLedger({
    horseCards,
    selectMode = false,
    selectedIds = new Set(),
    onToggleSelect,
}: {
    horseCards: HorseCardData[];
    selectMode?: boolean;
    selectedIds?: Set<string>;
    onToggleSelect?: (id: string) => void;
}) {
    const [searchQuery, setSearchQuery] = useState("");
    const [sortKey, setSortKey] = useState<SortKey>("added");
    const [sortDir, setSortDir] = useState<SortDir>("desc");

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(sortDir === "asc" ? "desc" : "asc");
        } else {
            setSortKey(key);
            setSortDir(key === "added" ? "desc" : "asc");
        }
    };

    const sortIndicator = (key: SortKey) => {
        if (sortKey !== key) return "";
        return sortDir === "asc" ? " ▲" : " ▼";
    };

    const filteredCards = useMemo(() => {
        let filtered = horseCards;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            filtered = horseCards.filter((h) =>
                h.customName.toLowerCase().includes(q) ||
                h.refName.toLowerCase().includes(q) ||
                (h.moldName && h.moldName.toLowerCase().includes(q)) ||
                (h.sculptor && h.sculptor.toLowerCase().includes(q)) ||
                (h.collectionName && h.collectionName.toLowerCase().includes(q))
            );
        }

        const sorted = [...filtered];
        const dir = sortDir === "asc" ? 1 : -1;

        sorted.sort((a, b) => {
            switch (sortKey) {
                case "name": return dir * a.customName.localeCompare(b.customName);
                case "ref": return dir * a.refName.localeCompare(b.refName);
                case "finish": return dir * (a.finishType || "").localeCompare(b.finishType || "");
                case "condition": {
                    const ai = CONDITION_ORDER.indexOf(a.conditionGrade);
                    const bi = CONDITION_ORDER.indexOf(b.conditionGrade);
                    return dir * ((ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi));
                }
                case "collection": return dir * (a.collectionName || "zzz").localeCompare(b.collectionName || "zzz");
                case "trade": return dir * (a.tradeStatus || "").localeCompare(b.tradeStatus || "");
                case "value": return dir * ((a.vaultValue || 0) - (b.vaultValue || 0));
                case "added": return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                default: return 0;
            }
        });

        return sorted;
    }, [searchQuery, horseCards, sortKey, sortDir]);

    return (
        <>
            {horseCards.length > 0 && (
                <div className="gap-4 mb-4" style={{ display: "flex", alignItems: "center", flexWrap: "wrap" }}>
                    <div className="flex-1 min-w-[200px]" >
                        <SearchBar
                            value={searchQuery}
                            onChange={setSearchQuery}
                            placeholder="Search your stable…"
                            id="ledger-search-bar"
                        />
                    </div>
                </div>
            )}

            {searchQuery.trim() && (
                <div className="text-sm text-muted mb-6 pl-1">
                    {filteredCards.length === 0
                        ? "No models match your search"
                        : `Showing ${filteredCards.length} of ${horseCards.length} models`}
                </div>
            )}

            {filteredCards.length === 0 && !searchQuery.trim() ? (
                <div className="bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all text-center py-[var(--space-3xl)] px-8">
                    <div className="text-center py-[var(--space-3xl)] px-8-icon">🏠</div>
                    <h2>Your Stable is Empty</h2>
                    <p>Click the button above to add your first horse.</p>
                </div>
            ) : filteredCards.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-edge bg-surface-primary">
                    <table className="sticky top-0 z-[2]">
                        <thead>
                            <tr>
                                {selectMode && <th className="w-[36]" >☑</th>}
                                <th className="w-[50]" >📷</th>
                                <th onClick={() => toggleSort("name")} className="cursor-pointer select-none transition-colors hover:text-forest">
                                    Name{sortIndicator("name")}
                                </th>
                                <th onClick={() => toggleSort("ref")} className="cursor-pointer select-none transition-colors hover:text-forest max-md:hidden">
                                    Reference{sortIndicator("ref")}
                                </th>
                                <th onClick={() => toggleSort("finish")} className="cursor-pointer select-none transition-colors hover:text-forest">
                                    Finish{sortIndicator("finish")}
                                </th>
                                <th onClick={() => toggleSort("condition")} className="cursor-pointer select-none transition-colors hover:text-forest max-md:hidden">
                                    Condition{sortIndicator("condition")}
                                </th>
                                <th onClick={() => toggleSort("collection")} className="cursor-pointer select-none transition-colors hover:text-forest max-md:hidden">
                                    Collection{sortIndicator("collection")}
                                </th>
                                <th onClick={() => toggleSort("trade")} className="cursor-pointer select-none transition-colors hover:text-forest max-md:hidden">
                                    Status{sortIndicator("trade")}
                                </th>
                                <th onClick={() => toggleSort("value")} className="cursor-pointer select-none transition-colors hover:text-forest max-md:hidden">
                                    Value{sortIndicator("value")}
                                </th>
                                <th onClick={() => toggleSort("added")} className="cursor-pointer select-none transition-colors hover:text-forest">
                                    Added{sortIndicator("added")}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCards.map((horse) => (
                                <tr
                                    key={horse.id}
                                    className={`transition-colors hover:bg-surface-secondary ${selectMode && selectedIds.has(horse.id) ? "!bg-[rgba(44,85,69,0.1)]" : ""}`}
                                    onClick={selectMode ? () => onToggleSelect?.(horse.id) : undefined}
                                    style={selectMode ? { cursor: "pointer" } : undefined}
                                >
                                    {selectMode && (
                                        <td className="w-[36]" style={{ textAlign: "center" }}>
                                            <input type="checkbox" checked={selectedIds.has(horse.id)} readOnly />
                                        </td>
                                    )}
                                    <td className="w-[50px] !py-1 !px-2">
                                        <Link href={`/stable/${horse.id}`}>
                                            {horse.thumbnailUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={horse.thumbnailUrl}
                                                    alt=""
                                                    className="w-10 h-10 rounded-sm object-cover block"
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <span className="flex items-center justify-center w-10 h-10 rounded-sm bg-surface-secondary text-xl">🐴</span>
                                            )}
                                        </Link>
                                    </td>
                                    <td>
                                        <Link href={`/stable/${horse.id}`} className="text-ink no-underline font-semibold transition-colors hover:text-forest">
                                            {horse.customName}
                                        </Link>
                                    </td>
                                    <td className="max-md:hidden text-ink-light max-w-[180px] overflow-hidden text-ellipsis">{horse.refName}</td>
                                    <td>
                                        <span className={getFinishBadgeClass(horse.finishType)}>
                                            {horse.finishType || "—"}
                                        </span>
                                    </td>
                                    <td className="max-md:hidden">{horse.conditionGrade || "—"}</td>
                                    <td className="max-md:hidden text-ink-light text-xs">
                                        {horse.collectionName ? `📁 ${horse.collectionName}` : "—"}
                                    </td>
                                    <td className="max-md:hidden">
                                        {horse.tradeStatus === "For Sale" && <span className="inline-block py-[2px] px-1.5 rounded-full text-xs font-medium bg-[rgba(34,197,94,0.15)] text-[rgb(34,197,94)]">💲 For Sale</span>}
                                        {horse.tradeStatus === "Open to Offers" && <span className="inline-block py-[2px] px-1.5 rounded-full text-xs font-medium bg-[rgba(251,191,36,0.15)] text-[rgb(202,138,4)]">🤝 Offers</span>}
                                        {horse.tradeStatus === "Not for Sale" && <span className="text-muted" >—</span>}
                                    </td>
                                    <td className="max-md:hidden">
                                        {horse.vaultValue ? `$${horse.vaultValue.toLocaleString()}` : "—"}
                                    </td>
                                    <td className="text-muted text-xs">{formatRelDate(horse.createdAt)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : null}
        </>
    );
}
