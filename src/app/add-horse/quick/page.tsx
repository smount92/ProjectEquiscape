"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { quickAddHorse } from "@/app/actions/horse";
import UnifiedReferenceSearch from "@/components/UnifiedReferenceSearch";
import type { CatalogItem } from "@/app/actions/reference";
import { createClient } from "@/lib/supabase/client";

const FINISH_TYPES = ["OF", "Custom", "Artist Resin"];
const CONDITION_GRADES = ["Mint", "Near Mint", "Excellent", "Very Good", "Good", "Fair", "Poor", "Play Grade", "Not Graded"];

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
            const { data: { user } } = await supabase.auth.getUser();
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

            setRecentAdds(prev => [{
                id: result.horseId!,
                name: result.horseName!,
                finish: finishType,
                condition: conditionGrade,
                timestamp: Date.now(),
            }, ...prev].slice(0, 10));

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
        <div className="page-container form-page">
            <div className="animate-fade-in-up" style={{ maxWidth: 640, margin: "0 auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-lg)" }}>
                    <h1>⚡ <span className="text-gradient">Quick Add</span></h1>
                    <Link href="/dashboard" className="btn btn-ghost">← Back</Link>
                </div>

                <div className="glass-card" style={{ padding: "var(--space-xl)" }}>
                    {/* Catalog Search */}
                    <div style={{ marginBottom: "var(--space-lg)" }}>
                        <label className="form-label">🔍 Search Catalog</label>
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
                                <span style={{ color: "var(--color-text-muted)", fontSize: "calc(var(--font-size-xs) * var(--font-scale))" }}>
                                    {" "}({selectedCatalog.itemType})
                                </span>
                            </div>
                        )}
                        {!selectedCatalog && customName && (
                            <div className="quick-add-selected">
                                ✍️ Custom entry: {customName}
                            </div>
                        )}
                    </div>

                    {/* Custom Name (optional if catalog selected) */}
                    {!selectedCatalog && (
                        <div style={{ marginBottom: "var(--space-lg)" }}>
                            <label className="form-label">Name</label>
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
                    <div className="quick-add-selectors">
                        <div>
                            <label className="form-label">Finish</label>
                            <select
                                className="form-input"
                                value={finishType}
                                onChange={(e) => setFinishType(e.target.value)}
                                id="quick-finish"
                            >
                                {FINISH_TYPES.map(f => (
                                    <option key={f} value={f}>{f}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="form-label">Condition</label>
                            <select
                                className="form-input"
                                value={conditionGrade}
                                onChange={(e) => setConditionGrade(e.target.value)}
                                id="quick-condition"
                            >
                                {CONDITION_GRADES.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="form-label">Collection</label>
                            <select
                                className="form-input"
                                value={collectionId}
                                onChange={(e) => setCollectionId(e.target.value)}
                                id="quick-collection"
                            >
                                <option value="">— None —</option>
                                {collections.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="form-error" style={{ marginTop: "var(--space-md)" }}>
                            ⚠️ {error}
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="quick-add-actions">
                        <button
                            className="btn btn-primary"
                            onClick={handleAdd}
                            disabled={isAdding || (!selectedCatalog && !customName.trim())}
                            id="quick-add-submit"
                        >
                            {isAdding ? "Adding…" : "🐴 Add to Stable"}
                        </button>
                        {selectedCatalog && recentAdds.length > 0 && (
                            <button
                                className="btn btn-ghost"
                                onClick={handleDuplicate}
                                id="quick-duplicate"
                            >
                                + Duplicate as New Finish
                            </button>
                        )}
                    </div>
                </div>

                {/* Link to full form */}
                <div style={{ textAlign: "center", marginTop: "var(--space-md)", color: "var(--color-text-muted)", fontSize: "calc(var(--font-size-sm) * var(--font-scale))" }}>
                    Need photos or more details?{" "}
                    <Link href="/add-horse" style={{ color: "var(--color-accent-primary)" }}>
                        Use the full intake form →
                    </Link>
                </div>

                {/* Recent Adds */}
                {recentAdds.length > 0 && (
                    <div className="quick-add-recent">
                        <h3 style={{ marginBottom: "var(--space-sm)", fontSize: "calc(var(--font-size-md) * var(--font-scale))" }}>
                            Recently Added
                        </h3>
                        {recentAdds.map((item) => (
                            <div key={item.id} className="quick-add-recent-item">
                                <span>✅ {item.name}</span>
                                <span style={{ color: "var(--color-text-muted)" }}>
                                    {item.finish} · {item.condition} — {timeSince(item.timestamp)}
                                </span>
                                <Link
                                    href={`/stable/${item.id}`}
                                    className="btn btn-ghost"
                                    style={{ padding: "2px 8px", fontSize: "calc(var(--font-size-xs) * var(--font-scale))" }}
                                >
                                    View →
                                </Link>
                            </div>
                        ))}
                        <button
                            className="btn btn-ghost"
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
