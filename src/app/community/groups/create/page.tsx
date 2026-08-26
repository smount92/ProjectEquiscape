"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createGroup, uploadGroupBanner } from "@/app/actions/groups";
import BannerCropModal from "@/components/groups/BannerCropModal";

import { GROUP_TYPE_LABELS } from "@/lib/constants/groups";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import FocusLayout from "@/components/layouts/FocusLayout";
import PageMasthead from "@/components/layouts/PageMasthead";
import { Button } from "@/components/ui/button";

// ============================================================
// START A BARN — name, description, privacy. Nothing else is
// required to open the doors; type and region are optional colour.
// ============================================================

export default function CreateGroupPage() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [description, setDescription] = useState("");
    const [groupType, setGroupType] = useState("general");
    const [region, setRegion] = useState("");
    const [isPrivate, setIsPrivate] = useState(false);
    const [saving, setSaving] = useState(false);
    // Banner: uploaded on selection, PATH held until submit — an
    // abandoned form leaves at most one orphaned image, never a half-
    // configured barn.
    const [bannerPath, setBannerPath] = useState<string | null>(null);
    const [bannerPreview, setBannerPreview] = useState<string | null>(null);
    const [bannerBusy, setBannerBusy] = useState(false);
    const [pendingBannerFile, setPendingBannerFile] = useState<File | null>(null);
    const [error, setError] = useState("");

    function autoSlug(value: string) {
        setName(value);
        setSlug(
            value
                .toLowerCase()
                .replace(/[^a-z0-9-]/g, "-")
                .replace(/-+/g, "-")
                .replace(/^-|-$/g, ""),
        );
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setError("");

        const result = await createGroup({
            name: name.trim(),
            slug,
            description: description.trim() || undefined,
            groupType,
            region: region.trim() || undefined,
            isPrivate,
            bannerPath: bannerPath ?? undefined,
        });

        if (result.success && result.slug) {
            router.push(`/community/groups/${result.slug}`);
        } else {
            setError(result.error || "Failed to create barn");
            setSaving(false);
        }
    }

    return (
        <FocusLayout noHeader>
            <PageMasthead compact icon="🏚️" title="Start a Barn" backHref="/community/groups" backLabel="Barns" />
            <form onSubmit={handleSubmit}>
                <div className="mb-6">
                    <label className="text-foreground mb-1 block text-sm font-semibold">Barn Name *</label>
                    <Input
                        value={name}
                        onChange={(e) => autoSlug(e.target.value)}
                        placeholder="Pacific Northwest Model Horse Collectors"
                        required
                    />
                </div>

                <div className="mb-6">
                    <label className="text-foreground mb-1 block text-sm font-semibold">URL Slug</label>
                    <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="pnw-collectors" />
                    <small className="text-muted-foreground">
                        modelhorsehub.com/community/groups/{slug || "your-slug"}
                    </small>
                </div>

                <div className="mb-6">
                    <label className="text-foreground mb-1 block text-sm font-semibold">Description</label>
                    <Textarea
                        className="w-full resize-y"
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="What is this barn about?"
                    />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="mb-6">
                        <label className="text-foreground mb-1 block text-sm font-semibold">Barn Type *</label>
                        <select
                            className="border-input bg-card ring-offset-background focus:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none"
                            value={groupType}
                            onChange={(e) => setGroupType(e.target.value)}
                            title="Barn type"
                        >
                            {Object.entries(GROUP_TYPE_LABELS).map(([key, label]) => (
                                <option key={key} value={key}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="mb-6">
                        <label className="text-foreground mb-1 block text-sm font-semibold">Region</label>
                        <Input
                            value={region}
                            onChange={(e) => setRegion(e.target.value)}
                            placeholder="e.g. Pacific Northwest"
                        />
                    </div>
                </div>

                <div className="mb-6">
                    <label className="text-foreground mb-1 block text-sm font-semibold">Privacy</label>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            className={`studio-status-btn ${!isPrivate ? "active-open" : ""}`}
                            onClick={() => setIsPrivate(false)}
                            aria-pressed={!isPrivate}
                        >
                            🌐 Public
                        </button>
                        <button
                            type="button"
                            className={`studio-status-btn ${isPrivate ? "active-closed" : ""}`}
                            onClick={() => setIsPrivate(true)}
                            aria-pressed={isPrivate}
                        >
                            🔒 Private
                        </button>
                    </div>
                    <small className="text-muted-foreground mt-1 block">
                        {isPrivate
                            ? "Listed in the directory with a Private badge. The notice board and member list stay hidden, and joining needs your approval."
                            : "Anyone can find this barn, read the notice board, and join."}
                    </small>
                </div>

                {/* Banner image — the face of the card in the directory. */}
                <div className="mt-4">
                    <label className="text-foreground mb-1 block text-sm font-semibold" htmlFor="barn-banner">
                        Banner image <span className="text-muted-foreground font-normal">(optional)</span>
                    </label>
                    {bannerPreview && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={bannerPreview}
                            alt="Banner preview"
                            className="border-input mb-2 aspect-[4/1] h-auto w-full rounded-md border object-cover"
                        />
                    )}
                    <input
                        id="barn-banner"
                        type="file"
                        accept="image/*"
                        disabled={bannerBusy}
                        className="text-sm"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            // Crop first — the upload is the framed 4:1 result.
                            if (file) setPendingBannerFile(file);
                            e.target.value = "";
                        }}
                    />
                    {pendingBannerFile && (
                        <BannerCropModal
                            file={pendingBannerFile}
                            onCancel={() => setPendingBannerFile(null)}
                            onCropped={(cropped) => {
                                setPendingBannerFile(null);
                                void (async () => {
                                    setBannerBusy(true);
                                    setError("");
                                    const fd = new FormData();
                                    fd.set("banner", cropped);
                                    const up = await uploadGroupBanner(fd);
                                    if (up.success && up.path) {
                                        setBannerPath(up.path);
                                        setBannerPreview(up.url ?? null);
                                    } else {
                                        setError(up.error || "Could not upload that image.");
                                    }
                                    setBannerBusy(false);
                                })();
                            }}
                        />
                    )}
                    <small className="text-muted-foreground mt-1 block">
                        Shown across the top of your barn&rsquo;s card. Under 3MB.
                    </small>
                </div>

                {error && (
                    <p className="text-destructive border-destructive/30 bg-destructive/10 mt-2 flex items-center gap-2 rounded-md border px-4 py-2 text-sm">
                        {error}
                    </p>
                )}

                <div className="mt-6 flex gap-2">
                    <Button type="submit" disabled={saving || !name.trim()}>
                        {saving ? "Raising the barn..." : "Start Barn"}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="wide"
                        onClick={() => router.push("/community/groups")}
                    >
                        Cancel
                    </Button>
                </div>
            </form>
        </FocusLayout>
    );
}
