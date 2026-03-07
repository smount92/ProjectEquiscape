"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { FinishType } from "@/lib/types/database";
import UnifiedReferenceSearch from "@/components/UnifiedReferenceSearch";
import type { ReleaseDetail } from "@/components/UnifiedReferenceSearch";
import CollectionPicker from "@/components/CollectionPicker";

// ---- Types ----

interface VaultData {
  purchase_price: number | null;
  purchase_date: string | null;
  estimated_current_value: number | null;
  insurance_notes: string | null;
}

const CONDITION_GRADES = [
  { value: "Mint", label: "Mint — Flawless, like new" },
  { value: "Near Mint", label: "Near Mint — Minimal handling wear" },
  { value: "Excellent", label: "Excellent — Very light wear, no breaks" },
  { value: "Very Good", label: "Very Good — Minor rubs or scuffs" },
  { value: "Good", label: "Good — Noticeable wear, still displays well" },
  { value: "Fair", label: "Fair — Visible flaws, repairs, or damage" },
  { value: "Poor", label: "Poor — Significant damage or missing parts" },
];

// ---- Component ----
export default function EditHorsePage() {
  const router = useRouter();
  const params = useParams();
  const horseId = params.id as string;
  const supabase = createClient();

  // Loading / error
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Identity fields
  const [customName, setCustomName] = useState("");
  const [sculptor, setSculptor] = useState("");
  const [finishType, setFinishType] = useState<FinishType | "">("");
  const [conditionGrade, setConditionGrade] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);

  // Reference fields (controlled by UnifiedReferenceSearch)
  const [selectedMoldId, setSelectedMoldId] = useState<string | null>(null);
  const [selectedResinId, setSelectedResinId] = useState<string | null>(null);
  const [selectedReleaseId, setSelectedReleaseId] = useState<string | null>(null);
  const [releases, setReleases] = useState<ReleaseDetail[]>([]);
  const [loadingReleases, setLoadingReleases] = useState(false);
  const [defaultTab, setDefaultTab] = useState<"mold" | "resin">("mold");

  // Financial Vault
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [insuranceNotes, setInsuranceNotes] = useState("");
  const [hasExistingVault, setHasExistingVault] = useState(false);

  // ---- Load existing data ----
  useEffect(() => {
    async function loadHorse() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: horse, error: horseErr } = await supabase
        .from("user_horses")
        .select("id, owner_id, custom_name, sculptor, finish_type, condition_grade, is_public, collection_id, reference_mold_id, artist_resin_id, release_id")
        .eq("id", horseId)
        .single<{
          id: string;
          owner_id: string;
          custom_name: string;
          sculptor: string | null;
          finish_type: FinishType;
          condition_grade: string;
          is_public: boolean;
          collection_id: string | null;
          reference_mold_id: string | null;
          artist_resin_id: string | null;
          release_id: string | null;
        }>();

      if (horseErr || !horse || horse.owner_id !== user.id) {
        setError("Horse not found or access denied.");
        setIsLoading(false);
        return;
      }

      setCustomName(horse.custom_name);
      setSculptor(horse.sculptor || "");
      setFinishType(horse.finish_type);
      setConditionGrade(horse.condition_grade);
      setIsPublic(horse.is_public);
      setSelectedCollectionId(horse.collection_id);

      if (horse.reference_mold_id) {
        setSelectedMoldId(horse.reference_mold_id);
        setDefaultTab("mold");
      } else if (horse.artist_resin_id) {
        setSelectedResinId(horse.artist_resin_id);
        setDefaultTab("resin");
      }
      if (horse.release_id) {
        setSelectedReleaseId(horse.release_id);
      }

      const { data: vault } = await supabase
        .from("financial_vault")
        .select("purchase_price, purchase_date, estimated_current_value, insurance_notes")
        .eq("horse_id", horseId)
        .single<VaultData>();

      if (vault) {
        setHasExistingVault(true);
        if (vault.purchase_price !== null) setPurchasePrice(String(vault.purchase_price));
        if (vault.purchase_date !== null) setPurchaseDate(vault.purchase_date);
        if (vault.estimated_current_value !== null) setEstimatedValue(String(vault.estimated_current_value));
        if (vault.insurance_notes !== null) setInsuranceNotes(vault.insurance_notes);
      }

      setIsLoading(false);
    }

    loadHorse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horseId]);

  // ---- Fetch releases cascade ----
  useEffect(() => {
    if (!selectedMoldId) {
      setReleases([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoadingReleases(true);
      const { data } = await supabase
        .from("reference_releases")
        .select("id, mold_id, model_number, release_name, color_description, release_year_start, release_year_end")
        .eq("mold_id", selectedMoldId)
        .order("release_year_start", { ascending: true, nullsFirst: false });
      if (!cancelled) {
        setReleases((data as ReleaseDetail[]) ?? []);
        setLoadingReleases(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [selectedMoldId, supabase]);

  // ---- Save handler ----
  const handleSave = async () => {
    if (!customName.trim() || !finishType || !conditionGrade) {
      setSaveError("Please fill in all required identity fields.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const horseUpdate: Record<string, unknown> = {
        custom_name: customName.trim(),
        sculptor: sculptor.trim() || null,
        finish_type: finishType,
        condition_grade: conditionGrade,
        is_public: isPublic,
        collection_id: selectedCollectionId,
        reference_mold_id: selectedMoldId,
        artist_resin_id: selectedResinId,
        release_id: selectedReleaseId,
      };

      const { error: updErr } = await supabase
        .from("user_horses")
        .update(horseUpdate)
        .eq("id", horseId);

      if (updErr) throw new Error(updErr.message);

      const hasVaultData = purchasePrice || purchaseDate || estimatedValue || insuranceNotes;

      if (hasVaultData) {
        const vaultData: Record<string, unknown> = {
          horse_id: horseId,
          purchase_price: purchasePrice ? parseFloat(purchasePrice) : null,
          purchase_date: purchaseDate || null,
          estimated_current_value: estimatedValue ? parseFloat(estimatedValue) : null,
          insurance_notes: insuranceNotes || null,
        };

        if (hasExistingVault) {
          const { error: vErr } = await supabase
            .from("financial_vault")
            .update(vaultData)
            .eq("horse_id", horseId);
          if (vErr) console.error("Vault update error:", vErr);
        } else {
          const { error: vErr } = await supabase
            .from("financial_vault")
            .insert(vaultData);
          if (vErr) console.error("Vault insert error:", vErr);
        }
      } else if (hasExistingVault) {
        await supabase.from("financial_vault").delete().eq("horse_id", horseId);
      }

      router.push("/?toast=updated&name=" + encodeURIComponent(customName.trim()));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save changes.");
      setIsSaving(false);
    }
  };

  // ---- RENDER ----

  if (isLoading) {
    return (
      <div className="page-container form-page">
        <div className="edit-page" style={{ textAlign: "center", padding: "var(--space-3xl)" }}>
          <div className="btn-spinner" style={{ width: 36, height: 36, margin: "0 auto var(--space-lg)", borderWidth: 3, borderColor: "var(--color-border)", borderTopColor: "var(--color-accent-primary)" }} />
          <p>Loading horse details…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container form-page">
        <div className="passport-not-found card">
          <div className="passport-not-found-icon">🚫</div>
          <h1>Access Denied</h1>
          <p>{error}</p>
          <Link href="/" className="btn btn-primary">Back to Stable</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container form-page">
      <nav className="passport-breadcrumb animate-fade-in-up" aria-label="Breadcrumb">
        <Link href="/">Digital Stable</Link>
        <span className="separator" aria-hidden="true">/</span>
        <Link href={`/stable/${horseId}`}>{customName}</Link>
        <span className="separator" aria-hidden="true">/</span>
        <span>Edit</span>
      </nav>

      <div className="edit-page animate-fade-in-up">
        <h1 style={{ marginBottom: "var(--space-xl)" }}>
          Edit <span className="text-gradient">{customName}</span>
        </h1>

        {saveError && (
          <div className="form-error" role="alert" style={{ marginBottom: "var(--space-xl)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            {saveError}
          </div>
        )}

        {/* ===== Section 1: Identity ===== */}
        <div className="edit-section">
          <div className="edit-section-header">
            <div className="edit-section-icon">🏷️</div>
            <h2>Model Identity</h2>
          </div>

          <div className="form-group">
            <label htmlFor="edit-name" className="form-label">Custom Name *</label>
            <input id="edit-name" type="text" className="form-input" value={customName}
              onChange={(e) => setCustomName(e.target.value)} maxLength={100} />
          </div>

          <div className="form-group">
            <label htmlFor="edit-sculptor" className="form-label">Sculptor / Artist</label>
            <input id="edit-sculptor" type="text" className="form-input" value={sculptor}
              onChange={(e) => setSculptor(e.target.value)} maxLength={100}
              placeholder="e.g. Sarah Rose, Brigitte Eberl…" />
            <span className="form-hint">
              Optional — tag the sculptor or artist, especially for Artist Resins or custom work.
            </span>
          </div>

          <div className="edit-row">
            <div className="form-group">
              <label htmlFor="edit-finish" className="form-label">Finish Type *</label>
              <select id="edit-finish" className="form-select" value={finishType}
                onChange={(e) => setFinishType(e.target.value as FinishType)}>
                <option value="">Select finish type…</option>
                <option value="OF">OF (Original Finish)</option>
                <option value="Custom">Custom (Repaint / Body Mod)</option>
                <option value="Artist Resin">Artist Resin</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="edit-condition" className="form-label">Condition Grade *</label>
              <select id="edit-condition" className="form-select" value={conditionGrade}
                onChange={(e) => setConditionGrade(e.target.value)}>
                <option value="">Select condition…</option>
                {CONDITION_GRADES.map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Collection Picker */}
          <CollectionPicker
            selectedCollectionId={selectedCollectionId}
            onSelect={setSelectedCollectionId}
          />
        </div>

        {/* Community visibility toggle */}
        <div className="community-toggle-section">
          <div className="community-toggle-row">
            <div className="community-toggle-info">
              <span className="community-toggle-label">🏆 Show in Public Community Feed</span>
              <span className="community-toggle-hint">
                When enabled, this model appears in the Show Ring.
                Your financial data is always private.
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isPublic}
              className={`toggle-switch ${isPublic ? "toggle-on" : "toggle-off"}`}
              onClick={() => setIsPublic(!isPublic)}
              id="edit-is-public-toggle"
            >
              <span className="toggle-knob" />
            </button>
          </div>
        </div>

        {/* ===== Section 2: Reference Link (Unified Search) ===== */}
        <div className="edit-section">
          <div className="edit-section-header">
            <div className="edit-section-icon">🔗</div>
            <h2>Reference Link</h2>
          </div>

          <UnifiedReferenceSearch
            selectedMoldId={selectedMoldId}
            selectedResinId={selectedResinId}
            selectedReleaseId={selectedReleaseId}
            onSelectionChange={(sel) => {
              setSelectedMoldId(sel.moldId);
              setSelectedResinId(sel.resinId);
              setSelectedReleaseId(sel.releaseId);
            }}
            onCustomEntry={(searchTerm) => {
              setSelectedMoldId(null);
              setSelectedResinId(null);
              setSelectedReleaseId(null);
              setCustomName(searchTerm);
            }}
            defaultTab={defaultTab}
            releases={releases}
            loadingReleases={loadingReleases}
          />
        </div>

        {/* ===== Section 3: Financial Vault ===== */}
        <div className="edit-section vault-section">
          <div className="vault-header">
            <div className="vault-icon">🔒</div>
            <div>
              <h2>Financial Vault</h2>
              <p>Optional — update purchase details and valuations</p>
            </div>
          </div>

          <div className="vault-privacy-notice" role="note">
            <span style={{ fontSize: "1.3em", flexShrink: 0, marginTop: "2px" }}>🛡️</span>
            <p>
              <strong>This data is encrypted and only visible to you.</strong> Protected by
              strict Row Level Security.
            </p>
          </div>

          <div className="vault-row">
            <div className="form-group">
              <label htmlFor="edit-price" className="form-label">Purchase Price ($)</label>
              <input id="edit-price" type="number" className="form-input" placeholder="0.00"
                min="0" step="0.01" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="edit-date" className="form-label">Purchase Date</label>
              <input id="edit-date" type="date" className="form-input" value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)} />
            </div>
          </div>

          <div className="vault-row">
            <div className="form-group">
              <label htmlFor="edit-value" className="form-label">Estimated Current Value ($)</label>
              <input id="edit-value" type="number" className="form-input" placeholder="0.00"
                min="0" step="0.01" value={estimatedValue} onChange={(e) => setEstimatedValue(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="edit-insurance" className="form-label">Insurance Notes</label>
              <input id="edit-insurance" type="text" className="form-input"
                placeholder="Policy number, coverage details, etc."
                value={insuranceNotes} onChange={(e) => setInsuranceNotes(e.target.value)} />
            </div>
          </div>
        </div>

        {/* ===== Actions ===== */}
        <div className="edit-actions">
          <Link href={`/stable/${horseId}`} className="btn btn-ghost" id="edit-cancel">
            Cancel
          </Link>
          <button className="btn btn-primary" onClick={handleSave}
            disabled={isSaving || !customName.trim() || !finishType || !conditionGrade}
            id="edit-save">
            {isSaving ? (
              <>
                <span className="btn-spinner" aria-hidden="true" />
                Saving…
              </>
            ) : (
              <>✅ Save Changes</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
