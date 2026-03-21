"use client";

import { useState } from "react";
import { updateBio } from "@/app/actions/profile";
import { useRouter } from "next/navigation";

interface EditBioButtonProps {
    currentBio: string | null;
}

export default function EditBioButton({ currentBio }: EditBioButtonProps) {
    const router = useRouter();
    const [isEditing, setIsEditing] = useState(false);
    const [bio, setBio] = useState(currentBio || "");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        const result = await updateBio(bio);
        if (result.success) {
            setIsEditing(false);
            router.refresh();
        } else {
            setError(result.error || "Failed to save bio.");
        }
        setSaving(false);
    };

    if (!isEditing) {
        return (
            <button
                className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge min-h-[36px] py-1 px-6 text-sm"
                onClick={() => setIsEditing(true)}
                style={{ fontSize: "calc(var(--font-size-xs) * var(--font-scale))", opacity: 0.7 }}
                id="edit-bio-btn"
                title="Edit bio"
            >
                ✏️ {currentBio ? "Edit Bio" : "Add Bio"}
            </button>
        );
    }

    return (
        <div className="edit-bio-form" style={{ marginTop: "var(--space-sm)", maxWidth: "480px", width: "100%" }}>
            <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 500))}
                placeholder="Tell collectors about yourself… (500 chars max)"
                className="form-input"
                style={{
                    minHeight: "80px",
                    resize: "vertical",
                    fontSize: "calc(var(--font-size-sm) * var(--font-scale))",
                }}
                maxLength={500}
                id="bio-textarea"
                autoFocus
            />
            <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "var(--space-xs)",
                gap: "var(--space-sm)",
            }}>
                <span style={{
                    fontSize: "calc(var(--font-size-xs) * var(--font-scale))",
                    color: bio.length > 450 ? "var(--color-error)" : "var(--color-text-muted)",
                }}>
                    {bio.length}/500
                </span>
                <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                    <button
                        className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge min-h-[36px] py-1 px-6 text-sm"
                        onClick={() => {
                            setBio(currentBio || "");
                            setIsEditing(false);
                            setError(null);
                        }}
                        disabled={saving}
                    >
                        Cancel
                    </button>
                    <button
                        className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm min-h-[36px] py-1 px-6 text-sm"
                        onClick={handleSave}
                        disabled={saving}
                        id="save-bio-btn"
                    >
                        {saving ? "Saving…" : "Save"}
                    </button>
                </div>
            </div>
            {error && (
                <div style={{
                    color: "var(--color-error)",
                    fontSize: "calc(var(--font-size-xs) * var(--font-scale))",
                    marginTop: "var(--space-xs)",
                }}>
                    {error}
                </div>
            )}
        </div>
    );
}
