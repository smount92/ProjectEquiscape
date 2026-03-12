"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import styles from "./StableLedger.module.css";

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

function getFinishBadgeStyle(finishType: string): string {
    switch (finishType) {
        case "OF": return styles.finishBadgeOf;
        case "Custom": return styles.finishBadgeCustom;
        case "Artist Resin": return styles.finishBadgeResin;
        default: return styles.finishBadge;
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
                <div style={{ display: "flex", gap: "var(--space-md)", alignItems: "center", flexWrap: "wrap", marginBottom: "var(--space-md)" }}>
                    <div style={{ flex: 1, minWidth: "200px" }}>
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
                <div className="search-results-count">
                    {filteredCards.length === 0
                        ? "No models match your search"
                        : `Showing ${filteredCards.length} of ${horseCards.length} models`}
                </div>
            )}

            {filteredCards.length === 0 && !searchQuery.trim() ? (
                <div className="card shelf-empty">
                    <div className="shelf-empty-icon">🏠</div>
                    <h2>Your Stable is Empty</h2>
                    <p>Click the button above to add your first horse.</p>
                </div>
            ) : filteredCards.length > 0 ? (
                <div className={styles.wrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                {selectMode && <th style={{ width: 36 }}>☑</th>}
                                <th style={{ width: 50 }}>📷</th>
                                <th onClick={() => toggleSort("name")} className={styles.sortableTh}>
                                    Name{sortIndicator("name")}
                                </th>
                                <th onClick={() => toggleSort("ref")} className={`${styles.sortableTh} ${styles.hideMobile}`}>
                                    Reference{sortIndicator("ref")}
                                </th>
                                <th onClick={() => toggleSort("finish")} className={styles.sortableTh}>
                                    Finish{sortIndicator("finish")}
                                </th>
                                <th onClick={() => toggleSort("condition")} className={`${styles.sortableTh} ${styles.hideMobile}`}>
                                    Condition{sortIndicator("condition")}
                                </th>
                                <th onClick={() => toggleSort("collection")} className={`${styles.sortableTh} ${styles.hideMobile}`}>
                                    Collection{sortIndicator("collection")}
                                </th>
                                <th onClick={() => toggleSort("trade")} className={`${styles.sortableTh} ${styles.hideMobile}`}>
                                    Status{sortIndicator("trade")}
                                </th>
                                <th onClick={() => toggleSort("value")} className={`${styles.sortableTh} ${styles.hideMobile}`}>
                                    Value{sortIndicator("value")}
                                </th>
                                <th onClick={() => toggleSort("added")} className={styles.sortableTh}>
                                    Added{sortIndicator("added")}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCards.map((horse) => (
                                <tr
                                    key={horse.id}
                                    className={`${styles.row} ${selectMode && selectedIds.has(horse.id) ? styles.rowSelected : ""}`}
                                    onClick={selectMode ? () => onToggleSelect?.(horse.id) : undefined}
                                    style={selectMode ? { cursor: "pointer" } : undefined}
                                >
                                    {selectMode && (
                                        <td style={{ width: 36, textAlign: "center" }}>
                                            <input type="checkbox" checked={selectedIds.has(horse.id)} readOnly />
                                        </td>
                                    )}
                                    <td className={styles.thumbCell}>
                                        <Link href={`/stable/${horse.id}`}>
                                            {horse.thumbnailUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={horse.thumbnailUrl}
                                                    alt=""
                                                    className={styles.thumb}
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <span className={styles.thumbPlaceholder}>🐴</span>
                                            )}
                                        </Link>
                                    </td>
                                    <td>
                                        <Link href={`/stable/${horse.id}`} className={styles.nameLink}>
                                            {horse.customName}
                                        </Link>
                                    </td>
                                    <td className={`${styles.hideMobile} ${styles.ref}`}>{horse.refName}</td>
                                    <td>
                                        <span className={getFinishBadgeStyle(horse.finishType)}>
                                            {horse.finishType || "—"}
                                        </span>
                                    </td>
                                    <td className={styles.hideMobile}>{horse.conditionGrade || "—"}</td>
                                    <td className={`${styles.hideMobile} ${styles.collection}`}>
                                        {horse.collectionName ? `📁 ${horse.collectionName}` : "—"}
                                    </td>
                                    <td className={styles.hideMobile}>
                                        {horse.tradeStatus === "For Sale" && <span className={styles.tradeBadgeSale}>💲 For Sale</span>}
                                        {horse.tradeStatus === "Open to Offers" && <span className={styles.tradeBadgeOffers}>🤝 Offers</span>}
                                        {horse.tradeStatus === "Not for Sale" && <span style={{ color: "var(--color-text-muted)" }}>—</span>}
                                    </td>
                                    <td className={styles.hideMobile}>
                                        {horse.vaultValue ? `$${horse.vaultValue.toLocaleString()}` : "—"}
                                    </td>
                                    <td className={styles.date}>{formatRelDate(horse.createdAt)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : null}
        </>
    );
}
