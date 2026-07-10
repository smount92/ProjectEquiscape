"use client";

/**
 * Ledger table view (Digital Stable v2) — consumes the same
 * StableCard data type as the shared card. Column-header sorting
 * re-orders the LOADED rows only (a view concern); the authoritative
 * whole-collection sort lives in the URL via the filter bar.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import type { StableCard } from "@/lib/stable/types";
import { finishBadgeClass, tradeBadgeClass } from "@/lib/stable/badges";

type SortKey = "name" | "ref" | "finish" | "condition" | "collection" | "trade" | "value" | "added";
type SortDir = "asc" | "desc";

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

export default function StableLedgerTable({
    horses,
    selectMode = false,
    selectedIds = new Set(),
    onToggleSelect,
}: {
    horses: StableCard[];
    selectMode?: boolean;
    selectedIds?: Set<string>;
    onToggleSelect?: (id: string) => void;
}) {
    const [sortKey, setSortKey] = useState<SortKey | null>(null);
    const [sortDir, setSortDir] = useState<SortDir>("asc");

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

    const sorted = useMemo(() => {
        if (!sortKey) return horses; // server order
        const dir = sortDir === "asc" ? 1 : -1;
        return [...horses].sort((a, b) => {
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
    }, [horses, sortKey, sortDir]);

    const headerClass =
        "cursor-pointer select-none text-muted-foreground transition-colors hover:text-forest";

    return (
        <div className="w-full overflow-hidden rounded-xl border border-input bg-card shadow-sm">
            <div className="-mx-4 w-full overflow-x-auto px-4 sm:mx-0 sm:px-0">
                <Table className="min-w-[640px]">
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            {selectMode && <TableHead className="w-[36px]">☑</TableHead>}
                            <TableHead className="w-[50px]">📷</TableHead>
                            <TableHead onClick={() => toggleSort("name")} className={headerClass}>
                                Name{sortIndicator("name")}
                            </TableHead>
                            <TableHead onClick={() => toggleSort("ref")} className={`${headerClass} max-md:hidden`}>
                                Reference{sortIndicator("ref")}
                            </TableHead>
                            <TableHead onClick={() => toggleSort("finish")} className={headerClass}>
                                Finish{sortIndicator("finish")}
                            </TableHead>
                            <TableHead onClick={() => toggleSort("condition")} className={`${headerClass} max-md:hidden`}>
                                Condition{sortIndicator("condition")}
                            </TableHead>
                            <TableHead onClick={() => toggleSort("collection")} className={`${headerClass} max-md:hidden`}>
                                Collection{sortIndicator("collection")}
                            </TableHead>
                            <TableHead onClick={() => toggleSort("trade")} className={`${headerClass} max-md:hidden`}>
                                Status{sortIndicator("trade")}
                            </TableHead>
                            <TableHead onClick={() => toggleSort("value")} className={`${headerClass} max-md:hidden`}>
                                Value{sortIndicator("value")}
                            </TableHead>
                            <TableHead onClick={() => toggleSort("added")} className={headerClass}>
                                Added{sortIndicator("added")}
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sorted.map((horse) => {
                            const tradeClass = tradeBadgeClass(horse.tradeStatus);
                            return (
                                <TableRow
                                    key={horse.id}
                                    className={`transition-colors hover:bg-muted ${selectMode && selectedIds.has(horse.id) ? "bg-forest/5" : ""} ${selectMode ? "cursor-pointer" : ""}`}
                                    onClick={selectMode ? () => onToggleSelect?.(horse.id) : undefined}
                                >
                                    {selectMode && (
                                        <TableCell className="w-[36px] text-center">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(horse.id)}
                                                readOnly
                                                aria-label={`Select ${horse.customName}`}
                                            />
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
                                        {horse.showRecordCount > 0 && (
                                            <span className="ml-1.5 text-xs text-warning" title={`${horse.showRecordCount} show placings`}>
                                                🏆{horse.showRecordCount}
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell className="max-w-[180px] text-muted-foreground max-md:hidden">
                                        <span className="block truncate">{horse.refName}</span>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className={`text-xs ${finishBadgeClass(horse.finishType)}`}>
                                            {horse.finishType || "—"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-secondary-foreground max-md:hidden">
                                        {horse.conditionGrade || "—"}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground max-md:hidden">
                                        {horse.collectionName ? `📁 ${horse.collectionName}` : "—"}
                                    </TableCell>
                                    <TableCell className="max-md:hidden">
                                        {tradeClass ? (
                                            <Badge variant="secondary" className={`text-xs ${tradeClass}`}>
                                                {horse.tradeStatus}
                                            </Badge>
                                        ) : (
                                            <span className="text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-secondary-foreground max-md:hidden">
                                        {horse.vaultValue ? `$${horse.vaultValue.toLocaleString()}` : "—"}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {formatRelDate(horse.createdAt)}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
