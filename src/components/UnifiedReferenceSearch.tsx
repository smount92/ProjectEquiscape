"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MoldResult {
  id: string;
  manufacturer: string;
  mold_name: string;
  scale: string;
  release_year_start: number | null;
}

interface ReleaseSearchResult {
  id: string;
  mold_id: string;
  release_name: string;
  model_number: string | null;
  color_description: string | null;
  release_year_start: number | null;
  release_year_end: number | null;
  reference_molds: { mold_name: string; manufacturer: string } | null;
}

interface ResinResult {
  id: string;
  sculptor_alias: string;
  resin_name: string;
  scale: string;
  cast_medium: string | null;
}

export interface ReleaseDetail {
  id: string;
  mold_id: string;
  model_number: string | null;
  release_name: string;
  color_description: string | null;
  release_year_start: number | null;
  release_year_end: number | null;
}

export interface SelectionState {
  moldId: string | null;
  resinId: string | null;
  releaseId: string | null;
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface UnifiedReferenceSearchProps {
  selectedMoldId: string | null;
  selectedResinId: string | null;
  selectedReleaseId: string | null;
  onSelectionChange: (sel: SelectionState) => void;
  /** Called when user clicks the "Can't find it?" escape hatch */
  onCustomEntry?: (searchTerm: string) => void;
  /** External query injected by AI detection — auto-runs search */
  externalSearchQuery?: string;
  /** Optional notice block shown above the search (e.g., AI badge) */
  aiNotice?: React.ReactNode;
  /** Which tab to show first */
  defaultTab?: "mold" | "resin";
  /** Cascade: releases for the currently selected mold */
  releases: ReleaseDetail[];
  loadingReleases: boolean;
  /** Optional hint shown under release selector */
  releaseHint?: React.ReactNode;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function UnifiedReferenceSearch({
  selectedMoldId,
  selectedResinId,
  selectedReleaseId,
  onSelectionChange,
  onCustomEntry,
  externalSearchQuery,
  aiNotice,
  defaultTab = "mold",
  releases,
  loadingReleases,
  releaseHint,
}: UnifiedReferenceSearchProps) {
  const supabase = createClient();

  // Internal search state
  const [tab, setTab] = useState<"mold" | "resin">(defaultTab);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  // Results
  const [moldResults, setMoldResults] = useState<MoldResult[]>([]);
  const [releaseResults, setReleaseResults] = useState<ReleaseSearchResult[]>([]);
  const [resinResults, setResinResults] = useState<ResinResult[]>([]);

  // Details for selected badges
  const [selectedMoldInfo, setSelectedMoldInfo] = useState<MoldResult | null>(null);
  const [selectedResinInfo, setSelectedResinInfo] = useState<ResinResult | null>(null);

  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevExternalQuery = useRef<string | undefined>(undefined);

  // ---- Sync external search query (from AI detection) ----
  useEffect(() => {
    if (
      externalSearchQuery !== undefined &&
      externalSearchQuery !== prevExternalQuery.current
    ) {
      prevExternalQuery.current = externalSearchQuery;
      setQuery(externalSearchQuery);
      setTab("mold");
    }
  }, [externalSearchQuery]);

  // ---- Fetch selected item details for badges ----
  useEffect(() => {
    if (selectedMoldId && !selectedMoldInfo) {
      supabase
        .from("reference_molds")
        .select("id, manufacturer, mold_name, scale, release_year_start")
        .eq("id", selectedMoldId)
        .single()
        .then(({ data }) => {
          if (data) setSelectedMoldInfo(data as unknown as MoldResult);
        });
    } else if (!selectedMoldId) {
      setSelectedMoldInfo(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMoldId]);

  useEffect(() => {
    if (selectedResinId && !selectedResinInfo) {
      supabase
        .from("artist_resins")
        .select("id, sculptor_alias, resin_name, scale, cast_medium")
        .eq("id", selectedResinId)
        .single()
        .then(({ data }) => {
          if (data) setSelectedResinInfo(data as unknown as ResinResult);
        });
    } else if (!selectedResinId) {
      setSelectedResinInfo(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedResinId]);

  // ---- Unified search (molds + releases in mold tab) ----
  const runSearch = useCallback(
    async (q: string) => {
      setLoading(true);

      if (tab === "mold") {
        // Parallel: search molds + releases
        const moldPromise = supabase
          .from("reference_molds")
          .select("id, manufacturer, mold_name, scale, release_year_start")
          .or(`mold_name.ilike.%${q}%,manufacturer.ilike.%${q}%`)
          .order("mold_name")
          .limit(20);

        // Only search releases if query has text (otherwise too many results)
        const releasePromise = q.trim()
          ? supabase
              .from("reference_releases")
              .select(
                `id, mold_id, release_name, model_number, color_description,
                 release_year_start, release_year_end,
                 reference_molds(mold_name, manufacturer)`
              )
              .or(`release_name.ilike.%${q}%,color_description.ilike.%${q}%`)
              .limit(20)
          : Promise.resolve({ data: [] as unknown[] });

        const [moldRes, releaseRes] = await Promise.all([
          moldPromise,
          releasePromise,
        ]);
        setMoldResults((moldRes.data as MoldResult[]) ?? []);
        setReleaseResults(
          (releaseRes.data as unknown as ReleaseSearchResult[]) ?? []
        );
      } else {
        // Resin tab: search resins only
        const { data } = await supabase
          .from("artist_resins")
          .select("id, sculptor_alias, resin_name, scale, cast_medium")
          .or(`resin_name.ilike.%${q}%,sculptor_alias.ilike.%${q}%`)
          .order("sculptor_alias")
          .limit(50);
        setResinResults((data as ResinResult[]) ?? []);
      }

      setLoading(false);
    },
    [supabase, tab]
  );

  // Debounced search on query/tab change
  useEffect(() => {
    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    fetchTimeoutRef.current = setTimeout(() => runSearch(query), 300);
    return () => {
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    };
  }, [query, tab, runSearch]);

  // ---- Handlers ----

  const handleMoldClick = (mold: MoldResult) => {
    const newMoldId = selectedMoldId === mold.id ? null : mold.id;
    setSelectedMoldInfo(newMoldId ? mold : null);
    onSelectionChange({
      moldId: newMoldId,
      resinId: null,
      releaseId: null, // reset release when mold changes
    });
  };

  const handleReleaseClick = (release: ReleaseSearchResult) => {
    // Auto-fill the parent mold
    const parentMold = moldResults.find((m) => m.id === release.mold_id);
    if (parentMold) setSelectedMoldInfo(parentMold);
    else if (release.reference_molds) {
      // Create a pseudo MoldResult from the joined data
      setSelectedMoldInfo(null); // will be fetched by useEffect
    }

    onSelectionChange({
      moldId: release.mold_id,
      resinId: null,
      releaseId: release.id,
    });
  };

  const handleResinClick = (resin: ResinResult) => {
    const newResinId = selectedResinId === resin.id ? null : resin.id;
    setSelectedResinInfo(newResinId ? resin : null);
    onSelectionChange({
      moldId: null,
      resinId: newResinId,
      releaseId: null,
    });
  };

  const clearMold = () => {
    setSelectedMoldInfo(null);
    onSelectionChange({ moldId: null, resinId: selectedResinId, releaseId: null });
  };

  const clearResin = () => {
    setSelectedResinInfo(null);
    onSelectionChange({ moldId: selectedMoldId, resinId: null, releaseId: selectedReleaseId });
  };

  // ---- Render ----

  const hasResults =
    tab === "mold"
      ? moldResults.length > 0 || releaseResults.length > 0
      : resinResults.length > 0;

  return (
    <div>
      {aiNotice}

      {/* Tab toggle */}
      <div className="reference-tabs">
        <button
          className={`reference-tab ${tab === "mold" ? "active" : ""}`}
          onClick={() => {
            setTab("mold");
            setQuery("");
            onSelectionChange({ moldId: selectedMoldId, resinId: null, releaseId: selectedReleaseId });
          }}
          id="ref-tab-mold"
        >
          🔍 Search Molds &amp; Releases
        </button>
        <button
          className={`reference-tab ${tab === "resin" ? "active" : ""}`}
          onClick={() => {
            setTab("resin");
            setQuery("");
            onSelectionChange({ moldId: null, resinId: selectedResinId, releaseId: null });
          }}
          id="ref-tab-resin"
        >
          🎨 Artist Resin
        </button>
      </div>

      {/* Search input */}
      <div className="reference-search">
        <svg
          className="reference-search-icon"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          className="form-input"
          placeholder={
            tab === "mold"
              ? "Search by mold name, release name, or color…"
              : "Search by resin name or sculptor…"
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          id="reference-search-input"
          role="combobox"
          aria-expanded={hasResults}
          aria-autocomplete="list"
          autoComplete="off"
        />
      </div>

      {/* Selected badges */}
      {selectedMoldId && selectedMoldInfo && (
        <div className="reference-selected-badge">
          <span className="ref-type-badge mold">Mold</span>
          ✓ {selectedMoldInfo.manufacturer} — {selectedMoldInfo.mold_name} (
          {selectedMoldInfo.scale})
          <button onClick={clearMold} aria-label="Remove mold selection">
            ✕
          </button>
        </div>
      )}
      {selectedResinId && selectedResinInfo && (
        <div className="reference-selected-badge">
          <span className="ref-type-badge resin">Resin</span>
          ✓ {selectedResinInfo.sculptor_alias} — {selectedResinInfo.resin_name} (
          {selectedResinInfo.scale})
          <button onClick={clearResin} aria-label="Remove resin selection">
            ✕
          </button>
        </div>
      )}

      {/* ---- Results list ---- */}
      <div className="reference-results" role="listbox" aria-label="Search results">
        {loading ? (
          <div className="reference-empty">Searching…</div>
        ) : tab === "mold" ? (
          // ===== Mold tab: unified mold + release results =====
          <>
            {/* Base Molds group */}
            {moldResults.length > 0 && (
              <>
                <div className="ref-group-header" role="presentation">
                  🏭 Base Molds
                </div>
                {moldResults.map((mold) => (
                  <div
                    key={`mold-${mold.id}`}
                    className={`reference-item ${selectedMoldId === mold.id ? "selected" : ""}`}
                    onClick={() => handleMoldClick(mold)}
                    role="option"
                    aria-selected={selectedMoldId === mold.id}
                  >
                    <div className="ref-result-main">
                      <div className="ref-result-info">
                        <span className="reference-item-name">{mold.mold_name}</span>
                        <span className="reference-item-meta">
                          {" "}· {mold.manufacturer}
                        </span>
                        {mold.release_year_start && (
                          <span className="reference-item-meta">
                            {" "}· {mold.release_year_start}
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                        <span className="reference-item-meta">{mold.scale}</span>
                        <span className="ref-type-badge mold">Mold</span>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Releases group */}
            {releaseResults.length > 0 && (
              <>
                <div className="ref-group-header" role="presentation">
                  🎨 Specific Releases
                </div>
                {releaseResults.map((release) => {
                  const parentMoldName =
                    release.reference_molds?.mold_name ?? "Unknown mold";
                  const parentMfg =
                    release.reference_molds?.manufacturer ?? "";
                  const isSelected =
                    selectedReleaseId === release.id;

                  return (
                    <div
                      key={`release-${release.id}`}
                      className={`reference-item ${isSelected ? "selected" : ""}`}
                      onClick={() => handleReleaseClick(release)}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <div className="ref-result-main">
                        <div className="ref-result-info">
                          <span className="reference-item-name">
                            {release.release_name}
                          </span>
                          {release.model_number && (
                            <span className="reference-item-meta">
                              {" "}(#{release.model_number})
                            </span>
                          )}
                          <div className="ref-result-context">
                            on <strong>{parentMoldName}</strong>
                            {parentMfg && <> · {parentMfg}</>}
                            {release.release_year_start && (
                              <>
                                {" "}· {release.release_year_start}
                                {release.release_year_end &&
                                  release.release_year_end !== release.release_year_start &&
                                  `–${release.release_year_end}`}
                              </>
                            )}
                          </div>
                        </div>
                        <span className="ref-type-badge release">Release</span>
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {/* Empty — with escape hatch */}
            {!loading && moldResults.length === 0 && releaseResults.length === 0 && (
              <div className="reference-empty">
                {query.trim() ? (
                  <>
                    <p style={{ marginBottom: "var(--space-md)" }}>
                      No molds or releases matched &ldquo;{query}&rdquo;
                    </p>
                    {onCustomEntry && (
                      <button
                        className="btn btn-ghost ref-custom-entry-btn"
                        onClick={() => {
                          onCustomEntry(query.trim());
                          setQuery("");
                        }}
                        id="custom-entry-mold"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="16" />
                          <line x1="8" y1="12" x2="16" y2="12" />
                        </svg>
                        Can&apos;t find it? Add &ldquo;{query}&rdquo; as a Custom Entry
                      </button>
                    )}
                  </>
                ) : (
                  "Start typing to search across all molds and releases."
                )}
              </div>
            )}
          </>
        ) : (
          // ===== Resin tab =====
          <>
            {resinResults.length > 0
              ? resinResults.map((resin) => (
                  <div
                    key={resin.id}
                    className={`reference-item ${selectedResinId === resin.id ? "selected" : ""}`}
                    onClick={() => handleResinClick(resin)}
                    role="option"
                    aria-selected={selectedResinId === resin.id}
                  >
                    <div className="ref-result-main">
                      <div className="ref-result-info">
                        <span className="reference-item-name">{resin.resin_name}</span>
                        <span className="reference-item-meta"> · {resin.sculptor_alias}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                        <span className="reference-item-meta">{resin.scale}</span>
                        <span className="ref-type-badge resin">Resin</span>
                      </div>
                    </div>
                  </div>
                ))
              : (
                <div className="reference-empty">
                  {query.trim() ? (
                    <>
                      <p style={{ marginBottom: "var(--space-md)" }}>
                        No resins matched &ldquo;{query}&rdquo;
                      </p>
                      {onCustomEntry && (
                        <button
                          className="btn btn-ghost ref-custom-entry-btn"
                          onClick={() => {
                            onCustomEntry(query.trim());
                            setQuery("");
                          }}
                          id="custom-entry-resin"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="16" />
                            <line x1="8" y1="12" x2="16" y2="12" />
                          </svg>
                          Can&apos;t find it? Add &ldquo;{query}&rdquo; as a Custom Entry
                        </button>
                      )}
                    </>
                  ) : (
                    "Start typing to search artist resins."
                  )}
                </div>
              )}
          </>
        )}
      </div>

      {/* ---- Cascading Release dropdown (mold tab only) ---- */}
      {selectedMoldId && tab === "mold" && !selectedReleaseId && (
        <div className="form-group" style={{ marginTop: "var(--space-lg)" }}>
          <label htmlFor="release-select" className="form-label">
            🎨 Specific Release (Optional)
          </label>
          <span
            className="form-hint"
            style={{ marginBottom: "var(--space-sm)", display: "block" }}
          >
            Select a specific paint job / model number for this mold
          </span>
          {loadingReleases ? (
            <div className="reference-empty" style={{ padding: "var(--space-md)" }}>
              Loading releases…
            </div>
          ) : releases.length > 0 ? (
            <>
              <select
                id="release-select"
                className="form-select"
                value={selectedReleaseId ?? ""}
                onChange={(e) => {
                  const val = e.target.value || null;
                  onSelectionChange({
                    moldId: selectedMoldId,
                    resinId: null,
                    releaseId: val,
                  });
                }}
              >
                <option value="">— No specific release —</option>
                {releases.map((rel) => (
                  <option key={rel.id} value={rel.id}>
                    {rel.release_name}
                    {rel.model_number ? ` (#${rel.model_number})` : ""}
                    {rel.color_description ? ` — ${rel.color_description}` : ""}
                    {rel.release_year_start
                      ? ` (${rel.release_year_start}${
                          rel.release_year_end &&
                          rel.release_year_end !== rel.release_year_start
                            ? `–${rel.release_year_end}`
                            : ""
                        })`
                      : ""}
                  </option>
                ))}
              </select>
              {releaseHint}
            </>
          ) : (
            <div
              className="reference-empty"
              style={{
                padding: "var(--space-md)",
                fontSize: "calc(var(--font-size-sm) * var(--font-scale))",
              }}
            >
              No specific releases found for this mold. You can still proceed.
            </div>
          )}
        </div>
      )}

      {/* Show selected release info if selected via unified search */}
      {selectedReleaseId && selectedMoldId && tab === "mold" && (
        <div className="form-group" style={{ marginTop: "var(--space-lg)" }}>
          <div className="reference-selected-badge">
            <span className="ref-type-badge release">Release</span>
            ✓ {releases.find(r => r.id === selectedReleaseId)?.release_name ||
               releaseResults.find(r => r.id === selectedReleaseId)?.release_name ||
               "Selected release"}
            <button
              onClick={() =>
                onSelectionChange({
                  moldId: selectedMoldId,
                  resinId: null,
                  releaseId: null,
                })
              }
              aria-label="Remove release selection"
            >
              ✕
            </button>
          </div>
          {/* Still show cascade dropdown to let them change */}
          {!loadingReleases && releases.length > 0 && (
            <select
              className="form-select"
              style={{ marginTop: "var(--space-sm)" }}
              value={selectedReleaseId ?? ""}
              onChange={(e) => {
                const val = e.target.value || null;
                onSelectionChange({
                  moldId: selectedMoldId,
                  resinId: null,
                  releaseId: val,
                });
              }}
            >
              <option value="">— Change release —</option>
              {releases.map((rel) => (
                <option key={rel.id} value={rel.id}>
                  {rel.release_name}
                  {rel.model_number ? ` (#${rel.model_number})` : ""}
                  {rel.color_description ? ` — ${rel.color_description}` : ""}
                </option>
              ))}
            </select>
          )}
          {releaseHint}
        </div>
      )}
    </div>
  );
}
