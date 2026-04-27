"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import { Badge } from "@/components/ui/badge";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

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

function getFinishBadgeVariant(finishType: string): { className: string } {
    switch (finishType) {
        case "OF":
            return { className: "bg-blue-50 text-blue-600 border-blue-200" };
        case "Custom":
            return { className: "bg-purple-50 text-purple-600 border-purple-200" };
        case "Artist Resin":
            return { className: "bg-pink-50 text-pink-600 border-pink-200" };
        default:
            return { className: "bg-muted text-secondary-foreground border-input" };
    }
}

const CONDITION_ORDER = [
    "Mint",
    "Near Mint",
    "Excellent",
    "Very Good",
    "Good",
    "Fair",
    "Poor",
    "Play Grade",
    "Not Graded",
];

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
            filtered = horseCards.filter(
                (h) =>
                    h.customName.toLowerCase().includes(q) ||
                    h.refName.toLowerCase().includes(q) ||
                    (h.moldName && h.moldName.toLowerCase().includes(q)) ||
                    (h.sculptor && h.sculptor.toLowerCase().includes(q)) ||
                    (h.collectionName && h.collectionName.toLowerCase().includes(q)),
            );
        }

        const sorted = [...filtered];
        const dir = sortDir === "asc" ? 1 : -1;

        sorted.sort((a, b) => {
            switch (sortKey) {
                case "name":
                    return dir * a.customName.localeCompare(b.customName);
                case "ref":
                    return dir * a.refName.localeCompare(b.refName);
                case "finish":
                    return dir * (a.finishType || "").localeCompare(b.finishType || "");
                case "condition": {
                    const ai = CONDITION_ORDER.indexOf(a.conditionGrade);
                    const bi = CONDITION_ORDER.indexOf(b.conditionGrade);
                    return dir * ((ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi));
                }
                case "collection":
                    return dir * (a.collectionName || "zzz").localeCompare(b.collectionName || "zzz");
                case "trade":
                    return dir * (a.tradeStatus || "").localeCompare(b.tradeStatus || "");
                case "value":
                    return dir * ((a.vaultValue || 0) - (b.vaultValue || 0));
                case "added":
                    return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                default:
                    return 0;
            }
        });

        return sorted;
    }, [searchQuery, horseCards, sortKey, sortDir]);

    return (
        <>
            {horseCards.length > 0 && (
                <div className="mb-4 flex flex-wrap items-center gap-4">
                    <div className="min-w-[200px] flex-1">
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
                <div className="mb-6 pl-1 text-sm text-muted-foreground">
                    {filteredCards.length === 0
                        ? "No models match your search"
                        : `Showing ${filteredCards.length} of ${horseCards.length} models`}
                </div>
            )}

            {filteredCards.length === 0 && !searchQuery.trim() ? (
                <div className="rounded-xl border border-input bg-card px-8 py-12 text-center shadow-sm">
                    <div className="mb-4 text-5xl">🏠</div>
                    <h2>Your Stable is Empty</h2>
                    <p>Click the button above to add your first horse.</p>
                </div>
            ) : filteredCards.length > 0 ? (
                <div className="w-full overflow-hidden rounded-xl border border-input bg-card shadow-sm">
                    <div className="w-full overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                    <Table className="min-w-[640px]">
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                {selectMode && <TableHead className="w-[36px]">☑</TableHead>}
                                <TableHead className="w-[50px]">📷</TableHead>
                                <TableHead
                                    onClick={() => toggleSort("name")}
                                    className="cursor-pointer select-none text-muted-foreground transition-colors hover:text-forest"
                                >
                                    Name{sortIndicator("name")}
                                </TableHead>
                                <TableHead
                                    onClick={() => toggleSort("ref")}
                                    className="cursor-pointer select-none text-muted-foreground transition-colors hover:text-forest max-md:hidden"
                                >
                                    Reference{sortIndicator("ref")}
                                </TableHead>
                                <TableHead
                                    onClick={() => toggleSort("finish")}
                                    className="cursor-pointer select-none text-muted-foreground transition-colors hover:text-forest"
                                >
                                    Finish{sortIndicator("finish")}
                                </TableHead>
                                <TableHead
                                    onClick={() => toggleSort("condition")}
                                    className="cursor-pointer select-none text-muted-foreground transition-colors hover:text-forest max-md:hidden"
                                >
                                    Condition{sortIndicator("condition")}
                                </TableHead>
                                <TableHead
                                    onClick={() => toggleSort("collection")}
                                    className="cursor-pointer select-none text-muted-foreground transition-colors hover:text-forest max-md:hidden"
                                >
                                    Collection{sortIndicator("collection")}
                                </TableHead>
                                <TableHead
                                    onClick={() => toggleSort("trade")}
                                    className="cursor-pointer select-none text-muted-foreground transition-colors hover:text-forest max-md:hidden"
                                >
                                    Status{sortIndicator("trade")}
                                </TableHead>
                                <TableHead
                                    onClick={() => toggleSort("value")}
                                    className="cursor-pointer select-none text-muted-foreground transition-colors hover:text-forest max-md:hidden"
                                >
                                    Value{sortIndicator("value")}
                                </TableHead>
                                <TableHead
                                    onClick={() => toggleSort("added")}
                                    className="cursor-pointer select-none text-muted-foreground transition-colors hover:text-forest"
                                >
                                    Added{sortIndicator("added")}
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredCards.map((horse) => (
                                <TableRow
                                    key={horse.id}
                                    className={`transition-colors hover:bg-muted ${selectMode && selectedIds.has(horse.id) ? "bg-forest/5" : ""} ${selectMode ? "cursor-pointer" : ""}`}
                                    onClick={selectMode ? () => onToggleSelect?.(horse.id) : undefined}
                                >
                                    {selectMode && (
                                        <TableCell className="w-[36px] text-center">
                                            <input type="checkbox" checked={selectedIds.has(horse.id)} readOnly aria-label={`Select ${horse.customName}`} />
                                        </TableCell>
                                    )}
                                    <TableCell className="w-[50px] !px-2 !py-1">
                                        <Link href={`/stable/${horse.id}`}>
                                            {horse.thumbnailUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={horse.thumbnailUrl}
                                                    alt=""
                                                    className="block h-10 w-10 rounded-sm object-cover"
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <span className="flex h-10 w-10 items-center justify-center rounded-sm bg-muted text-xl">
                                                    🐴
                                                </span>
                                            )}
                                        </Link>
                                    </TableCell>
                                    <TableCell>
                                        <Link
                                            href={`/stable/${horse.id}`}
                                            className="font-semibold text-foreground no-underline transition-colors hover:text-forest"
                                        >
                                            {horse.customName}
                                        </Link>
                                    </TableCell>
                                    <TableCell className="max-w-[180px] text-muted-foreground max-md:hidden">
                                        <span className="block truncate">{horse.refName}</span>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className={`text-xs ${getFinishBadgeVariant(horse.finishType).className}`}>
                                            {horse.finishType || "—"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-secondary-foreground max-md:hidden">{horse.conditionGrade || "—"}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground max-md:hidden">
                                        {horse.collectionName ? `📁 ${horse.collectionName}` : "—"}
                                    </TableCell>
                                    <TableCell className="max-md:hidden">
                                        {horse.tradeStatus === "For Sale" && (
                                            <Badge variant="secondary" className="bg-emerald-50 text-xs text-emerald-700">
                                                💲 For Sale
                                            </Badge>
                                        )}
                                        {horse.tradeStatus === "Open to Offers" && (
                                            <Badge variant="secondary" className="bg-amber-50 text-xs text-amber-700">
                                                🤝 Offers
                                            </Badge>
                                        )}
                                        {horse.tradeStatus === "Not for Sale" && <span className="text-muted-foreground">—</span>}
                                    </TableCell>
                                    <TableCell className="text-secondary-foreground max-md:hidden">
                                        {horse.vaultValue ? `$${horse.vaultValue.toLocaleString()}` : "—"}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{formatRelDate(horse.createdAt)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    </div>
                </div>
            ) : null}
        </>
    );
}
