"use client";

/**
 * The customization editor.
 *
 * Lives on its own route (/profile/customize) rather than inside
 * /settings, which is a different agent's surface. It follows the
 * settings idiom all the same: local state per field, an explicit
 * Save, and a `{ success, error }` result rendered inline.
 *
 * The theme picker previews on a real leather band rather than a row
 * of colour dots, because the only question a member actually has is
 * "what will my profile look like" — and the band is the answer.
 */

import Link from "next/link";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveProfileCustomization, uploadProfileBanner } from "@/app/actions/profile";
import {
    MAX_FEATURED,
    MAX_PRONOUNS,
    MAX_TAGLINE,
    PROFILE_SECTIONS,
    PROFILE_THEMES,
    SECTION_LABELS,
    themeStyle,
    type ProfileCustomization,
    type ProfileSection,
} from "@/app/profile/customization";

export default function ProfileCustomizer({
    alias,
    initial,
    initialBannerUrl,
    horses,
    available,
}: {
    alias: string;
    initial: ProfileCustomization;
    initialBannerUrl: string | null;
    horses: { id: string; name: string }[];
    /** False until migration 171 is applied — the form goes read-only. */
    available: boolean;
}) {
    const [theme, setTheme] = useState(initial.theme);
    const [tagline, setTagline] = useState(initial.tagline ?? "");
    const [pronouns, setPronouns] = useState(initial.pronouns ?? "");
    const [bannerPath, setBannerPath] = useState(initial.bannerPath);
    const [bannerUrl, setBannerUrl] = useState(initialBannerUrl);
    const [featured, setFeatured] = useState<string[]>(initial.featured);
    const [hidden, setHidden] = useState<ProfileSection[]>(initial.hidden);

    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
    const [uploading, setUploading] = useState(false);
    const [pending, startTransition] = useTransition();

    const toggleFeatured = (id: string) => {
        setFeatured((current) =>
            current.includes(id)
                ? current.filter((h) => h !== id)
                : current.length >= MAX_FEATURED
                  ? current
                  : [...current, id],
        );
    };

    const toggleSection = (section: ProfileSection) => {
        setHidden((current) =>
            current.includes(section)
                ? current.filter((s) => s !== section)
                : [...current, section],
        );
    };

    const handleBanner = async (file: File) => {
        setUploading(true);
        setMessage(null);
        const formData = new FormData();
        formData.set("banner", file);
        const result = await uploadProfileBanner(formData);
        setUploading(false);
        if (!result.success) {
            setMessage({ ok: false, text: result.error ?? "Upload failed." });
            return;
        }
        setBannerPath(result.path ?? null);
        setBannerUrl(result.url ?? null);
        setMessage({ ok: true, text: "Banner uploaded — press Save to publish it." });
    };

    const handleSave = () => {
        setMessage(null);
        startTransition(async () => {
            const result = await saveProfileCustomization({
                theme,
                tagline,
                pronouns,
                bannerPath,
                featured,
                hidden,
            } satisfies Record<keyof ProfileCustomization, unknown>);
            setMessage(
                result.success
                    ? { ok: true, text: "Saved — your profile is updated." }
                    : { ok: false, text: result.error ?? "Could not save." },
            );
        });
    };

    const busy = pending || uploading;

    return (
        <div className="flex flex-col gap-8">
            {!available && (
                <div className="border-input bg-card/60 rounded-lg border p-4 text-sm backdrop-blur-sm">
                    <strong>Not switched on yet.</strong> Profile customization needs migration 171.
                    You can look around, but saving will not stick until it is applied.
                </div>
            )}

            {/* ── Theme ── */}
            <section>
                <h2 className="mb-1 font-serif text-lg font-bold">Trim</h2>
                <p className="text-secondary-foreground mb-4 text-sm">
                    Six leather-and-hardware pairings. They restyle the trim only — the lettering
                    stays on the same cream ramp, so every choice reads the same in Lamplight, and
                    Simple Mode flattens all of them to the standard panel.
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {PROFILE_THEMES.map((option) => {
                        const active = option.id === theme;
                        return (
                            <button
                                key={option.id}
                                type="button"
                                onClick={() => setTheme(option.id)}
                                aria-pressed={active ? "true" : "false"}
                                className={`leather-panel stitched relative cursor-pointer rounded-[12px] px-4 py-4 text-left ${
                                    active ? "outline-2 outline-offset-2 outline-(--brass-hi)" : ""
                                }`}
                                style={themeStyle(option.id) ?? { ["--x" as string]: "0" }}
                            >
                                <span className="text-engraved-light block font-serif text-sm font-bold tracking-[0.14em] uppercase">
                                    {option.label}
                                </span>
                                <span className="mt-1 block text-xs text-(--leather-text-soft)">
                                    {option.blurb}
                                </span>
                                {active && (
                                    <span className="mt-2 inline-block text-[0.6rem] font-bold tracking-[0.18em] text-(--brass-hi) uppercase">
                                        ✓ Selected
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </section>

            {/* ── Nameplate ── */}
            <section>
                <h2 className="mb-1 font-serif text-lg font-bold">Nameplate</h2>
                <p className="text-secondary-foreground mb-4 text-sm">
                    A short line under your alias, and how you like to be referred to. Your bio stays
                    where it is — this is the one-liner above it.
                </p>
                <div className="flex flex-col gap-4">
                    <label className="flex flex-col gap-1">
                        <span className="text-sm font-semibold">Tagline</span>
                        <Input
                            value={tagline}
                            maxLength={MAX_TAGLINE}
                            placeholder="Chasing a NAN card since 2019"
                            onChange={(e) => setTagline(e.target.value)}
                        />
                        <span className="text-xs text-muted-foreground">
                            {tagline.length}/{MAX_TAGLINE}
                        </span>
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className="text-sm font-semibold">Pronouns</span>
                        <Input
                            value={pronouns}
                            maxLength={MAX_PRONOUNS}
                            placeholder="she/her"
                            onChange={(e) => setPronouns(e.target.value)}
                        />
                    </label>
                </div>
            </section>

            {/* ── Banner ── */}
            <section>
                <h2 className="mb-1 font-serif text-lg font-bold">Banner</h2>
                <p className="text-secondary-foreground mb-4 text-sm">
                    An optional photo behind your nameplate. It sits under a scrim so your name stays
                    readable whatever the picture — a bright shot will look moody, and that is on
                    purpose. Max 3MB.
                </p>
                {bannerUrl && (
                    <div className="border-input mb-3 overflow-hidden rounded-lg border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={bannerUrl} alt="Your banner" className="h-32 w-full object-cover" />
                    </div>
                )}
                <div className="flex flex-wrap items-center gap-3">
                    <input
                        id="banner-input"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        aria-label="Upload profile banner"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void handleBanner(file);
                        }}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        onClick={() => document.getElementById("banner-input")?.click()}
                    >
                        {uploading ? "Uploading…" : bannerUrl ? "Replace banner" : "Choose an image"}
                    </Button>
                    {bannerPath && (
                        <Button
                            type="button"
                            variant="outline"
                            disabled={busy}
                            onClick={() => {
                                setBannerPath(null);
                                setBannerUrl(null);
                            }}
                        >
                            Remove
                        </Button>
                    )}
                </div>
            </section>

            {/* ── Featured horses ── */}
            <section>
                <h2 className="mb-1 font-serif text-lg font-bold">Featured horses</h2>
                <p className="text-secondary-foreground mb-4 text-sm">
                    Pick up to {MAX_FEATURED} to lead your stable, in the order you choose them.
                    Leave it empty and the shelf auto-picks by show record.
                </p>
                {horses.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        You have no public horses yet — make one public and it will show up here.
                    </p>
                ) : (
                    <div className="border-input max-h-64 overflow-y-auto rounded-lg border">
                        {horses.map((horse) => {
                            const index = featured.indexOf(horse.id);
                            const picked = index >= 0;
                            return (
                                <label
                                    key={horse.id}
                                    className="border-input flex cursor-pointer items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0"
                                >
                                    <input
                                        type="checkbox"
                                        checked={picked}
                                        className="h-4 w-4 accent-(--brass)"
                                        onChange={() => toggleFeatured(horse.id)}
                                    />
                                    <span className="flex-1">{horse.name}</span>
                                    {picked && <span className="stamp">#{index + 1}</span>}
                                </label>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* ── Sections ── */}
            <section>
                <h2 className="mb-1 font-serif text-lg font-bold">Sections</h2>
                <p className="text-secondary-foreground mb-4 text-sm">
                    Switch off anything you would rather not show. Your stable and your nameplate
                    always stay.
                </p>
                <div>
                    {PROFILE_SECTIONS.map((section) => {
                        const shown = !hidden.includes(section);
                        return (
                            <div
                                key={section}
                                className="border-input flex items-center justify-between gap-4 border-b py-3 first:pt-0 last:border-b-0 last:pb-0 max-sm:gap-2"
                            >
                                <span className="text-sm">{SECTION_LABELS[section]}</span>
                                <button
                                    type="button"
                                    className={shown ? "settings-toggle-active" : "settings-toggle"}
                                    onClick={() => toggleSection(section)}
                                    aria-pressed={shown ? "true" : "false"}
                                    aria-label={`Show ${SECTION_LABELS[section]} on my profile`}
                                    title={`Show ${SECTION_LABELS[section]} on my profile`}
                                />
                            </div>
                        );
                    })}
                </div>
            </section>

            <div className="border-input flex flex-wrap items-center gap-4 border-t pt-6">
                <Button type="button" size="wide" disabled={busy} onClick={handleSave}>
                    {pending ? "Saving…" : "Save profile"}
                </Button>
                <Button asChild variant="outline">
                    <Link href={`/profile/${encodeURIComponent(alias)}`}>View my profile →</Link>
                </Button>
                {message && (
                    <span
                        className={`text-sm ${message.ok ? "text-forest" : "text-destructive"}`}
                        role="status"
                    >
                        {message.text}
                    </span>
                )}
            </div>
        </div>
    );
}
