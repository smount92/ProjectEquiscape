"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { quickAddHorse } from "@/app/actions/horse";
import UnifiedReferenceSearch from "@/components/UnifiedReferenceSearch";
import type { CatalogItem } from "@/app/actions/reference";
import { createClient } from "@/lib/supabase/client";

const FINISH_TYPES = ["OF", "Custom", "Artist Resin"];
const CONDITION_GRADES = [
    "Mint",
    "Near Mint",
    "Excellent",
    "Very Good",
    "Good",
    "Body Quality",
    "Fair",
    "Poor",
    "Play Grade",
    "Not Graded",
];

interface RecentAdd {
    id: string;
    name: string;
    finish: string;
    condition: string;
    timestamp: number;
}

export default function QuickAddPage() {
    const router = useRouter();
    const [selectedCatalog, setSelectedCatalog] = useState<CatalogItem | null>(null);
    const [customName, setCustomName] = useState("");
    const [finishType, setFinishType] = useState("OF");
    const [conditionGrade, setConditionGrade] = useState("Mint");
    const [collectionId, setCollectionId] = useState("");
    const [collections, setCollections] = useState<{ id: string; name: string }[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [recentAdds, setRecentAdds] = useState<RecentAdd[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Load user collections
    useEffect(() => {
        async function loadCollections() {
            const supabase = createClient();
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase
                .from("user_collections")
                .select("id, name")
                .eq("user_id", user.id)
                .order("name");
            if (data) setCollections(data as { id: string; name: string }[]);
        }
        loadCollections();
    }, []);

    const handleAdd = async () => {
        setIsAdding(true);
        setError(null);
        try {
            const result = await quickAddHorse({
                catalogId: selectedCatalog?.id,
                customName: customName.trim() || undefined,
                finishType,
                conditionGrade,
                collectionId: collectionId || undefined,
            });

            if (!result.success) {
                setError(result.error || "Failed to add horse.");
                return;
            }

            setRecentAdds((prev) =>
                [
                    {
                        id: result.horseId!,
                        name: result.horseName!,
                        finish: finishType,
                        condition: conditionGrade,
                        timestamp: Date.now(),
                    },
                    ...prev,
                ].slice(0, 10),
            );

            // Don't clear catalog selection — supports "Duplicate as New"
        } catch {
            setError("An unexpected error occurred.");
        } finally {
            setIsAdding(false);
        }
    };

    const handleDuplicate = () => {
        // Keep catalog, reset only finish for a different variant
        setFinishType("OF");
        setConditionGrade("Mint");
        setCustomName("");
    };

    const timeSince = (ts: number) => {
        const secs = Math.floor((Date.now() - ts) / 1000);
        if (secs < 5) return "just now";
        if (secs < 60) return `${secs}s ago`;
        return `${Math.floor(secs / 60)}m ago`;
    };

    return (
        <div className="mx-auto max-w-[var(--max-width)] px-6 px-[0] py-12 py-[0]">
            <div className="animate-fade-in-up mx-auto max-w-[640]">
                <div className="mb-6 justify-between" style={{ display: "flex", alignItems: "center" }}>
                    <h1>
                        ⚡ <span className="text-forest">Quick Add</span>
                    </h1>
                    <Link
                        href="/dashboard"
                        className="hover:no-underline-min-h)] text-ink-light border-edge inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] bg-transparent px-8 py-2 font-sans text-base leading-none font-semibold no-underline transition-all duration-150"
                    >
                        ← Back
                    </Link>
                </div>

                <div className="glass-bg-card border-edge rounded-lg border p-8 p-12 shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]">
                    {/* Catalog Search */}
                    <div className="mb-6">
                        <label className="text-ink mb-1 block text-sm font-semibold">🔍 Search Catalog</label>
                        <UnifiedReferenceSearch
                            selectedCatalogId={selectedCatalog?.id || null}
                            onCatalogSelect={(catalogId, item) => {
                                setSelectedCatalog(item);
                                setCustomName("");
                            }}
                            onCustomEntry={(name) => {
                                setSelectedCatalog(null);
                                setCustomName(name);
                            }}
                        />
                        {selectedCatalog && (
                            <div className="quick-add-selected">
                                ✅ {selectedCatalog.maker} — {selectedCatalog.title}
                                <span className="text-muted text-xs"> ({selectedCatalog.itemType})</span>
                            </div>
                        )}
                        {!selectedCatalog && customName && (
                            <div className="quick-add-selected">✍️ Custom entry: {customName}</div>
                        )}
                    </div>

                    {/* Custom Name (optional if catalog selected) */}
                    {!selectedCatalog && (
                        <div className="mb-6">
                            <label className="text-ink mb-1 block text-sm font-semibold">Name</label>
                            <input
                                className="form-input"
                                type="text"
                                value={customName}
                                onChange={(e) => setCustomName(e.target.value)}
                                placeholder="e.g. My Black Beauty"
                            />
                        </div>
                    )}

                    {/* Quick Selectors Row */}
                    <div className="quick-add-selectors max-sm:grid-cols-1">
                        <div>
                            <label className="text-ink mb-1 block text-sm font-semibold">Finish</label>
                            <select
                                className="form-input"
                                value={finishType}
                                onChange={(e) => setFinishType(e.target.value)}
                                id="quick-finish"
                            >
                                {FINISH_TYPES.map((f) => (
                                    <option key={f} value={f}>
                                        {f}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-ink mb-1 block text-sm font-semibold">Condition</label>
                            <select
                                className="form-input"
                                value={conditionGrade}
                                onChange={(e) => setConditionGrade(e.target.value)}
                                id="quick-condition"
                            >
                                {CONDITION_GRADES.map((c) => (
                                    <option key={c} value={c}>
                                        {c}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-ink mb-1 block text-sm font-semibold">Collection</label>
                            <select
                                className="form-input"
                                value={collectionId}
                                onChange={(e) => setCollectionId(e.target.value)}
                                id="quick-collection"
                            >
                                <option value="">— None —</option>
                                {collections.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="text-danger mt-2 mt-4 flex items-center gap-2 rounded-md border border-[rgba(240,108,126,0.3)] bg-[rgba(240,108,126,0.1)] px-4 py-2 text-sm">
                            ⚠️ {error}
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-4">
                        <button
                            className="hover:no-underline-min-h)] bg-forest text-inverse inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-0 border-[transparent] px-8 py-2 font-sans text-base leading-none font-semibold no-underline shadow-sm transition-all duration-150"
                            onClick={handleAdd}
                            disabled={isAdding || (!selectedCatalog && !customName.trim())}
                            id="quick-add-submit"
                        >
                            {isAdding ? "Adding…" : "🐴 Add to Stable"}
                        </button>
                        {selectedCatalog && recentAdds.length > 0 && (
                            <button
                                className="hover:no-underline-min-h)] text-ink-light border-edge inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] bg-transparent px-8 py-2 font-sans text-base leading-none font-semibold no-underline transition-all duration-150"
                                onClick={handleDuplicate}
                                id="quick-duplicate"
                            >
                                + Duplicate as New Finish
                            </button>
                        )}
                    </div>
                </div>

                {/* Link to full form */}
                <div className="text-muted mt-4 text-sm" style={{ textAlign: "center" }}>
                    Need photos or more details?{" "}
                    <Link href="/add-horse" className="text-forest">
                        Use the full intake form →
                    </Link>
                </div>

                {/* Recent Adds */}
                {recentAdds.length > 0 && (
                    <div className="border-edge mt-8 rounded-lg border bg-[var(--color-surface-primary)] p-6">
                        <h3 className="mb-2 text-[calc(var(--font-size-md)*var(--font-scale))]">Recently Added</h3>
                        {recentAdds.map((item) => (
                            <div
                                key={item.id}
                                className="border-edge rounded-lg-item mt-8 border bg-[var(--color-surface-primary)] p-6"
                            >
                                <span>✅ {item.name}</span>
                                <span className="text-muted">
                                    {item.finish} · {item.condition} — {timeSince(item.timestamp)}
                                </span>
                                <Link
                                    href={`/stable/${item.id}`}
                                    className="hover:no-underline-min-h)] text-ink-light border-edge inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] bg-transparent px-8 py-2 font-sans text-base leading-none font-semibold no-underline transition-all duration-150"
                                    style={{
                                        padding: "2px 8px",
                                        fontSize: "calc(var(--font-size-xs) * var(--font-scale))",
                                    }}
                                >
                                    View →
                                </Link>
                            </div>
                        ))}
                        <button
                            className="hover:no-underline-min-h)] text-ink-light border-edge inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] bg-transparent px-8 py-2 font-sans text-base leading-none font-semibold no-underline transition-all duration-150"
                            onClick={() => router.push("/dashboard")}
                            style={{ marginTop: "var(--space-sm)", width: "100%" }}
                        >
                            ← Back to Dashboard ({recentAdds.length} added)
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
