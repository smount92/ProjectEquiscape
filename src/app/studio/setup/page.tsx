"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    getArtistProfile,
    createArtistProfile,
    updateArtistProfile,
} from "@/app/actions/art-studio";
import type { ArtistProfile } from "@/app/actions/art-studio";

// ── Option Lists ──
const SPECIALTIES = [
    "Custom Painting (OF)", "Custom Painting (Resin)", "Prepping",
    "Hairing", "Tack Making", "Etching/Dremmeling", "Body Mods",
    "Glazework", "Pastels", "Oils", "Acrylics",
];

const MEDIUMS = [
    "Acrylics", "Oils", "Pastels", "Airbrush",
    "Prismacolor Pencils", "Chalk", "Epoxy", "Mixed Media",
];

const SCALES = [
    "Traditional (1:9)", "Classic (1:12)", "Stablemate (1:32)",
    "Paddock Pal (1:24)", "Micro Mini", "Other",
];

const COMMISSION_TYPES = [
    "Custom Paint", "Resin Prep & Paint", "Hair Job",
    "Tack Order", "Body Mod", "Full Custom",
    "Repair / Touch-up", "Other",
];

export default function StudioSetupPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [existing, setExisting] = useState<ArtistProfile | null>(null);
    const [userId, setUserId] = useState<string | null>(null);

    // Form state
    const [studioName, setStudioName] = useState("");
    const [studioSlug, setStudioSlug] = useState("");
    const [specialties, setSpecialties] = useState<string[]>([]);
    const [mediums, setMediums] = useState<string[]>([]);
    const [scalesOffered, setScalesOffered] = useState<string[]>([]);
    const [bioArtist, setBioArtist] = useState("");
    const [status, setStatus] = useState("closed");
    const [maxSlots, setMaxSlots] = useState("5");
    const [turnaroundMin, setTurnaroundMin] = useState("");
    const [turnaroundMax, setTurnaroundMax] = useState("");
    const [priceMin, setPriceMin] = useState("");
    const [priceMax, setPriceMax] = useState("");
    const [termsText, setTermsText] = useState("");
    const [paypalMeLink, setPaypalMeLink] = useState("");
    const [acceptingTypes, setAcceptingTypes] = useState<string[]>([]);

    const loadProfile = useCallback(async () => {
        setLoading(true);
        try {
            // Get current user ID from cookie-based session
            const res = await fetch("/api/auth/me");
            if (!res.ok) { setLoading(false); return; }
            const { userId: uid } = await res.json();
            if (!uid) { setLoading(false); return; }
            setUserId(uid);

            const profile = await getArtistProfile(uid);
            if (profile) {
                setExisting(profile);
                setStudioName(profile.studioName);
                setStudioSlug(profile.studioSlug);
                setSpecialties(profile.specialties);
                setMediums(profile.mediums);
                setScalesOffered(profile.scalesOffered);
                setBioArtist(profile.bioArtist || "");
                setStatus(profile.status);
                setMaxSlots(profile.maxSlots?.toString() || "5");
                setTurnaroundMin(profile.turnaroundMinDays?.toString() || "");
                setTurnaroundMax(profile.turnaroundMaxDays?.toString() || "");
                setPriceMin(profile.priceRangeMin?.toString() || "");
                setPriceMax(profile.priceRangeMax?.toString() || "");
                setTermsText(profile.termsText || "");
                setPaypalMeLink(profile.paypalMeLink || "");
                setAcceptingTypes(profile.acceptingTypes);
            }
        } catch { /* ignore */ }
        setLoading(false);
    }, []);

    useEffect(() => { loadProfile(); }, [loadProfile]);

    // Auto-generate slug from studio name
    useEffect(() => {
        if (!existing && studioName) {
            setStudioSlug(studioName.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""));
        }
    }, [studioName, existing]);

    const toggleArray = (arr: string[], setArr: (v: string[]) => void, val: string) => {
        setArr(arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        setSuccess(null);

        const formData = new FormData();
        formData.set("studioName", studioName);
        formData.set("studioSlug", studioSlug);
        formData.set("specialties", JSON.stringify(specialties));
        formData.set("mediums", JSON.stringify(mediums));
        formData.set("scalesOffered", JSON.stringify(scalesOffered));
        formData.set("bioArtist", bioArtist);
        formData.set("status", status);
        formData.set("maxSlots", (parseInt(maxSlots) || 5).toString());
        formData.set("turnaroundMinDays", turnaroundMin);
        formData.set("turnaroundMaxDays", turnaroundMax);
        formData.set("priceRangeMin", priceMin);
        formData.set("priceRangeMax", priceMax);
        formData.set("termsText", termsText);
        formData.set("paypalMeLink", paypalMeLink);
        formData.set("acceptingTypes", JSON.stringify(acceptingTypes));

        const result = existing
            ? await updateArtistProfile(formData)
            : await createArtistProfile(formData);

        if (result.success) {
            setSuccess(existing ? "Profile updated!" : "Studio created!");
            if (!existing && "slug" in result && result.slug) {
                setTimeout(() => router.push(`/studio/${result.slug}`), 1500);
            }
            // Reload to refresh state
            await loadProfile();
        } else {
            setError(result.error || "Something went wrong.");
        }
        setSaving(false);
    };

    if (loading) {
        return (
            <div className="page-container form-page">
                <div className="card" style={{ maxWidth: 700, margin: "0 auto", padding: "var(--space-2xl)", textAlign: "center" }}>
                    <p style={{ color: "var(--color-text-muted)" }}>Loading studio settings…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container form-page">
            <div className="card animate-fade-in-up" style={{ maxWidth: 700, margin: "0 auto", padding: "var(--space-2xl)" }}>
                {/* Header */}
                <div style={{ textAlign: "center", marginBottom: "var(--space-xl)" }}>
                    <div style={{ fontSize: "2.5rem", marginBottom: "var(--space-sm)" }}>🎨</div>
                    <h1 style={{ fontSize: "calc(1.4rem * var(--font-scale))" }}>
                        <span className="text-gradient">
                            {existing ? "Edit Your Studio" : "Set Up Your Art Studio"}
                        </span>
                    </h1>
                    <p style={{ color: "var(--color-text-muted)", fontSize: "calc(0.85rem * var(--font-scale))", marginTop: "var(--space-xs)" }}>
                        {existing ? "Update your studio profile and commission settings." : "Create your artist profile to start accepting commissions."}
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Studio Identity */}
                    <fieldset className="border border-edge rounded-lg p-6 mb-6">
                        <legend>🏷️ Studio Identity</legend>

                        <div className="form-group">
                            <label className="form-label">Studio Name *</label>
                            <input
                                type="text"
                                className="form-input"
                                value={studioName}
                                onChange={e => setStudioName(e.target.value)}
                                placeholder="e.g. Painted Ponies Studio"
                                required
                                maxLength={80}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Studio URL Slug</label>
                            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
                                <span style={{ color: "var(--color-text-muted)", fontSize: "calc(0.8rem * var(--font-scale))", whiteSpace: "nowrap" }}>
                                    /studio/
                                </span>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={studioSlug}
                                    onChange={e => setStudioSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                                    placeholder="painted-ponies"
                                    maxLength={50}
                                    style={{ fontFamily: "monospace" }}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Artist Bio</label>
                            <textarea
                                className="form-input"
                                value={bioArtist}
                                onChange={e => setBioArtist(e.target.value)}
                                placeholder="Tell clients about your style, experience, and what inspires your work…"
                                rows={4}
                                maxLength={2000}
                            />
                        </div>
                    </fieldset>

                    {/* Skills & Services */}
                    <fieldset className="border border-edge rounded-lg p-6 mb-6">
                        <legend>🛠️ Skills & Services</legend>

                        <div className="form-group">
                            <label className="form-label">Specialties</label>
                            <div className="studio-chip-grid">
                                {SPECIALTIES.map(s => (
                                    <button
                                        key={s}
                                        type="button"
                                        className={`studio-chip ${specialties.includes(s) ? "active" : ""}`}
                                        onClick={() => toggleArray(specialties, setSpecialties, s)}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Mediums</label>
                            <div className="studio-chip-grid">
                                {MEDIUMS.map(m => (
                                    <button
                                        key={m}
                                        type="button"
                                        className={`studio-chip ${mediums.includes(m) ? "active" : ""}`}
                                        onClick={() => toggleArray(mediums, setMediums, m)}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Scales Offered</label>
                            <div className="studio-chip-grid">
                                {SCALES.map(s => (
                                    <button
                                        key={s}
                                        type="button"
                                        className={`studio-chip ${scalesOffered.includes(s) ? "active" : ""}`}
                                        onClick={() => toggleArray(scalesOffered, setScalesOffered, s)}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Commission Types Accepted</label>
                            <div className="studio-chip-grid">
                                {COMMISSION_TYPES.map(t => (
                                    <button
                                        key={t}
                                        type="button"
                                        className={`studio-chip ${acceptingTypes.includes(t) ? "active" : ""}`}
                                        onClick={() => toggleArray(acceptingTypes, setAcceptingTypes, t)}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </fieldset>

                    {/* Commission Settings */}
                    <fieldset className="border border-edge rounded-lg p-6 mb-6">
                        <legend>📋 Commission Settings</legend>

                        <div className="form-group">
                            <label className="form-label">Commission Status</label>
                            <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                                {(["open", "waitlist", "closed"] as const).map(s => (
                                    <button
                                        key={s}
                                        type="button"
                                        className={`studio-status-btn ${status === s ? `active-${s}` : ""}`}
                                        onClick={() => setStatus(s)}
                                    >
                                        {s === "open" ? "🟢" : s === "waitlist" ? "🟡" : "🔴"}{" "}
                                        {s.charAt(0).toUpperCase() + s.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="form-row-2col">
                            <div className="form-group">
                                <label className="form-label">Max Commission Slots</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={maxSlots}
                                    onChange={e => setMaxSlots(e.target.value)}
                                    onBlur={() => {
                                        const val = parseInt(maxSlots);
                                        if (isNaN(val) || val < 1) setMaxSlots("1");
                                        else if (val > 50) setMaxSlots("50");
                                        else setMaxSlots(val.toString());
                                    }}
                                    min={1}
                                    max={50}
                                />
                            </div>
                            <div />
                        </div>

                        <div className="form-row-2col">
                            <div className="form-group">
                                <label className="form-label">Turnaround (min days)</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={turnaroundMin}
                                    onChange={e => setTurnaroundMin(e.target.value)}
                                    placeholder="e.g. 14"
                                    min={1}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Turnaround (max days)</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={turnaroundMax}
                                    onChange={e => setTurnaroundMax(e.target.value)}
                                    placeholder="e.g. 60"
                                    min={1}
                                />
                            </div>
                        </div>

                        <div className="form-row-2col">
                            <div className="form-group">
                                <label className="form-label">Price Range (min $)</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={priceMin}
                                    onChange={e => setPriceMin(e.target.value)}
                                    placeholder="e.g. 50"
                                    min={0}
                                    step="0.01"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Price Range (max $)</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={priceMax}
                                    onChange={e => setPriceMax(e.target.value)}
                                    placeholder="e.g. 500"
                                    min={0}
                                    step="0.01"
                                />
                            </div>
                        </div>
                    </fieldset>

                    {/* Policies & Payment */}
                    <fieldset className="border border-edge rounded-lg p-6 mb-6">
                        <legend>💰 Policies & Payment</legend>

                        <div className="form-group">
                            <label className="form-label">Terms & Conditions</label>
                            <textarea
                                className="form-input"
                                value={termsText}
                                onChange={e => setTermsText(e.target.value)}
                                placeholder="Deposit policy, revision limits, turnaround expectations, cancellation rules…"
                                rows={5}
                                maxLength={5000}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">PayPal.me Link</label>
                            <input
                                type="url"
                                className="form-input"
                                value={paypalMeLink}
                                onChange={e => setPaypalMeLink(e.target.value)}
                                placeholder="https://paypal.me/yourstudio"
                            />
                        </div>
                    </fieldset>

                    {/* Feedback */}
                    {error && (
                        <p style={{ color: "#ef4444", textAlign: "center", marginBottom: "var(--space-md)", fontSize: "calc(0.85rem * var(--font-scale))" }}>
                            {error}
                        </p>
                    )}
                    {success && (
                        <p style={{ color: "#22c55e", textAlign: "center", marginBottom: "var(--space-md)", fontSize: "calc(0.85rem * var(--font-scale))" }}>
                            {success}
                        </p>
                    )}

                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={saving || !studioName.trim()}
                        style={{ width: "100%" }}
                        id="save-studio-btn"
                    >
                        {saving ? "Saving…" : existing ? "💾 Save Changes" : "🎨 Create Studio"}
                    </button>

                    {existing && (
                        <div style={{ textAlign: "center", marginTop: "var(--space-md)" }}>
                            <a href={`/studio/${existing.studioSlug}`} className="btn btn-ghost">
                                👁️ View Public Studio Page
                            </a>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}
