"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCommission } from "@/app/actions/art-studio";
import type { ArtistProfile } from "@/app/actions/art-studio";

export default function CommissionRequestForm({
    artist,
}: {
    artist: ArtistProfile;
}) {
    const router = useRouter();
    const [commissionType, setCommissionType] = useState("");
    const [description, setDescription] = useState("");
    const [budget, setBudget] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const typeOptions = artist.acceptingTypes.length > 0
        ? artist.acceptingTypes
        : artist.specialties.length > 0
            ? artist.specialties
            : ["Custom Paint", "Other"];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!commissionType || !description.trim()) {
            setError("Please fill in all required fields.");
            return;
        }

        setSaving(true);
        setError(null);

        const result = await createCommission({
            artistId: artist.userId,
            commissionType,
            description: description.trim(),
            budget: budget ? parseFloat(budget) : undefined,
        });

        if (result.success && result.commissionId) {
            router.push(`/studio/commission/${result.commissionId}`);
        } else {
            setError(result.error || "Failed to submit request.");
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="form-group">
                <label className="form-label">Commission Type *</label>
                <select
                    className="form-input"
                    value={commissionType}
                    onChange={e => setCommissionType(e.target.value)}
                    required
                >
                    <option value="">Select a type…</option>
                    {typeOptions.map(t => (
                        <option key={t} value={t}>{t}</option>
                    ))}
                </select>
            </div>

            <div className="form-group">
                <label className="form-label">Description *</label>
                <textarea
                    className="form-input"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Describe what you'd like — colors, breed, reference photos, any details that help the artist understand your vision…"
                    rows={6}
                    maxLength={5000}
                    required
                />
            </div>

            <div className="form-group">
                <label className="form-label">Your Budget ($)</label>
                <input
                    type="number"
                    className="form-input"
                    value={budget}
                    onChange={e => setBudget(e.target.value)}
                    placeholder={artist.priceRangeMin ? `Starting from $${artist.priceRangeMin}` : "Optional"}
                    min={0}
                    step="0.01"
                />
                {(artist.priceRangeMin || artist.priceRangeMax) && (
                    <span style={{ fontSize: "calc(0.75rem * var(--font-scale))", color: "var(--color-text-muted)", marginTop: 4, display: "block" }}>
                        Artist&apos;s range: ${artist.priceRangeMin || "?"} – ${artist.priceRangeMax || "?"}
                    </span>
                )}
            </div>

            {error && (
                <p style={{ color: "#ef4444", textAlign: "center", marginBottom: "var(--space-md)", fontSize: "calc(0.85rem * var(--font-scale))" }}>
                    {error}
                </p>
            )}

            <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
                style={{ width: "100%" }}
                id="submit-commission-btn"
            >
                {saving ? "Submitting…" : "🎨 Submit Commission Request"}
            </button>
        </form>
    );
}
