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
            <div className="max-w-[var(--max-width)] mx-auto py-[0] px-6 py-12 px-[0]">
                <div className="bg-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-12 shadow-md transition-all max-w-[700] mx-auto p-12" style={{ textAlign: "center" }}>
                    <p className="text-muted" >Loading studio settings…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-[var(--max-width)] mx-auto py-[0] px-6 py-12 px-[0]">
            <div className="bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all animate-fade-in-up max-w-[700] mx-auto p-12">
                {/* Header */}
                <div className="mb-8" style={{ textAlign: "center" }}>
                    <div className="text-[2.5rem] mb-2" >🎨</div>
                    <h1 className="text-[calc(1.4rem*var(--font-scale))]" >
                        <span className="text-forest">
                            {existing ? "Edit Your Studio" : "Set Up Your Art Studio"}
                        </span>
                    </h1>
                    <p className="text-muted text-[calc(0.85rem*var(--font-scale))] mt-1" >
                        {existing ? "Update your studio profile and commission settings." : "Create your artist profile to start accepting commissions."}
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Studio Identity */}
                    <fieldset className="border border-edge rounded-lg p-6 mb-6">
                        <legend>🏷️ Studio Identity</legend>

                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-ink mb-1">Studio Name *</label>
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

                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-ink mb-1">Studio URL Slug</label>
                            <div className="gap-1" style={{ display: "flex", alignItems: "center" }}>
                                <span className="text-muted text-[calc(0.8rem*var(--font-scale))]" style={{ whiteSpace: "nowrap" }}>
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

                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-ink mb-1">Artist Bio</label>
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

                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-ink mb-1">Specialties</label>
                            <div className="flex flex-wrap gap-1">
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

                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-ink mb-1">Mediums</label>
                            <div className="flex flex-wrap gap-1">
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

                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-ink mb-1">Scales Offered</label>
                            <div className="flex flex-wrap gap-1">
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

                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-ink mb-1">Commission Types Accepted</label>
                            <div className="flex flex-wrap gap-1">
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

                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-ink mb-1">Commission Status</label>
                            <div className="gap-2" style={{ display: "flex" }}>
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

                        <div className="grid grid-cols-2 gap-4">
                            <div className="mb-6">
                                <label className="block text-sm font-semibold text-ink mb-1">Max Commission Slots</label>
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

                        <div className="grid grid-cols-2 gap-4">
                            <div className="mb-6">
                                <label className="block text-sm font-semibold text-ink mb-1">Turnaround (min days)</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={turnaroundMin}
                                    onChange={e => setTurnaroundMin(e.target.value)}
                                    placeholder="e.g. 14"
                                    min={1}
                                />
                            </div>
                            <div className="mb-6">
                                <label className="block text-sm font-semibold text-ink mb-1">Turnaround (max days)</label>
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

                        <div className="grid grid-cols-2 gap-4">
                            <div className="mb-6">
                                <label className="block text-sm font-semibold text-ink mb-1">Price Range (min $)</label>
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
                            <div className="mb-6">
                                <label className="block text-sm font-semibold text-ink mb-1">Price Range (max $)</label>
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

                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-ink mb-1">Terms & Conditions</label>
                            <textarea
                                className="form-input"
                                value={termsText}
                                onChange={e => setTermsText(e.target.value)}
                                placeholder="Deposit policy, revision limits, turnaround expectations, cancellation rules…"
                                rows={5}
                                maxLength={5000}
                            />
                        </div>

                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-ink mb-1">PayPal.me Link</label>
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
                        <p className="text-[#ef4444] mb-4 text-[calc(0.85rem*var(--font-scale))]" style={{ textAlign: "center" }}>
                            {error}
                        </p>
                    )}
                    {success && (
                        <p className="text-[#22c55e] mb-4 text-[calc(0.85rem*var(--font-scale))]" style={{ textAlign: "center" }}>
                            {success}
                        </p>
                    )}

                    <button
                        type="submit"
                        className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm"
                        disabled={saving || !studioName.trim()}
                        style={{ width: "100%" }}
                        id="save-studio-btn"
                    >
                        {saving ? "Saving…" : existing ? "💾 Save Changes" : "🎨 Create Studio"}
                    </button>

                    {existing && (
                        <div className="mt-4" style={{ textAlign: "center" }}>
                            <a href={`/studio/${existing.studioSlug}`} className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge">
                                👁️ View Public Studio Page
                            </a>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}
