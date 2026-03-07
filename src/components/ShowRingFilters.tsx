"use client";

interface FilterState {
    finishType: string | null;
    tradeStatus: string | null;
    manufacturer: string | null;
    sortBy: "newest" | "oldest" | "most-favorited";
}

interface ShowRingFiltersProps {
    filters: FilterState;
    onFilterChange: (filters: FilterState) => void;
    manufacturers: string[];
}

const FINISH_TYPES = ["OF", "Custom", "Artist Resin"];

export default function ShowRingFilters({
    filters,
    onFilterChange,
    manufacturers,
}: ShowRingFiltersProps) {
    const setFilter = (key: keyof FilterState, value: string | null) => {
        onFilterChange({ ...filters, [key]: value });
    };

    return (
        <div className="showring-filters" id="showring-filters">
            {/* Finish Type Pills */}
            <div className="filter-pill-group">
                <button
                    className={`filter-pill ${filters.finishType === null ? "filter-pill-active" : ""}`}
                    onClick={() => setFilter("finishType", null)}
                >
                    All
                </button>
                {FINISH_TYPES.map((ft) => (
                    <button
                        key={ft}
                        className={`filter-pill ${filters.finishType === ft ? "filter-pill-active" : ""}`}
                        onClick={() =>
                            setFilter("finishType", filters.finishType === ft ? null : ft)
                        }
                    >
                        {ft}
                    </button>
                ))}
            </div>

            {/* Trade Status Dropdown */}
            <select
                className="filter-dropdown"
                value={filters.tradeStatus || ""}
                onChange={(e) => setFilter("tradeStatus", e.target.value || null)}
                id="filter-trade-status"
            >
                <option value="">All Statuses</option>
                <option value="For Sale">💲 For Sale</option>
                <option value="Open to Offers">🤝 Open to Offers</option>
            </select>

            {/* Manufacturer Dropdown */}
            {manufacturers.length > 1 && (
                <select
                    className="filter-dropdown"
                    value={filters.manufacturer || ""}
                    onChange={(e) => setFilter("manufacturer", e.target.value || null)}
                    id="filter-manufacturer"
                >
                    <option value="">All Makes</option>
                    {manufacturers.map((m) => (
                        <option key={m} value={m}>
                            {m}
                        </option>
                    ))}
                </select>
            )}

            {/* Sort Dropdown */}
            <select
                className="filter-dropdown"
                value={filters.sortBy}
                onChange={(e) =>
                    setFilter("sortBy", e.target.value as FilterState["sortBy"])
                }
                id="filter-sort"
            >
                <option value="newest">Sort: Newest</option>
                <option value="oldest">Sort: Oldest</option>
                <option value="most-favorited">Sort: Most ❤️</option>
            </select>
        </div>
    );
}

export type { FilterState };
