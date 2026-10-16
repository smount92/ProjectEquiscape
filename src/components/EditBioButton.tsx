"use client";

/**
 * Edit the bio and the outbound links in one place. Links are
 * normalised server-side (lib/links/memberLinks): a handle, a pasted
 * URL or a bare domain all become one https link; junk is dropped.
 */

import { useState } from "react";
import { updateBio, updateProfileLinks } from "@/app/actions/profile";
import { useRouter } from "next/navigation";
import { linkMeta, PROFILE_LINK_KEYS, type MemberLinks } from "@/lib/links/memberLinks";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface EditBioButtonProps {
    currentBio: string | null;
    currentLinks?: MemberLinks | null;
}

export default function EditBioButton({ currentBio, currentLinks = null }: EditBioButtonProps) {
    const router = useRouter();
    const [isEditing, setIsEditing] = useState(false);
    const [bio, setBio] = useState(currentBio || "");
    const [links, setLinks] = useState<Record<string, string>>({ ...(currentLinks ?? {}) });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        const bioResult = await updateBio(bio);
        if (!bioResult.success) {
            setError(bioResult.error || "Failed to save bio.");
            setSaving(false);
            return;
        }
        const linksResult = await updateProfileLinks(links);
        if (!linksResult.success) {
            // The bio is saved; only the links are waiting (pre-229).
            setError(linksResult.error || "Failed to save links.");
            setSaving(false);
            return;
        }
        setIsEditing(false);
        setSaving(false);
        router.refresh();
    };

    if (!isEditing) {
        return (
            <Button
                variant="outline"
                size="wide"
                className="text-xs opacity-70"
                onClick={() => setIsEditing(true)}
                id="edit-bio-btn"
                title="Edit bio and links"
            >
                ✏️ {currentBio ? "Edit Bio & Links" : "Add Bio & Links"}
            </Button>
        );
    }

    return (
        <div className="edit-bio-form mt-2 w-full max-w-[480px] text-left">
            <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 500))}
                placeholder="Tell collectors about yourself… (500 chars max)"
                className="min-h-[80px] resize-y text-sm"
                maxLength={500}
                id="bio-textarea"
                autoFocus
            />
            <div className="mt-1 flex items-center justify-between gap-2">
                <span className={`text-xs ${bio.length > 450 ? "text-destructive" : "text-muted-foreground"}`}>
                    {bio.length}/500
                </span>
            </div>

            <fieldset className="mt-3 flex flex-col gap-2 border-0 p-0">
                <legend className="text-xs font-bold tracking-wide text-muted-foreground uppercase">Links</legend>
                {linkMeta(PROFILE_LINK_KEYS).map((m) => (
                    <label key={m.key} className="flex items-center gap-2 text-sm">
                        <span className="w-28 shrink-0 text-xs font-semibold text-muted-foreground">
                            {m.glyph} {m.label}
                        </span>
                        <Input
                            value={links[m.key] ?? ""}
                            onChange={(e) => setLinks((prev) => ({ ...prev, [m.key]: e.target.value }))}
                            placeholder={m.placeholder}
                            className="h-8 text-sm"
                            id={`profile-link-${m.key}`}
                            maxLength={300}
                        />
                    </label>
                ))}
                <p className="m-0 text-xs text-muted-foreground">
                    Shown as buttons under your bio. A handle, a pasted link or a bare domain all work; anything that
                    isn&rsquo;t a web address is dropped.
                </p>
            </fieldset>

            <div className="mt-3 flex justify-end gap-2">
                <Button
                    variant="outline"
                    size="wide"
                    onClick={() => {
                        setBio(currentBio || "");
                        setLinks({ ...(currentLinks ?? {}) });
                        setIsEditing(false);
                        setError(null);
                    }}
                    disabled={saving}
                >
                    Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving} id="save-bio-btn">
                    {saving ? "Saving…" : "Save"}
                </Button>
            </div>
            {error && <div className="mt-1 text-xs text-destructive">{error}</div>}
        </div>
    );
}
